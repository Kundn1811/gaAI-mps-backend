import { Request, Response } from 'express';
import admin from '../firebase/admin';
import { AppError } from '../utils/appError';


export const sendNotification = async (req: Request, res: Response) => {
  const { title, body, token } = req.body;

  if (!title || !body || !token) {
    throw new AppError('Missing required fields: title, body, or token', 400);
  }

  const message = {
    notification: {
      title,
      body,
    },
    token,
  };

  try {
    const response = await admin.messaging().send(message);
    return res.status(200).json({ success: true, response });
  } catch (error:any) {
    console.error('Error sending notification:', error);
     throw new AppError('Something went wrong', 500);
  }
};
