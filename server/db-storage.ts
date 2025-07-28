import { db } from './db';
import { users, chatSessions, chatMessages, type User, type InsertUser, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage } from "@shared/schema";
import { eq, desc } from 'drizzle-orm';
import type { IStorage } from './storage';

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async updateUserFirebaseUid(userId: number, firebaseUid: string): Promise<User> {
    const result = await db
      .update(users)
      .set({ firebaseUid, lastLogin: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // New users require manual admin approval
    const userData = {
      ...insertUser,
      isActive: false,  // User must wait for admin approval
      role: 'pending' as const  // Pending approval status
    };
    
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const result = await db.insert(chatSessions).values(insertSession).returning();
    return result[0];
  }

  async getChatSessionsByUserId(userId: number): Promise<ChatSession[]> {
    return await db.select().from(chatSessions).where(eq(chatSessions.userId, userId)).orderBy(desc(chatSessions.createdAt));
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(insertMessage).returning();
    return result[0];
  }

  async getChatMessagesBySessionId(sessionId: number): Promise<ChatMessage[]> {
    return await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
  }

  async deleteChatSession(sessionId: number): Promise<void> {
    await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));
  }

  async deleteChatMessagesBySession(sessionId: number): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  }
}