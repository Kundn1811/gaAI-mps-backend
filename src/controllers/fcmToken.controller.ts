import { Request, Response, NextFunction } from 'express';
import admin from '../firebase/admin';
import { AppError } from '../utils/appError';
import FCMToken from '../models/fcm.model';
import NotificationHistory from '../models/notificationHistory.model';
import BroadcastNotification from '../models/broadcastingNotification.model';
import UserPreferences from '../models/userPrefrence.model';
// import FCMToken from '../models/FCMToken'; 


// Type definitions
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  };
}

interface StoreTokenRequest extends Request {
  body: {
    userId: string;
    token: string;
    deviceId: string;
    deviceType: string;
    appVersion?: string;
  };
}

interface SendNotificationRequest extends Request {
  body: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  };
}

interface SendMultipleUsersRequest extends Request {
  body: {
    userIds: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
  };
}

interface BroadcastRequest extends AuthenticatedRequest {
  body: {
    title: string;
    body: string;
    data?: Record<string, any>;
    targetCriteria?: {
      userIds?: string[];
      deviceTypes?: string[];
      [key: string]: any;
    };
    scheduledFor?: string | Date;
  };
}

interface CleanupTokensRequest extends Request {
  body: {
    invalidTokens: string[];
  };
}

interface GetUserTokensRequest extends Request {
  params: {
    userId: string;
  };
  query: {
    activeOnly?: string;
  };
}

interface RemoveTokenRequest extends Request {
  params: {
    tokenId: string;
  };
}

interface GetNotificationHistoryRequest extends Request {
  query: {
    userId?: string;
    page?: string;
    limit?: string;
    status?: string;
    type?: string;
  };
}

interface UserPreferencesRequest extends Request {
  params: {
    userId: string;
  };
  body: Record<string, any>;
}

interface BatchResult {
  batch: number;
  totalTokens?: number;
  successCount?: number;
  failureCount?: number;
  error?: string;
}

interface FCMResponse {
  responses: {
    success: boolean;
    error?: {
      code: string;
      message: string;
    };
  }[];
  successCount: number;
  failureCount: number;
}

// FCM Token Controller
class FCMTokenController {
  // Store/Update FCM Token
  static async storeToken(req: StoreTokenRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId, token, deviceId, deviceType, appVersion } = req.body;

      if (!userId || !token || !deviceId || !deviceType) {
        throw new AppError('Missing required fields', 400);
      }

      // Check if token already exists
      const existingToken = await FCMToken.findOne({ token });
      
      if (existingToken) {
        // Update existing token
        existingToken.userId = FCMToken.schema.path('userId').instance === 'ObjectID' ? 
          require('mongoose').Types.ObjectId(userId) : userId;
        existingToken.deviceId = deviceId;
        if (deviceType === 'ios' || deviceType === 'android' || deviceType === 'web') {
          existingToken.deviceType = deviceType;
        } else {
          throw new AppError('Invalid deviceType. Allowed values are ios, android, web.', 400);
        }
        existingToken.appVersion = appVersion ?? '';
        existingToken.isActive = true;
        existingToken.lastUsed = new Date();
        
        await existingToken.save();
        
        return res.status(200).json({
          success: true,
          message: 'Token updated successfully',
          data: existingToken
        });
      }

      // Deactivate old tokens for same device
      await FCMToken.updateMany(
        { userId, deviceId },
        { isActive: false }
      );

      // Create new token
      const newToken = new FCMToken({
        userId,
        token,
        deviceId,
        deviceType,
        appVersion
      });

      await newToken.save();
      

      return res.status(201).json({
        success: true,
        message: 'Token stored successfully',
        data: newToken
      });

    } catch (error) {
      
      next(error);
    }
  }

  // Get tokens for a user
  static async getUserTokens(req: GetUserTokensRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const { activeOnly = 'true' } = req.query;

      const query: Record<string, any> = { userId };
      if (activeOnly === 'true') {
        query.isActive = true;
      }

      const tokens = await FCMToken.find(query).sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        data: tokens,
        count: tokens.length
      });

    } catch (error) {
      
      next(error);
    }
  }

  // Remove/Deactivate token
  static async removeToken(req: RemoveTokenRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { tokenId } = req.params;

      const token = await FCMToken.findByIdAndUpdate(
        tokenId,
        { isActive: false },
        { new: true }
      );

      if (!token) {
        throw new AppError('Token not found', 404);
      }

      

      return res.status(200).json({
        success: true,
        message: 'Token removed successfully'
      });

    } catch (error) {
      
      next(error);
    }
  }

  // Clean up invalid tokens
  static async cleanupInvalidTokens(req: CleanupTokensRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { invalidTokens } = req.body;

      if (!Array.isArray(invalidTokens) || invalidTokens.length === 0) {
        throw new AppError('Invalid tokens array required', 400);
      }

      const result = await FCMToken.updateMany(
        { token: { $in: invalidTokens } },
        { isActive: false }
      );

      

      return res.status(200).json({
        success: true,
        message: `${result.modifiedCount} tokens cleaned up`
      });

    } catch (error) {
      next(error);
    }
  }
}

// Push Notification Controller
class PushNotificationController {
  // Send notification to single user (Phase 1)
  static async sendToUser(req: SendNotificationRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId, title, body, data = {} } = req.body;

      if (!userId || !title || !body) {
        throw new AppError('Missing required fields: userId, title, body', 400);
      }

      // Get active tokens for user
      const tokens = await FCMToken.find({ userId, isActive: true });

      if (tokens.length === 0) {
        throw new AppError('No active tokens found for user', 404);
      }

      // Create notification history record
      const notificationHistory = new NotificationHistory({
        userId,
        title,
        body,
        data,
        type: 'single',
        status: 'pending',
        deliveryDetails: {
          totalTokens: tokens.length
        }
      });

      const tokenStrings: string[] = tokens.map(t => t.token);
      
      try {
        // Send notification via FCM
        const message: admin.messaging.MulticastMessage = {
          notification: { title, body },
          data: Object.keys(data).reduce((acc: Record<string, string>, key: string) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
          tokens: tokenStrings
        };

        const response = await admin.messaging().sendEachForMulticast(message);

        // Update tokens lastUsed
        await FCMToken.updateMany(
          { token: { $in: tokenStrings } },
          { lastUsed: new Date() }
        );

        // Handle failures and invalid tokens
        const invalidTokens: string[] = [];
        if (response.failureCount > 0) {
          response.responses.forEach((resp, index) => {
            if (!resp.success && resp.error) {
              const error = resp.error;
              if (error.code === 'messaging/registration-token-not-registered' || 
                  error.code === 'messaging/invalid-registration-token') {
                invalidTokens.push(tokenStrings[index]);
              }
            }
          });

          // Deactivate invalid tokens
          if (invalidTokens.length > 0) {
            await FCMToken.updateMany(
              { token: { $in: invalidTokens } },
              { isActive: false }
            );
          }
        }

        // Update notification history
        notificationHistory.status = response.failureCount === tokenStrings.length ? 'failed' : 
                                   response.successCount === tokenStrings.length ? 'sent' : 'partial';
        notificationHistory.sentAt = new Date();
        if (!notificationHistory.deliveryDetails) {
          notificationHistory.deliveryDetails = {
            totalTokens: tokenStrings.length,
            successCount: response.successCount,
            failureCount: response.failureCount,
            invalidTokens: invalidTokens
          };
        } else {
          notificationHistory.deliveryDetails.successCount = response.successCount;
          notificationHistory.deliveryDetails.failureCount = response.failureCount;
          notificationHistory.deliveryDetails.invalidTokens = invalidTokens;
        }
        notificationHistory.fcmResponse = response;

        await notificationHistory.save();

        

        return res.status(200).json({
          success: true,
          message: 'Notification sent successfully',
          data: {
            successCount: response.successCount,
            failureCount: response.failureCount,
            totalTokens: tokenStrings.length,
            notificationId: notificationHistory._id
          }
        });

      } catch (fcmError) {
        // Update notification history with error
        notificationHistory.status = 'failed';
        notificationHistory.error = (fcmError as Error).message;
        await notificationHistory.save();

        throw new AppError('Failed to send notification via FCM', 500);
      }

    } catch (error) {
      next(error);
    }
  }

  // Send notification to multiple users (Phase 2)
  static async sendToMultipleUsers(req: SendMultipleUsersRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userIds, title, body, data = {} } = req.body;

      if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
        throw new AppError('Missing required fields: userIds (array), title, body', 400);
      }

      if (userIds.length > 500) {
        throw new AppError('Maximum 500 users allowed per request', 400);
      }

      const results: BatchResult[] = [];

      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        // Get all active tokens for this batch of users
        const tokens = await FCMToken.find({ 
          userId: { $in: batch }, 
          isActive: true 
        });

        if (tokens.length === 0) continue;

        const tokenStrings: string[] = tokens.map(t => t.token);
        const userTokenMap: Record<string, string[]> = {};
        tokens.forEach(t => {
          const userIdStr = t.userId.toString();
          if (!userTokenMap[userIdStr]) userTokenMap[userIdStr] = [];
          userTokenMap[userIdStr].push(t.token);
        });

        // Send batch notification
        const message: admin.messaging.MulticastMessage = {
          notification: { title, body },
          data: Object.keys(data).reduce((acc: Record<string, string>, key: string) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
          tokens: tokenStrings
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          
          // Create notification history for each user in batch
          for (const userId of batch) {
            const userTokens = userTokenMap[userId] || [];
            if (userTokens.length === 0) continue;

            const userSuccessCount = response.responses
              .filter((resp, index) => userTokens.includes(tokenStrings[index]) && resp.success)
              .length;

            const notificationHistory = new NotificationHistory({
              userId,
              title,
              body,
              data,
              type: 'multiple',
              status: userSuccessCount > 0 ? 'sent' : 'failed',
              sentAt: new Date(),
              deliveryDetails: {
                totalTokens: userTokens.length,
                successCount: userSuccessCount,
                failureCount: userTokens.length - userSuccessCount
              }
            });

            await notificationHistory.save();
          }

          results.push({
            batch: Math.floor(i / batchSize) + 1,
            totalTokens: tokenStrings.length,
            successCount: response.successCount,
            failureCount: response.failureCount
          });

        } catch (fcmError) {
          
          results.push({
            batch: Math.floor(i / batchSize) + 1,
            error: (fcmError as Error).message
          });
        }
      }

      const totalSuccess = results.reduce((sum, r) => sum + (r.successCount || 0), 0);
      const totalFailure = results.reduce((sum, r) => sum + (r.failureCount || 0), 0);

      

      return res.status(200).json({
        success: true,
        message: 'Notifications sent to multiple users',
        data: {
          totalUsers: userIds.length,
          totalSuccess,
          totalFailure,
          batchResults: results
        }
      });

    } catch (error) {
      
      next(error);
    }
  }

  // Broadcast notification (Phase 2)
  static async broadcastNotification(req: BroadcastRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { title, body, data = {}, targetCriteria = {}, scheduledFor } = req.body;
      const createdBy = req.user?.id;

      if (!title || !body) {
        throw new AppError('Missing required fields: title, body', 400);
      }

      // Create broadcast record
      const broadcast = new BroadcastNotification({
        title,
        body,
        data,
        targetCriteria,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : new Date(),
        createdBy,
        status: 'scheduled'
      });

      await broadcast.save();

      // If scheduled for now, process immediately
      if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
        await PushNotificationController.processBroadcast(broadcast._id.toString());
      }

      

      return res.status(201).json({
        success: true,
        message: 'Broadcast notification created',
        data: {
          broadcastId: broadcast._id,
          scheduledFor: broadcast.scheduledFor
        }
      });

    } catch (error) {
      
      next(error);
    }
  }

  // Process broadcast (internal method)
  static async processBroadcast(broadcastId: string): Promise<void> {
    try {
      const broadcast = await BroadcastNotification.findById(broadcastId);
      if (!broadcast || broadcast.status !== 'scheduled') {
        return;
      }

      broadcast.status = 'processing';
      await broadcast.save();

      // Build query based on target criteria
      const query: Record<string, any> = { isActive: true };
      
      const rawCriteria = (broadcast.targetCriteria ?? {}) as { userIds?: any[]; deviceTypes?: string[]; [key: string]: any };
      const targetCriteria: { userIds?: string[]; deviceTypes?: string[]; [key: string]: any } = {
        ...rawCriteria,
        userIds: Array.isArray(rawCriteria.userIds)
          ? rawCriteria.userIds.map((id: any) => id.toString())
          : undefined
      };

      if (Array.isArray(targetCriteria.userIds) && targetCriteria.userIds.length > 0) {
        query.userId = { $in: targetCriteria.userIds };
      }
      
      if (Array.isArray(targetCriteria.deviceTypes) && targetCriteria.deviceTypes.length > 0) {
        query.deviceType = { $in: targetCriteria.deviceTypes };
      }

      const tokens = await FCMToken.find(query);
      if (!broadcast.stats) {
        broadcast.stats = {
          totalTargeted: 0,
          totalSent: 0,
          totalFailed: 0
        };
      }
      broadcast.stats.totalTargeted = tokens.length;

      if (tokens.length === 0) {
        broadcast.status = 'completed';
        broadcast.completedAt = new Date();
        await broadcast.save();
        return;
      }

      // Send in batches
      const batchSize = 500;
      const tokenStrings: string[] = tokens.map(t => t.token);
      
      for (let i = 0; i < tokenStrings.length; i += batchSize) {
        const batchTokens = tokenStrings.slice(i, i + batchSize);
        
        const message: admin.messaging.MulticastMessage = {
          notification: { 
            title: broadcast.title, 
            body: broadcast.body 
          },
          data: Object.keys(broadcast.data).reduce((acc: Record<string, string>, key: string) => {
            acc[key] = String(broadcast.data[key]);
            return acc;
          }, {}),
          tokens: batchTokens
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(message);
          broadcast.stats.totalSent += response.successCount;
          broadcast.stats.totalFailed += response.failureCount;
        } catch (fcmError) {
         
          broadcast.stats.totalFailed += batchTokens.length;
        }
      }

      broadcast.status = 'completed';
      broadcast.completedAt = new Date();
      await broadcast.save();

      

    } catch (error) {
      
      
      await BroadcastNotification.findByIdAndUpdate(broadcastId, {
        status: 'failed',
        completedAt: new Date()
      });
    }
  }

  // Get notification history
  static async getNotificationHistory(req: GetNotificationHistoryRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId, page = '1', limit = '20', status, type } = req.query;

      const query: Record<string, any> = {};
      if (userId) query.userId = userId;
      if (status) query.status = status;
      if (type) query.type = type;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [notifications, total] = await Promise.all([
        NotificationHistory.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .populate('userId', 'name email'),
        NotificationHistory.countDocuments(query)
      ]);

      return res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      1
      next(error);
    }
  }
}

// User Preferences Controller (Phase 2)
class UserPreferencesController {
  // Get user preferences
  static async getUserPreferences(req: UserPreferencesRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;

      let preferences = await UserPreferences.findOne({ userId });
      
      if (!preferences) {
        // Create default preferences
        preferences = new UserPreferences({ userId });
        await preferences.save();
      }

      return res.status(200).json({
        success: true,
        data: preferences
      });

    } catch (error) {
      next(error);
    }
  }

  // Update user preferences
  static async updateUserPreferences(req: UserPreferencesRequest, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const preferences = await UserPreferences.findOneAndUpdate(
        { userId },
        { ...updates, updatedAt: new Date() },
        { new: true, upsert: true }
      );


      return res.status(200).json({
        success: true,
        message: 'Preferences updated successfully',
        data: preferences
      });

    } catch (error) {
      next(error);
    }
  }
}


// Route to save the FCM token
export const saveFCMToken = async (req: Request, res: Response): Promise<void> => {
  const { userId, token } = req.body; // Assuming the frontend sends userId and token in the request body

  try {
    // Check if the token already exists for the user
    let fcmToken = await FCMToken.findOne({ userId });

    if (fcmToken) {
      // Update the token if it already exists
      fcmToken.token = token;
      fcmToken.createdAt = new Date();
      await fcmToken.save();
    } else {
      // Create a new entry if no token exists for the user
      fcmToken = new FCMToken({
        userId,
        token,
      });
      await fcmToken.save();
    }

    res.status(200).json({ message: 'FCM Token saved successfully' });
  } catch (error) {
    console.error('Error saving FCM Token:', error);
    res.status(500).json({ error: 'Failed to save FCM Token' });
  }
};


export {
  FCMTokenController,
  PushNotificationController,
  UserPreferencesController
};