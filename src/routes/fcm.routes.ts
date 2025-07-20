import express from 'express';
import { FCMTokenController, PushNotificationController, UserPreferencesController } from '../controllers/fcmToken.controller';
import { validateBroadcast, validateMultipleUsers, validateNotification, validateToken } from '../middleware/validation';


const router = express.Router();


// ============ PHASE 1 ROUTES ============

// FCM Token Management Routes
router.post('/tokens', validateToken, FCMTokenController.storeToken);
router.get('/tokens/user/:userId', FCMTokenController.getUserTokens);
router.delete('/tokens/:tokenId', FCMTokenController.removeToken);
router.post('/tokens/cleanup', FCMTokenController.cleanupInvalidTokens);

// Single User Notification Routes
router.post('/send/user', validateNotification, PushNotificationController.sendToUser);

// Notification History Routes
router.get('/history', PushNotificationController.getNotificationHistory);



// ============ PHASE 2 ROUTES ============

// Multiple Users Notification Routes
router.post('/send/multiple', validateMultipleUsers, PushNotificationController.sendToMultipleUsers);

// Broadcast Notification Routes
router.post('/broadcast', validateBroadcast, PushNotificationController.broadcastNotification);

// User Preferences Routes
router.get('/preferences/:userId', UserPreferencesController.getUserPreferences);
router.put('/preferences/:userId', UserPreferencesController.updateUserPreferences);

export default router;


/*
--------------------------------------------------------------------------------------------------  
            ██████╗ ██╗████████╗    ██████╗  █████╗ ███╗   ██╗██████╗ ██╗████████╗███████╗
            ██╔══██╗██║╚══██╔══╝    ██╔══██╗██╔══██╗████╗  ██║██╔══██╗██║╚══██╔══╝██╔════╝
            ██████╔╝██║   ██║       ██████╔╝███████║██╔██╗ ██║██║  ██║██║   ██║   ███████╗
            ██╔══██╗██║   ██║       ██╔══██╗██╔══██║██║╚██╗██║██║  ██║██║   ██║   ╚════██║
            ██████╔╝██║   ██║       ██████╔╝██║  ██║██║ ╚████║██████╔╝██║   ██║   ███████║
            ╚═════╝ ╚═╝   ╚═╝       ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝   ╚═╝   ╚══════╝
---------------------------------------------------------------------------------------------------
*/