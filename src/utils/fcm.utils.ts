import * as cron from 'node-cron';
import * as admin from 'firebase-admin';
import FCMToken from '../models/fcm.model';
import BroadcastNotification from '../models/broadcastingNotification.model';
import { PushNotificationController } from '../controllers/fcmToken.controller';
import NotificationHistory from '../models/notificationHistory.model';
import UserPreferences from '../models/userPrefrence.model';



// Type definitions
interface NotificationPermissionResult {
  canReceive: boolean;
  reason: string;
}

interface NotificationTemplateData {
  name?: string;
  orderId?: string;
  status?: string;
  title?: string;
  body?: string;
  action?: string;
  [key: string]: any;
}

interface NotificationTemplate {
  title: string;
  body: string;
  data: Record<string, any>;
}

interface TokenValidationResult {
  valid: string[];
  invalid: InvalidToken[];
}

interface InvalidToken {
  token: string;
  error: string;
}

interface NotificationStatsFilters {
  startDate?: string | Date;
  endDate?: string | Date;
  userId?: string;
  type?: string;
}

interface NotificationStats {
  totalNotifications: number;
  totalSent: number;
  totalFailed: number;
  avgSuccessRate: number;
  statusCounts: Record<string, number>;
  typeCounts: Record<string, number>;
}

interface HealthCheckResult {
  fcm: 'healthy' | 'unhealthy';
  database?: 'healthy' | 'unhealthy';
  stats?: {
    totalTokens: number;
    totalNotifications: number;
  };
  timestamp: Date;
  message?: string;
  error?: string;
}

interface MockResponse {
  status: (code: number) => { json: (data: any) => void };
}

interface MockRequest {
  body: Record<string, any>;
}

type TemplateType = 'welcome' | 'order_update' | 'promotion' | 'reminder' | 'security';

// Utility Functions for FCM Management
class FCMUtils {
  // Initialize FCM utilities (call this in your app startup)
  static init(): void {
    this.scheduleTokenCleanup();
    this.scheduleProcessPendingBroadcasts();
    
  }

  // Clean up inactive tokens (runs daily at 2 AM)
  static scheduleTokenCleanup(): void {
    cron.schedule('0 2 * * *', async () => {
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await FCMToken.deleteMany({
          isActive: false,
          lastUsed: { $lt: thirtyDaysAgo }
        });

      } catch (error) {
          console.error('Error during FCM token cleanup:', error);
          
      }
    });
  }

  // Process pending scheduled broadcasts (runs every minute)
  static scheduleProcessPendingBroadcasts(): void {
    cron.schedule('* * * * *', async () => {
      try {
        const now = new Date();
        const pendingBroadcasts = await BroadcastNotification.find({
          status: 'scheduled',
          scheduledFor: { $lte: now }
        });

        for (const broadcast of pendingBroadcasts) {
          await PushNotificationController.processBroadcast(broadcast._id.toString());
        }

        if (pendingBroadcasts.length > 0) {
            console.log(`Processed ${pendingBroadcasts.length} pending broadcasts at ${now.toISOString()}`);
        }
      } catch (error) {
        console.error('Error processing pending broadcasts:', error);
      }
    });
  }

  // Check if user can receive notifications based on preferences
  static async canUserReceiveNotification(
    userId: string, 
    category: string = 'general', 
    notificationData: Record<string, any> = {}
  ): Promise<NotificationPermissionResult> {
    try {
      const preferences = await UserPreferences.findOne({ userId });
      
      if (!preferences) {
        return { canReceive: true, reason: 'default_preferences' };
      }

      // Check global enabled
      if (!preferences.globalEnabled) {
        return { canReceive: false, reason: 'globally_disabled' };
      }

      // Check category preferences
      if (
        category &&
        preferences.categories &&
        Object.prototype.hasOwnProperty.call(preferences.categories, category) &&
        (preferences.categories as Record<string, boolean>)[category] === false
      ) {
        return { canReceive: false, reason: `category_disabled: ${category}` };
      }

      // Check quiet hours
      if (preferences.quietHours?.enabled) {
        const now = new Date();
        const userTimezone = preferences.quietHours.timezone || 'UTC';
        
        // Simple quiet hours check (you might want to use a proper timezone library)
        const currentHour = now.getUTCHours(); // Simplified - in production use proper timezone conversion
        const startHour = parseInt(preferences.quietHours.startTime.split(':')[0]);
        const endHour = parseInt(preferences.quietHours.endTime.split(':')[0]);

        const isQuietTime = (startHour > endHour) ? 
          (currentHour >= startHour || currentHour < endHour) : 
          (currentHour >= startHour && currentHour < endHour);

        if (isQuietTime && !notificationData.urgent) {
          return { canReceive: false, reason: 'quiet_hours' };
        }
      }

      return { canReceive: true, reason: 'allowed' };
    } catch (error) {
      return { canReceive: true, reason: 'error_default_allow' };
    }
  }

  // Validate FCM tokens by sending test messages
  static async validateTokens(tokens: string[]): Promise<TokenValidationResult> {
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return { valid: [], invalid: [] };
    }

    const valid: string[] = [];
    const invalid: InvalidToken[] = [];

    // Test tokens in batches of 100
    const batchSize = 100;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        // Send a test message (dry run)
        const message: admin.messaging.MulticastMessage = {
          data: { test: 'validation' },
          tokens: batch
        };

        const response = await admin.messaging().sendEachForMulticast(message); // dry run

        response.responses.forEach((resp, index) => {
          if (resp.success) {
            valid.push(batch[index]);
          } else {
            invalid.push({
              token: batch[index],
              error: resp.error?.code || 'unknown_error'
            });
          }
        });
      } catch (error) {
        // If batch fails entirely, mark all as invalid
        batch.forEach(token => {
          invalid.push({
            token,
            error: 'batch_validation_failed'
          });
        });
      }
    }

    return { valid, invalid };
  }

  // Get notification statistics
  static async getNotificationStats(filters: NotificationStatsFilters = {}): Promise<NotificationStats> {
    try {
      const { startDate, endDate, userId, type } = filters;
      
      const matchStage: Record<string, any> = {};
      
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }
      
      if (userId) matchStage.userId = userId;
      if (type) matchStage.type = type;

      const stats = await NotificationHistory.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            totalSent: { $sum: '$deliveryDetails.successCount' },
            totalFailed: { $sum: '$deliveryDetails.failureCount' },
            avgSuccessRate: { 
              $avg: {
                $divide: [
                  '$deliveryDetails.successCount',
                  '$deliveryDetails.totalTokens'
                ]
              }
            },
            statusBreakdown: {
              $push: '$status'
            },
            typeBreakdown: {
              $push: '$type'
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalNotifications: 1,
            totalSent: 1,
            totalFailed: 1,
            avgSuccessRate: { $multiply: ['$avgSuccessRate', 100] }, // Convert to percentage
            statusBreakdown: 1,
            typeBreakdown: 1
          }
        }
      ]);

      const result = stats[0] || {
        totalNotifications: 0,
        totalSent: 0,
        totalFailed: 0,
        avgSuccessRate: 0,
        statusBreakdown: [],
        typeBreakdown: []
      };

      // Count occurrences in breakdowns
      const statusCounts: Record<string, number> = result.statusBreakdown.reduce((acc: Record<string, number>, status: string) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const typeCounts: Record<string, number> = result.typeBreakdown.reduce((acc: Record<string, number>, type: string) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalNotifications: result.totalNotifications,
        totalSent: result.totalSent,
        totalFailed: result.totalFailed,
        avgSuccessRate: result.avgSuccessRate,
        statusCounts,
        typeCounts
      };
    } catch (error) {
      throw error;
    }
  }

  // Retry failed notifications
  static async retryFailedNotifications(notificationId: string): Promise<any> {
    try {
      const notification = await NotificationHistory.findById(notificationId);

      if (!notification || notification.status !== 'failed') {
        throw new Error('Invalid notification for retry');
      }

      // Extract original notification data
      const { userId, title, body, data, type } = notification;

      if (type === 'single') {
        // Create mock request and response objects
        const mockRequest = { body: { userId, title, body, data } } as MockRequest;
        const mockResponse = { 
          status: () => ({ json: () => {} }) 
        } as MockResponse;
        const mockNext = () => {};

        // Retry single user notification
        return await PushNotificationController.sendToUser(
          mockRequest as any,
          mockResponse as any,
          mockNext
        );
      } else if (type === 'multiple') {
        // For multiple user notifications, you'd need to store the original userIds
        // This requires schema modification to store original request data
        throw new Error('Multiple user notification retry not implemented');
      }

    } catch (error) {
      throw error;
    }
  }

  // Generate notification template
  static generateNotificationTemplate(type: TemplateType, data: NotificationTemplateData = {}): NotificationTemplate {
    const templates: Record<TemplateType, NotificationTemplate> = {
      welcome: {
        title: `Welcome ${data.name || 'User'}!`,
        body: 'Thanks for joining us. Get started by exploring our features.',
        data: { type: 'welcome', action: 'onboarding' }
      },
      order_update: {
        title: 'Order Update',
        body: `Your order #${data.orderId || 'XXX'} has been ${data.status || 'updated'}.`,
        data: { type: 'order', orderId: data.orderId, action: 'view_order' }
      },
      promotion: {
        title: data.title || 'Special Offer!',
        body: data.body || 'Don\'t miss out on this limited-time offer.',
        data: { type: 'promotion', category: 'marketing', action: 'view_offer' }
      },
      reminder: {
        title: 'Reminder',
        body: data.body || 'You have a pending action to complete.',
        data: { type: 'reminder', action: data.action || 'open_app' }
      },
      security: {
        title: 'Security Alert',
        body: data.body || 'There was a security-related activity on your account.',
        data: { type: 'security', urgent: true, action: 'security_check' }
      }
    };

    return templates[type] || {
      title: data.title || 'Notification',
      body: data.body || 'You have a new notification.',
      data: { type: 'general', ...data }
    };
  }

  // Health check for FCM service
  static async healthCheck(): Promise<HealthCheckResult> {
    try {
      // Test with a dummy token (this will fail but validates FCM connection)
      try {
        await admin.messaging().send({
          token: 'dummy_token_for_health_check',
          notification: { title: 'Test', body: 'Test' }
        });
      } catch (fcmError: any) {
        // Expected error for dummy token, but confirms FCM is reachable
        if (fcmError.code === 'messaging/registration-token-not-registered') {
          return { 
            fcm: 'healthy', 
            timestamp: new Date(),
            message: 'FCM service is reachable'
          };
        }
      }

      // Check database connectivity
      const tokenCount = await FCMToken.countDocuments();
      const notificationCount = await NotificationHistory.countDocuments();

      return {
        fcm: 'healthy',
        database: 'healthy',
        stats: {
          totalTokens: tokenCount,
          totalNotifications: notificationCount
        },
        timestamp: new Date()
      };

    } catch (error) {
      return {
        fcm: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date()
      };
    }
  }
}

// Export utility functions
export { FCMUtils };

// Example usage types for reference
export interface FCMUtilsExampleTypes {
  // Health check endpoint type
  healthCheckEndpoint: (req: any, res: any) => Promise<void>;
  
  // Stats endpoint type
  statsEndpoint: (req: any, res: any) => Promise<void>;
}

/*
Example usage in your main app file:

import { FCMUtils } from './utils/fcmUtils';
import { Request, Response } from 'express';

// Initialize FCM utilities when your app starts
FCMUtils.init();

// Health check endpoint
app.get('/health/fcm', async (req: Request, res: Response) => {
  const health = await FCMUtils.healthCheck();
  res.json(health);
});

// Stats endpoint
app.get('/admin/notification-stats', async (req: Request, res: Response) => {
  try {
    const stats = await FCMUtils.getNotificationStats(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Template generation example
const welcomeNotification = FCMUtils.generateNotificationTemplate('welcome', { name: 'John Doe' });

// Token validation example
const validationResult = await FCMUtils.validateTokens(['token1', 'token2', 'token3']);
console.log('Valid tokens:', validationResult.valid);
console.log('Invalid tokens:', validationResult.invalid);

// Check user permissions
const canReceive = await FCMUtils.canUserReceiveNotification('userId123', 'marketing');
if (canReceive.canReceive) {
  // Send notification
} else {
  console.log('Cannot send notification:', canReceive.reason);
}
*/