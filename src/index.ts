import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import connectDB from './config';

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed, but starting server anyway:', error);
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8099;

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});