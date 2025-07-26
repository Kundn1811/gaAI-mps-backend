//import all the controllers from the post.controller file and give them the apis endpoint 

import express from 'express';
import { post, getPost, getSinglePost, register, login, voteOnPost,
  deletePost } from '../controllers/post.controller';
import authenticateToken from '../utils/authenticateToken';

const router = express.Router();
// Post Routes
router.post('/post', authenticateToken, post);
router.get('/posts', authenticateToken, getPost);
router.get('/post/:postId', authenticateToken, getSinglePost);
router.post('/register', register);
router.post('/login', login);
router.post('/vote', authenticateToken, voteOnPost);
router.delete('/post/:postId', authenticateToken, deletePost);

export default router;