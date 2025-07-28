import { googleDriveService } from './google-drive';
import { pdfProcessor } from './pdf-processor';
import { SubjectDetector } from './subject-detector';
import { ExerciseDetector } from './exercise-detector';
import fs from 'fs/promises';
import path from 'path';

export class GoogleDrivePDFService {
  private static instance: GoogleDrivePDFService;

  private constructor() {}

  static getInstance(): GoogleDrivePDFService {
    if (!GoogleDrivePDFService.instance) {
      GoogleDrivePDFService.instance = new GoogleDrivePDFService();
    }
    return GoogleDrivePDFService.instance;
  }

  async processPDFFromDrive(
    fileId: string,
    userId: number,
    subjectId?: string,
    subjectNumericId?: number
  ): Promise<{ documentId: number; chunksCount: number }> {
    console.log(`📥 Processing PDF from Google Drive: ${fileId}`);
    
    try {
      // Step 1: Get file info from Google Drive
      const fileInfo = await googleDriveService.getFileInfo(fileId);
      
      if (!fileInfo || fileInfo.mimeType !== 'application/pdf') {
        throw new Error('File is not a PDF or does not exist');
      }
      
      console.log(`📄 File info: ${fileInfo.name} (${fileInfo.size} bytes)`);
      
      // Step 1.5: Auto-detect subject from filename using first words method
      if (!subjectId || !subjectNumericId) {
        const detectedSubject = SubjectDetector.detectSubjectFromFirstWords(fileInfo.name);
        if (detectedSubject) {
          console.log(`🔍 Auto-detected subject: ${SubjectDetector.getSubjectById(detectedSubject.subjectId)?.name} (${(detectedSubject.confidence * 100).toFixed(1)}% confidence)`);
          subjectId = subjectId || detectedSubject.subjectId;
          subjectNumericId = subjectNumericId || detectedSubject.subjectNumericId;
        } else {
          console.log(`⚠️ Could not auto-detect subject from filename: ${fileInfo.name}`);
          // Set default to general/unknown subject
          subjectId = subjectId || 'GENERAL_001';
          subjectNumericId = subjectNumericId || 9;
        }
      }
      
      // Step 2: Download PDF to temp location
      const tempDir = '/tmp/pdf-downloads';
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempPath = path.join(tempDir, `${fileId}.pdf`);
      await googleDriveService.downloadFile(fileId, tempPath);
      
      console.log(`⬇️ Downloaded PDF to: ${tempPath}`);
      
      // Step 3: Process PDF with OCR
      const result = await pdfProcessor.processPDF({
        pdfPath: tempPath,
        userId,
        fileName: fileInfo.name,
        googleDriveId: fileId,
        subjectId,
        subjectNumericId,
      });
      
      // Step 4: Clean up temp file
      await fs.unlink(tempPath).catch(error => {
        console.warn(`Failed to clean up temp file: ${error.message}`);
      });
      
      console.log(`✅ PDF processing completed: Document ID ${result.documentId}, ${result.chunksCount} chunks`);
      
      // Step 5: Rebuild FAISS index to include new document
      try {
        console.log('🔄 Rebuilding FAISS index with new document...');
        const { vectorService } = await import('./vector-service');
        await vectorService.rebuildIndex();
        console.log('✅ FAISS index rebuilt successfully');
      } catch (rebuildError) {
        console.error('⚠️ Failed to rebuild FAISS index:', rebuildError);
        // Don't fail the entire request if index rebuild fails
      }
      
      return result;
    } catch (error) {
      console.error(`❌ PDF processing failed:`, error);
      throw error;
    }
  }

  async batchProcessPDFs(
    fileIds: string[],
    userId: number,
    subjectId?: string,
    subjectNumericId?: number
  ): Promise<Array<{ fileId: string; success: boolean; documentId?: number; chunksCount?: number; error?: string }>> {
    const results = [];
    
    for (const fileId of fileIds) {
      try {
        const result = await this.processPDFFromDrive(fileId, userId, subjectId, subjectNumericId);
        results.push({
          fileId,
          success: true,
          documentId: result.documentId,
          chunksCount: result.chunksCount,
        });
      } catch (error) {
        results.push({
          fileId,
          success: false,
          error: (error as Error).message,
        });
      }
    }
    
    return results;
  }
}

export const googleDrivePDFService = GoogleDrivePDFService.getInstance();