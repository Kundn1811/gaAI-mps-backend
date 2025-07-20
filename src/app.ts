import express from 'express';
import notificationRouter from './routes/notification.routes'
import fcmRouter from './routes/fcm.routes';
import logger from './middleware/logger.middleware';
import { globalErrorHandler } from './middleware/error.middleware';

const app = express();

// Logging middleware
app.use(logger);

app.use(express.json());

app.use("/api/v1", notificationRouter);
app.use("/api/v1/fcm", fcmRouter);

app.get("/", (req, res) => {
  res.send("Hello There! Server is up and working");
});

app.use(globalErrorHandler);

export default app;