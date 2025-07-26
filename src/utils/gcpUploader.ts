import { Storage } from '@google-cloud/storage';
import path from 'path';
import dotenv from 'dotenv';
import { Express } from 'express';

dotenv.config();

const serviceKeyPath = path.join(__dirname, '../service-account.json'); // adjust path as needed

const storage = new Storage({ keyFilename: serviceKeyPath });

const bucketName = process.env.GCP_BUCKET_NAME;
if (!bucketName) {
  throw new Error('GCP_BUCKET_NAME not set in environment variables');
}
const bucket = storage.bucket(bucketName);

/**
 * Uploads a file to Google Cloud Storage and returns the public URL.
 *
 * @param file - The file object from multer
 * @param fileName - The path/name for the file in the bucket (e.g., "posts/123.png")
 * @returns The public URL of the uploaded file
 */
export const uploadFileToGCP = async (
  file: Express.Multer.File,
  fileName: string
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
      predefinedAcl: 'publicRead',
    });

    blobStream.on('error', (err) => {
      reject(err);
    });

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve(publicUrl);
    });

    blobStream.end(file.buffer);
  });
};
