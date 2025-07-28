import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { documents, documentChunks, type InsertDocument, type InsertDocumentChunk } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { vectorService } from './vector-service';
import { ExerciseDetector } from './exercise-detector';

interface ProcessPDFOptions {
  pdfPath: string;
  userId: number;
  fileName: string;
  googleDriveId?: string;
  subjectId?: string;
  subjectNumericId?: number;
}

interface ChunkOptions {
  maxWordsPerChunk: number;
  overlapWords: number;
}

export class PDFProcessor {
  private static instance: PDFProcessor;
  private tesseractWorker: any;

  private constructor() {}

  static getInstance(): PDFProcessor {
    if (!PDFProcessor.instance) {
      PDFProcessor.instance = new PDFProcessor();
    }
    return PDFProcessor.instance;
  }

  async initialize() {
    if (!this.tesseractWorker) {
      console.log('🔧 Initializing Tesseract OCR worker...');
      this.tesseractWorker = await createWorker('vie+eng'); // Vietnamese + English
      console.log('✅ Tesseract OCR worker initialized');
    }
  }

  async processPDF(options: ProcessPDFOptions): Promise<{ documentId: number; chunksCount: number }> {
    const { pdfPath, userId, fileName, googleDriveId, subjectId, subjectNumericId } = options;
    
    console.log(`📄 Processing PDF: ${fileName}`);
    
    // Step 1: Convert PDF to images
    const images = await this.convertPDFToImages(pdfPath);
    console.log(`📸 Converted PDF to ${images.length} images`);
    
    // Step 2: OCR processing
    let fullText = '';
    for (let i = 0; i < images.length; i++) {
      console.log(`🔍 OCR processing page ${i + 1}/${images.length}`);
      const pageText = await this.performOCR(images[i]);
      fullText += pageText + '\n\n';
      
      // Clean up temp image
      await fs.unlink(images[i]).catch(() => {});
    }
    
    console.log(`📝 Extracted ${fullText.length} characters from PDF`);
    
    // Step 3: Detect if document is exercise and chunk accordingly
    const { chunks, isExercise } = ExerciseDetector.chunkDocument(fileName, fullText);
    console.log(`📝 Document type: ${isExercise ? 'Exercise (BT)' : 'Standard'} - ${chunks.length} chunks created`);

    // Step 4: Save document to database with exercise flag
    const documentData: InsertDocument = {
      userId,
      fileName,
      filePath: pdfPath,
      fileType: 'pdf',
      googleDriveId,
      subjectId,
      subjectNumericId,
      ocrText: fullText,
      isExercise,
    };
    
    const [document] = await db.insert(documents).values(documentData).returning();
    
    // Update processedAt timestamp
    await db.update(documents)
      .set({ processedAt: new Date() })
      .where(eq(documents.id, document.id));
    
    console.log(`💾 Document saved with ID: ${document.id}`);
    
    // Step 5: Create exercise-aware chunks
    const chunksCount = await this.createExerciseAwareChunks(document.id, chunks);
    console.log(`📊 Created ${chunksCount} chunks for document`);
    
    return { documentId: document.id, chunksCount };
  }

  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    const tempDir = '/tmp/pdf-processing';
    await fs.mkdir(tempDir, { recursive: true });
    
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 200, // DPI
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
      width: 2000,
      height: 2800,
      // Remove graphicsMagick option as it's not valid for pdf2pic
    });
    
    const results = await convert.bulk(-1); // Convert all pages
    return results.map(result => result.path).filter(Boolean) as string[];
  }

  private async performOCR(imagePath: string): Promise<string> {
    await this.initialize();
    
    try {
      // Optimize image for OCR using Sharp
      const optimizedPath = imagePath.replace('.png', '_optimized.png');
      await sharp(imagePath)
        .greyscale()
        .normalize()
        .sharpen()
        .png({ quality: 95 })
        .toFile(optimizedPath);
      
      // Perform OCR
      const { data: { text } } = await this.tesseractWorker.recognize(optimizedPath);
      
      // Clean up optimized image
      await fs.unlink(optimizedPath).catch(() => {});
      
      return this.cleanOCRText(text);
    } catch (error) {
      console.error('OCR Error:', error);
      return '';
    }
  }

  private cleanOCRText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
      .trim();
  }

  private async createExerciseAwareChunks(
    documentId: number, 
    chunks: import('./exercise-detector').ExerciseChunk[]
  ): Promise<number> {
    console.log(`📝 Creating ${chunks.length} exercise-aware chunks for document ${documentId}...`);
    
    const dbChunks: InsertDocumentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      dbChunks.push({
        documentId,
        chunkIndex: i,
        content: chunk.content,
        wordCount: chunk.wordCount,
        chunkType: chunk.chunkType,
        questionNumber: chunk.questionNumber,
      });
    }
    
    if (dbChunks.length > 0) {
      // Insert chunks in batches
      const batchSize = 10;
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize);
        const savedChunks = await db.insert(documentChunks).values(batch).returning();
        
        // Generate embeddings for the batch
        for (const savedChunk of savedChunks) {
          try {
            console.log(`🔮 Generating embedding for ${savedChunk.chunkType} chunk ${savedChunk.chunkIndex + 1}/${dbChunks.length}...`);
            await vectorService.addEmbeddingToChunk(savedChunk.id, savedChunk.content, false); // isTemporary = false
          } catch (embeddingError) {
            console.error(`⚠️ Failed to generate embedding for chunk ${savedChunk.id}:`, embeddingError);
          }
        }
      }
      
      console.log(`✅ Created ${dbChunks.length} exercise-aware permanent chunks`);
    }
    
    return dbChunks.length;
  }

  private async createDocumentChunks(
    documentId: number, 
    fullText: string, 
    options: ChunkOptions = { maxWordsPerChunk: 500, overlapWords: 50 }
  ): Promise<number> {
    const { maxWordsPerChunk, overlapWords } = options;
    
    // Split text into words
    const words = fullText.split(/\s+/).filter(word => word.trim().length > 0);
    
    if (words.length === 0) {
      return 0;
    }
    
    const chunks: InsertDocumentChunk[] = [];
    let chunkIndex = 0;
    
    for (let i = 0; i < words.length; i += maxWordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + maxWordsPerChunk);
      const content = chunkWords.join(' ');
      
      if (content.trim().length > 0) {
        chunks.push({
          documentId,
          chunkIndex,
          content: content.trim(),
          wordCount: chunkWords.length,
          chunkType: 'standard',
          questionNumber: null,
        });
        chunkIndex++;
      }
    }
    
    // Insert chunks in batches and generate embeddings
    const batchSize = 10; // Smaller batches for embedding generation
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const savedChunks = await db.insert(documentChunks).values(batch).returning();
      
      // Generate embeddings for the batch
      for (const savedChunk of savedChunks) {
        try {
          console.log(`🔮 Generating embedding for chunk ${savedChunk.chunkIndex + 1}/${chunks.length}...`);
          await vectorService.addEmbeddingToChunk(savedChunk.id, savedChunk.content, false);
        } catch (embeddingError) {
          console.error(`⚠️ Failed to generate embedding for chunk ${savedChunk.id}:`, embeddingError);
          // Continue processing other chunks even if embedding fails
        }
      }
    }
    

    
    return chunks.length;
  }

  async getDocumentWithChunks(documentId: number) {
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        chunks: {
          orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)],
        },
      },
    });
    
    return document;
  }

  async searchInDocuments(query: string, userId: number, subjectId?: string) {
    // Simple text search in chunks - can be enhanced with vector search later
    const searchPattern = `%${query.toLowerCase()}%`;
    
    const results = await db.query.documentChunks.findMany({
      where: (chunks, { like, and, eq: eqOp }) => and(
        like(chunks.content, searchPattern),
        // Filter by user's documents
        eqOp(chunks.documentId, documents.id)
      ),
      with: {
        document: true,
      },
      limit: 10,
    });
    
    return results;
  }

  async cleanup() {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}

export const pdfProcessor = PDFProcessor.getInstance();