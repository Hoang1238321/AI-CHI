import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { db } from './db';
import { temporaryDocuments, temporaryDocumentChunks, type InsertTemporaryDocument, type InsertTemporaryDocumentChunk } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { vectorService } from './vector-service';
import { ExerciseDetector } from './exercise-detector';

interface ProcessTempPDFOptions {
  pdfPath: string;
  userId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  subjectId?: string;
  subjectNumericId?: number;
  sessionId?: number;
}

interface ChunkOptions {
  maxWordsPerChunk: number;
  overlapWords: number;
}

export class TempPDFProcessor {
  private static instance: TempPDFProcessor;
  private tesseractWorker: any;

  private constructor() {}

  static getInstance(): TempPDFProcessor {
    if (!TempPDFProcessor.instance) {
      TempPDFProcessor.instance = new TempPDFProcessor();
    }
    return TempPDFProcessor.instance;
  }

  async initialize() {
    if (!this.tesseractWorker) {
      console.log('🔧 Initializing Temporary PDF Tesseract OCR worker...');
      this.tesseractWorker = await createWorker('vie+eng'); // Vietnamese + English
      console.log('✅ Temporary PDF Tesseract OCR worker initialized');
    }
  }

  async processTempPDF(options: ProcessTempPDFOptions): Promise<{ documentId: number; chunksCount: number }> {
    const { pdfPath, userId, fileName, fileSize, mimeType, subjectId, subjectNumericId, sessionId } = options;
    
    console.log(`📄 Processing Temporary PDF: ${fileName}`);
    
    // Step 1: Create initial temporary document record
    const documentData: InsertTemporaryDocument = {
      userId,
      fileName,
      fileSize,
      mimeType,
      filePath: pdfPath,
      subjectId,
      subjectNumericId,
      status: 'processing',
    };

    const [savedDocument] = await db.insert(temporaryDocuments).values(documentData).returning();
    console.log(`📝 Created temporary document record with ID: ${savedDocument.id}`);

    try {
      // Step 2: Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath);
      console.log(`📸 Converted PDF to ${images.length} images`);
      
      // Step 3: OCR processing
      let fullText = '';
      for (let i = 0; i < images.length; i++) {
        console.log(`🔍 OCR processing page ${i + 1}/${images.length}`);
        const pageText = await this.performOCR(images[i]);
        fullText += pageText + '\n\n';
        
        // Clean up temp image
        await fs.unlink(images[i]).catch(() => {});
      }
      
      console.log(`📝 Extracted ${fullText.length} characters from temporary PDF`);
      
      // Step 4: Auto-detect subject if not provided
      let finalSubjectId = subjectId;
      let finalSubjectNumericId = subjectNumericId;
      let confidence = undefined;
      
      if (!subjectId) {
        try {
          const { SubjectDetector } = await import('./subject-detector');
          const detection = SubjectDetector.detectSubjectFromFirstWords(fileName);
          if (detection) {
            finalSubjectId = detection.subjectId;
            finalSubjectNumericId = detection.subjectNumericId;
            confidence = detection.confidence;
            console.log(`🎯 Auto-detected subject from filename: ${finalSubjectId} (confidence: ${confidence})`);
          } else {
            console.log('⚠️ Could not detect subject from filename');
          }
        } catch (error) {
          console.log('⚠️ Subject detection failed:', (error as Error).message);
        }
      }
      
      // Step 5: Detect if document is exercise and chunk accordingly
      const { chunks, isExercise } = ExerciseDetector.chunkDocument(fileName, fullText);
      console.log(`📝 Document type: ${isExercise ? 'Exercise (BT)' : 'Standard'} - ${chunks.length} chunks created`);

      // Step 6: Update document with OCR text, subject detection, and exercise flag
      await db
        .update(temporaryDocuments)
        .set({ 
          ocrText: fullText,
          subjectId: finalSubjectId,
          subjectNumericId: finalSubjectNumericId,
          confidence,
          isExercise,
          status: 'processed',
          processedAt: new Date()
        })
        .where(eq(temporaryDocuments.id, savedDocument.id));
      
      // Step 7: Create and save exercise-aware chunks
      const chunksCount = await this.createExerciseAwareChunks(savedDocument.id, chunks, userId, sessionId);
      console.log(`✅ Created ${chunksCount} temporary chunks for document`);
      
      return { documentId: savedDocument.id, chunksCount };
    } catch (error) {
      // Mark document as failed
      await db
        .update(temporaryDocuments)
        .set({ 
          status: 'failed',
          processedAt: new Date()
        })
        .where(eq(temporaryDocuments.id, savedDocument.id));
      
      console.error('❌ Error processing temporary PDF:', error);
      throw error;
    }
  }

  private async convertPDFToImages(pdfPath: string): Promise<string[]> {
    const outputDir = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, '.pdf');
    
    const convert = pdf2pic.fromPath(pdfPath, {
      density: 300,
      saveFilename: `${baseName}_page`,
      savePath: outputDir,
      format: 'png',
      width: 2000,
      height: 2800,
      // Remove graphicsMagick option as it's not valid
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
      console.error('Temporary PDF OCR Error:', error);
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
    chunks: import('./exercise-detector').ExerciseChunk[], 
    userId: number,
    sessionId?: number
  ): Promise<number> {
    console.log(`📝 Creating ${chunks.length} exercise-aware chunks for document ${documentId}...`);
    
    const dbChunks: InsertTemporaryDocumentChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      dbChunks.push({
        documentId,
        chunkIndex: i,
        content: chunk.content,
        wordCount: chunk.wordCount,
        chunkType: chunk.chunkType,
        questionNumber: chunk.questionNumber,
        userId,
        sessionId,
      });
    }
    
    if (dbChunks.length > 0) {
      // Insert chunks in batches
      const batchSize = 10;
      for (let i = 0; i < dbChunks.length; i += batchSize) {
        const batch = dbChunks.slice(i, i + batchSize);
        const savedChunks = await db.insert(temporaryDocumentChunks).values(batch).returning();
        
        // Generate embeddings for the batch
        for (const savedChunk of savedChunks) {
          try {
            console.log(`🔮 Generating embedding for ${savedChunk.chunkType} chunk ${savedChunk.chunkIndex + 1}/${dbChunks.length}...`);
            await vectorService.addEmbeddingToChunk(savedChunk.id, savedChunk.content, true); // isTemporary = true
          } catch (embeddingError) {
            console.error(`⚠️ Failed to generate embedding for chunk ${savedChunk.id}:`, embeddingError);
          }
        }
      }
      
      console.log(`✅ Created ${dbChunks.length} exercise-aware temporary chunks`);
    }
    
    return dbChunks.length;
  }

  private async createTempDocumentChunks(
    documentId: number, 
    fullText: string, 
    userId: number,
    sessionId?: number,
    options: ChunkOptions = { maxWordsPerChunk: 500, overlapWords: 50 }
  ): Promise<number> {
    const { maxWordsPerChunk, overlapWords } = options;
    
    // Split text into words
    const words = fullText.split(/\s+/).filter(word => word.trim().length > 0);
    
    if (words.length === 0) {
      return 0;
    }
    
    const chunks: InsertTemporaryDocumentChunk[] = [];
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
          userId: userId,
          sessionId: sessionId,
        });
        chunkIndex++;
      }
    }
    
    // Insert chunks in batches and generate embeddings
    const batchSize = 10; // Smaller batches for embedding generation
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const savedChunks = await db.insert(temporaryDocumentChunks).values(batch).returning();
      
      // Generate embeddings for the batch
      for (const savedChunk of savedChunks) {
        try {
          console.log(`🔮 Generating embedding for temporary chunk ${savedChunk.chunkIndex + 1}/${chunks.length}...`);
          await vectorService.addEmbeddingToChunk(savedChunk.id, savedChunk.content, true); // true = isTemporary
        } catch (embeddingError) {
          console.error(`⚠️ Failed to generate embedding for temporary chunk ${savedChunk.id}:`, embeddingError);
          // Continue processing other chunks even if embedding fails
        }
      }
    }
    
    return chunks.length;
  }

  async getTempDocumentWithChunks(documentId: number) {
    const document = await db.query.temporaryDocuments.findFirst({
      where: eq(temporaryDocuments.id, documentId),
      with: {
        chunks: {
          orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)],
        },
      },
    });
    
    return document;
  }

  /**
   * Create temporary document from pre-processed text (for DOCX, images, etc.)
   */
  async createTempDocumentFromText({
    extractedText,
    userId,
    fileName,
    fileSize,
    mimeType,
    subjectId,
    subjectNumericId,
    sessionId,
    originalFormat = 'unknown'
  }: {
    extractedText: string;
    userId: number;
    fileName: string;
    fileSize: number;
    mimeType: string;
    subjectId?: string;
    subjectNumericId?: number;
    sessionId?: number;
    originalFormat?: string;
  }) {
    console.log(`📄 Creating temporary document from ${originalFormat} text: ${fileName}`);
    console.log(`📊 Text length: ${extractedText.length} characters`);

    // Detect subject if not provided
    let finalSubjectId = subjectId;
    let finalSubjectNumericId = subjectNumericId;
    
    if (!finalSubjectId) {
      console.log('🔍 Auto-detecting subject from filename...');
      const { SubjectDetector } = await import('./subject-detector');
      const detection = SubjectDetector.detectSubjectFromFirstWords(fileName);
      
      if (detection) {
        finalSubjectId = detection.subjectId;
        finalSubjectNumericId = detection.subjectNumericId;
        console.log(`🎯 Auto-detected subject: ${detection.subjectId} (confidence: ${detection.confidence.toFixed(2)})`);
      }
    }

    // Create temporary document record
    const [tempDocument] = await db
      .insert(temporaryDocuments)
      .values({
        userId,
        fileName,
        fileSize,
        mimeType,
        filePath: `/tmp/processed/${fileName}`, // Virtual path for non-PDF files
        subjectId: finalSubjectId,
        subjectNumericId: finalSubjectNumericId,
        sessionId,
        ocrText: extractedText,
        processedAt: new Date(),
      })
      .returning();

    console.log(`📁 Created temporary document record: ID ${tempDocument.id}`);

    // Detect if document is exercise and chunk accordingly
    const { chunks, isExercise } = ExerciseDetector.chunkDocument(fileName, extractedText);
    console.log(`📝 Document type: ${isExercise ? 'Exercise (BT)' : 'Standard'} - ${chunks.length} chunks created`);

    // Update document with exercise flag
    await db
      .update(temporaryDocuments)
      .set({ isExercise })
      .where(eq(temporaryDocuments.id, tempDocument.id));

    // Create exercise-aware chunks
    const chunksCount = await this.createExerciseAwareChunks(tempDocument.id, chunks, userId, sessionId);

    console.log(`✅ ${originalFormat.toUpperCase()} processing completed: ${chunksCount} chunks saved`);

    return {
      documentId: tempDocument.id,
      chunksCount,
      extractedText: extractedText.substring(0, 500) + '...', // Preview
      originalFormat,
      subjectId: finalSubjectId,
      autoDetected: !subjectId && finalSubjectId ? true : false
    };
  }
}

// Export singleton instance
export const tempPDFProcessor = TempPDFProcessor.getInstance();