import { Router } from 'express';
import { sendNotification } from '../controllers/notification.controller';

const router = Router();

router.get('/send-notification', sendNotification);

export default router;
