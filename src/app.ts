import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';  // Import CORS
import notificationRouter from './routes/notification.routes';
import fcmRouter from './routes/fcm.routes';
import logger from './middleware/logger.middleware';
import { globalErrorHandler } from './middleware/error.middleware';
import { MulterError } from 'multer';
import userPostRoutes from './routes/userPost.routes';

const app = express();

// CORS middleware to allow all origins
app.use(cors());  // This will allow all origins
  
// Logging middleware
app.use(logger);  
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.send("Hello There! Server is up and working");
});

app.use("/api/v1", notificationRouter);
app.use("/api/v1/fcm", fcmRouter);
app.use("/api/v1/userPost", userPostRoutes);

// Multer error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File size too large' });
      return;
    }
  }
  next(error); // Pass to global error handler
});

// Global error handler (should be last)
app.use(globalErrorHandler);

export default app;
