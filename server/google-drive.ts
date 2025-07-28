import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// Service Account Configuration
interface ServiceAccountConfig {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

class GoogleDriveService {
  private drive: any;
  private auth: any;
  private rcloneConfigPath: string;
  private webdavPort: number = 8080;

  constructor() {
    this.rcloneConfigPath = path.join(process.cwd(), 'rclone.conf');
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Check if service account credentials exist in environment
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        console.log('⚠️ Google Service Account credentials not found in environment');
        return;
      }

      const serviceAccount: ServiceAccountConfig = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      
      this.auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ['https://www.googleapis.com/auth/drive']
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // Setup rclone configuration
      await this.setupRcloneConfig(serviceAccount);
      
      console.log('✅ Google Drive Service Account initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive Service:', error);
    }
  }

  private async setupRcloneConfig(serviceAccount: ServiceAccountConfig) {
    // Create temporary service account file for rclone
    const tempServiceAccountPath = path.join(process.cwd(), 'temp-service-account.json');
    const rcloneConfig = `
[gdrive]
type = drive
service_account_file = ${tempServiceAccountPath}
scope = drive
root_folder_id = 

[webdav]
type = webdav
url = http://localhost:${this.webdavPort}
vendor = other
`;

    try {
      // Write temporary service account file (will be cleaned up)
      await fs.writeFile(
        tempServiceAccountPath,
        JSON.stringify(serviceAccount, null, 2)
      );

      // Write rclone config
      await fs.writeFile(this.rcloneConfigPath, rcloneConfig.trim());
      
      console.log('✅ Rclone configuration setup complete');
      
      // Clean up temporary service account file after a delay
      setTimeout(async () => {
        try {
          await fs.unlink(tempServiceAccountPath);
          console.log('🧹 Temporary service account file cleaned up');
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 5000);
      
    } catch (error) {
      console.error('❌ Failed to setup rclone config:', error);
    }
  }

  async startWebDAVServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Starting WebDAV server on port ${this.webdavPort}...`);
      
      const rcloneProcess = spawn('rclone', [
        'serve', 'webdav',
        'gdrive:/',
        '--addr', `0.0.0.0:${this.webdavPort}`,
        '--config', this.rcloneConfigPath,
        '--log-level', 'INFO'
      ]);

      rcloneProcess.stdout.on('data', (data) => {
        console.log(`📡 WebDAV: ${data}`);
      });

      rcloneProcess.stderr.on('data', (data) => {
        console.error(`❌ WebDAV Error: ${data}`);
      });

      rcloneProcess.on('close', (code) => {
        console.log(`🛑 WebDAV server exited with code ${code}`);
      });

      // Give the server time to start
      setTimeout(() => {
        console.log(`✅ WebDAV server should be running on http://localhost:${this.webdavPort}`);
        resolve();
      }, 3000);
    });
  }

  async listFiles(folderId?: string): Promise<any[]> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.list({
        q: folderId ? `'${folderId}' in parents` : undefined,
        fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
        pageSize: 50
      });

      return response.data.files || [];
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, parentFolderId?: string): Promise<any> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: parentFolderId ? [parentFolderId] : undefined
        },
        media: {
          body: fileBuffer
        },
        fields: 'id, name, webViewLink'
      });

      console.log(`✅ File uploaded: ${fileName} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }

  async createFolder(folderName: string, parentFolderId?: string): Promise<any> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentFolderId ? [parentFolderId] : undefined
        },
        fields: 'id, name'
      });

      console.log(`✅ Folder created: ${folderName} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      throw error;
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`✅ File deleted: ${fileId}`);
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      throw error;
    }
  }

  async getFileInfo(fileId: string) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime',
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw error;
    }
  }

  async downloadFile(fileId: string, destinationPath: string): Promise<void> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const fs = await import('fs');
      
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      }, { responseType: 'stream' });

      const dest = fs.createWriteStream(destinationPath);
      response.data.pipe(dest);

      return new Promise((resolve, reject) => {
        dest.on('finish', resolve);
        dest.on('error', reject);
      });
    } catch (error) {
      console.error('❌ Error downloading file:', error);
      throw error;
    }
  }

  async getFileContent(fileId: string): Promise<Buffer> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'stream' });

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        response.data.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.data.on('end', () => resolve(Buffer.concat(chunks)));
        response.data.on('error', reject);
      });
    } catch (error) {
      console.error('❌ Error getting file content:', error);
      throw error;
    }
  }

  // Upload video file to Google Drive with specific folder structure
  async uploadVideoFile(fileName: string, buffer: Buffer, userId: number): Promise<string> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Create or find user video folder
      const folderName = `videos_user_${userId}`;
      let folderId = await this.findOrCreateVideoFolder(folderName);

      const { Readable } = await import('stream');

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: 'video/mp4',
        body: Readable.from(buffer),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
      });

      console.log(`✅ Video uploaded to Google Drive: ${fileName} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error('❌ Error uploading video to Google Drive:', error);
      throw error;
    }
  }

  // Get file information from Google Drive
  async getFileInfo(fileId: string): Promise<any> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id,name,size,mimeType,createdTime,modifiedTime'
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error getting file info:', error);
      throw error;
    }
  }

  // Get folder information
  async getFolderInfo(folderName: string): Promise<any> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Search for existing folder
      const searchResponse = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0];
      }

      return null;
    } catch (error) {
      console.error('❌ Error getting folder info:', error);
      throw error;
    }
  }

  // Find or create a video folder in Google Drive
  async findOrCreateVideoFolder(folderName: string): Promise<string> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Search for existing folder
      const searchResponse = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
      });

      if (searchResponse.data.files && searchResponse.data.files.length > 0) {
        return searchResponse.data.files[0].id;
      }

      // Create new folder if not exists
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const createResponse = await this.drive.files.create({
        requestBody: folderMetadata,
      });

      console.log(`✅ Created video folder: ${folderName} (ID: ${createResponse.data.id})`);
      return createResponse.data.id;
    } catch (error) {
      console.error('❌ Error creating video folder:', error);
      throw error;
    }
  }

  // Get file stream from Google Drive for video streaming
  async getVideoStream(fileId: string) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      }, { responseType: 'stream' });

      return response.data;
    } catch (error) {
      console.error('❌ Error getting video stream from Google Drive:', error);
      throw error;
    }
  }

  getWebDAVUrl(): string {
    return `http://localhost:${this.webdavPort}`;
  }

  isInitialized(): boolean {
    return !!this.drive;
  }
}

export const googleDriveService = new GoogleDriveService();