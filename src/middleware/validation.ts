import { Request, Response, NextFunction } from 'express';
import { body, validationResult, ValidationChain } from 'express-validator';
import { AppError } from '../utils/appError';


const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg).join(', ');
    throw new AppError(errorMessages, 400);
  }
  next();
};

type ValidationMiddleware = (ValidationChain | typeof handleValidationErrors)[];

const validateToken: ValidationMiddleware = [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('token').notEmpty().withMessage('FCM token is required'),
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('deviceType').isIn(['ios', 'android', 'web']).withMessage('Invalid device type'),
  handleValidationErrors
];

const validateNotification: ValidationMiddleware = [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('title').notEmpty().withMessage('Title is required'),
  body('body').notEmpty().withMessage('Body is required'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  handleValidationErrors
];

const validateMultipleUsers: ValidationMiddleware = [
  body('userIds').isArray({ min: 1, max: 500 }).withMessage('UserIds must be array (1-500 items)'),
  body('title').notEmpty().withMessage('Title is required'),
  body('body').notEmpty().withMessage('Body is required'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  handleValidationErrors
];

const validateBroadcast: ValidationMiddleware = [
  body('title').notEmpty().withMessage('Title is required'),
  body('body').notEmpty().withMessage('Body is required'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  body('scheduledFor').optional().isISO8601().withMessage('Invalid scheduled date'),
  handleValidationErrors
];

export {
  validateToken,
  validateNotification,
  validateMultipleUsers,
  validateBroadcast
};