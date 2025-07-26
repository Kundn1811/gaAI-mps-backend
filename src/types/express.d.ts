import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: any; // or define your user type
    }
  }
}

export interface AuthRequest extends Request {
  user?: any; // Define your user type here
  files?: any; // For multer files
}