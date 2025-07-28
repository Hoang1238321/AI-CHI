import { db } from "./db";
import { users, userDevices, userSessions, adminAuditLog, chatSessions, chatMessages, documents, documentChunks, temporaryDocuments, temporaryDocumentChunks, videos, transcriptChunks, type User, type UserDevice, type UserSession, type InsertUserDevice, type InsertUserSession, type InsertAdminAuditLog } from "@shared/schema";
import { eq, and, desc, count } from "drizzle-orm";
import crypto from "crypto";

export interface DeviceValidationResult {
  success: boolean;
  deviceId?: number;
  reason?: string;
  requiresApproval?: boolean;
  exceedsLimit?: boolean;
}

export interface SessionValidationResult {
  success: boolean;
  sessionId?: number;
  reason?: string;
  user?: User;
}

export class SessionManager {
  // Validate device and check if user can login
  async validateDevice(userId: number, deviceFingerprint: string, deviceName: string, deviceInfo: string, clientIp: string): Promise<DeviceValidationResult> {
    try {
      // Get user with device limits
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        return { success: false, reason: "User not found" };
      }

      if (!user.isActive) {
        return { success: false, reason: "User account is inactive" };
      }

      // Check if device already exists
      const [existingDevice] = await db
        .select()
        .from(userDevices)
        .where(and(
          eq(userDevices.userId, userId),
          eq(userDevices.deviceFingerprint, deviceFingerprint)
        ));

      if (existingDevice) {
        // Update last seen time
        await db
          .update(userDevices)
          .set({ lastSeen: new Date() })
          .where(eq(userDevices.id, existingDevice.id));

        // Device auto-approved for tracking only
        // if (!existingDevice.isApproved) {
        //   return { 
        //     success: false, 
        //     reason: "Device pending approval",
        //     requiresApproval: true 
        //   };
        // }

        return { success: true, deviceId: existingDevice.id };
      }

      // Check device limit
      const [deviceCount] = await db
        .select({ count: count() })
        .from(userDevices)
        .where(and(
          eq(userDevices.userId, userId),
          eq(userDevices.isApproved, true)
        ));

      if (deviceCount.count >= (user.maxDevices || 2)) {
        console.log(`🚨 User ${userId} exceeded device limit (${deviceCount.count}/${user.maxDevices || 2}). Deleting user...`);
        
        // Delete user completely when device limit is exceeded
        try {
          await this.deleteUserCompletely(userId);
          console.log(`✅ User ${userId} successfully deleted for device limit violation`);
        } catch (error) {
          console.error(`❌ Failed to delete user ${userId}:`, error);
        }
        
        return { 
          success: false, 
          reason: "Device limit exceeded - user account deleted",
          exceedsLimit: true 
        };
      }

      // Create new device - requires manual admin approval
      const [newDevice] = await db
        .insert(userDevices)
        .values({
          userId,
          deviceFingerprint,
          deviceName,
          deviceInfo,
          isApproved: true, // Auto-approve devices for tracking only
        })
        .returning();

      // Log device creation (system action)
      await this.logAdminAction(null, "new_device_registered", userId, "device", newDevice.id, {
        deviceName,
        deviceInfo,
        clientIp,
        autoApproved: true,
      }, clientIp);

      return { 
        success: true, 
        deviceId: newDevice.id
      };
    } catch (error) {
      console.error("Device validation error:", error);
      return { success: false, reason: "Internal error" };
    }
  }

  // Create new session
  async createSession(userId: number, deviceId: number, clientIp: string, userAgent: string): Promise<SessionValidationResult> {
    try {
      // Terminate any existing active sessions for this device
      await db
        .update(userSessions)
        .set({ 
          isActive: false, 
          logoutTime: new Date() 
        })
        .where(and(
          eq(userSessions.userId, userId),
          eq(userSessions.deviceId, deviceId),
          eq(userSessions.isActive, true)
        ));

      // Create new session
      const [newSession] = await db
        .insert(userSessions)
        .values({
          userId,
          deviceId,
          loginIp: clientIp,
          userAgent,
        })
        .returning();

      // Update user last login
      await db
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, userId));

      // Get user data
      const [user] = await db.select().from(users).where(eq(users.id, userId));

      return { 
        success: true, 
        sessionId: newSession.id,
        user: user 
      };
    } catch (error) {
      console.error("Session creation error:", error);
      return { success: false, reason: "Failed to create session" };
    }
  }

  // Validate session by ID
  async validateSessionById(sessionId: number): Promise<SessionValidationResult> {
    try {
      const [session] = await db
        .select({
          session: userSessions,
          user: users,
          device: userDevices,
        })
        .from(userSessions)
        .innerJoin(users, eq(userSessions.userId, users.id))
        .innerJoin(userDevices, eq(userSessions.deviceId, userDevices.id))
        .where(and(
          eq(userSessions.id, sessionId),
          eq(userSessions.isActive, true),
          eq(users.isActive, true),
          eq(userDevices.isApproved, true)
        ));

      if (!session) {
        return { success: false, reason: "Invalid or expired session" };
      }

      // Check if session is too old (24 hours)
      const sessionAge = Date.now() - session.session.loginTime.getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (sessionAge > maxAge) {
        await this.terminateSession(session.session.id, "expired");
        return { success: false, reason: "Session expired" };
      }

      return { 
        success: true, 
        sessionId: session.session.id,
        user: session.user 
      };
    } catch (error) {
      console.error("Session validation error:", error);
      return { success: false, reason: "Internal error" };
    }
  }

  // Terminate session
  async terminateSession(sessionId: number, reason: string, adminId?: number): Promise<boolean> {
    try {
      await db
        .update(userSessions)
        .set({
          isActive: false,
          logoutTime: new Date(),
          forcedLogout: !!adminId,
          loggedOutBy: adminId,
        })
        .where(eq(userSessions.id, sessionId));

      if (adminId) {
        const [session] = await db.select().from(userSessions).where(eq(userSessions.id, sessionId));
        if (session) {
          await this.logAdminAction(adminId, "force_logout", session.userId, "session", sessionId, {
            reason,
            sessionId: sessionId,
          });
        }
      }

      return true;
    } catch (error) {
      console.error("Session termination error:", error);
      return false;
    }
  }

  // Get user's active sessions
  async getUserSessions(userId: number): Promise<UserSession[]> {
    return await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isActive, true)
      ))
      .orderBy(desc(userSessions.loginTime));
  }

  // Get user's devices
  async getUserDevices(userId: number): Promise<UserDevice[]> {
    return await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.lastSeen));
  }

  // Admin: Force logout all user sessions
  async forceLogoutUser(targetUserId: number, adminId: number, reason: string): Promise<boolean> {
    try {
      const activeSessions = await this.getUserSessions(targetUserId);
      
      for (const session of activeSessions) {
        await this.terminateSession(session.id, reason, adminId);
      }

      await this.logAdminAction(adminId, "force_logout_all", targetUserId, "user", targetUserId, {
        reason,
        sessionCount: activeSessions.length,
      });

      return true;
    } catch (error) {
      console.error("Force logout error:", error);
      return false;
    }
  }

  // Admin: Approve/block device
  async setDeviceApproval(deviceId: number, approved: boolean, adminId: number): Promise<boolean> {
    try {
      await db
        .update(userDevices)
        .set({
          isApproved: approved,
          approvedBy: adminId,
          approvedAt: new Date(),
        })
        .where(eq(userDevices.id, deviceId));

      const [device] = await db.select().from(userDevices).where(eq(userDevices.id, deviceId));
      
      if (device) {
        await this.logAdminAction(adminId, approved ? "approve_device" : "block_device", device.userId, "device", deviceId, {
          deviceName: device.deviceName,
          deviceFingerprint: device.deviceFingerprint.slice(0, 8) + "...",
        });

        // If blocking device, terminate all active sessions
        if (!approved) {
          const activeSessions = await db
            .select()
            .from(userSessions)
            .where(and(
              eq(userSessions.deviceId, deviceId),
              eq(userSessions.isActive, true)
            ));

          for (const session of activeSessions) {
            await this.terminateSession(session.id, "device_blocked", adminId);
          }
        }
      }

      return true;
    } catch (error) {
      console.error("Device approval error:", error);
      return false;
    }
  }

  // Admin: Set user device limit
  async setUserDeviceLimit(userId: number, maxDevices: number, adminId: number): Promise<boolean> {
    try {
      await db
        .update(users)
        .set({ maxDevices })
        .where(eq(users.id, userId));

      await this.logAdminAction(adminId, "set_device_limit", userId, "user", userId, {
        maxDevices,
        previousLimit: "unknown", // Could track this if needed
      });

      return true;
    } catch (error) {
      console.error("Set device limit error:", error);
      return false;
    }
  }

  // Admin: Get all sessions for monitoring
  async getAllActiveSessions(): Promise<Array<UserSession & { user: User; device: UserDevice }>> {
    return await db
      .select({
        session: userSessions,
        user: users,
        device: userDevices,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .innerJoin(userDevices, eq(userSessions.deviceId, userDevices.id))
      .where(eq(userSessions.isActive, true))
      .orderBy(desc(userSessions.loginTime)) as any;
  }

  // Log admin actions with proper null handling
  private async logAdminAction(
    adminId: number | null,
    actionType: string,
    targetUserId: number | null,
    resourceType: string,
    resourceId: number,
    details: any,
    ipAddress?: string
  ): Promise<void> {
    try {
      await db.insert(adminAuditLog).values({
        adminId, // Allow null for system actions
        actionType,
        targetUserId,
        targetResourceType: resourceType,
        targetResourceId: resourceId,
        actionDetails: JSON.stringify(details),
        ipAddress,
      });
      console.log(`🔍 Admin Action Logged: ${actionType} on ${resourceType} ${resourceId} by ${adminId || 'system'}`);
    } catch (error) {
      console.error("Audit logging error:", error);
      // Don't fail the main operation if logging fails
    }
  }

  // Delete user completely when device limit exceeded
  async deleteUserCompletely(userId: number): Promise<void> {
    try {
      console.log(`🗑️  Starting complete deletion of user ${userId} for device limit violation`);
      
      // Log the deletion before deleting
      await this.logAdminAction(null, "user_deleted_device_limit", userId, "user", userId, {
        reason: "Device limit exceeded",
        deletionTime: new Date().toISOString(),
      }, "system");

      // Delete in reverse dependency order to avoid foreign key constraints
      // Only delete tables that have userId column
      
      // 1. Delete videos (user-owned)
      await db.delete(videos).where(eq(videos.userId, userId));
      
      // 2. Delete temporary document chunks (references temporary documents)
      await db.delete(temporaryDocumentChunks).where(eq(temporaryDocumentChunks.userId, userId));
      
      // 3. Delete temporary documents
      await db.delete(temporaryDocuments).where(eq(temporaryDocuments.userId, userId));
      
      // 4. Delete documents (user-owned)
      await db.delete(documents).where(eq(documents.userId, userId));
      
      // 5. Delete chat sessions (user-owned)
      await db.delete(chatSessions).where(eq(chatSessions.userId, userId));
      
      // 6. Delete user sessions
      await db.delete(userSessions).where(eq(userSessions.userId, userId));
      
      // 7. Delete user devices
      await db.delete(userDevices).where(eq(userDevices.userId, userId));
      
      // 8. Finally delete the user
      await db.delete(users).where(eq(users.id, userId));
      
      console.log(`✅ Successfully deleted user ${userId} and all associated data`);
      
    } catch (error) {
      console.error(`❌ Error deleting user ${userId}:`, error);
      throw error;
    }
  }
}

export const sessionManager = new SessionManager();