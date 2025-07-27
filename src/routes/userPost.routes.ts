//import all the controllers from the post.controller file and give them the apis endpoint 

import express from 'express';
import { post, getPost, getSinglePost, register, login, voteOnPost,
  deletePost, 
  getPostsByLocation} from '../controllers/post.controller';
import authenticateToken from '../utils/authenticateToken';
import multer from 'multer';
const router = express.Router();

// Set up multer storage (in-memory storage for simplicity, but you can configure as needed)
const storage = multer.memoryStorage();

// Set up multer middleware
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024,  // Default 10MB limit for both images and videos
  },
  fileFilter: (req, file, cb) => {
    // Apply restrictions for video files (no need to check size here, multer already does it)
    if (file.mimetype.startsWith('video/')) {
      if (file.size > 10 * 1024 * 1024) {
        return cb(new Error('Video file size exceeds the limit of 10MB'));
      }
    }
    // Apply restrictions for image files (optional)
    if (file.mimetype.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        return cb(new Error('Image file size exceeds the limit of 5MB'));
      }
    }
    cb(null, true); // Accept the file
  }
});

// Post Routes
router.post('/post', upload.array('files'), authenticateToken, post);
router.get('/posts', authenticateToken, getPost);
router.get('/post/:postId', authenticateToken, getSinglePost);
router.post('/register', register);
router.post('/login', login);
router.post('/vote', authenticateToken, voteOnPost);
router.delete('/post/:postId', authenticateToken, deletePost);
router.get('/posts/by-location', authenticateToken, getPostsByLocation);

export default router;