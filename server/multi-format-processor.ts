import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';

export interface ProcessedContent {
  text: string;
  wordCount: number;
  originalFormat: string;
}

export class MultiFormatProcessor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  /**
   * Process DOCX file and extract text content
   */
  async processDocx(filePath: string): Promise<ProcessedContent> {
    console.log('📄 Processing DOCX file:', filePath);
    
    try {
      // Read DOCX file using mammoth
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      
      if (result.messages && result.messages.length > 0) {
        console.log('⚠️ DOCX conversion warnings:', result.messages);
      }
      
      // Clean up text
      const cleanText = text
        .replace(/\r\n/g, '\n')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      console.log(`✅ Extracted ${cleanText.length} characters from DOCX`);
      
      return {
        text: cleanText,
        wordCount: cleanText.split(/\s+/).filter(word => word.length > 0).length,
        originalFormat: 'docx'
      };
      
    } catch (error) {
      console.error('❌ Error processing DOCX:', error);
      throw new Error(`Không thể xử lý file DOCX: ${error.message}`);
    }
  }

  /**
   * Process image file using OCR (ImageMagick + TesseractOCR)
   */
  async processImage(filePath: string, languages: string[] = ['eng', 'vie']): Promise<ProcessedContent> {
    console.log('🖼️ Processing image file:', filePath);
    const tempDir = '/tmp/image_processing';
    
    try {
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = path.basename(filePath, path.extname(filePath));
      const preprocessedPath = path.join(tempDir, `${fileName}_preprocessed.png`);
      
      console.log('🔧 Preprocessing image with ImageMagick...');
      
      // Check file size first (very minimal check)
      const stats = fs.statSync(filePath);
      if (stats.size < 30) {
        throw new Error('Image file is too small or corrupted');
      }
      
      console.log(`📏 Image file size: ${stats.size} bytes`);

      // Simplified ImageMagick preprocessing for better OCR accuracy
      const magickCommand = [
        'magick', 
        filePath,
        '-density', '300',           // High DPI for better text recognition
        '-colorspace', 'Gray',       // Convert to grayscale
        '-normalize',               // Normalize lighting
        '-enhance',                 // Enhance image quality
        preprocessedPath
      ].join(' ');
      
      try {
        execSync(magickCommand, { 
          stdio: 'pipe',
          timeout: 30000  // 30 second timeout
        });
        console.log('✅ Image preprocessed with ImageMagick');
      } catch (magickError) {
        console.log('⚠️ ImageMagick preprocessing failed, using original image');
        console.log('ImageMagick error:', magickError.message);
        // Copy original file as fallback
        try {
          fs.copyFileSync(filePath, preprocessedPath);
        } catch (copyError) {
          console.error('Failed to copy original file:', copyError.message);
          // Use original file path directly for OCR
          preprocessedPath = filePath;
        }
      }
      
      // OCR with TesseractOCR using both Vietnamese and English
      const langString = languages.join('+');
      console.log(`🔍 Running OCR with languages: ${langString}`);
      
      const tesseractCommand = [
        'tesseract',
        preprocessedPath,           // Remove quotes
        'stdout',
        '-l', langString,
        '--psm', '3',               // Fully automatic page segmentation
        '--oem', '3',               // Default OCR engine mode
        '-c', 'preserve_interword_spaces=1'
      ].join(' ');
      
      const ocrResult = execSync(tesseractCommand, { 
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 60000  // 60 second timeout for OCR
      });
      
      // Clean up OCR text
      const cleanText = ocrResult
        .replace(/\f/g, '')         // Remove form feed characters
        .replace(/\r\n/g, '\n')     // Normalize line endings
        .replace(/\n\s*\n/g, '\n\n') // Remove extra whitespace
        .trim();
      
      console.log(`✅ OCR completed: extracted ${cleanText.length} characters`);
      
      // Cleanup temp files (only if different from original)
      try {
        if (preprocessedPath !== filePath) {
          fs.unlinkSync(preprocessedPath);
        }
      } catch (cleanupError) {
        console.log('⚠️ Failed to cleanup temp file:', cleanupError.message);
      }
      
      if (cleanText.length < 5) {
        console.log('⚠️ OCR extracted very little text, but continuing with available content');
        // Don't throw error, allow processing with minimal text
        return {
          text: cleanText || 'No readable text found in image',
          wordCount: 1,
          originalFormat: 'image'
        };
      }
      
      return {
        text: cleanText,
        wordCount: cleanText.split(/\s+/).filter(word => word.length > 0).length,
        originalFormat: 'image'
      };
      
    } catch (error) {
      console.error('❌ Error processing image:', error);
      throw new Error(`Không thể xử lý hình ảnh: ${error.message}`);
    }
  }

  /**
   * Auto-detect file format and process accordingly
   */
  async processFile(filePath: string, mimeType: string): Promise<ProcessedContent> {
    console.log(`🔍 Processing file: ${filePath} (${mimeType})`);
    
    // DOCX files
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filePath.toLowerCase().endsWith('.docx')) {
      return await this.processDocx(filePath);
    }
    
    // Image files  
    if (mimeType.startsWith('image/') || 
        /\.(jpg|jpeg|png|bmp|tiff|gif)$/i.test(filePath)) {
      return await this.processImage(filePath);
    }
    
    // Plain text files
    if (mimeType === 'text/plain' || filePath.toLowerCase().endsWith('.txt')) {
      const text = fs.readFileSync(filePath, 'utf-8');
      return {
        text: text.trim(),
        wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
        originalFormat: 'text'
      };
    }
    
    throw new Error(`Định dạng file không được hỗ trợ: ${mimeType}`);
  }

  /**
   * Check if a file format is supported
   */
  static isSupportedFormat(mimeType: string, fileName: string): boolean {
    // DOCX files
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.toLowerCase().endsWith('.docx')) {
      return true;
    }
    
    // Image files
    if (mimeType.startsWith('image/') || 
        /\.(jpg|jpeg|png|bmp|tiff|gif)$/i.test(fileName)) {
      return true;
    }
    
    // Text files  
    if (mimeType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
      return true;
    }
    
    // PDF files (already supported)
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      return true;
    }
    
    return false;
  }

  /**
   * Get supported file extensions for UI display
   */
  static getSupportedExtensions(): string[] {
    return ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif'];
  }

  /**
   * Get file type description for users
   */
  static getFileTypeDescription(mimeType: string, fileName: string): string {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.toLowerCase().endsWith('.docx')) {
      return 'Microsoft Word Document';
    }
    
    if (mimeType.startsWith('image/')) {
      return 'Hình ảnh (sẽ được xử lý OCR)';
    }
    
    if (mimeType === 'text/plain') {
      return 'File văn bản thuần túy';
    }
    
    if (mimeType === 'application/pdf') {
      return 'PDF Document';
    }
    
    return 'File không xác định';
  }
}

// Export singleton instance
export const multiFormatProcessor = new MultiFormatProcessor();