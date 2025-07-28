import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").unique(), // Allow null for manual admin creation
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoURL: text("photo_url"),
  role: text("role").default("pending"), // "pending", "student", "admin", "super_admin"  
  isActive: boolean("is_active").default(false), // Default to inactive, require manual approval
  maxDevices: integer("max_devices").default(2), // Số máy tối đa
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(), // e.g., "MATH_001", "LIT_001"
  subjectId: integer("subject_id").notNull(), // 1-8 numeric ID (removed unique to avoid migration issue)
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  gradientFrom: text("gradient_from").notNull(),
  gradientTo: text("gradient_to").notNull(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subjectId: text("subject_id").notNull(), // "MATH_001", etc.
  subjectNumericId: integer("subject_numeric_id").notNull(), // 1-8
  title: text("title").notNull(),
  sessionType: text("session_type").notNull().default("qa"), // "qa" or "video"
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  subjectId: text("subject_id").notNull(), // "MATH_001", etc.
  subjectNumericId: integer("subject_numeric_id").notNull(), // 1-8
  content: text("content").notNull(),
  isUser: boolean("is_user").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subjectId: text("subject_id"), // "MATH_001", etc. (optional)
  subjectNumericId: integer("subject_numeric_id"), // 1-8 (optional)
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  googleDriveId: text("google_drive_id"),
  ocrText: text("ocr_text"), // Full OCR extracted text
  isExercise: boolean("is_exercise").notNull().default(false), // True if document contains exercises (BT)
  processedAt: timestamp("processed_at"), // When OCR processing completed
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Order of chunk in document
  content: text("content").notNull(), // Chunk text content
  wordCount: integer("word_count").notNull(),
  chunkType: text("chunk_type").notNull().default("standard"), // "standard" | "exercise_question"
  questionNumber: text("question_number"), // e.g., "Câu 1", "Bài 5", "1"
  embedding: text("embedding"), // JSON string of vector embedding
  embeddingModel: text("embedding_model").default("text-embedding-3-small"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Temporary document tables for student uploads
export const temporaryDocuments = pgTable("temporary_documents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  subjectId: text("subject_id"), // Auto-detected or user-assigned subject
  subjectNumericId: integer("subject_numeric_id"), // Numeric ID for subject (1-8)
  status: text("status").notNull().default("pending"), // pending, processing, processed, failed
  filePath: text("file_path"), // Local file path for processing
  ocrText: text("ocr_text"), // Extracted text content
  isExercise: boolean("is_exercise").notNull().default(false), // True if document contains exercises (BT)
  confidence: doublePrecision("confidence"), // Subject detection confidence (0-1)
  processedAt: timestamp("processed_at"), // When processing completed
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const temporaryDocumentChunks = pgTable("temporary_document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => temporaryDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Order of chunk in document
  content: text("content").notNull(), // Chunk text content
  wordCount: integer("word_count").notNull(),
  chunkType: text("chunk_type").notNull().default("standard"), // "standard" | "exercise_question"
  questionNumber: text("question_number"), // e.g., "Câu 1", "Bài 5", "1"
  embedding: text("embedding"), // JSON string of vector embedding
  embeddingModel: text("embedding_model").default("text-embedding-3-small"),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").references(() => chatSessions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Videos table for storing video processing information
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  googleDriveId: text("google_drive_id"), // Google Drive file ID
  fileName: text("file_name").notNull(),
  subjectId: text("subject_id"), // "MATH_001", etc. (auto-detected or assigned)
  subjectNumericId: integer("subject_numeric_id"), // 1-8 numeric ID
  videoUrl: text("video_url"), // URL to access the video
  contentPreview: text("content_preview"), // Summary/preview of video content
  duration: doublePrecision("duration"), // Video duration in seconds
  status: text("status").notNull().default("pending"), // pending, processing, processed, failed
  processedAt: timestamp("processed_at"), // When transcription completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transcript chunks for storing processed video transcript segments
export const transcriptChunks = pgTable("transcript_chunks", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Order of chunk in transcript
  content: text("content").notNull(), // Transcript text chunk
  startTime: doublePrecision("start_time"), // Start time in seconds (future enhancement)
  endTime: doublePrecision("end_time"), // End time in seconds (future enhancement)
  wordCount: integer("word_count").notNull(),
  embedding: text("embedding"), // JSON string of vector embedding
  embeddingModel: text("embedding_model").default("text-embedding-3-small"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Device tracking and session management tables
export const userDevices = pgTable("user_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceFingerprint: text("device_fingerprint").notNull(),
  deviceName: text("device_name"), // Browser info
  deviceInfo: text("device_info"), // OS, screen resolution, etc
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  isApproved: boolean("is_approved").default(true), // Auto-approve devices, just for tracking
  approvedBy: integer("approved_by").references(() => users.id), // Admin who approved
  approvedAt: timestamp("approved_at"),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: integer("device_id").notNull().references(() => userDevices.id, { onDelete: "cascade" }),
  loginIp: text("login_ip"),
  userAgent: text("user_agent"),
  loginTime: timestamp("login_time").defaultNow().notNull(),
  logoutTime: timestamp("logout_time"),
  isActive: boolean("is_active").default(true),
  forcedLogout: boolean("forced_logout").default(false),
  loggedOutBy: integer("logged_out_by").references(() => users.id), // Admin who forced logout
});

// Admin audit table
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => users.id), // Allow null for system actions
  actionType: text("action_type").notNull(), // "force_logout", "approve_device", "block_user"
  targetUserId: integer("target_user_id").references(() => users.id),
  targetResourceType: text("target_resource_type"), // "device", "session", "user"
  targetResourceId: integer("target_resource_id"),
  actionDetails: text("action_details"), // JSON string with details
  ipAddress: text("ip_address"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Processing jobs table for external admin app integration
export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  driveFileId: text("drive_file_id").notNull(),
  fileName: text("file_name").notNull(),
  processingType: text("processing_type").notNull(), // "pdf_ocr", "video_transcription", "image_ocr"
  subjectHint: text("subject_hint"), // Optional subject classification hint
  priority: text("priority").notNull().default("medium"), // "high", "medium", "low"
  status: text("status").notNull().default("queued"), // "queued", "processing", "completed", "failed"
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  resultData: text("result_data"), // JSON string with processing results
  errorMessage: text("error_message"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  firebaseUid: z.string().nullable().optional(), // Allow null for manual admin creation
});

export const insertSubjectSchema = createInsertSchema(subjects);
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertTemporaryDocumentSchema = createInsertSchema(temporaryDocuments).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const insertTemporaryDocumentChunkSchema = createInsertSchema(temporaryDocumentChunks).omit({
  id: true,
  createdAt: true,
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertTranscriptChunkSchema = createInsertSchema(transcriptChunks).omit({
  id: true,
  createdAt: true,
});

export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({
  id: true,
  firstSeen: true,
  lastSeen: true,
  approvedAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  loginTime: true,
  logoutTime: true,
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({
  id: true,
  timestamp: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type TemporaryDocument = typeof temporaryDocuments.$inferSelect;
export type TemporaryDocumentChunk = typeof temporaryDocumentChunks.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type TranscriptChunk = typeof transcriptChunks.$inferSelect;
export type UserDevice = typeof userDevices.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type InsertTemporaryDocument = z.infer<typeof insertTemporaryDocumentSchema>;
export type InsertTemporaryDocumentChunk = z.infer<typeof insertTemporaryDocumentChunkSchema>;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type InsertTranscriptChunk = z.infer<typeof insertTranscriptChunkSchema>;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type InsertAdminAuditLog = z.infer<typeof insertAdminAuditLogSchema>;

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
  documents: many(documents),
  temporaryDocuments: many(temporaryDocuments),
  videos: many(videos),
  devices: many(userDevices),
  sessions: many(userSessions),
  adminActions: many(adminAuditLog, { relationName: "adminActions" }),
  targetedActions: many(adminAuditLog, { relationName: "targetedActions" }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export const temporaryDocumentsRelations = relations(temporaryDocuments, ({ one, many }) => ({
  user: one(users, {
    fields: [temporaryDocuments.userId],
    references: [users.id],
  }),
  chunks: many(temporaryDocumentChunks),
}));

export const temporaryDocumentChunksRelations = relations(temporaryDocumentChunks, ({ one }) => ({
  document: one(temporaryDocuments, {
    fields: [temporaryDocumentChunks.documentId],
    references: [temporaryDocuments.id],
  }),
  user: one(users, {
    fields: [temporaryDocumentChunks.userId],
    references: [users.id],
  }),
  session: one(chatSessions, {
    fields: [temporaryDocumentChunks.sessionId],
    references: [chatSessions.id],
  }),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  transcriptChunks: many(transcriptChunks),
}));

export const transcriptChunksRelations = relations(transcriptChunks, ({ one }) => ({
  video: one(videos, {
    fields: [transcriptChunks.videoId],
    references: [videos.id],
  }),
}));

export const userDevicesRelations = relations(userDevices, ({ one, many }) => ({
  user: one(users, {
    fields: [userDevices.userId],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [userDevices.approvedBy],
    references: [users.id],
    relationName: "deviceApprover",
  }),
  sessions: many(userSessions),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
  device: one(userDevices, {
    fields: [userSessions.deviceId],
    references: [userDevices.id],
  }),
  loggedOutByUser: one(users, {
    fields: [userSessions.loggedOutBy],
    references: [users.id],
    relationName: "sessionTerminator",
  }),
}));

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  admin: one(users, {
    fields: [adminAuditLog.adminId],
    references: [users.id],
    relationName: "adminActions",
  }),
  targetUser: one(users, {
    fields: [adminAuditLog.targetUserId],
    references: [users.id],
    relationName: "targetedActions",
  }),
}));
