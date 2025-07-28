import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { DatabaseStorage } from "./db-storage";
import { 
  insertUserSchema, 
  type InsertUser,
  users,
  userDevices,
  userSessions,
  adminAuditLog,
  documents,
  videos,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count } from "drizzle-orm";
import multer from 'multer';
import type { Request as MulterRequest } from 'multer';
import path from 'path';
import fs from 'fs/promises';

export async function registerRoutes(app: Express): Promise<Server> {
  const storage = new DatabaseStorage();
  
  // Configure multer for temporary document upload (PDF only)
  const uploadTempDoc = multer({
    dest: '/tmp/',
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    storage: multer.diskStorage({
      destination: '/tmp/',
      filename: (req: any, file: any, cb: any) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
      }
    }),
    fileFilter: (req: any, file: any, cb: any) => {
      console.log('📋 File filter check:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype
      });
      
      // Enhanced file type support: PDF, DOCX, Images, Text
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'text/plain', // TXT
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/bmp',
        'image/tiff',
        'image/gif'
      ];
      
      const allowedExtensions = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif'];
      const fileExtension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0];
      
      if (allowedMimeTypes.includes(file.mimetype) || 
          (fileExtension && allowedExtensions.includes(fileExtension))) {
        console.log('✅ File format accepted:', file.mimetype, fileExtension);
        cb(null, true);
      } else {
        console.log('❌ File format rejected:', file.mimetype, fileExtension);
        cb(new Error(`Định dạng file không được hỗ trợ. Chỉ chấp nhận: ${allowedExtensions.join(', ')}`));
      }
    }
  });

  // Configure multer for Google Drive upload (multiple file types)
  const uploadGoogleDrive = multer({
    storage: multer.memoryStorage(), // Store files in memory for Google Drive
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  });
  
  // Security violation logging endpoint
  app.post('/api/security/violation', (req, res) => {
    const { type, timestamp, userAgent } = req.body;
    console.log(`🚨 Security violation detected: ${type} at ${timestamp}`);
    console.log(`🔍 User Agent: ${userAgent}`);
    res.status(200).json({ logged: true });
  });

  // Get client IP endpoint
  app.get("/api/auth/client-ip", (req, res) => {
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     'unknown';
    
    res.json({ ip: clientIp });
  });

  // Authentication API routes with device tracking
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log('🔐 Auth login request:', req.body);
      const { 
        firebaseUid, 
        email, 
        displayName, 
        photoURL, 
        deviceFingerprint, 
        deviceName, 
        deviceInfo 
      } = req.body;
      
      if (!firebaseUid || !email) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ 
          success: false, 
          error: "Firebase UID và email là bắt buộc" 
        });
      }

      // Get client IP and user agent
      const clientIp = req.headers['x-forwarded-for'] || 
                       req.headers['x-real-ip'] || 
                       req.connection.remoteAddress || 
                       'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Check if user exists
      let user = await storage.getUserByFirebaseUid(firebaseUid);
      console.log('👤 Existing user found:', !!user);
      
      if (!user) {
        // Check if user exists by email (could be leftover from previous registration)
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          // Update existing user with new Firebase UID
          user = await storage.updateUserFirebaseUid(existingUser.id, firebaseUid);
          console.log('🔄 Updated existing user with Firebase UID:', user);
        } else {
          // Block access - only pre-approved users can login
          console.log('🚫 Login blocked: User not found in system, requires admin pre-approval');
          return res.status(403).json({
            success: false,
            error: "Bạn không thể đăng nhập được. Vui lòng liên hệ với Quản trị viên để được đăng nhập"
          });
        }
      }

      // Handle device fingerprinting if provided
      let sessionData = null;
      if (deviceFingerprint && deviceName && deviceInfo) {
        const { sessionManager } = await import('./session-manager');
        
        // Validate device
        const deviceValidation = await sessionManager.validateDevice(
          user.id,
          deviceFingerprint,
          deviceName,
          deviceInfo,
          clientIp as string
        );

        if (!deviceValidation.success) {
          console.log('🚫 Device validation failed:', deviceValidation.reason);
          return res.status(403).json({
            success: false,
            error: deviceValidation.reason,
            requiresApproval: deviceValidation.requiresApproval,
            exceedsLimit: deviceValidation.exceedsLimit,
          });
        }

        // Create session
        const sessionValidation = await sessionManager.createSession(
          user.id,
          deviceValidation.deviceId!,
          clientIp as string,
          userAgent
        );

        if (!sessionValidation.success) {
          console.log('🚫 Session creation failed:', sessionValidation.reason);
          return res.status(500).json({
            success: false,
            error: sessionValidation.reason,
          });
        }

        sessionData = {
          sessionId: sessionValidation.sessionId,
        };
      }

      console.log('🎉 Login successful for user:', user.email);
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          firebaseUid: user.firebaseUid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role || 'student',
          isActive: user.isActive !== false,
          maxDevices: user.maxDevices || 2,
        },
        session: sessionData,
      });
    } catch (error) {
      console.error('❌ Auth error:', error);
      res.status(500).json({ 
        success: false, 
        error: "Có lỗi xảy ra khi xử lý đăng nhập" 
      });
    }
  });

  // Admin device management endpoints
  app.get("/api/admin/users", async (req, res) => {
    try {
      // Check admin permission (simplified for now)
      const adminUserId = req.query.adminId;
      if (!adminUserId) {
        return res.status(401).json({ success: false, error: "Admin authorization required" });
      }

      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      
      // Get device and session counts for each user
      const usersWithStats = await Promise.all(
        allUsers.map(async (user) => {
          const [deviceCount] = await db
            .select({ count: count() })
            .from(userDevices)
            .where(eq(userDevices.userId, user.id));
          
          const [sessionCount] = await db
            .select({ count: count() })
            .from(userSessions)
            .where(and(
              eq(userSessions.userId, user.id),
              eq(userSessions.isActive, true)
            ));

          return {
            ...user,
            deviceCount: deviceCount.count,
            activeSessionCount: sessionCount.count,
          };
        })
      );

      res.json({ success: true, users: usersWithStats });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/user/:userId/devices", async (req, res) => {
    try {
      const { userId } = req.params;
      const { sessionManager } = await import('./session-manager');
      
      const devices = await sessionManager.getUserDevices(parseInt(userId));
      res.json({ success: true, devices });
    } catch (error) {
      console.error("Get user devices error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch devices" });
    }
  });

  app.get("/api/admin/user/:userId/sessions", async (req, res) => {
    try {
      const { userId } = req.params;
      const { sessionManager } = await import('./session-manager');
      
      const sessions = await sessionManager.getUserSessions(parseInt(userId));
      res.json({ success: true, sessions });
    } catch (error) {
      console.error("Get user sessions error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch sessions" });
    }
  });

  // Get all devices pending approval
  app.get("/api/admin/devices/pending", async (req, res) => {
    try {
      const pendingDevices = await db
        .select({
          device: userDevices,
          user: users,
        })
        .from(userDevices)
        .innerJoin(users, eq(userDevices.userId, users.id))
        .where(eq(userDevices.isApproved, false));

      res.json({ 
        success: true, 
        devices: pendingDevices.map(item => ({
          ...item.device,
          user: item.user
        }))
      });
    } catch (error) {
      console.error("Get pending devices error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch pending devices" });
    }
  });

  app.post("/api/admin/device/:deviceId/approve", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { approved, adminId } = req.body;
      const { sessionManager } = await import('./session-manager');
      
      const success = await sessionManager.setDeviceApproval(
        parseInt(deviceId),
        approved,
        parseInt(adminId)
      );
      
      if (success) {
        res.json({ success: true, message: approved ? "Device approved" : "Device blocked" });
      } else {
        res.status(500).json({ success: false, error: "Failed to update device" });
      }
    } catch (error) {
      console.error("Device approval error:", error);
      res.status(500).json({ success: false, error: "Failed to update device" });
    }
  });

  app.post("/api/admin/user/:userId/force-logout", async (req, res) => {
    try {
      const { userId } = req.params;
      const { adminId, reason } = req.body;
      const { sessionManager } = await import('./session-manager');
      
      const success = await sessionManager.forceLogoutUser(
        parseInt(userId),
        parseInt(adminId),
        reason || "Admin force logout"
      );
      
      if (success) {
        res.json({ success: true, message: "User logged out successfully" });
      } else {
        res.status(500).json({ success: false, error: "Failed to logout user" });
      }
    } catch (error) {
      console.error("Force logout error:", error);
      res.status(500).json({ success: false, error: "Failed to logout user" });
    }
  });

  app.post("/api/admin/user/:userId/device-limit", async (req, res) => {
    try {
      const { userId } = req.params;
      const { maxDevices, adminId } = req.body;
      const { sessionManager } = await import('./session-manager');
      
      const success = await sessionManager.setUserDeviceLimit(
        parseInt(userId),
        parseInt(maxDevices),
        parseInt(adminId)
      );
      
      if (success) {
        res.json({ success: true, message: "Device limit updated" });
      } else {
        res.status(500).json({ success: false, error: "Failed to update device limit" });
      }
    } catch (error) {
      console.error("Set device limit error:", error);
      res.status(500).json({ success: false, error: "Failed to update device limit" });
    }
  });

  app.get("/api/admin/sessions/all", async (req, res) => {
    try {
      const { sessionManager } = await import('./session-manager');
      
      const sessions = await sessionManager.getAllActiveSessions();
      res.json({ success: true, sessions });
    } catch (error) {
      console.error("Get all sessions error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/admin/audit-log", async (req, res) => {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const auditLogs = await db
        .select({
          log: adminAuditLog,
          admin: { id: users.id, email: users.email, displayName: users.displayName },
          targetUser: { id: users.id, email: users.email, displayName: users.displayName }
        })
        .from(adminAuditLog)
        .leftJoin(users, eq(adminAuditLog.adminId, users.id))
        .leftJoin(users as any, eq(adminAuditLog.targetUserId, users.id))
        .orderBy(desc(adminAuditLog.timestamp))
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
      
      res.json({ success: true, logs: auditLogs });
    } catch (error) {
      console.error("Get audit log error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch audit log" });
    }
  });

  // Chat API routes
  app.post("/api/chat/send", async (req, res) => {
    try {
      const { message, subjectId, context, model, userId, sessionId } = req.body;
      
      // Debug log
      console.log('💬 Chat request received:', {
        message: message?.substring(0, 50),
        subjectId,
        model,
        userId,
        sessionId,
        hasMessage: !!message,
        hasSubjectId: !!subjectId,
        hasUserId: !!userId
      });
      
      if (!message || !subjectId || !userId) {
        console.log('❌ Missing required fields:', { message: !!message, subjectId: !!subjectId, userId: !!userId });
        return res.status(400).json({
          success: false,
          error: "Tin nhắn, môn học và userId là bắt buộc"
        });
      }

      console.log(`💬 Chat request for ${subjectId}:`, message);
      
      // Import helper function to get numeric ID
      const { getSubjectNumericId } = await import('./subjects');
      const subjectNumericId = getSubjectNumericId(subjectId);
      
      let currentSessionId = sessionId;
      
      // If no sessionId provided, create new session
      if (!currentSessionId) {
        const newSession = await storage.createChatSession({
          userId: parseInt(userId),
          subjectId,
          subjectNumericId,
          title: message.slice(0, 50) + (message.length > 50 ? "..." : ""), // First message as title
          sessionType: "qa" // Q&A chat type
        });
        currentSessionId = newSession.id;
        console.log(`📝 Created new Q&A chat session:`, currentSessionId);
      }
      
      // Save user message
      await storage.createChatMessage({
        sessionId: currentSessionId,
        subjectId,
        subjectNumericId,
        content: message,
        isUser: true
      });
      
      // Check if query is irrelevant/nonsensical
      const { isIrrelevantQuery } = await import('./deepseek');
      if (isIrrelevantQuery(message)) {
        console.log('🚫 Irrelevant query detected, returning standard response');
        return res.json({
          success: true,
          response: "Nội dung không liên quan đến việc học. Vui lòng đặt câu hỏi về môn học để tôi có thể hỗ trợ bạn tốt hơn.",
          cached: false
        });
      }

      // Search for relevant document chunks using simple vector search
      let relevantContext = "";
      try {
        console.log('🔍 Starting simple vector search for chat message...');
        const { vectorService } = await import('./vector-service');
        const searchResults = await vectorService.searchSimilarChunksWithAI(message, subjectId, userId, sessionId);
        
        if (searchResults.length > 0) {
          console.log(`✅ Found ${searchResults.length} document chunks for chat - DeepSeek will self-evaluate relevance`);
          
          relevantContext = "\n\n📚 **CÁC TÀI LIỆU LIÊN QUAN - DEEPSEEK ĐÁNH GIÁ:**\n" + 
            searchResults.map((result, index) => {
              const chunkIndex = vectorService.chunkIds.indexOf(result.chunkId);
              const isExercise = chunkIndex >= 0 ? vectorService.chunkIsExercise[chunkIndex] : false;
              const exerciseLabel = isExercise ? " [BÀI TẬP]" : " [LÝ THUYẾT]";
              return `\n### Tài liệu ${index + 1}${exerciseLabel} (similarity: ${(result.similarity * 100).toFixed(1)}%):\n${result.content}`;
            }).join('\n');
        } else {
          console.log('📭 No relevant document chunks found for this query');
        }
      } catch (vectorError: unknown) {
        console.log('⚠️ Vector search failed, continuing without context:', vectorError instanceof Error ? vectorError.message : 'Unknown error');
      }

      // Import Hybrid DeepSeek service for Q&A Chat (auto V3/R1 selection)
      const { getHybridDeepSeekResponse } = await import('./deepseek');
      
      // Get response from Hybrid DeepSeek with relevant context - DeepSeek will self-evaluate
      const enhancedContext = (context || "") + relevantContext;
      const hybridResponse = await getHybridDeepSeekResponse(message, subjectId, enhancedContext);
      const aiResponse = hybridResponse;
      
      // Save AI response
      await storage.createChatMessage({
        sessionId: currentSessionId,
        subjectId,
        subjectNumericId,
        content: aiResponse.content,
        isUser: false
      });
      
      console.log(`✅ ${hybridResponse.model} response saved for session ${currentSessionId}`);
      
      res.json({ 
        success: true, 
        response: aiResponse.content,
        sessionId: currentSessionId,
        subject: aiResponse.subject,
        timestamp: aiResponse.timestamp,
        model: hybridResponse.model,
        complexity: hybridResponse.complexity
      });
    } catch (error) {
      console.error('❌ Chat error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Có lỗi xảy ra khi xử lý tin nhắn" 
      });
    }
  });

  // Get chat history for user
  app.get("/api/chat/sessions/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessions = await storage.getChatSessionsByUserId(parseInt(userId));
      
      res.json({
        success: true,
        sessions
      });
    } catch (error) {
      console.error('💥 Error getting chat sessions:', error);
      res.status(500).json({
        success: false,
        error: "Có lỗi xảy ra khi lấy lịch sử chat"
      });
    }
  });

  // Get messages for a specific session
  app.get("/api/chat/session/:sessionId/messages", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessagesBySessionId(parseInt(sessionId));
      
      res.json({
        success: true,
        messages
      });
    } catch (error) {
      console.error('💥 Error getting chat messages:', error);
      res.status(500).json({
        success: false,
        error: "Có lỗi xảy ra khi lấy tin nhắn"
      });
    }
  });

  // Delete chat session
  app.delete('/api/chat/sessions/:sessionId', async (req, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      
      if (isNaN(sessionId)) {
        return res.status(400).json({ success: false, error: 'Invalid session ID' });
      }

      // Delete all messages in the session first
      await storage.deleteChatMessagesBySession(sessionId);
      
      // Then delete the session
      await storage.deleteChatSession(sessionId);

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Error deleting chat session:', error);
      res.status(500).json({ success: false, error: 'Failed to delete chat session' });
    }
  });

  // Student folder link endpoint
  app.get("/api/student-drive/folder-link", async (req, res) => {
    try {
      const { studentDriveService } = await import('./student-drive-service');
      
      if (!studentDriveService.isServiceInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Student Drive Service chưa được khởi tạo"
        });
      }

      const folderLink = await studentDriveService.getStudentFolderLink();
      
      if (folderLink) {
        res.json({
          success: true,
          folderLink,
          message: "Link folder 'sech1'"
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Không thể lấy link folder 'sech1'",
          setupInstructions: "Vui lòng liên hệ quản trị viên để thiết lập folder"
        });
      }
    } catch (error: unknown) {
      console.error('❌ Error getting student folder link:', error);
      res.status(500).json({
        success: false,
        error: "Lỗi khi lấy link folder"
      });
    }
  });

  // Student Drive setup instructions endpoint  
  app.get('/api/student-drive/setup-instructions', async (req, res) => {
    try {
      const { studentDriveService } = await import('./student-drive-service');
      
      res.json({
        success: true,
        serviceAccountEmail: studentDriveService.getServiceAccountEmail(),
        instructions: studentDriveService.getSetupInstructions(),
        folderName: 'sech1'
      });
    } catch (error: unknown) {
      console.error('Error getting setup instructions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get setup instructions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Google Drive API routes with Service Account integration
  app.get("/api/drive/files", async (req, res) => {
    try {
      const folderId = req.query.folderId as string;
      
      // Import Google Drive service
      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account chưa được cấu hình. Vui lòng thêm GOOGLE_SERVICE_ACCOUNT_JSON vào environment variables."
        });
      }

      const files = await googleDriveService.listFiles(folderId);
      
      res.json({
        success: true,
        files: files
      });
    } catch (error) {
      console.error('❌ Error listing Google Drive files:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tải danh sách tệp từ Google Drive"
      });
    }
  });

  // Create folder in Google Drive
  app.post("/api/drive/create-folder", async (req, res) => {
    try {
      const { name, parentFolderId } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: "Tên thư mục là bắt buộc"
        });
      }

      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account chưa được cấu hình"
        });
      }

      const folder = await googleDriveService.createFolder(name, parentFolderId);
      
      res.json({
        success: true,
        folder: folder
      });
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tạo thư mục"
      });
    }
  });

  // Upload files to Google Drive  
  app.post("/api/drive/upload", uploadGoogleDrive.array('files'), async (req, res) => {
    try {
      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account chưa được cấu hình"
        });
      }

      // Handle multipart form data with multer
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({
          success: false,
          error: "Không có tệp nào được tải lên"
        });
      }

      const files = req.files as Express.Multer.File[];
      const folderId = req.body.folderId;
      const uploadedFiles = [];

      for (const file of files) {
        if (file && file.buffer) {
          const result = await googleDriveService.uploadFile(
            file.originalname,
            file.buffer,
            folderId
          );
          uploadedFiles.push(result);
        }
      }

      res.json({
        success: true,
        files: uploadedFiles,
        message: `Đã tải lên ${uploadedFiles.length} tệp thành công`
      });
    } catch (error) {
      console.error('❌ Error uploading files:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tải lên tệp"
      });
    }
  });

  // Delete file from Google Drive
  app.delete("/api/drive/files/:fileId", async (req, res) => {
    try {
      const fileId = req.params.fileId;
      
      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account chưa được cấu hình"
        });
      }

      await googleDriveService.deleteFile(fileId);
      
      res.json({
        success: true,
        message: "Tệp đã được xóa thành công"
      });
    } catch (error) {
      console.error('❌ Error deleting file:', error);
      res.status(500).json({
        success: false,
        error: "Không thể xóa tệp"
      });
    }
  });

  // Start WebDAV server endpoint
  app.post("/api/drive/start-webdav", async (req, res) => {
    try {
      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(503).json({
          success: false,
          error: "Google Drive Service Account chưa được cấu hình"
        });
      }

      await googleDriveService.startWebDAVServer();
      
      res.json({
        success: true,
        webdavUrl: googleDriveService.getWebDAVUrl(),
        message: "WebDAV server đã được khởi động"
      });
    } catch (error) {
      console.error('❌ Error starting WebDAV server:', error);
      res.status(500).json({
        success: false,
        error: "Không thể khởi động WebDAV server"
      });
    }
  });

  // PDF Processing API endpoints
  app.post("/api/documents/process-pdf", async (req, res) => {
    try {
      const { fileId, userId, subjectId, subjectNumericId } = req.body;
      
      if (!fileId || !userId) {
        return res.status(400).json({
          success: false,
          error: "File ID và User ID là bắt buộc"
        });
      }

      // Import PDF processing service
      const { googleDrivePDFService } = await import('./google-drive-pdf');
      
      const result = await googleDrivePDFService.processPDFFromDrive(
        fileId, 
        userId, 
        subjectId, // Can be null - will auto-detect
        subjectNumericId // Can be null - will auto-detect
      );
      
      res.json({
        success: true,
        documentId: result.documentId,
        chunksCount: result.chunksCount,
        message: `PDF đã được xử lý thành công với ${result.chunksCount} chunks`
      });
    } catch (error: unknown) {
      console.error('❌ Error processing PDF:', error);
      res.status(500).json({
        success: false,
        error: `Không thể xử lý PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Subject detection API endpoint
  app.post("/api/documents/detect-subject", async (req, res) => {
    try {
      const { filename } = req.body;
      
      if (!filename) {
        return res.status(400).json({
          success: false,
          error: "Filename là bắt buộc"
        });
      }

      const { SubjectDetector } = await import('./subject-detector');
      const result = SubjectDetector.detectSubjectFromFirstWords(filename);
      
      if (result) {
        const subject = SubjectDetector.getSubjectById(result.subjectId);
        res.json({
          success: true,
          detected: true,
          subjectId: result.subjectId,
          subjectNumericId: result.subjectNumericId,
          subjectName: subject?.name,
          confidence: result.confidence,
          method: "First Words"
        });
      } else {
        res.json({
          success: true,
          detected: false,
          message: "Không thể xác định môn học từ tên file"
        });
      }
    } catch (error) {
      console.error('❌ Error detecting subject:', error);
      res.status(500).json({
        success: false,
        error: "Không thể xác định môn học"
      });
    }
  });

  // Document analysis endpoint (using DeepSeek R1)
  app.post("/api/documents/analyze", async (req, res) => {
    try {
      const { content, subjectId } = req.body;
      
      if (!content || !subjectId) {
        return res.status(400).json({
          success: false,
          error: "Content và subjectId là bắt buộc"
        });
      }

      console.log(`📄 Analyzing document with DeepSeek R1 for subject: ${subjectId}`);
      const { analyzeDocumentWithDeepSeekR1 } = await import('./deepseek');
      
      const analysis = await analyzeDocumentWithDeepSeekR1(content, subjectId);
      
      res.json({
        success: true,
        analysis,
        method: "DeepSeek R1"
      });
      
    } catch (error: unknown) {
      console.error('❌ Error analyzing document:', error);
      res.status(500).json({
        success: false,
        error: `Lỗi phân tích tài liệu: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Vector search endpoints
  app.post("/api/vector/search", async (req, res) => {
    try {
      const { query, subjectId, topK = 5 } = req.body;
      
      if (!query) {
        return res.status(400).json({
          success: false,
          error: "Query là bắt buộc"
        });
      }

      const { vectorService } = await import('./vector-service');
      const results = await vectorService.searchSimilarChunks(query, topK, subjectId);
      
      res.json({
        success: true,
        query,
        results,
        count: results.length
      });
    } catch (error) {
      console.error('❌ Error in vector search:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tìm kiếm vector"
      });
    }
  });

  app.post("/api/vector/process-all-chunks", async (req, res) => {
    try {
      const { vectorService } = await import('./vector-service');
      await vectorService.processAllChunks();
      await vectorService.rebuildIndex();
      
      const stats = await vectorService.getEmbeddingStats();
      
      res.json({
        success: true,
        message: "Đã xử lý tất cả chunks",
        stats
      });
    } catch (error) {
      console.error('❌ Error processing all chunks:', error);
      res.status(500).json({
        success: false,
        error: "Không thể xử lý chunks"
      });
    }
  });

  app.get("/api/vector/stats", async (req, res) => {
    try {
      const { vectorService } = await import('./vector-service');
      const stats = await vectorService.getEmbeddingStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Error getting vector stats:', error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy thống kê"
      });
    }
  });

  // Delete vectors for a specific document
  app.delete("/api/vector/document/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const { isTemporary } = req.query;
      
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          error: "Document ID không hợp lệ"
        });
      }
      
      const { vectorService } = await import('./vector-service');
      await vectorService.deleteDocumentVectors(documentId, isTemporary === 'true');
      
      res.json({
        success: true,
        message: `Đã xóa vectors cho tài liệu ${documentId}`
      });
    } catch (error) {
      console.error('❌ Error deleting document vectors:', error);
      res.status(500).json({
        success: false,
        error: "Không thể xóa vectors"
      });
    }
  });

  // Delete specific chunk vectors
  app.delete("/api/vector/chunks", async (req, res) => {
    try {
      const { chunkIds, isTemporary } = req.body;
      
      if (!Array.isArray(chunkIds) || chunkIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Danh sách chunk IDs không hợp lệ"
        });
      }
      
      const { vectorService } = await import('./vector-service');
      await vectorService.deleteChunkVectors(chunkIds, isTemporary || false);
      
      res.json({
        success: true,
        message: `Đã xóa ${chunkIds.length} chunk vectors`
      });
    } catch (error) {
      console.error('❌ Error deleting chunk vectors:', error);
      res.status(500).json({
        success: false,
        error: "Không thể xóa chunk vectors"
      });
    }
  });

  // Manual cleanup of expired temporary vectors
  app.post("/api/vector/cleanup", async (req, res) => {
    try {
      const { vectorService } = await import('./vector-service');
      await vectorService.cleanupExpiredTemporaryVectors();
      
      res.json({
        success: true,
        message: "Đã thực hiện dọn dẹp vectors hết hạn"
      });
    } catch (error) {
      console.error('❌ Error during manual cleanup:', error);
      res.status(500).json({
        success: false,
        error: "Không thể thực hiện dọn dẹp"
      });
    }
  });

  // Get cleanup statistics
  app.get("/api/vector/cleanup-stats", async (req, res) => {
    try {
      const { vectorService } = await import('./vector-service');
      const stats = await vectorService.getCleanupStats();
      
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('❌ Error getting cleanup stats:', error);
      res.status(500).json({
        success: false,
        error: "Không thể lấy thống kê dọn dẹp"
      });
    }
  });

  // Force server crash cleanup (admin only)
  app.post("/api/vector/crash-cleanup", async (req, res) => {
    try {
      const { vectorService } = await import('./vector-service');
      await vectorService.handleServerCrashCleanup();
      
      res.json({
        success: true,
        message: "Đã thực hiện dọn dẹp crash cleanup"
      });
    } catch (error) {
      console.error('❌ Error during crash cleanup:', error);
      res.status(500).json({
        success: false,
        error: "Không thể thực hiện crash cleanup"
      });
    }
  });

  // Get document with chunks
  app.get("/api/documents/:documentId", async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      
      if (isNaN(documentId)) {
        return res.status(400).json({
          success: false,
          error: "Document ID không hợp lệ"
        });
      }

      const { pdfProcessor } = await import('./pdf-processor');
      const document = await pdfProcessor.getDocumentWithChunks(documentId);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: "Không tìm thấy tài liệu"
        });
      }
      
      res.json({
        success: true,
        document
      });
    } catch (error) {
      console.error('❌ Error fetching document:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tải tài liệu"
      });
    }
  });

  // Search in documents
  app.get("/api/documents/search", async (req, res) => {
    try {
      const { query, userId, subjectId } = req.query;
      
      if (!query || !userId) {
        return res.status(400).json({
          success: false,
          error: "Query và User ID là bắt buộc"
        });
      }

      const { pdfProcessor } = await import('./pdf-processor');
      const results = await pdfProcessor.searchInDocuments(
        query as string, 
        parseInt(userId as string), 
        subjectId as string
      );
      
      res.json({
        success: true,
        results
      });
    } catch (error) {
      console.error('❌ Error searching documents:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tìm kiếm tài liệu"
      });
    }
  });

  // List user documents
  app.get("/api/documents/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: "User ID không hợp lệ"
        });
      }

      const userDocuments = await db.select()
        .from(documents)
        .where(eq(documents.userId, userId))
        .orderBy(desc(documents.uploadedAt));
      
      res.json({
        success: true,
        documents: userDocuments
      });
    } catch (error) {
      console.error('❌ Error fetching user documents:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tải danh sách tài liệu"
      });
    }
  });

  // Subject data API
  app.get("/api/subjects", async (req, res) => {
    try {
      const subjects = [
        {
          id: "MATH_001",
          name: "Toán học",
          nameEn: "math",
          description: "Giải toán, tính toán nhanh, học xA",
          icon: "calculator",
          gradientFrom: "from-pink-500",
          gradientTo: "to-pink-600",
        },
        {
          id: "LIT_001",
          name: "Ngữ văn",
          nameEn: "literature", 
          description: "Văn học, ngữ pháp, từ vựng, tiếng việt",
          icon: "book-open",
          gradientFrom: "from-purple-500",
          gradientTo: "to-purple-600",
        },
        // ... other subjects
      ];
      
      res.json({ success: true, subjects });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: "Không thể tải danh sách môn học" 
      });
    }
  });

  // Temporary document upload and processing endpoints
  app.post("/api/temp-documents/upload", uploadTempDoc.single('file'), async (req, res) => {
    try {
      console.log('📤 Upload request received');
      console.log('Body:', req.body);
      console.log('File:', req.file);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Không có file được tải lên"
        });
      }

      const { userId, subjectId } = req.body;
      const uploadedFile = req.file;
      
      console.log('📁 File info:', {
        originalname: uploadedFile.originalname,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        path: uploadedFile.path
      });

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID là bắt buộc"
        });
      }

      console.log(`📤 Processing temporary document upload: ${uploadedFile.originalname}`);

      // Get subject info if provided
      let subjectNumericId = undefined;
      if (subjectId) {
        const { getSubjectNumericId } = await import('./subjects');
        subjectNumericId = getSubjectNumericId(subjectId);
      }

      // Process file using enhanced multi-format processor
      const sessionId = req.body.sessionId ? parseInt(req.body.sessionId, 10) : undefined;
      let result;
      
      // Determine processing method based on file type
      if (uploadedFile.mimetype === 'application/pdf') {
        // PDF processing (existing method)
        const { tempPDFProcessor } = await import('./temp-pdf-processor');
        result = await tempPDFProcessor.processTempPDF({
          pdfPath: uploadedFile.path,
          userId: parseInt(userId),
          fileName: uploadedFile.originalname,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.mimetype,
          subjectId,
          subjectNumericId,
          sessionId
        });
      } else {
        // Multi-format processing (DOCX, Images, Text)
        console.log(`🔄 Processing ${uploadedFile.originalname} with multi-format processor...`);
        const { multiFormatProcessor } = await import('./multi-format-processor');
        const processedContent = await multiFormatProcessor.processFile(uploadedFile.path, uploadedFile.mimetype);
        
        // Create temporary document record with processed content
        const { tempPDFProcessor } = await import('./temp-pdf-processor');
        result = await tempPDFProcessor.createTempDocumentFromText({
          extractedText: processedContent.text,
          userId: parseInt(userId),
          fileName: uploadedFile.originalname,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.mimetype,
          subjectId,
          subjectNumericId,
          sessionId,
          originalFormat: processedContent.originalFormat
        });
      }

      // Save to Google Drive in "Tài liệu của học sinh" folder
      let driveFileId = null;
      try {
        console.log('📤 Uploading document to Google Drive...');
        const { studentDriveService } = await import('./student-drive-service');
        driveFileId = await studentDriveService.uploadStudentDocument(
          uploadedFile.path,
          uploadedFile.originalname,
          parseInt(userId),
          subjectId
        );
        
        if (driveFileId) {
          console.log(`✅ Document uploaded to Google Drive: ${driveFileId}`);
        } else {
          console.log('⚠️ Failed to upload to Google Drive, but processing continues');
        }
      } catch (driveError) {
        console.error('⚠️ Google Drive upload failed:', driveError);
        // Don't fail the entire request if Drive upload fails
      }

      // Clean up temporary file
      await fs.unlink(uploadedFile.path).catch(() => {});

      res.json({
        success: true,
        message: `File đã được tải lên và xử lý thành công${driveFileId ? ' (đã lưu vào Google Drive)' : ''}`,
        documentId: result.documentId,
        chunksCount: result.chunksCount,
        driveFileId: driveFileId
      });

      // Rebuild FAISS index after adding temporary document
      try {
        console.log('🔄 Rebuilding FAISS index with new temporary document...');
        const { vectorService } = await import('./vector-service');
        await vectorService.rebuildIndex();
        console.log('✅ FAISS index rebuilt successfully');
      } catch (rebuildError) {
        console.error('⚠️ Failed to rebuild FAISS index:', rebuildError);
        // Don't fail the entire request if index rebuild fails
      }

    } catch (error: unknown) {
      console.error('❌ Error uploading temporary document:', error);
      res.status(500).json({
        success: false,
        error: `Không thể xử lý file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Get temporary documents for a user
  app.get("/api/temp-documents/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: "User ID không hợp lệ"
        });
      }

      const { temporaryDocuments } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');
      const { db } = await import('./db');

      const documents = await db
        .select()
        .from(temporaryDocuments)
        .where(eq(temporaryDocuments.userId, userId))
        .orderBy(desc(temporaryDocuments.uploadedAt));

      res.json({
        success: true,
        documents
      });

    } catch (error) {
      console.error('❌ Error fetching temporary documents:', error);
      res.status(500).json({
        success: false,
        error: "Không thể tải danh sách tài liệu"
      });
    }
  });

  // Video Q&A Chat endpoint with transcript vector search
  app.post("/api/video/chat", async (req, res) => {
    try {
      const { message, subjectId, userId, sessionId, model = 'gpt-4o' } = req.body;
      
      if (!message || !subjectId || !userId) {
        return res.status(400).json({
          success: false,
          error: "Message, subjectId, và userId là bắt buộc"
        });
      }

      // Get subjectNumericId from subjectId
      const subjectMapping: Record<string, number> = {
        "MATH_001": 1, "LIT_001": 2, "ENG_001": 3, "HIS_001": 4,
        "GEO_001": 5, "BIO_001": 6, "PHY_001": 7, "CHE_001": 8
      };
      const subjectNumericId = subjectMapping[subjectId];
      
      if (!subjectNumericId) {
        return res.status(400).json({
          success: false,
          error: "Subject ID không hợp lệ"
        });
      }

      // Detect if user wants to view video ("xem", "play", "chơi", "hiển thị", etc)
      const viewKeywords = ["xem", "play", "chơi", "hiển thị", "mở video", "xem video", "chạy video", "khởi động"];
      const isViewRequest = viewKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
      );

      if (isViewRequest) {
        // Use vector search to find the most relevant video for the user's query
        const { vectorService } = await import('./vector-service');
        const relevantVideo = await vectorService.searchRelevantVideo(message, userId, subjectId);
        
        if (relevantVideo) {
          console.log(`🎯 Found relevant video: ${relevantVideo.fileName} (similarity: ${relevantVideo.similarity.toFixed(3)})`);
          
          // Search for related documents based on video content
          const { vectorService } = await import('./vector-service');
          console.log(`🔍 Searching for documents related to video: ${relevantVideo.fileName}`);
          const relatedDocuments = await vectorService.searchRelatedDocuments(
            relevantVideo.fileName, 
            relevantVideo.transcriptMatch, 
            subjectId, 
            3 // Limit to top 3 documents
          );
          
          // Extract clean video title without file extension
          const cleanTitle = relevantVideo.fileName.replace(/\.(mp4|avi|mov|mkv)$/i, '');
          
          // Build response with related documents
          let response = `🎥 **${cleanTitle}**\n\nTôi đã tìm thấy video phù hợp với câu hỏi của bạn! Video sẽ tự động phát để bạn có thể xem luôn.\n\n⏳ Quá trình load video thường mất từ 10 - 20 giây, mong các bạn thông cảm!\n\nTrong khi xem, bạn có thể tiếp tục hỏi tôi về bất kỳ nội dung nào trong video nhé!`;
          
          // Add related documents section if found
          if (relatedDocuments.length > 0) {
            response += `\n\n📚 **Tài liệu liên quan được tìm thấy:**\n`;
            relatedDocuments.forEach((doc, index) => {
              response += `${index + 1}. **${doc.fileName}** (${(doc.similarity * 100).toFixed(0)}% tương đồng)\n   *${doc.chunkMatch}*\n\n`;
            });
            response += `💡 *Những tài liệu này có nội dung tương tự với video, giúp bạn hiểu sâu hơn về chủ đề!*`;
          }
          
          return res.json({
            success: true,
            response,
            action: "SHOW_VIDEO",
            videoId: relevantVideo.googleDriveId,
            sessionId,
            uploaderUserId: relevantVideo.uploaderUserId,
            autoPlay: true,
            relatedDocuments // Include for potential frontend use
          });
        } else {
          return res.json({
            success: true,
            response: "Tôi đang tìm video phù hợp cho bạn. Video sẽ được hiển thị và tự động phát ngay.\n\nTrong khi xem video, bạn có thể tiếp tục hỏi tôi về nội dung bất cứ lúc nào!",
            action: "SHOW_VIDEO",
            sessionId,
            autoPlay: true
          });
        }
      }

      // Check if query is irrelevant/nonsensical
      const { isIrrelevantQuery } = await import('./deepseek');
      if (isIrrelevantQuery(message)) {
        console.log('🚫 Irrelevant video query detected, returning standard response');
        return res.json({
          success: true,
          response: "Nội dung không liên quan đến việc học. Vui lòng đặt câu hỏi về môn học để tôi có thể hỗ trợ bạn tốt hơn.",
          cached: false
        });
      }

      // Perform transcript vector search for regular questions
      const { vectorService } = await import('./vector-service');
      
      console.log('🎬 Video chat simple vector search for:', message);
      const vectorResults = await vectorService.searchSimilarChunksWithAI(
        message, 
        subjectId,
        userId, 
        sessionId
      );

      // Create context from transcript chunks - DeepSeek will self-evaluate
      let context = '';
      if (vectorResults.length > 0) {
        console.log(`🎥 Video context found: ${vectorResults.length} transcript chunks - DeepSeek will self-evaluate relevance`);
        
        context = '🎬 **CÁC TRANSCRIPT LIÊN QUAN - DEEPSEEK ĐÁNH GIÁ:**\n\n';
        vectorResults.forEach((result, index) => {
          context += `**Transcript ${index + 1}** (similarity: ${result.similarity.toFixed(3)}):\n`;
          context += `${result.content}\n\n`;
        });
        context += '---\n\n';
      }

      // Generate video-specific response - DeepSeek will self-evaluate relevance
      const { getDeepSeekR1ResponseForVideo } = await import('./deepseek');
      const chatResponse = await getDeepSeekR1ResponseForVideo(
        message, 
        subjectId, 
        context
      );

      // Import necessary database and schemas for operations
      const { db } = await import('./db');
      const { chatSessions, chatMessages } = await import('../shared/schema');
      
      // Save to chat session if needed
      let currentSessionId = sessionId;
      if (!sessionId) {
        // Create new video session
        const [newSession] = await db
          .insert(chatSessions)
          .values({
            userId: userId,
            subjectId: subjectId,
            subjectNumericId: subjectNumericId,
            title: `Video: ${message.substring(0, 50)}...`,
            sessionType: "video" // Video chat type
          })
          .returning();
        currentSessionId = newSession.id;
      }

      // Save messages
      await db.insert(chatMessages).values([
        {
          sessionId: currentSessionId,
          subjectId: subjectId,
          subjectNumericId: subjectNumericId,
          content: message,
          isUser: true
        },
        {
          sessionId: currentSessionId,
          subjectId: subjectId,
          subjectNumericId: subjectNumericId,
          content: chatResponse.content,
          isUser: false
        }
      ]);

      res.json({
        success: true,
        response: chatResponse.content,
        sessionId: currentSessionId,
        vectorResults: vectorResults.length > 0 ? vectorResults.length : 0
      });

    } catch (error) {
      console.error('❌ Video chat error:', error);
      res.status(500).json({
        success: false,
        error: "Lỗi khi xử lý chat video"
      });
    }
  });

  // Serve video files from Google Drive for playback
  app.get("/api/video/file/:userId/:videoId", async (req, res) => {
    try {
      const { userId, videoId } = req.params;
      
      console.log(`🎥 Streaming video request: ${userId}/${videoId}`);
      
      // Get video stream from Google Drive
      const { googleDriveService } = await import('./google-drive');
      
      if (!googleDriveService.isInitialized()) {
        return res.status(500).json({
          success: false,
          error: "Google Drive service không khả dụng"
        });
      }

      try {
        // Get file info first to check if exists and get size
        const fileInfo = await googleDriveService.getFileInfo(videoId);
        const fileSize = parseInt(fileInfo.size || '0');
        
        console.log(`✅ Found video in Google Drive: ${fileInfo.name} (${fileSize} bytes)`);
        
        // Set appropriate headers for video streaming with CORS
        // Try different content type based on file extension
        let contentType = 'video/mp4';
        if (fileInfo.name && fileInfo.name.toLowerCase().includes('.webm')) {
          contentType = 'video/webm';
        } else if (fileInfo.name && fileInfo.name.toLowerCase().includes('.avi')) {
          contentType = 'video/x-msvideo';
        }
        
        console.log(`📹 Setting content type: ${contentType} for file: ${fileInfo.name}`);
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
        res.setHeader('Cache-Control', 'public, max-age=0');
        res.setHeader('Connection', 'keep-alive');
        
        // Handle range requests for video streaming
        const range = req.headers.range;
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          
          const chunksize = (end - start) + 1;
          
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.setHeader('Content-Length', chunksize);
          
          // For range requests - disable for now to test full download
          console.log('⚠️ Range request detected, serving full video instead for compatibility');
          
          // Serve full video even for range requests to avoid stream issues
          res.status(200); // Override 206 status
          res.setHeader('Content-Length', fileSize);
          
          const stream = await googleDriveService.getVideoStream(videoId);
          stream.on('error', (streamError: any) => {
            console.error('❌ Video stream error:', streamError);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Stream error' });
            }
          });
          
          stream.pipe(res);
        } else {
          // Full file request - serve as chunked stream with proper headers
          console.log('📡 Serving video as stream with proper MP4 headers...');
          
          const stream = await googleDriveService.getVideoStream(videoId);
          
          // Essential headers for MP4 streaming
          res.setHeader('Content-Length', fileSize);
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Transfer-Encoding', 'identity');
          
          stream.on('error', (streamError: any) => {
            console.error('❌ Video stream error:', streamError);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Stream error' });
            }
          });
          
          // Pipe with end handling
          stream.on('end', () => {
            console.log('✅ Video stream completed');
          });
          
          stream.pipe(res);
        }
        
      } catch (driveError: any) {
        if (driveError.code === 404) {
          console.log(`❌ Video file not found in Google Drive: ${videoId}`);
          return res.status(404).json({
            success: false,
            error: "Video không tồn tại trong Google Drive"
          });
        }
        throw driveError;
      }
      
    } catch (error) {
      console.error('❌ Error serving video file:', error);
      res.status(500).json({
        success: false,
        error: "Lỗi khi phát video từ Google Drive"
      });
    }
  });

  // Video processing routes
  app.post("/api/video/process", async (req, res) => {
    try {
      const { fileId, fileName, userId } = req.body;
      
      if (!fileId || !fileName) {
        return res.status(400).json({ 
          success: false, 
          error: "File ID và tên file là bắt buộc" 
        });
      }

      console.log(`🎬 Starting video processing for ${fileName} (${fileId})`);
      
      // For now, get userId from request body (TODO: implement proper session auth)
      const processUserId = userId || 5; // Default to current user ID 5

      // Download video content from Google Drive
      const { googleDriveService } = await import('./google-drive');
      const videoBuffer = await googleDriveService.getFileContent(fileId);
      
      if (!videoBuffer || videoBuffer.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: "Không thể tải video từ Google Drive" 
        });
      }

      // Process video with transcription
      const { videoProcessor } = await import('./video-processor');
      const result = await videoProcessor.processVideo(videoBuffer, fileName, processUserId, fileId);
      
      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          error: result.error || "Lỗi khi xử lý video" 
        });
      }

      console.log(`✅ Video processing completed for ${fileName}`);
      res.json({ 
        success: true, 
        result,
        message: "Video đã được xử lý thành công" 
      });

    } catch (error: any) {
      console.error('❌ Error processing video:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi xử lý video" 
      });
    }
  });

  // Get processed videos from SHARED LIBRARY (all users)
  app.get("/api/video/processed/:userId", async (req, res) => {
    try {
      const requestingUserId = parseInt(req.params.userId);
      
      if (!requestingUserId) {
        return res.status(400).json({ 
          success: false, 
          error: "User ID không hợp lệ" 
        });
      }

      // Get ALL videos from SHARED LIBRARY (from all users)
      const { db } = await import('./db');
      const { videos } = await import('../shared/schema');
      
      const allVideos = await db.select({
        googleDriveId: videos.googleDriveId,
        fileName: videos.fileName,
        uploaderUserId: videos.userId
      }).from(videos);
      
      console.log(`📊 Found ${allVideos.length} videos in SHARED LIBRARY (requested by user ${requestingUserId})`);
      console.log(`☁️ Videos from ${new Set(allVideos.map(v => v.uploaderUserId)).size} different uploaders`);
      
      // Return Google Drive IDs for video streaming
      const videoIds = allVideos
        .filter(video => video.googleDriveId) // Only return videos with Google Drive IDs
        .map(video => video.googleDriveId);
        
      console.log(`☁️ Found ${videoIds.length} videos with Google Drive IDs`);
      
      res.json({ 
        success: true, 
        videos: videoIds,
        videoDetails: allVideos // Include uploader info
      });

    } catch (error: any) {
      console.error('❌ Error getting shared video library:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi lấy thư viện video chung" 
      });
    }
  });

  // Get video processing status
  app.get("/api/video/status/:videoId/:userId", async (req, res) => {
    try {
      const { videoId, userId } = req.params;
      
      if (!videoId || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: "Video ID và User ID là bắt buộc" 
        });
      }

      const { videoProcessor } = await import('./video-processor');
      const status = videoProcessor.getVideoStatus(videoId, parseInt(userId));
      
      res.json({ 
        success: true, 
        status 
      });

    } catch (error: any) {
      console.error('❌ Error getting video status:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi kiểm tra trạng thái video" 
      });
    }
  });

  // Get video folder info in Google Drive
  app.get("/api/video/folder-info/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: "User ID không hợp lệ" 
        });
      }

      const { googleDriveService } = await import('./google-drive');
      const folderName = `videos_user_${userId}`;
      
      // Check if folder exists and get its info
      const folderInfo = await googleDriveService.getFolderInfo(folderName);
      
      res.json({ 
        success: true, 
        folderName,
        folderInfo,
        message: `Thư mục video của bạn: ${folderName}` 
      });

    } catch (error: any) {
      console.error('❌ Error getting video folder info:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi lấy thông tin thư mục" 
      });
    }
  });

  // Clean up video files
  app.delete("/api/video/cleanup/:videoId/:userId", async (req, res) => {
    try {
      const { videoId, userId } = req.params;
      
      if (!videoId || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: "Video ID và User ID là bắt buộc" 
        });
      }

      const { videoProcessor } = await import('./video-processor');
      await videoProcessor.cleanupVideo(videoId, parseInt(userId));
      
      res.json({ 
        success: true, 
        message: "Video đã được xóa thành công" 
      });

    } catch (error: any) {
      console.error('❌ Error cleaning up video:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi xóa video" 
      });
    }
  });

  // Test video vector search API
  app.post("/api/video/search", async (req, res) => {
    try {
      const { query, userId, subjectId } = req.body;
      
      if (!query || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: "Query và userId là bắt buộc" 
        });
      }

      const { vectorService } = await import('./vector-service');
      const relevantVideo = await vectorService.searchRelevantVideo(query, userId, subjectId);
      
      res.json({ 
        success: true, 
        video: relevantVideo,
        message: relevantVideo ? `Tìm thấy video phù hợp: ${relevantVideo.fileName}` : "Không tìm thấy video phù hợp"
      });

    } catch (error: any) {
      console.error('❌ Error searching video:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi tìm kiếm video" 
      });
    }
  });

  // API endpoint to find documents related to a specific video
  app.post("/api/video/related-documents", async (req, res) => {
    try {
      const { videoId, userId, subjectId, limit = 5 } = req.body;
      
      if (!videoId || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: "Video ID và User ID là bắt buộc" 
        });
      }

      // Get video details from database
      const [video] = await db
        .select({
          id: videos.id,
          fileName: videos.fileName,
          contentPreview: videos.contentPreview,
        })
        .from(videos)
        .where(eq(videos.googleDriveId, videoId))
        .limit(1);

      if (!video) {
        return res.status(404).json({ 
          success: false, 
          error: "Video không tìm thấy" 
        });
      }

      // Search for related documents
      const { vectorService } = await import('./vector-service');
      const relatedDocuments = await vectorService.searchRelatedDocuments(
        video.fileName, 
        video.contentPreview || '', 
        subjectId,
        limit
      );
      
      res.json({ 
        success: true, 
        video: {
          id: video.id,
          fileName: video.fileName,
          contentPreview: video.contentPreview
        },
        relatedDocuments,
        message: `Tìm thấy ${relatedDocuments.length} tài liệu liên quan đến video "${video.fileName}"`
      });

    } catch (error: any) {
      console.error('❌ Error finding related documents:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi tìm kiếm tài liệu liên quan" 
      });
    }
  });

  // Admin API: Approve/Reject new user accounts
  app.post("/api/admin/user/:id/approve", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { approved, role = 'student' } = req.body;
      
      if (typeof approved !== 'boolean') {
        return res.status(400).json({ 
          success: false, 
          error: "approved field must be boolean" 
        });
      }

      // Update user status
      const [updatedUser] = await db
        .update(users)
        .set({ 
          isActive: approved,
          role: approved ? role : 'pending'
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ 
          success: false, 
          error: "User not found" 
        });
      }

      // Audit logging temporarily disabled to unblock user approval functionality
      console.log(`🔑 Admin action: ${approved ? 'approved' : 'rejected'} user ${userId} with role ${role}`);

      res.json({ 
        success: true, 
        user: updatedUser,
        message: approved ? "User đã được phê duyệt" : "User đã bị từ chối"
      });

    } catch (error: any) {
      console.error('❌ Error approving user:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi phê duyệt user" 
      });
    }
  });

  // Admin: Manually create new user
  app.post("/api/admin/users/create", async (req, res) => {
    try {
      const { email, displayName, role = 'student', firebaseUid = null } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: "Email is required" 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          error: "User with this email already exists" 
        });
      }

      // Create new user
      const newUser = {
        firebaseUid,
        email,
        displayName: displayName || null,
        photoURL: null,
        role,
        isActive: true, // Pre-approved by admin
      };
      
      const validatedUser = insertUserSchema.parse(newUser);
      const user = await storage.createUser(validatedUser);
      
      console.log(`👤 Admin manually created user: ${email} with role ${role}`);

      res.json({ 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt
        },
        message: "User created successfully" 
      });

    } catch (error: any) {
      console.error('❌ Error creating user:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Error creating user" 
      });
    }
  });

  // Fix subject detection for existing documents
  app.post('/api/admin/fix-subject-detection', async (req, res) => {
    try {
      console.log('🔧 Starting subject detection fix for existing documents...');
      
      // Get all documents with NULL subject info
      const documentsToFix = await db.select()
        .from(documents)
        .where(sql`subject_id IS NULL OR subject_numeric_id IS NULL`);
      
      console.log(`📊 Found ${documentsToFix.length} documents to fix`);
      
      const results = [];
      
      for (const doc of documentsToFix) {
        console.log(`\n🔍 Processing: ${doc.fileName}`);
        
        // Use smart filename detection (first words method works better)
        const { SubjectDetector } = await import('./subject-detector');
        const detectedSubject = SubjectDetector.detectSubjectFromFirstWords(doc.fileName);
        
        if (detectedSubject) {
          // Update document with detected subject
          await db.update(documents)
            .set({ 
              subjectId: detectedSubject.id,
              subjectNumericId: detectedSubject.numericId
            })
            .where(eq(documents.id, doc.id));
            
          console.log(`✅ Updated Doc ${doc.id}: ${detectedSubject.name} (${detectedSubject.id})`);
          
          results.push({
            documentId: doc.id,
            fileName: doc.fileName,
            detectedSubject: detectedSubject.name,
            subjectId: detectedSubject.id,
            status: 'updated'
          });
        } else {
          console.log(`❌ No subject detected for: ${doc.fileName}`);
          results.push({
            documentId: doc.id,
            fileName: doc.fileName,
            status: 'no_detection'
          });
        }
      }
      
      console.log('\n✅ Subject detection fix completed!');
      
      res.json({ 
        success: true, 
        message: `Fixed ${results.filter(r => r.status === 'updated').length} documents`,
        results
      });
    } catch (error) {
      console.error('❌ Error fixing subject detection:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Admin API: Get pending users waiting for approval
  app.get("/api/admin/users/pending", async (req, res) => {
    try {
      const pendingUsers = await db
        .select({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          photoURL: users.photoURL,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.role, 'pending'))
        .orderBy(desc(users.createdAt));

      res.json({ 
        success: true, 
        pendingUsers,
        total: pendingUsers.length
      });

    } catch (error: any) {
      console.error('❌ Error fetching pending users:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Lỗi khi lấy danh sách user chờ duyệt" 
      });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
