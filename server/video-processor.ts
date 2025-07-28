import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import OpenAI from 'openai';
import { db } from './db';
import { videos, transcriptChunks, type InsertVideo, type InsertTranscriptChunk } from '@shared/schema';
import { SubjectDetector } from './subject-detector';
import { VectorService } from './vector-service';
import { eq } from 'drizzle-orm';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export interface VideoProcessingResult {
  videoId: string;
  originalFilename: string;
  audioPath: string;
  transcription: string;
  duration: number;
  success: boolean;
  error?: string;
}

export class VideoProcessor {
  private openai: OpenAI;
  private vectorService: VectorService;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    this.vectorService = new VectorService();
  }

  /**
   * Process video: extract audio, transcribe, upload to Google Drive and store in database
   */
  async processVideo(
    videoBuffer: Buffer, 
    originalFilename: string, 
    userId: number,
    googleDriveId?: string
  ): Promise<VideoProcessingResult> {
    const videoId = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const tempDir = path.join('/tmp', 'videos', String(userId));
    
    try {
      console.log(`🎬 Starting video processing for ${originalFilename}...`);
      
      // Ensure temp directory exists
      await mkdir(tempDir, { recursive: true });
      
      // Save video to temp directory for processing
      const videoPath = path.join(tempDir, `${videoId}-${originalFilename}`);
      await writeFile(videoPath, videoBuffer);
      console.log(`📁 Video saved temporarily to: ${videoPath}`);
      
      // Upload video to Google Drive only if not already provided
      let driveVideoId: string;
      if (googleDriveId) {
        // Video is already on Google Drive, use existing ID
        driveVideoId = googleDriveId;
        console.log(`☁️ Using existing Google Drive video: ${driveVideoId}`);
      } else {
        // Upload new video to Google Drive
        const { googleDriveService } = await import('./google-drive');
        driveVideoId = await googleDriveService.uploadVideoFile(
          `${videoId}-${originalFilename}`,
          videoBuffer,
          userId
        );
        console.log(`☁️ Video uploaded to Google Drive: ${driveVideoId}`);
      }
      
      // Extract audio from video
      const audioPath = path.join(tempDir, `${videoId}-audio.mp3`);
      await this.extractAudio(videoPath, audioPath);
      console.log(`🎵 Audio extracted to: ${audioPath}`);
      
      // Get video duration
      const duration = await this.getVideoDuration(videoPath);
      console.log(`⏱️ Video duration: ${duration} seconds`);
      
      // Transcribe audio using OpenAI Whisper (pass video path for chunking if needed)
      const transcription = await this.transcribeAudio(audioPath, videoPath);
      console.log(`📝 Transcription completed: ${transcription.length} characters`);
      
      // Detect subject from filename using DeepSeek V3
      console.log(`🔍 Detecting subject for filename: "${originalFilename}"`);
      const subjectInfo = await SubjectDetector.detectSubject(originalFilename);
      console.log(`📊 Subject detection result:`, subjectInfo);
      
      // Store video information in database with Google Drive ID
      if (subjectInfo) {
        console.log(`✅ Subject successfully detected and will be stored: ${subjectInfo.subjectId} (${subjectInfo.subjectNumericId})`);
      } else {
        console.log(`⚠️ No subject detected - video will be stored without subject classification`);
      }
      
      const videoRecord = await this.storeVideoRecord(
        userId, 
        originalFilename, 
        driveVideoId,  // Use Google Drive ID instead of provided ID
        duration, 
        transcription, 
        subjectInfo
      );
      
      // Process and store transcript chunks
      await this.processAndStoreTranscriptChunks(videoRecord.id, transcription);
      
      // Clean up temporary files
      try {
        await unlink(videoPath);
        await unlink(audioPath);
        console.log(`🧹 Cleaned up temporary files`);
      } catch (cleanupError) {
        console.warn(`⚠️ Warning: Could not clean up temporary files:`, cleanupError);
      }
      
      return {
        videoId: driveVideoId,  // Return Google Drive ID as videoId
        originalFilename,
        audioPath: '', // No longer needed since we cleaned up
        transcription,
        duration,
        success: true
      };
      
    } catch (error) {
      console.error(`❌ Error processing video ${originalFilename}:`, error);
      return {
        videoId,
        originalFilename,
        audioPath: '',
        transcription: '',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Extract audio from video using FFmpeg with aggressive compression for OpenAI Whisper
   */
  private async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame') // Use MP3 compression
        .audioBitrate('32k')     // Very low bitrate for smaller file
        .audioFrequency(8000)    // 8kHz for speech (lower quality but much smaller)
        .audioChannels(1)        // Mono channel
        .on('end', () => {
          console.log('✅ Audio extraction completed with aggressive compression');
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Audio extraction failed:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Get video duration using FFmpeg
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }
        
        const duration = metadata.format.duration || 0;
        resolve(duration);
      });
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeAudio(audioPath: string, videoPath?: string): Promise<string> {
    try {
      console.log('🎙️ Starting transcription with OpenAI Whisper...');
      
      const audioBuffer = fs.readFileSync(audioPath);
      const audioFile = new File([audioBuffer], 'audio.mp3', { 
        type: 'audio/mp3' 
      });
      
      // Check file size to ensure it's within OpenAI's 25MB limit
      const fileSizeMB = audioBuffer.length / (1024*1024);
      console.log(`📊 Compressed audio file size: ${fileSizeMB.toFixed(2)} MB`);
      
      if (audioBuffer.length > 25 * 1024 * 1024) {
        console.log('⚠️ Audio file still too large, implementing chunking strategy...');
        
        // For very large files, transcribe first 15 minutes as sample
        const maxDurationSeconds = 15 * 60; // 15 minutes
        const tempChunkPath = audioPath.replace('.mp3', '_chunk.mp3');
        
        // Use the video path passed from caller
        if (!videoPath) {
          throw new Error('Video path required for chunking large files');
        }
        await this.extractAudioChunk(videoPath, tempChunkPath, maxDurationSeconds);
        
        // Read the chunked audio
        const chunkBuffer = fs.readFileSync(tempChunkPath);
        const chunkFile = new File([chunkBuffer], 'audio_chunk.mp3', { 
          type: 'audio/mp3' 
        });
        
        console.log(`📊 Chunked audio size: ${(chunkBuffer.length / (1024*1024)).toFixed(2)} MB`);
        
        const partialTranscription = await this.openai.audio.transcriptions.create({
          file: chunkFile as any,
          model: 'whisper-1',
          language: 'vi',
          response_format: 'text'
        });
        
        // Clean up chunk file
        try { fs.unlinkSync(tempChunkPath); } catch {}
        
        return `[PHẦN TRANSCRIPT ĐẦU - 15 PHÚT ĐẦU TIÊN]\n\n${partialTranscription}\n\n[LƯU Ý: Đây là transcript một phần do video quá dài. Toàn bộ video được lưu trữ tại ${audioPath}]`;
      }
      
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile as any,
        model: 'whisper-1',
        language: 'vi', // Vietnamese language
        response_format: 'text'
      });
      
      console.log('✅ Transcription completed successfully');
      return transcription;
      
    } catch (error) {
      console.error('❌ Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Extract audio chunk from video (first N seconds) for large files
   */
  private async extractAudioChunk(videoPath: string, audioPath: string, durationSeconds: number): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame')
        .audioBitrate('32k')
        .audioFrequency(8000)
        .audioChannels(1)
        .duration(durationSeconds)
        .on('end', () => {
          console.log(`✅ Audio chunk (${durationSeconds}s) extraction completed`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Audio chunk extraction failed:', error);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Clean up temporary files for a specific video
   */
  async cleanupVideo(videoId: string, userId: number): Promise<void> {
    try {
      const tempDir = path.join('/tmp', 'videos', String(userId));
      const files = fs.readdirSync(tempDir);
      
      for (const file of files) {
        if (file.includes(videoId)) {
          const filePath = path.join(tempDir, file);
          await unlink(filePath);
          console.log(`🗑️ Deleted temp file: ${file}`);
        }
      }
    } catch (error) {
      console.error(`❌ Error cleaning up video ${videoId}:`, error);
    }
  }

  /**
   * Get list of processed videos for a user
   */
  getProcessedVideos(userId: number): string[] {
    try {
      const tempDir = path.join('/tmp', 'videos', String(userId));
      if (!fs.existsSync(tempDir)) {
        return [];
      }
      
      const files = fs.readdirSync(tempDir);
      const videoIds = new Set<string>();
      
      for (const file of files) {
        const match = file.match(/^(\d+)-\d+-/);
        if (match) {
          videoIds.add(match[1]);
        }
      }
      
      return Array.from(videoIds);
    } catch (error) {
      console.error('❌ Error getting processed videos:', error);
      return [];
    }
  }

  /**
   * Get video processing status
   */
  getVideoStatus(videoId: string, userId: number): {
    exists: boolean;
    hasAudio: boolean;
    hasTranscription: boolean;
  } {
    try {
      const tempDir = path.join('/tmp', 'videos', String(userId));
      if (!fs.existsSync(tempDir)) {
        return { exists: false, hasAudio: false, hasTranscription: false };
      }
      
      const files = fs.readdirSync(tempDir);
      const videoFiles = files.filter(file => file.includes(videoId));
      
      const hasAudio = videoFiles.some(file => file.includes('audio.mp3'));
      const hasVideo = videoFiles.some(file => !file.includes('audio.wav'));
      
      return {
        exists: hasVideo,
        hasAudio,
        hasTranscription: hasAudio // If we have audio, we likely have transcription
      };
    } catch (error) {
      console.error('❌ Error checking video status:', error);
      return { exists: false, hasAudio: false, hasTranscription: false };
    }
  }

  /**
   * Store video record in database
   */
  private async storeVideoRecord(
    userId: number,
    fileName: string,
    googleDriveId?: string,
    duration?: number,
    transcription?: string,
    subjectInfo?: { subjectId: string; subjectNumericId: number; confidence: number } | null
  ) {
    // Create preview from first 200 characters of transcription
    const contentPreview = transcription 
      ? transcription.substring(0, 200) + (transcription.length > 200 ? '...' : '')
      : null;

    const insertData: InsertVideo = {
      userId,
      googleDriveId,
      fileName,
      subjectId: subjectInfo?.subjectId || null,
      subjectNumericId: subjectInfo?.subjectNumericId || null,
      videoUrl: googleDriveId ? `https://drive.google.com/file/d/${googleDriveId}/view` : null,
      contentPreview,
      duration,
      status: 'processed',
    };

    const [videoRecord] = await db.insert(videos).values(insertData).returning();
    console.log(`💾 Video record stored in database: ID ${videoRecord.id}`);
    return videoRecord;
  }

  /**
   * Process transcript into chunks and store with embeddings
   */
  private async processAndStoreTranscriptChunks(videoId: number, transcription: string) {
    console.log('📝 Processing transcript into chunks...');
    
    // Split transcript into chunks (similar to PDF processing)
    const chunks = this.chunkTranscript(transcription);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding for the chunk
      const embedding = await this.generateEmbedding(chunk);
      
      // Store chunk in database
      const insertData: InsertTranscriptChunk = {
        videoId,
        chunkIndex: i,
        content: chunk,
        wordCount: chunk.split(' ').length,
        embedding: JSON.stringify(embedding),
        embeddingModel: 'text-embedding-3-small'
      };
      
      await db.insert(transcriptChunks).values(insertData);
    }
    
    console.log(`✅ Stored ${chunks.length} transcript chunks with embeddings`);
  }

  /**
   * Split transcript into manageable chunks
   */
  private chunkTranscript(text: string, chunkSize: number = 1000): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 50); // Filter out very short chunks
  }

  /**
   * Generate embedding for text chunk
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const videoProcessor = new VideoProcessor();