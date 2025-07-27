import { Express } from 'express';
import { uploadFileToGCP } from './gcpUploader'; // Adjust the path accordingly
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

// Mock the file content (dummy .txt file)
const mockFilePath = path.join(__dirname, 'test-file.txt');

// Create a dummy .txt file for testing
fs.writeFileSync(mockFilePath, 'This is a dummy text file for testing.');

// Create the mock file object that multer would pass
const mockFile = {
  buffer: fs.readFileSync(mockFilePath), // Read the file content as a buffer
  mimetype: 'text/plain',
  originalname: 'test-file.txt',
} as Express.Multer.File;

// Testing the upload function
const testUpload = async () => {
  try {
    const fileName = 'uploads/test-file.txt'; // Adjust file path/name as needed
    const publicUrl = await uploadFileToGCP(mockFile, fileName);

    console.log('File uploaded successfully. Public URL:', publicUrl);

    // Clean up the dummy file after testing
    fs.unlinkSync(mockFilePath);
  } catch (error) {
    console.error('Error uploading file:', error);
  }
};

// Run the test function
testUpload();
