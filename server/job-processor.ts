import { db } from "../server/db";
import { processingJobs, users } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';

// Import existing processors
import { pdfProcessor } from './pdf-processor';
import { VideoProcessor } from './video-processor';

// Create video processor instance
const videoProcessor = new VideoProcessor();

class JobProcessor {
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private drive: any = null;

  async initialize() {
    try {
      // Initialize Google Drive API using environment variables
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.log('⚠️ Job Processor: No Google Service Account credentials found in environment');
        return;
      }

      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
      });

      this.drive = google.drive({ version: 'v3', auth });
      console.log('✅ Job Processor: Google Drive API initialized');
    } catch (error) {
      console.error('❌ Job Processor initialization failed:', error);
    }
  }

  startProcessing() {
    if (this.isRunning) {
      console.log('⚠️ Job Processor already running');
      return;
    }

    console.log('🚀 Starting Job Processor...');
    this.isRunning = true;

    // Check for jobs every 30 seconds
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, 30000);

    // Process immediately on start
    this.processNextJob();
  }

  stopProcessing() {
    console.log('🛑 Stopping Job Processor...');
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processNextJob(): Promise<void> {
    try {
      if (!this.drive) {
        console.log('⚠️ Google Drive not initialized, skipping job processing');
        return;
      }

      // Find the next job to process (prioritize by high -> medium -> low, then by creation time)
      const jobs = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.status, 'queued'))
        .orderBy(
          // Priority order: high first, then medium, then low
          processingJobs.priority,
          processingJobs.createdAt
        )
        .limit(1);

      if (jobs.length === 0) {
        return; // No jobs to process
      }

      const job = jobs[0];
      console.log(`📋 Processing job ${job.id}: ${job.fileName} (${job.processingType})`);

      // Mark job as processing
      await db.update(processingJobs)
        .set({ 
          status: 'processing',
          startedAt: new Date()
        })
        .where(eq(processingJobs.id, job.id));

      try {
        // Download file from Google Drive
        const filePath = await this.downloadFileFromDrive(job.driveFileId, job.fileName);
        
        if (!filePath) {
          throw new Error('Failed to download file from Google Drive');
        }

        // Process based on type
        let result;
        switch (job.processingType) {
          case 'pdf_ocr':
            result = await this.processPdf(filePath, job);
            break;
          case 'video_transcription':
            result = await this.processVideo(filePath, job);
            break;
          case 'image_ocr':
            result = await this.processImage(filePath, job);
            break;
          default:
            throw new Error(`Unknown processing type: ${job.processingType}`);
        }

        // Mark job as completed
        await db.update(processingJobs)
          .set({
            status: 'completed',
            completedAt: new Date(),
            resultData: JSON.stringify(result)
          })
          .where(eq(processingJobs.id, job.id));

        console.log(`✅ Job ${job.id} completed successfully`);

        // Clean up temporary file
        await fs.unlink(filePath).catch(() => {});

      } catch (error) {
        // Mark job as failed
        await db.update(processingJobs)
          .set({
            status: 'failed',
            completedAt: new Date(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          })
          .where(eq(processingJobs.id, job.id));

        console.error(`❌ Job ${job.id} failed:`, error);
      }

    } catch (error) {
      console.error('❌ Error in job processing:', error);
    }
  }

  private async downloadFileFromDrive(fileId: string, fileName: string): Promise<string | null> {
    try {
      console.log(`⬇️ Downloading file ${fileName} from Drive...`);
      
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      // Create temporary directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'tmp', 'jobs');
      await fs.mkdir(tempDir, { recursive: true });

      // Save file to temporary location
      const tempFilePath = path.join(tempDir, `${Date.now()}_${fileName}`);
      
      return new Promise<string>((resolve, reject) => {
        const chunks: any[] = [];
        
        response.data.on('data', (chunk: any) => {
          chunks.push(chunk);
        });
        
        response.data.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            await fs.writeFile(tempFilePath, buffer);
            console.log(`✅ File downloaded to: ${tempFilePath}`);
            resolve(tempFilePath);
          } catch (error) {
            reject(error);
          }
        });
        
        response.data.on('error', reject);
      });

    } catch (error) {
      console.error(`❌ Failed to download file ${fileName}:`, error);
      return null;
    }
  }

  private async processPdf(filePath: string, job: any): Promise<any> {
    console.log(`📄 Processing PDF: ${job.fileName}`);
    
    // Initialize PDF processor
    await pdfProcessor.initialize();
    
    // Get system admin user ID
    const systemUserId = await this.getSystemUserId();
    
    // Always detect subject from filename - ignore subject_hint completely
    let subjectId: string | undefined;
    let subjectNumericId: number | undefined;
    
    console.log(`🔍 Auto-detecting subject from filename: "${job.fileName}"`);
    const { SubjectDetector } = await import('./subject-detector');
    const detectedSubject = await SubjectDetector.detectSubject(job.fileName);
    
    if (detectedSubject) {
      subjectId = detectedSubject.subjectId;
      subjectNumericId = detectedSubject.subjectNumericId;
      console.log(`✅ Subject auto-detected: ${subjectId} (${subjectNumericId}) - ignoring hint "${job.subjectHint}"`);
    } else {
      console.log(`❌ Could not auto-detect subject from filename: "${job.fileName}"`);
      // Don't fall back to subject_hint - let it be null
    }
    
    // Use existing PDF processor service
    const result = await pdfProcessor.processPDF({
      pdfPath: filePath,
      fileName: job.fileName,
      userId: systemUserId,
      subjectId,
      subjectNumericId
    });

    return {
      type: 'pdf_ocr',
      documentId: result.documentId,
      chunksCreated: result.chunksCount,
      subjectDetected: subjectId || 'General',
      processingComplete: true
    };
  }

  private async processVideo(filePath: string, job: any): Promise<any> {
    console.log(`🎥 Processing Video: ${job.fileName}`);
    
    // Read video file as buffer
    const videoBuffer = await fs.readFile(filePath);
    
    // Get system admin user ID
    const systemUserId = await this.getSystemUserId();
    
    // Always detect subject from filename - ignore subject_hint completely
    console.log(`🔍 Auto-detecting subject for video: "${job.fileName}"`);
    const { SubjectDetector } = await import('./subject-detector');
    const detectedSubject = await SubjectDetector.detectSubject(job.fileName);
    
    if (detectedSubject) {
      console.log(`✅ Video subject auto-detected: ${detectedSubject.subjectId} (${detectedSubject.subjectNumericId}) - ignoring hint "${job.subjectHint}"`);
    } else {
      console.log(`❌ Could not auto-detect subject from video filename: "${job.fileName}"`);
    }

    // Use existing video processor service
    const result = await videoProcessor.processVideo(
      videoBuffer,
      job.fileName,
      systemUserId,
      job.driveFileId // Use the Drive ID if available
    );

    // Extract subject info from video processing result
    let detectedSubjectForResponse = 'General';
    if (result && result.subjectId) {
      detectedSubjectForResponse = result.subjectId;
    } else if (detectedSubject) {
      detectedSubjectForResponse = detectedSubject.subjectId;
    }

    return {
      type: 'video_transcription',
      videoId: result.videoId || 'processing_complete',
      processingComplete: !result.error,
      errorMessage: result.error || null,
      subjectDetected: detectedSubjectForResponse
    };
  }

  private async processImage(filePath: string, job: any): Promise<any> {
    console.log(`🖼️ Processing Image: ${job.fileName}`);
    
    // Initialize PDF processor for OCR
    await pdfProcessor.initialize();
    
    // Get system admin user ID
    const systemUserId = await this.getSystemUserId();
    
    // Always detect subject from filename - ignore subject_hint completely
    let subjectId: string | undefined;
    let subjectNumericId: number | undefined;
    
    console.log(`🔍 Auto-detecting subject from image filename: "${job.fileName}"`);
    const { SubjectDetector } = await import('./subject-detector');
    const detectedSubject = await SubjectDetector.detectSubject(job.fileName);
    
    if (detectedSubject) {
      subjectId = detectedSubject.subjectId;
      subjectNumericId = detectedSubject.subjectNumericId;
      console.log(`✅ Image subject auto-detected: ${subjectId} (${subjectNumericId}) - ignoring hint "${job.subjectHint}"`);
    } else {
      console.log(`❌ Could not auto-detect subject from image filename: "${job.fileName}"`);
      // Don't fall back to subject_hint - let it be null
    }

    // For now, treat images similar to PDFs for OCR
    const result = await pdfProcessor.processPDF({
      pdfPath: filePath,
      fileName: job.fileName,
      userId: systemUserId,
      subjectId,
      subjectNumericId
    });

    return {
      type: 'image_ocr',
      documentId: result.documentId,
      chunksCreated: result.chunksCount,
      subjectDetected: job.subjectHint || 'General',
      processingComplete: true
    };
  }

  // Get system user ID for external jobs
  private async getSystemUserId(): Promise<number> {
    const systemUser = await db.select()
      .from(users)
      .where(eq(users.email, 'system@admin.com'))
      .limit(1);

    if (systemUser.length === 0) {
      throw new Error('System admin user not found');
    }

    return systemUser[0].id;
  }

  // Get job status
  async getJobStatus(jobId: number) {
    const job = await db.select()
      .from(processingJobs)
      .where(eq(processingJobs.id, jobId))
      .limit(1);

    return job[0] || null;
  }
}

export const jobProcessor = new JobProcessor();