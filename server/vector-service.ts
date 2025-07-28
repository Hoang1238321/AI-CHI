import OpenAI from 'openai';
import { createRequire } from 'module';
import { db } from './db';
import { documentChunks, documents, temporaryDocumentChunks, temporaryDocuments, transcriptChunks, videos } from '@shared/schema';
import { eq, and, isNotNull, count, inArray, desc, lt } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

export interface VectorSearchResult {
  chunkId: number;
  documentId: number;
  content: string;
  similarity: number;
  isTemporary?: boolean;
  timestamp?: Date;
}

export interface VideoSearchResult {
  videoId: number;
  fileName: string;
  googleDriveId: string;
  contentPreview: string;
  similarity: number;
  transcriptMatch: string;
  uploaderUserId: number; // Track who uploaded the video
}

export interface DocumentSearchResult {
  documentId: number;
  fileName: string;
  content: string;
  similarity: number;
  chunkMatch: string;
  uploaderUserId: number;
}

export class VectorService {
  private openai: OpenAI;
  private faissIndex: any = null;
  private chunkIds: number[] = []; // Maps FAISS index positions to chunk IDs
  private chunkSubjects: string[] = []; // Maps FAISS index positions to subject IDs
  private chunkTimestamps: Date[] = []; // Maps FAISS index positions to timestamps
  private isTemporary: boolean[] = []; // Maps FAISS index positions to temporary status
  private chunkUserIds: number[] = []; // Maps FAISS index positions to user IDs for temporary chunks
  private chunkSessionIds: (number | null)[] = []; // Maps FAISS index positions to session IDs for temporary chunks
  private chunkIsExercise: boolean[] = []; // Maps FAISS index positions to exercise status
  private chunkTypes: string[] = []; // Maps FAISS index positions to chunk types
  private chunkQuestionNumbers: (number | null)[] = []; // Maps FAISS index positions to question numbers
  private chunkContents: string[] = []; // Maps FAISS index positions to content for reranking

  // Public getters for route access
  public getChunkIds(): number[] { return this.chunkIds; }
  public getChunkIsExercise(): boolean[] { return this.chunkIsExercise; }
  private initialized = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private serverStartTime = Date.now();

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  /**
   * Detect if the query contains vague terms that likely refer to recently uploaded documents
   */
  private isVagueQuery(query: string): boolean {
    const vietnameseVagueTerms = [
      // Demonstrative pronouns
      'này', 'kia', 'nọ', 'đó', 'đây',
      // Recent references
      'vừa rồi', 'vừa', 'mới', 'vừa mới', 'vừa xong', 
      'tài liệu vừa', 'file vừa', 'document vừa',
      // General references  
      'tài liệu', 'file', 'document', 'cái', 'thứ',
      'nội dung', 'văn bản', 'bài',
      // Question words with vague context
      'cái gì', 'gì', 'như thế nào', 'ra sao',
      // Recent actions
      'upload', 'tải lên', 'gửi', 'đưa lên', 'post'
    ];
    
    const queryLower = query.toLowerCase();
    return vietnameseVagueTerms.some(term => queryLower.includes(term));
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🔮 Generating embedding for text (${text.length} chars)...`);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        input: text.trim(),
        encoding_format: 'float',
      });

      const embedding = response.data[0].embedding;
      console.log(`✅ Generated embedding with ${embedding.length} dimensions`);
      
      return embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Add embedding to document chunk
   */
  async addEmbeddingToChunk(chunkId: number, content: string, isTemporary: boolean = false): Promise<void> {
    try {
      console.log(`📝 Adding embedding to ${isTemporary ? 'temporary' : 'permanent'} chunk ${chunkId}...`);
      
      const embedding = await this.generateEmbedding(content);
      const embeddingJson = JSON.stringify(embedding);
      
      if (isTemporary) {
        await db
          .update(temporaryDocumentChunks)
          .set({ 
            embedding: embeddingJson,
            embeddingModel: 'text-embedding-3-small'
          })
          .where(eq(temporaryDocumentChunks.id, chunkId));
      } else {
        await db
          .update(documentChunks)
          .set({ 
            embedding: embeddingJson,
            embeddingModel: 'text-embedding-3-small'
          })
          .where(eq(documentChunks.id, chunkId));
      }
      
      console.log(`✅ Added embedding to ${isTemporary ? 'temporary' : 'permanent'} chunk ${chunkId}`);
    } catch (error) {
      console.error(`❌ Error adding embedding to chunk ${chunkId}:`, error);
      throw error;
    }
  }

  /**
   * Process all chunks without embeddings
   */
  async processAllChunks(): Promise<void> {
    try {
      console.log('🔄 Processing all chunks without embeddings...');
      
      // Get all chunks without embeddings
      const chunks = await db
        .select()
        .from(documentChunks)
        .where(eq(documentChunks.embedding, null));
      
      console.log(`📊 Found ${chunks.length} chunks without embeddings`);
      
      for (const chunk of chunks) {
        await this.addEmbeddingToChunk(chunk.id, chunk.content);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`✅ Processed ${chunks.length} chunks`);
    } catch (error) {
      console.error('❌ Error processing chunks:', error);
      throw error;
    }
  }

  /**
   * Force clear and rebuild FAISS index
   */
  public clearIndex(): void {
    this.initialized = false;
    this.faissIndex = null;
    this.chunkIds = [];
    this.chunkSubjects = [];
    this.chunkTimestamps = [];
    this.isTemporary = [];
    this.chunkUserIds = [];
    this.chunkSessionIds = [];
    this.chunkIsExercise = [];
    this.chunkTypes = [];
    this.chunkQuestionNumbers = [];
    this.chunkContents = [];
    console.log('🔄 FAISS index cleared');
  }

  /**
   * Initialize or rebuild FAISS index
   */
  async initializeFAISSIndex(): Promise<void> {
    try {
      console.log('🏗️ Initializing FAISS index...');
      
      // Get all permanent chunks with embeddings and their document subjects
      const permanentChunks = await db
        .select({
          id: documentChunks.id,
          embedding: documentChunks.embedding,
          subjectId: documents.subjectId,
          uploadedAt: documents.uploadedAt,
          userId: documents.userId,
          isExercise: documents.isExercise,
          chunkType: documentChunks.chunkType,
          questionNumber: documentChunks.questionNumber,
          content: documentChunks.content
        })
        .from(documentChunks)
        .innerJoin(documents, eq(documentChunks.documentId, documents.id))
        .where(isNotNull(documentChunks.embedding))
        .orderBy(desc(documents.uploadedAt)); // Most recent first

      // Get all temporary chunks with embeddings and their document subjects  
      const tempChunks = await db
        .select({
          id: temporaryDocumentChunks.id,
          embedding: temporaryDocumentChunks.embedding,
          subjectId: temporaryDocuments.subjectId,
          uploadedAt: temporaryDocuments.uploadedAt,
          userId: temporaryDocumentChunks.userId,
          sessionId: temporaryDocumentChunks.sessionId,
          isExercise: temporaryDocuments.isExercise,
          chunkType: temporaryDocumentChunks.chunkType,
          questionNumber: temporaryDocumentChunks.questionNumber,
          content: temporaryDocumentChunks.content
        })
        .from(temporaryDocumentChunks)
        .innerJoin(temporaryDocuments, eq(temporaryDocumentChunks.documentId, temporaryDocuments.id))
        .where(isNotNull(temporaryDocumentChunks.embedding))
        .orderBy(desc(temporaryDocuments.uploadedAt)); // Most recent first

      // Get all transcript chunks with embeddings from videos
      const { transcriptChunks, videos } = await import('../shared/schema');
      const { sql, and } = await import('drizzle-orm');
      const videoTranscriptChunks = await db
        .select({
          id: transcriptChunks.id,
          embedding: transcriptChunks.embedding,
          subjectId: videos.subjectId,
          uploadedAt: videos.processedAt, // Use processedAt as timestamp
          userId: videos.userId,
          sessionId: sql<number | null>`NULL::integer` // Transcript chunks don't have session IDs
        })
        .from(transcriptChunks)
        .innerJoin(videos, eq(transcriptChunks.videoId, videos.id))
        .where(and(isNotNull(transcriptChunks.embedding), isNotNull(videos.processedAt)))
        .orderBy(desc(videos.processedAt)); // Most recent first

      // Combine all chunks - temporary chunks first (more priority), then transcript chunks, then permanent chunks
      const allChunks = [
        ...tempChunks.map(chunk => ({ 
          ...chunk, 
          isTemporary: true, 
          isTranscript: false,
          isExercise: chunk.isExercise || false,
          chunkType: chunk.chunkType || 'standard',
          questionNumber: chunk.questionNumber
        })),
        ...videoTranscriptChunks.map(chunk => ({ 
          ...chunk, 
          isTemporary: false, 
          isTranscript: true, 
          sessionId: null,
          isExercise: false,
          chunkType: 'transcript',
          questionNumber: null,
          content: ''
        })),
        ...permanentChunks.map(chunk => ({ 
          ...chunk, 
          isTemporary: false, 
          isTranscript: false, 
          sessionId: null,
          isExercise: chunk.isExercise || false,
          chunkType: chunk.chunkType || 'standard',
          questionNumber: chunk.questionNumber
        }))
      ];
      
      if (allChunks.length === 0) {
        console.log('⚠️ No chunks with embeddings found');
        return;
      }
      
      console.log(`📊 Building index with ${tempChunks.length} temporary + ${videoTranscriptChunks.length} transcript + ${permanentChunks.length} permanent = ${allChunks.length} total chunks...`);
      
      // Parse embeddings and build arrays
      const embeddings: number[][] = [];
      this.chunkIds = [];
      this.chunkSubjects = [];
      this.chunkTimestamps = [];
      this.isTemporary = [];
      this.chunkUserIds = [];
      this.chunkSessionIds = [];
      this.chunkIsExercise = [];
      this.chunkTypes = [];
      this.chunkQuestionNumbers = [];
      this.chunkContents = [];
      
      // Use Set to track unique chunk identifiers and prevent duplicates
      const seenChunks = new Set<string>();
      
      for (const chunk of allChunks) {
        try {
          const embedding = JSON.parse(chunk.embedding!);
          if (Array.isArray(embedding) && embedding.length > 0) {
            // Create unique identifier for chunk: "temp_ID" or "perm_ID"
            const chunkIdentifier = `${chunk.isTemporary ? 'temp' : 'perm'}_${chunk.id}`;
            
            // Skip if we've already seen this chunk
            if (seenChunks.has(chunkIdentifier)) {
              console.log(`⚠️ Skipping duplicate chunk: ${chunkIdentifier}`);
              continue;
            }
            seenChunks.add(chunkIdentifier);
            
            embeddings.push(embedding);
            this.chunkIds.push(chunk.id);
            this.chunkSubjects.push(chunk.subjectId);
            this.chunkTimestamps.push(new Date(chunk.uploadedAt));
            this.isTemporary.push(chunk.isTemporary);
            this.chunkUserIds.push(chunk.userId);
            this.chunkSessionIds.push(chunk.sessionId || null);
            this.chunkIsExercise.push(chunk.isExercise);
            this.chunkTypes.push(chunk.chunkType);
            this.chunkQuestionNumbers.push(chunk.questionNumber || null);
            this.chunkContents.push(chunk.content || '');
            
            // Debug log for each chunk added to index
            console.log(`📋 Added chunk ${chunk.id} to index: isTemp=${chunk.isTemporary}, subject=${chunk.subjectId}, user=${chunk.userId}, session=${chunk.sessionId}, uploaded=${chunk.uploadedAt}`);
          } else {
            console.error(`❌ Invalid embedding format for chunk ${chunk.id}`);
          }
        } catch (error) {
          console.error(`❌ Error parsing embedding for chunk ${chunk.id}:`, error);
        }
      }
      
      if (embeddings.length === 0) {
        console.log('⚠️ No valid embeddings found');
        return;
      }
      
      // Create FAISS index using require (CommonJS)
      const dimension = embeddings[0].length;
      console.log(`📐 Creating FAISS index with dimension ${dimension}...`);
      
      const { IndexFlatL2 } = require('faiss-node');
      this.faissIndex = new IndexFlatL2(dimension);
      
      // Add embeddings to index as matrix
      const flatEmbeddings = embeddings.flat();
      this.faissIndex.add(flatEmbeddings);
      
      this.initialized = true;
      console.log(`✅ FAISS index initialized with ${embeddings.length} vectors`);
      
    } catch (error) {
      console.error('❌ Error initializing FAISS index:', error);
      throw error;
    }
  }

  /**
   * Simple vector search without reranking - let DeepSeek evaluate relevance in prompt
   */
  async searchSimilarChunksWithAI(
    query: string, 
    subjectId: string,
    currentUserId?: number,
    currentSessionId?: number
  ): Promise<VectorSearchResult[]> {
    try {
      console.log(`🔍 Simple vector search: "${query}" in subject ${subjectId}`);
      
      // Direct vector search without reranking
      const results = await this.searchSimilarChunks(query, 10, subjectId, currentUserId, currentSessionId);
      
      if (results.length === 0) {
        console.log('⚠️ No results found');
        return [];
      }
      
      // Log exercise context for prompting  
      const topResult = results[0];
      if (topResult) {
        const index = this.chunkIds.indexOf(topResult.chunkId);
        const isTopExercise = index >= 0 ? this.chunkIsExercise[index] : false;
        if (isTopExercise) {
          console.log(`📚 Top result is from exercise - DeepSeek will evaluate relevance`);
        }
      }
      
      console.log(`🎯 Found ${results.length} vector search results - DeepSeek will self-evaluate relevance`);
      return results.slice(0, 5); // Return top 5 results
      
    } catch (error) {
      console.error('❌ Error in simple vector search:', error);
      // Fallback to basic search
      return this.searchSimilarChunks(query, 5, subjectId, currentUserId, currentSessionId);
    }
  }

  /**
   * Traditional vector search (fallback)
   */
  async searchSimilarChunks(
    query: string, 
    topK: number = 5, 
    subjectId?: string,
    currentUserId?: number,
    currentSessionId?: number,
    isVideoContext: boolean = false
  ): Promise<VectorSearchResult[]> {
    try {
      console.log(`🔍 Searching for similar chunks: "${query.substring(0, 50)}..."`);
      
      if (!this.initialized || !this.faissIndex) {
        console.log('🏗️ FAISS index not initialized, initializing now...');
        await this.initializeFAISSIndex();
      }
      
      if (!this.faissIndex || this.chunkIds.length === 0) {
        console.log('⚠️ No FAISS index or chunks available');
        return [];
      }
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search FAISS index - get ALL chunks to ensure temporary ones are included
      const searchK = this.chunkIds.length; // Get ALL results to guarantee temporary chunks are found
      console.log(`🔍 Searching with topK=${topK}, searchK=${searchK}, totalChunks=${this.chunkIds.length}`);
      
      const searchResults = this.faissIndex.search(
        queryEmbedding, 
        searchK
      );
      
      const { distances, labels } = searchResults;
      
      // Get chunk details from database (both permanent and temporary)
      const chunkIds = Array.from(labels).map(label => this.chunkIds[label]);
      console.log(`🔎 Looking for chunks with IDs:`, chunkIds);
      
      // Separate permanent and temporary chunk IDs based on FAISS index
      const permanentChunkIds: number[] = [];
      const temporaryChunkIds: number[] = [];
      
      for (let i = 0; i < labels.length; i++) {
        const faissIndex = labels[i];
        const chunkId = this.chunkIds[faissIndex];
        const isTemp = this.isTemporary[faissIndex];
        
        if (isTemp) {
          temporaryChunkIds.push(chunkId);
        } else {
          permanentChunkIds.push(chunkId);
        }
      }
      
      console.log(`🔍 Separated chunks: ${temporaryChunkIds.length} temporary, ${permanentChunkIds.length} permanent`);
      
      // Get permanent chunk details
      let permanentChunks: any[] = [];
      if (permanentChunkIds.length > 0) {
        if (subjectId) {
          permanentChunks = await db
            .select({
              id: documentChunks.id,
              documentId: documentChunks.documentId,
              content: documentChunks.content,
              subjectId: documents.subjectId,
            })
            .from(documentChunks)
            .innerJoin(documents, eq(documentChunks.documentId, documents.id))
            .where(
              and(
                inArray(documentChunks.id, permanentChunkIds),
                eq(documents.subjectId, subjectId)
              )
            );
        } else {
          permanentChunks = await db
            .select({
              id: documentChunks.id,
              documentId: documentChunks.documentId,
              content: documentChunks.content,
            })
            .from(documentChunks)
            .where(inArray(documentChunks.id, permanentChunkIds));
        }
      }
      
      // Get temporary chunk details  
      let temporaryChunks: any[] = [];
      if (temporaryChunkIds.length > 0) {
        if (subjectId) {
          temporaryChunks = await db
            .select({
              id: temporaryDocumentChunks.id,
              documentId: temporaryDocumentChunks.documentId,
              content: temporaryDocumentChunks.content,
              subjectId: temporaryDocuments.subjectId,
            })
            .from(temporaryDocumentChunks)
            .innerJoin(temporaryDocuments, eq(temporaryDocumentChunks.documentId, temporaryDocuments.id))
            .where(
              and(
                inArray(temporaryDocumentChunks.id, temporaryChunkIds),
                eq(temporaryDocuments.subjectId, subjectId)
              )
            );
        } else {
          temporaryChunks = await db
            .select({
              id: temporaryDocumentChunks.id,
              documentId: temporaryDocumentChunks.documentId,
              content: temporaryDocumentChunks.content,
            })
            .from(temporaryDocumentChunks)
            .where(inArray(temporaryDocumentChunks.id, temporaryChunkIds));
        }
      }
      
      // Combine all chunks
      const chunks = [...permanentChunks, ...temporaryChunks];
      console.log(`📊 Found ${permanentChunks.length} permanent + ${temporaryChunks.length} temporary = ${chunks.length} total chunks`);
      
      console.log(`🎯 Found ${distances.length} similar chunks`);
      console.log('🔍 Distance results:', distances);
      console.log('🔍 Label results:', labels);
      console.log('🔍 ChunkIds mapping:', this.chunkIds);
      console.log('🔍 IsTemporary mapping:', this.isTemporary);
      console.log('🔍 ChunkTimestamps mapping:', this.chunkTimestamps.map(t => t.toISOString()));
      
      // Debug: Show what each returned label maps to
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const chunkId = this.chunkIds[label];
        const isTemp = this.isTemporary[label];
        const timestamp = this.chunkTimestamps[label];
        console.log(`🔍 Label ${label} → Chunk ${chunkId}, isTemp: ${isTemp}, timestamp: ${timestamp.toISOString()}`);
      }
      
      // Map results with similarity scores and timestamp weighting
      const results: VectorSearchResult[] = [];
      
      for (let i = 0; i < distances.length; i++) {
        const chunkId = this.chunkIds[labels[i]];
        const chunkSubjectId = this.chunkSubjects[labels[i]];
        
        // Apply timestamp weighting - more recent documents get higher scores
        const chunkTimestamp = this.chunkTimestamps[labels[i]];
        const isTemp = this.isTemporary[labels[i]];
        const now = new Date();
        const ageInMinutes = (now.getTime() - chunkTimestamp.getTime()) / (1000 * 60);
        const ageInHours = ageInMinutes / 60;
        let timeWeight = 1.0;
        
        // MASSIVE boost for very recent documents (< 2 minutes) - especially for vague queries
        const isVagueQuery = this.isVagueQuery(query);
        
        if (ageInMinutes < 2) {
          timeWeight = isVagueQuery ? 5.0 : 3.0; // 500% for vague queries, 300% for specific ones
        } else if (ageInMinutes < 5) {
          timeWeight = isVagueQuery ? 4.0 : 2.5; // 400% for vague queries, 250% for specific ones
        } else if (ageInMinutes < 15) {
          timeWeight = isVagueQuery ? 3.0 : 2.0; // 300% for vague queries, 200% for specific ones
        } else if (ageInHours < 1) {
          timeWeight = 1.5; // 50% boost for very recent
        } else if (ageInHours < 24) {
          timeWeight = 1.2; // 20% boost for recent
        } else if (ageInHours < 168) { // 1 week
          timeWeight = Math.max(0.5, 1 - (ageInHours / (24 * 30))); // Decay over time
        } else {
          timeWeight = Math.max(0.5, 1 - (ageInHours / (24 * 30))); // Decay over 30 days, minimum 0.5
        }
        
        // Additional boost for temporary documents (20% more priority)
        if (isTemp) {
          timeWeight *= 1.2;
        }
        
        // Improved similarity calculation: cosine similarity from L2 distance
        const baseSimilarity = Math.max(0, 1 - (distances[i] / 2));
        let weightedSimilarity = baseSimilarity * timeWeight;
        
        // Check if this chunk is from transcript (for video context boost)
        const isFromTranscript = await this.isTranscriptChunk(chunkId);
        
        // Enhanced similarity boost for transcript chunks in video context
        if (isVideoContext && isFromTranscript) {
          weightedSimilarity *= 1.35; // 35% boost for transcript chunks in video context
          console.log(`🎬 Video transcript boost applied: ${weightedSimilarity.toFixed(3)}`);
        }
        
        // Threshold logic: temporary documents get low threshold only for first 3 minutes
        let threshold = isTemp ? 0.50 : 0.35; // Default: temporary docs use normal threshold after 3 minutes
        
        // Lower threshold for transcript chunks in video context
        if (isVideoContext && isFromTranscript) {
          threshold *= 0.80; // 20% lower threshold for transcript chunks
        }
        
        // EXTREMELY low threshold for very recent temporary documents (< 3 minutes)
        if (isTemp && ageInMinutes < 1) {
          threshold = 0.01; // Almost accept any temporary document uploaded < 1 minute
        } else if (isTemp && ageInMinutes < 3) {
          threshold = 0.02; // Very low for < 3 minutes
        }
        // After 3 minutes, temporary documents use normal threshold (0.5)
        
        // Additional reduction for vague queries on very recent temporary documents
        if (isTemp && ageInMinutes < 3 && this.isVagueQuery(query)) {
          threshold *= 0.5; // Cut threshold in half for vague queries on recent temp docs
        }
        
        console.log(`🔎 Similarity check: chunk ${chunkId}, baseSim=${baseSimilarity.toFixed(3)}, timeWeight=${timeWeight.toFixed(3)}, weightedSim=${weightedSimilarity.toFixed(3)}, isTemp=${isTemp}, age=${ageInMinutes.toFixed(1)}min, vague=${this.isVagueQuery(query)}, threshold=${threshold.toFixed(3)}`);
        
        if (weightedSimilarity >= threshold) {
          // Skip chunks from different subjects if subjectId filter is provided
          if (subjectId && chunkSubjectId !== subjectId) {
            console.log(`🚫 Skipping chunk ${chunkId} from different subject: ${chunkSubjectId} vs ${subjectId}`);
            continue;
          }

          // For temporary chunks, only include if they belong to the current user
          if (isTemp && currentUserId) {
            const chunkUserId = this.chunkUserIds[labels[i]];
            const chunkSessionId = this.chunkSessionIds[labels[i]];
            
            // Must match user
            if (chunkUserId !== currentUserId) {
              console.log(`🚫 Skipping temporary chunk ${chunkId}: user mismatch (${chunkUserId} !== ${currentUserId})`);
              continue;
            }
            
            // For temporary chunks: allow if no session set (recent uploads) OR if session matches
            if (currentSessionId && chunkSessionId && chunkSessionId !== currentSessionId) {
              // Allow very recent chunks (< 5 minutes) even with session mismatch
              if (ageInMinutes >= 5) {
                console.log(`🚫 Skipping temporary chunk ${chunkId}: session mismatch (${chunkSessionId} !== ${currentSessionId}) and not recent enough (${ageInMinutes.toFixed(1)}min)`);
                continue;
              } else {
                console.log(`✅ Allowing temporary chunk ${chunkId} despite session mismatch: very recent (${ageInMinutes.toFixed(1)}min)`);
              }
            }
          }
          
          const chunk = chunks.find(c => c.id === chunkId);
          
          if (chunk) {
            results.push({
              chunkId: chunk.id,
              documentId: chunk.documentId,
              content: chunk.content,
              similarity: weightedSimilarity,
              isTemporary: isTemp,
              timestamp: chunkTimestamp,
            });
          }
        } else {
          console.log(`🚫 Filtered out chunk ${chunkId}: low weighted similarity (${weightedSimilarity.toFixed(3)} < ${threshold})`);
        }
      }
      
      console.log(`🎯 Found ${results.length} similar chunks`);
      console.log(`🔎 Similarity check: ${results.length} total, ${results.filter(r => r.similarity >= 0.5).length} above threshold`);
      console.log(`🔎 Similarity scores:`, results.map(r => r.similarity.toFixed(3)));

      // Sort results: prioritize temporary documents first, then by weighted similarity
      results.sort((a, b) => {
        // Get isTemp status for both chunks - prioritize temporary documents
        const aIsTemp = a.isTemporary;
        const bIsTemp = b.isTemporary;
        
        // If one is temporary and other is not, prioritize temporary
        if (aIsTemp && !bIsTemp) return -1;
        if (!aIsTemp && bIsTemp) return 1;
        
        // If both same type, sort by similarity score (higher first)
        return b.similarity - a.similarity;
      });

      console.log(`🎯 Final sorted results: ${results.map(r => `chunk ${r.chunkId} (${r.isTemporary ? 'temp' : 'perm'}): ${r.similarity.toFixed(3)}`).join(', ')}`);

      // Return top K results without 80/20 weighting - let AI reranking handle prioritization
      const finalResults = results.slice(0, topK);
      console.log(`📊 Returning top ${finalResults.length} results without weighting scheme`);
      
      return finalResults;
      
    } catch (error) {
      console.error('❌ Error searching similar chunks:', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    totalChunks: number;
    chunksWithEmbeddings: number;
    chunksWithoutEmbeddings: number;
  }> {
    try {
      const [total] = await db
        .select({ count: count() })
        .from(documentChunks);
      
      const [withEmbeddings] = await db
        .select({ count: count() })
        .from(documentChunks)
        .where(isNotNull(documentChunks.embedding));
      
      return {
        totalChunks: total.count,
        chunksWithEmbeddings: withEmbeddings.count,
        chunksWithoutEmbeddings: total.count - withEmbeddings.count
      };
    } catch (error) {
      console.error('❌ Error getting embedding stats:', error);
      throw error;
    }
  }

  /**
   * Rebuild index after adding new chunks
   */
  async rebuildIndex(): Promise<void> {
    console.log('🔄 Rebuilding FAISS index...');
    this.initialized = false;
    this.faissIndex = null;
    this.chunkIds = [];
    await this.initializeFAISSIndex();
  }

  /**
   * Delete vectors for specific document chunks
   */
  async deleteDocumentVectors(documentId: number, isTemporary: boolean = false): Promise<void> {
    try {
      console.log(`🗑️ Deleting vectors for document ${documentId} (temporary: ${isTemporary})...`);
      
      if (isTemporary) {
        // Delete temporary document chunks from database
        const deletedChunks = await db
          .select({ id: temporaryDocumentChunks.id })
          .from(temporaryDocumentChunks)
          .where(eq(temporaryDocumentChunks.documentId, documentId));
        
        await db
          .delete(temporaryDocumentChunks)
          .where(eq(temporaryDocumentChunks.documentId, documentId));
        
        console.log(`🗑️ Deleted ${deletedChunks.length} temporary chunks for document ${documentId}`);
      } else {
        // Delete permanent document chunks from database  
        const deletedChunks = await db
          .select({ id: documentChunks.id })
          .from(documentChunks)
          .where(eq(documentChunks.documentId, documentId));
        
        await db
          .delete(documentChunks)
          .where(eq(documentChunks.documentId, documentId));
        
        console.log(`🗑️ Deleted ${deletedChunks.length} permanent chunks for document ${documentId}`);
      }
      
      // Rebuild FAISS index to remove deleted vectors
      await this.rebuildIndex();
      console.log(`✅ Vectors deleted and index rebuilt for document ${documentId}`);
      
    } catch (error) {
      console.error(`❌ Error deleting vectors for document ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Delete specific chunk vectors by IDs
   */
  async deleteChunkVectors(chunkIds: number[], isTemporary: boolean = false): Promise<void> {
    try {
      console.log(`🗑️ Deleting ${chunkIds.length} chunk vectors (temporary: ${isTemporary})...`);
      
      if (isTemporary) {
        await db
          .delete(temporaryDocumentChunks)
          .where(inArray(temporaryDocumentChunks.id, chunkIds));
      } else {
        await db
          .delete(documentChunks)
          .where(inArray(documentChunks.id, chunkIds));
      }
      
      // Rebuild FAISS index
      await this.rebuildIndex();
      console.log(`✅ ${chunkIds.length} chunk vectors deleted and index rebuilt`);
      
    } catch (error) {
      console.error(`❌ Error deleting chunk vectors:`, error);
      throw error;
    }
  }

  /**
   * Clean up temporary documents and vectors older than 2 hours
   */
  async cleanupExpiredTemporaryVectors(): Promise<void> {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      console.log(`🧹 Cleaning up temporary documents older than ${twoHoursAgo.toISOString()}...`);

      // Get expired temporary documents with their file paths
      const expiredDocs = await db
        .select()
        .from(temporaryDocuments)
        .where(lt(temporaryDocuments.uploadedAt, twoHoursAgo));

      if (expiredDocs.length === 0) {
        console.log('🧹 No expired temporary documents found');
        return;
      }

      console.log(`🧹 Found ${expiredDocs.length} expired temporary documents`);

      for (const doc of expiredDocs) {
        try {
          // Delete physical file if it exists
          const uploadDir = path.join(process.cwd(), 'uploads');
          const filePath = path.join(uploadDir, doc.filename);
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted physical file: ${doc.filename}`);
          }

          // Delete document chunks
          await db
            .delete(temporaryDocumentChunks)
            .where(eq(temporaryDocumentChunks.documentId, doc.id));

          // Delete document record
          await db
            .delete(temporaryDocuments)
            .where(eq(temporaryDocuments.id, doc.id));

          console.log(`✅ Cleaned up expired temporary document ${doc.id} (${doc.filename})`);
          
        } catch (fileError) {
          console.error(`❌ Error cleaning up document ${doc.id}:`, fileError);
        }
      }

      // Rebuild FAISS index after cleanup
      if (expiredDocs.length > 0) {
        await this.rebuildIndex();
        console.log(`✅ Cleaned up ${expiredDocs.length} expired temporary documents and rebuilt index`);
      }

    } catch (error) {
      console.error('❌ Error during temporary vector cleanup:', error);
    }
  }

  /**
   * Handle server crash cleanup - delete all temporary vectors
   */
  async handleServerCrashCleanup(): Promise<void> {
    try {
      console.log('💥 Handling server crash cleanup - removing all temporary vectors...');

      // Get all temporary documents for physical file cleanup
      let tempDocs: Array<{ id: number; filename: string }> = [];
      try {
        tempDocs = await db
          .select()
          .from(temporaryDocuments);
      } catch (dbError) {
        console.log('⚠️ No temporary documents table or empty - skipping file cleanup');
      }

      // Delete physical files
      const uploadDir = path.join(process.cwd(), 'uploads');
      for (const doc of tempDocs) {
        try {
          if (doc.filename && typeof doc.filename === 'string') {
            const filePath = path.join(uploadDir, doc.filename);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted crash cleanup file: ${doc.filename}`);
            }
          } else {
            console.log(`⚠️ Skipping file cleanup for document ${doc.id}: no filename`);
          }
        } catch (fileError) {
          console.error(`❌ Error deleting file ${doc.filename || 'undefined'}:`, fileError);
        }
      }

      // Delete all temporary document chunks (safe delete)
      try {
        await db.delete(temporaryDocumentChunks);
      } catch (error) {
        console.log('⚠️ Temporary chunks table cleanup skipped');
      }
      
      // Delete all temporary documents (safe delete)  
      try {
        await db.delete(temporaryDocuments);
      } catch (error) {
        console.log('⚠️ Temporary documents table cleanup skipped');
      }

      console.log(`✅ Server crash cleanup completed: processed ${tempDocs.length} temporary documents`);

      // Try to rebuild index (if possible)
      try {
        if (this.initialized) {
          await this.rebuildIndex();
        }
      } catch (error) {
        console.log('⚠️ Index rebuild skipped during crash cleanup');
      }

    } catch (error) {
      console.error('❌ Error during server crash cleanup:', error);
    }
  }

  /**
   * Start automatic cleanup service
   */
  startCleanupService(): void {
    console.log('🚀 Starting vector cleanup service...');
    
    // Check if server was recently started (< 30 seconds ago) - might be crash recovery
    const timeSinceStart = Date.now() - this.serverStartTime;
    if (timeSinceStart < 30000) {
      console.log('🔄 Recent server start detected - checking for crash cleanup...');
      // Wait 5 seconds for database connections to stabilize, then cleanup
      setTimeout(() => {
        this.handleServerCrashCleanup();
      }, 5000);
    }
    
    // Run cleanup every 30 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTemporaryVectors();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    // Also run an initial cleanup after 1 minute to clean up any old documents
    setTimeout(() => {
      this.cleanupExpiredTemporaryVectors();
    }, 60000); // 1 minute
  }

  /**
   * Stop cleanup service
   */
  stopCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Vector cleanup service stopped');
    }
  }

  /**
   * Check if a chunk belongs to a transcript (from video processing)
   */
  private async isTranscriptChunk(chunkId: number): Promise<boolean> {
    try {
      // Check if this chunk is in transcript_chunks table
      const { transcriptChunks } = await import('../shared/schema');
      const result = await db
        .select({ id: transcriptChunks.id })
        .from(transcriptChunks)
        .where(eq(transcriptChunks.id, chunkId))
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error('❌ Error checking transcript chunk:', error);
      return false;
    }
  }

  /**
   * Search for the most relevant video based on transcript content similarity
   * NOW SEARCHES ALL VIDEOS FROM ALL USERS (SHARED VIDEO LIBRARY)
   */
  async searchRelevantVideo(
    query: string, 
    requestingUserId: number, 
    subjectId?: string
  ): Promise<VideoSearchResult | null> {
    try {
      console.log(`🎬 Searching for relevant video in SHARED LIBRARY: "${query.substring(0, 50)}..." (requested by user ${requestingUserId})`);
      
      // Get all transcript chunks from ALL users' videos (shared library)
      let transcriptQuery = db
        .select({
          chunkId: transcriptChunks.id,
          videoId: transcriptChunks.videoId,
          content: transcriptChunks.content,
          embedding: transcriptChunks.embedding,
          fileName: videos.fileName,
          googleDriveId: videos.googleDriveId,
          contentPreview: videos.contentPreview,
          uploaderUserId: videos.userId, // Track who uploaded the video
        })
        .from(transcriptChunks)
        .innerJoin(videos, eq(transcriptChunks.videoId, videos.id));
        // REMOVED: .where(eq(videos.userId, userId)) - now searches ALL users

      // Add subject filter if provided (but still search across all users)
      if (subjectId) {
        transcriptQuery = transcriptQuery.where(
          eq(videos.subjectId, subjectId)
        ) as any;
      }

      const transcripts = await transcriptQuery;
      
      if (transcripts.length === 0) {
        console.log('❌ No videos found in shared library');
        return null;
      }

      console.log(`🎯 Found ${transcripts.length} transcript chunks from shared video library`);

      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Calculate similarity with each transcript chunk
      const similarities: Array<{
        videoId: number;
        fileName: string;
        googleDriveId: string;
        contentPreview: string;
        transcriptMatch: string;
        similarity: number;
        uploaderUserId: number; // Track who uploaded the video
      }> = [];

      for (const transcript of transcripts) {
        if (transcript.embedding) {
          try {
            const chunkEmbedding = JSON.parse(transcript.embedding);
            
            // Calculate cosine similarity
            const similarity = this.calculateCosineSimilarity(queryEmbedding, chunkEmbedding);
            
            // Group by video and keep highest similarity
            const existingVideo = similarities.find(s => s.videoId === transcript.videoId);
            if (!existingVideo) {
              similarities.push({
                videoId: transcript.videoId,
                fileName: transcript.fileName,
                googleDriveId: transcript.googleDriveId,
                contentPreview: transcript.contentPreview || '',
                transcriptMatch: transcript.content,
                similarity: similarity,
                uploaderUserId: transcript.uploaderUserId, // Track uploader
              });
            } else if (similarity > existingVideo.similarity) {
              // Update with better match
              existingVideo.similarity = similarity;
              existingVideo.transcriptMatch = transcript.content;
            }
          } catch (error) {
            console.error('❌ Error parsing embedding for chunk:', transcript.chunkId);
          }
        }
      }

      if (similarities.length === 0) {
        console.log('❌ No video embeddings found');
        return null;
      }

      // Sort by similarity and return best match
      similarities.sort((a, b) => b.similarity - a.similarity);
      const bestMatch = similarities[0];

      console.log(`🎯 Best video match: "${bestMatch.fileName}" with similarity ${bestMatch.similarity.toFixed(3)}`);

      return bestMatch;

    } catch (error) {
      console.error('❌ Error searching relevant video:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    totalTemporaryDocs: number;
    expiredTemporaryDocs: number;
    temporaryDocsOlderThan1Hour: number;
  }> {
    try {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const totalResult = await db
        .select({ count: count() })
        .from(temporaryDocuments);
      const total = totalResult[0]?.count || 0;

      const expiredResult = await db
        .select({ count: count() })
        .from(temporaryDocuments)
        .where(lt(temporaryDocuments.uploadedAt, twoHoursAgo));
      const expired = expiredResult[0]?.count || 0;

      const olderThanHourResult = await db
        .select({ count: count() })
        .from(temporaryDocuments)
        .where(lt(temporaryDocuments.uploadedAt, oneHourAgo));
      const olderThanHour = olderThanHourResult[0]?.count || 0;

      return {
        totalTemporaryDocs: total,
        expiredTemporaryDocs: expired,
        temporaryDocsOlderThan1Hour: olderThanHour
      };

    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      throw error;
    }
  }

  /**
   * Find documents with content similar to a given video transcript
   * This helps provide additional context when watching videos
   */
  async searchRelatedDocuments(videoTitle: string, videoContent: string, subjectId?: string, limit: number = 5): Promise<DocumentSearchResult[]> {
    try {
      await this.initializeFAISS();
      
      if (!this.faissIndex) {
        console.log('❌ FAISS index not available for document search');
        return [];
      }

      console.log(`📚 Searching for documents related to video: "${videoTitle}"`);
      
      // Combine video title and transcript content for search
      const searchText = `${videoTitle} ${videoContent}`;
      console.log(`🔍 Search text (${searchText.length} chars): ${searchText.substring(0, 100)}...`);
      
      // Generate embedding for video content
      const embedding = await this.generateEmbedding(searchText);
      
      // Search in FAISS index
      const { distances, labels } = this.faissIndex.search(embedding, Math.min(20, this.chunkIds.length));
      
      console.log(`🔍 FAISS search found ${distances.length} results`);
      
      // Filter for document chunks (not transcript chunks)
      const documentResults: DocumentSearchResult[] = [];
      const processedDocuments = new Set<number>(); // Avoid duplicates
      
      for (let i = 0; i < distances.length && documentResults.length < limit; i++) {
        const similarity = 1 - distances[i]; // Convert distance to similarity
        const chunkIndex = labels[i];
        const chunkId = this.chunkIds[chunkIndex];
        const isTemp = this.isTemporary[chunkIndex];
        
        // Apply similarity threshold - slightly lower for cross-reference
        const threshold = 0.4; // More lenient for finding related content
        if (similarity < threshold) {
          console.log(`📉 Document chunk ${chunkId} below threshold: ${similarity.toFixed(3)} < ${threshold}`);
          continue;
        }
        
        console.log(`📋 Processing document chunk ${chunkId} (temp: ${isTemp}, similarity: ${similarity.toFixed(3)})`);
        
        try {
          // Get chunk and document details
          let chunkData: any = null;
          let documentData: any = null;
          
          if (isTemp) {
            // Temporary document chunk
            const [tempChunk] = await db
              .select({
                id: temporaryDocumentChunks.id,
                documentId: temporaryDocumentChunks.documentId,
                content: temporaryDocumentChunks.content,
              })
              .from(temporaryDocumentChunks)
              .where(eq(temporaryDocumentChunks.id, chunkId))
              .limit(1);
              
            if (!tempChunk) continue;
            
            const [tempDoc] = await db
              .select({
                id: temporaryDocuments.id,
                fileName: temporaryDocuments.fileName,
                userId: temporaryDocuments.userId,
                subjectId: temporaryDocuments.subjectId,
              })
              .from(temporaryDocuments)
              .where(eq(temporaryDocuments.id, tempChunk.documentId))
              .limit(1);
              
            if (!tempDoc) continue;
            
            chunkData = tempChunk;
            documentData = tempDoc;
          } else {
            // Permanent document chunk
            const [permChunk] = await db
              .select({
                id: documentChunks.id,
                documentId: documentChunks.documentId,
                content: documentChunks.content,
              })
              .from(documentChunks)
              .where(eq(documentChunks.id, chunkId))
              .limit(1);
              
            if (!permChunk) continue;
            
            const [permDoc] = await db
              .select({
                id: documents.id,
                fileName: documents.fileName,
                userId: documents.userId,
                subjectId: documents.subjectId,
              })
              .from(documents)
              .where(eq(documents.id, permChunk.documentId))
              .limit(1);
              
            if (!permDoc) continue;
            
            chunkData = permChunk;
            documentData = permDoc;
          }
          
          // Filter by subject if specified
          if (subjectId && documentData.subjectId !== subjectId) {
            console.log(`❌ Document ${documentData.fileName} subject mismatch: ${documentData.subjectId} !== ${subjectId}`);
            continue;
          }
          
          // Avoid duplicate documents
          if (processedDocuments.has(documentData.id)) {
            console.log(`🔄 Document ${documentData.fileName} already processed, skipping...`);
            continue;
          }
          
          processedDocuments.add(documentData.id);
          
          const result: DocumentSearchResult = {
            documentId: documentData.id,
            fileName: documentData.fileName,
            content: chunkData.content.substring(0, 200) + '...', // Preview
            similarity,
            chunkMatch: chunkData.content.substring(0, 100) + '...', // Matching chunk preview
            uploaderUserId: documentData.userId,
          };
          
          documentResults.push(result);
          console.log(`✅ Added document: ${documentData.fileName} (similarity: ${similarity.toFixed(3)})`);
          
        } catch (error) {
          console.error(`❌ Error processing document chunk ${chunkId}:`, error);
          continue;
        }
      }
      
      // Sort by similarity descending
      documentResults.sort((a, b) => b.similarity - a.similarity);
      
      console.log(`📚 Found ${documentResults.length} related documents for video: ${videoTitle}`);
      return documentResults.slice(0, limit);
      
    } catch (error) {
      console.error('❌ Error searching related documents:', error);
      return [];
    }
  }
}

// Export singleton instance
export const vectorService = new VectorService();