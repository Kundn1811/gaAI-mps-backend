import express, { Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { Storage } from '@google-cloud/storage';
import dotenv from 'dotenv';
import path from 'path';
import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Load GCP credentials from file
const serviceKeyPath = path.join(__dirname, 'service-account.json');
if (!fs.existsSync(serviceKeyPath)) {
  console.error('Service account key file not found.');
  process.exit(1);
}

// Multer storage (in-memory)
const storageMulter = multer.memoryStorage();
const upload = multer({ storage: storageMulter });

// Initialize Google Cloud Storage
const gcStorage = new Storage({
  keyFilename: serviceKeyPath,
});

const bucketName = process.env.GCP_BUCKET_NAME;
if (!bucketName) {
  console.error('GCP_BUCKET_NAME not set in environment variables.');
  process.exit(1);
}
const bucket = gcStorage.bucket(bucketName);

// Define a custom file type for req.file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Upload endpoint
app.post('/upload', upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const file = req.file;
    const fileName = `${Date.now()}_${uuidv4()}_${file.originalname}`;
    const blob = bucket.file(fileName);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      predefinedAcl: 'publicRead',
    });

    blobStream.on('error', (err: Error) => {
      console.error('Stream error:', err);
      res.status(500).json({ error: 'Upload error.' });
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      res.status(200).json({ url: publicUrl });
    });

    blobStream.end(file.buffer);
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
