import { google } from 'googleapis';
import fs from 'fs/promises';
import { Readable } from 'stream';

class StudentDriveService {
  private drive: any;
  private auth: any;
  private isInitialized = false;
  private studentFolderId: string | null = null;
  private sharedDriveId: string | null = null;

  async initialize() {
    try {
      if (this.isInitialized) return;

      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
      
      if (!serviceAccountJson || !serviceAccountEmail) {
        console.log('⚠️ Student Drive Service: Missing service account credentials');
        return;
      }

      const credentials = JSON.parse(serviceAccountJson);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file'
        ],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      
      // Try to access the shared student folder
      try {
        await this.ensureStudentFolder();
      } catch (error) {
        console.log('⚠️ Cannot access shared folder "Thư mục của học sinh1" - service will run without Drive backup');
        this.studentFolderId = null;
      }
      
      this.isInitialized = true;
      console.log('✅ Student Drive Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Student Drive Service:', error);
      this.isInitialized = false;
    }
  }

  private async ensureStudentFolder(): Promise<void> {
    try {
      // Search for the shared "sech1" folder
      const folderName = 'sech1';
      // Search for folder across all drives including shared drives
      const response = await this.drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, parents, driveId)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        supportsTeamDrives: true,
        corpora: 'allDrives'
      });

      console.log(`📁 Search results for "${folderName}":`, response.data.files?.map(f => ({ 
        id: f.id, 
        name: f.name, 
        driveId: f.driveId || 'regular-drive' 
      })));

      if (response.data.files && response.data.files.length > 0) {
        const folder = response.data.files[0];
        this.studentFolderId = folder.id;
        const driveType = folder.driveId ? 'shared-drive' : 'regular-drive';
        console.log(`📁 Found shared student folder: ${this.studentFolderId} (type: ${driveType})`);
        
        // Store drive ID if it's a shared drive
        if (folder.driveId) {
          this.sharedDriveId = folder.driveId;
          console.log(`🚗 Using shared drive: ${this.sharedDriveId}`);
        }
      } else {
        // If folder not found, provide helpful instructions
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        console.error(`❌ Shared folder "${folderName}" not found.`);
        console.log(`📝 Instructions to fix:`);
        console.log(`   1. Tạo folder "${folderName}" trên Google Drive`);
        console.log(`   2. Share folder với email: ${serviceAccountEmail}`);
        console.log(`   3. Cấp quyền "Editor" cho service account`);
        throw new Error(`Shared folder "${folderName}" not accessible. Please share it with ${serviceAccountEmail}`);
      }
    } catch (error) {
      console.error('❌ Error accessing shared student folder:', error);
      throw error;
    }
  }

  private async ensureSharedDrive(): Promise<void> {
    try {
      // Check if shared drive already exists
      const existingDrives = await this.drive.drives.list({
        q: "name='Tài liệu học sinh'"
      });

      if (existingDrives.data.drives && existingDrives.data.drives.length > 0) {
        this.sharedDriveId = existingDrives.data.drives[0].id;
        console.log(`🚗 Found existing shared drive: ${this.sharedDriveId}`);
      } else {
        // Create a new shared drive
        const requestId = `student-drive-${Date.now()}`;
        const driveMetadata = {
          name: 'Tài liệu học sinh'
        };

        const sharedDrive = await this.drive.drives.create({
          requestId: requestId,
          resource: driveMetadata,
        });

        this.sharedDriveId = sharedDrive.data.id;
        console.log(`🚗 Created shared drive: ${this.sharedDriveId}`);
      }

      // Share the drive with the Gmail account
      await this.shareSharedDriveWithGmailAccount();

    } catch (error) {
      console.error('❌ Error ensuring shared drive:', error);
      // Fallback to regular folder if shared drive creation fails
      this.sharedDriveId = null;
      throw error;
    }
  }

  private async shareSharedDriveWithGmailAccount(): Promise<void> {
    try {
      const sharedGmailAccount = process.env.SHARED_GMAIL_ACCOUNT;
      
      if (!sharedGmailAccount || !this.sharedDriveId) {
        console.log('⚠️ Cannot share drive: missing Gmail account or drive ID');
        return;
      }

      // Share the shared drive with the Gmail account
      await this.drive.permissions.create({
        fileId: this.sharedDriveId,
        resource: {
          role: 'reader',
          type: 'user',
          emailAddress: sharedGmailAccount,
        },
        supportsAllDrives: true,
        sendNotificationEmail: true,
        emailMessage: 'Bạn đã được chia sẻ quyền truy cập shared drive "Tài liệu học sinh" - nơi lưu trữ tài liệu do học sinh tải lên.',
      });

      console.log(`✅ Shared drive with ${sharedGmailAccount}`);
    } catch (error) {
      console.error('❌ Error sharing drive with Gmail account:', error);
      // Don't throw error - drive creation should still succeed
    }
  }

  /**
   * Get Service Account email for sharing instructions
   */
  getServiceAccountEmail(): string | null {
    return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
  }

  /**
   * Get instructions for setting up the shared folder
   */
  getSetupInstructions(): string {
    const serviceEmail = this.getServiceAccountEmail();
    return `
📋 Hướng dẫn thiết lập Shared Drive "sech1":

❗ QUAN TRỌNG: Phải tạo SHARED DRIVE, không phải folder thường!

1. Vào Google Drive → Click "New" → "Shared drive"
2. Đặt tên: "sech1"
3. Click "Create"
4. Trong Shared Drive "sech1" → Click ⚙️ Settings → "Manage members"
5. Add member: ${serviceEmail}
6. Cấp quyền "Manager" hoặc "Content manager"
7. Click "Send"

🔄 Service Account cần quyền upload vào SHARED DRIVE, không thể upload vào folder thường!

Sau khi hoàn tất, hệ thống sẽ tự động upload tài liệu học sinh vào shared drive này.
    `.trim();
  }

  async uploadStudentDocument(filePath: string, fileName: string, userId: number, subjectId?: string): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      if (!this.isInitialized) {
        console.log('⚠️ Student Drive Service not initialized - skipping Google Drive backup');
        return null;
      }

      if (!this.studentFolderId) {
        console.log('⚠️ No shared student folder available - skipping Google Drive backup');
        return null;
      }

      // Verify we have write permission to the folder
      try {
        await this.drive.files.get({
          fileId: this.studentFolderId,
          fields: 'id, name, capabilities',
          supportsAllDrives: true,
          supportsTeamDrives: true,
        });
        console.log(`✅ Verified access to shared folder: ${this.studentFolderId}`);
      } catch (error) {
        console.error('❌ Cannot access shared folder for writing:', error);
        return null;
      }

      // Read the file
      const fileBuffer = await fs.readFile(filePath);
      
      // Create file metadata with user info
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const subjectPrefix = subjectId ? `[${subjectId}]` : '';
      const finalFileName = `${timestamp}_User${userId}_${subjectPrefix}${fileName}`;

      const fileMetadata = {
        name: finalFileName,
        parents: [this.studentFolderId],
        description: `Uploaded by User ${userId} on ${new Date().toLocaleString('vi-VN')}${subjectId ? ` - Subject: ${subjectId}` : ''}`,
      };

      // Convert Buffer to readable stream
      const stream = new Readable({
        read() {}
      });
      stream.push(fileBuffer);
      stream.push(null); // End the stream

      // Upload the file
      const media = {
        mimeType: 'application/octet-stream',
        body: stream,
      };

      // Upload with proper drive context
      const uploadParams: any = {
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink',
        supportsAllDrives: true,
        supportsTeamDrives: true,
      };

      // If this is a shared drive, add the drive ID
      if (this.sharedDriveId) {
        uploadParams.driveId = this.sharedDriveId;
        console.log(`📤 Uploading to shared drive: ${this.sharedDriveId}`);
      } else {
        console.log(`📤 Uploading to regular drive folder: ${this.studentFolderId}`);
      }

      const file = await this.drive.files.create(uploadParams);

      console.log(`✅ Uploaded student document to Drive: ${file.data.name} (${file.data.id})`);
      return file.data.id;

    } catch (error) {
      console.error('❌ Error uploading student document to Drive:', error);
      console.log('⚠️ Google Drive backup failed - document processing will continue locally');
      return null;
    }
  }

  async getStudentFolderLink(): Promise<string | null> {
    try {
      if (!this.studentFolderId) {
        await this.ensureStudentFolder();
      }

      if (!this.studentFolderId) return null;

      const response = await this.drive.files.get({
        fileId: this.studentFolderId,
        fields: 'webViewLink',
        supportsAllDrives: true,
        supportsTeamDrives: true,
      });

      return response.data.webViewLink;
    } catch (error) {
      console.error('❌ Error getting student folder link:', error);
      return null;
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export const studentDriveService = new StudentDriveService();