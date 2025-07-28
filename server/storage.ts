import { users, type User, type InsertUser, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserFirebaseUid(userId: number, firebaseUid: string): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSessionsByUserId(userId: number): Promise<ChatSession[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessagesBySessionId(sessionId: number): Promise<ChatMessage[]>;
  deleteChatSession(sessionId: number): Promise<void>;
  deleteChatMessagesBySession(sessionId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private sessions: Map<number, ChatSession>;
  private messages: Map<number, ChatMessage>;
  currentUserId: number;
  currentSessionId: number;
  currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
    this.messages = new Map();
    this.currentUserId = 1;
    this.currentSessionId = 1;
    this.currentMessageId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.firebaseUid === firebaseUid,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { 
      ...insertUser, 
      id,
      displayName: insertUser.displayName ?? null,
      photoURL: insertUser.photoURL ?? null,
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async createChatSession(insertSession: InsertChatSession): Promise<ChatSession> {
    const id = this.currentSessionId++;
    const session: ChatSession = {
      ...insertSession,
      id,
      createdAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  async getChatSessionsByUserId(userId: number): Promise<ChatSession[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentMessageId++;
    const message: ChatMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getChatMessagesBySessionId(sessionId: number): Promise<ChatMessage[]> {
    return Array.from(this.messages.values())
      .filter(message => message.sessionId === sessionId)
      .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  }

  async deleteChatSession(sessionId: number): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async deleteChatMessagesBySession(sessionId: number): Promise<void> {
    for (const [id, message] of this.messages.entries()) {
      if (message.sessionId === sessionId) {
        this.messages.delete(id);
      }
    }
  }
}

export const storage = new MemStorage();
