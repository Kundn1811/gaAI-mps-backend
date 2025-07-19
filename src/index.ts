import express, { Request, Response } from 'express';
import dotenv from 'dotenv'
import notificationRoutes from './routes/notification.routes'
dotenv.config();
import app from './app';

const PORT = process.env.PORT || 5000;


app.get('/', (req: Request, res: Response) => {
  res.send('Hello There! Server is up and working');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
