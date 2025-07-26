import express, { Request, Response, NextFunction } from 'express';
import notificationRouter from './routes/notification.routes'
import fcmRouter from './routes/fcm.routes';
import logger from './middleware/logger.middleware';
import { globalErrorHandler } from './middleware/error.middleware';
import { MulterError } from 'multer';
import connectDB from './config';
import userPostRoutes from './routes/userPost.routes';

const app = express();

// Logging middleware
app.use(logger);

app.use(express.json());

app.use("/api/v1", notificationRouter);
app.use("/api/v1/fcm", fcmRouter);

app.get("/", (req, res) => {
  res.send("Hello There! Server is up and working");
});

//  import the userPost routes form './routes/userPost.routes';

app.use("/api/v1/userPost", userPostRoutes);

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File size too large' });
      return;
    }
  }
  res.status(500).json({ error: error.message });
});

// Initialize database connection and start server
const startServer = async (): Promise<void> => {
  await connectDB();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
app.use(globalErrorHandler);

export default app;