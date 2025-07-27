// Social Posting Backend API - MongoDB TypeScript
import express, { Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import mongoose, { Schema, Document, Types } from 'mongoose';
import jwt, { JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import { uploadFileToGCP } from '../utils/gcpUploader';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

interface IGeoPoint {
  latitude: number;
  longitude: number;
}

// Types and Interfaces
interface IUser extends Document {
  _id: Types.ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  startPoint: IGeoPoint;
  endPoint: IGeoPoint;
  role?: 'user' | 'administrative';
  createdAt: Date;
  updatedAt: Date;
}

interface IMediaFile {
  url: string;
  type: string;
  fileName: string;
}

interface IPost extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'video' | 'mixed';
  media: IMediaFile[];
  longitude?: number;
  latitude?: number;
  role?: 'user' | 'administrative';
  createdAt: Date;
  updatedAt: Date;
}

interface IVote extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  voteType: 'up' | 'down';
  createdAt: Date;
}

interface PostWithDetails extends IPost {
  username: string;
  upvotes: number;
  downvotes: number;
  score: number;
  userUpvoted: boolean;
  userDownvoted: boolean;
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  startPoint: IGeoPoint;
  endPoint: IGeoPoint;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface CreatePostRequest {
  content: string;
  type?: 'text' | 'image' | 'video' | 'mixed';
  media?: IMediaFile[];
  latitude?: number;
  longitude?: number;
}

interface VoteRequest {
  voteType: 'up' | 'down';
}

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: 'createdAt' | 'score';
}

// MongoDB Schemas
const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  startPoint: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  endPoint: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  role: { type: String, enum: ['user', 'administrative'], default: 'user' }
}, { 
  timestamps: true,
  versionKey: false 
});

const mediaFileSchema = new Schema<IMediaFile>({
  url: { type: String, required: true },
  type: { type: String, required: true },
  fileName: { type: String, required: true }
}, { _id: false });

const postSchema = new Schema<IPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'video', 'mixed'], default: 'text' },
  media: [mediaFileSchema],
  longitude: { type: Number },
  latitude: { type: Number },
}, { 
  timestamps: true,
  versionKey: false 
});

const voteSchema = new Schema<IVote>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  voteType: { type: String, enum: ['up', 'down'], required: true },
}, { 
  timestamps: true,
  versionKey: false 
});

// Create compound index for unique user-post vote combination
voteSchema.index({ userId: 1, postId: 1 }, { unique: true });

// Models
const User = mongoose.model<IUser>('User', userSchema);
const Post = mongoose.model<IPost>('Post', postSchema);
const Vote = mongoose.model<IVote>('Vote', voteSchema);

// AWS S3 Configuration
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

//gcp bucket configuration
// const gcpStorage = new Storage({
//   projectId: process.env.GCP_PROJECT_ID!,
//   keyFilename: process.env.GCP_KEY_FILE!
// });
// const bucket = gcpStorage.bucket(process.env.GCP_BUCKET_NAME!);


// Multer configuration for file uploads
// const storage = multer.memoryStorage();
// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 50 * 1024 * 1024, // 50MB limit
//   },
//   fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
//     // Allow images and videos
//     if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image and video files are allowed'));
//     }
//   }
// });


// User Registration
export const register = async (req: Request<{}, {}, RegisterRequest>, res: Response): Promise<void> => {
  try {
    const { username, email, password, startPoint, endPoint } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      res.status(400).json({ error: 'Username or email already exists' });
      return;
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = new User({
      username,
      email,
      passwordHash,
      startPoint,
      endPoint,
      role: 'user'
    });
    
    const savedUser = await user.save();
    
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: savedUser._id 
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};


// User Login - convert this api into controller function
// This function handles user login, validates credentials, and returns a JWT token.
export const login = async (req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Create Post (with  file upload)
// export const post = async (req: AuthRequest, res: Response): Promise<void> => {
//   const session = await mongoose.startSession();
  
//   try {
//     session.startTransaction();
    
//     const { content, type = 'text' }: CreatePostRequest = req.body;
//     const userId = req.user!.userId;
    
//     // Handle file uploads if any
//     const media: IMediaFile[] = [];
//     if (req.files && Array.isArray(req.files) && req.files.length > 0) {
//       for (const file of req.files) {
//         const fileName = `posts/${Date.now()}-${file.originalname}`;
//         const fileUrl = await uploadFileToGCP(file, fileName);
        
//         media.push({
//           url: fileUrl,
//           type: file.mimetype,
//           fileName: file.originalname
//         });
//       }
//     }
    
//     // Create post
//     const post = new Post({
//       userId: new Types.ObjectId(userId),
//       content,
//       type: media.length > 0 ? (media.length > 1 ? 'mixed' : (media[0].type.startsWith('image/') ? 'image' : 'video')) : type,
//       media
//     });
    
//     const savedPost = await post.save({ session });
    
//     await session.commitTransaction();
    
//     res.status(201).json({
//       message: 'Post created successfully',
//       postId: savedPost._id
//     });
    
//   } catch (error) {
//     await session.abortTransaction();
//     console.error('Post creation error:', error);
//     res.status(500).json({ error: 'Failed to create post' });
//   } finally {
//     await session.endSession();
//   }
// };


export const post = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Destructure the post content and type from req.body
    const { content, type = 'text' }: CreatePostRequest = req.body;
    const userId = req.user!.userId;

    // Handle file uploads if any
    const media: IMediaFile[] = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `posts/${Date.now()}-${file.originalname}`;
        const fileUrl = await uploadFileToGCP(file, fileName);

        media.push({
          url: fileUrl,
          type: file.mimetype,
          fileName: file.originalname
        });
      }
    }

    // Create post
    const post = new Post({
      userId: new Types.ObjectId(userId),
      content,
      type: media.length > 0 ? (media.length > 1 ? 'mixed' : (media[0].type.startsWith('image/') ? 'image' : 'video')) : type,
      media
    });

    const savedPost = await post.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      message: 'Post created successfully',
      postId: savedPost._id
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  } finally {
    await session.endSession();
  }
};


// Get Posts Feed (with pagination)
// export const getPost = async (req: AuthRequest, res: Response): Promise<void> => {
//   try {
//     const { page = '1', limit = '20', sortBy = 'createdAt' } = req.query;
//     const userId = req.user!.userId;
    
//     // Validate and sanitize inputs
//     const pageNum = Math.max(1, parseInt(page as string) || 1);
//     const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20)); // Cap at 100
//     const skip = (pageNum - 1) * limitNum;
    
//     // Validate sortBy parameter
//     const validSortFields = ['createdAt', 'score'];
//     const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';

//     const pipeline: mongoose.PipelineStage[] = [
//       // Lookup user information
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user',
//           pipeline: [
//             { $project: { username: 1 } } // Only get username
//           ]
//         }
//       },
//       { $unwind: '$user' },
      
//       // Lookup vote aggregations (more efficient)
//       {
//         $lookup: {
//           from: 'votes',
//           localField: '_id',
//           foreignField: 'postId',
//           as: 'voteData',
//           pipeline: [
//             {
//               $group: {
//                 _id: '$postId',
//                 upvotes: {
//                   $sum: { $cond: [{ $eq: ['$voteType', 'up'] }, 1, 0] }
//                 },
//                 downvotes: {
//                   $sum: { $cond: [{ $eq: ['$voteType', 'down'] }, 1, 0] }
//                 },
//                 userVotes: {
//                   $push: {
//                     $cond: [
//                       { $eq: ['$userId', new Types.ObjectId(userId)] },
//                       '$voteType',
//                       null
//                     ]
//                   }
//                 }
//               }
//             }
//           ]
//         }
//       },
      
//       // Add calculated fields
//       {
//         $addFields: {
//           upvotes: { 
//             $ifNull: [{ $arrayElemAt: ['$voteData.upvotes', 0] }, 0] 
//           },
//           downvotes: { 
//             $ifNull: [{ $arrayElemAt: ['$voteData.downvotes', 0] }, 0] 
//           },
//           userUpvoted: {
//             $in: ['up', { $arrayElemAt: ['$voteData.userVotes', 0] }]
//           },
//           userDownvoted: {
//             $in: ['down', { $arrayElemAt: ['$voteData.userVotes', 0] }]
//           }
//         }
//       },
      
//       // Add score field
//       {
//         $addFields: {
//           score: { $subtract: ['$upvotes', '$downvotes'] }
//         }
//       }
//     ];

//     // Add sort stage
//     if (sortField === 'score') {
//       pipeline.push({ $sort: { score: -1, createdAt: -1 } });
//     } else {
//       pipeline.push({ $sort: { createdAt: -1 } });
//     }

//     // Fetch one extra record to determine hasMore
//     pipeline.push({ $skip: skip });
//     pipeline.push({ $limit: limitNum + 1 });

//     // Project final fields
//     pipeline.push({
//       $project: {
//         _id: 1,
//         content: 1,
//         type: 1,
//         media: 1,
//         createdAt: 1,
//         updatedAt: 1,
//         username: '$user.username',
//         userId: '$user._id',
//         upvotes: 1,
//         downvotes: 1,
//         score: 1,
//         userUpvoted: 1,
//         userDownvoted: 1
//       }
//     });

//     const results = await Post.aggregate(pipeline);
    
//     // Correct hasMore logic
//     const hasMore = results.length > limitNum;
//     const posts = hasMore ? results.slice(0, limitNum) : results;

//     res.json({
//       posts,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//         hasMore,
//         total: hasMore ? undefined : skip + posts.length // Optional: only calculate total when on last page
//       }
//     });

//   } catch (error) {
//     console.error('Feed fetch error:', error);
//     res.status(500).json({ error: 'Failed to fetch posts' });
//   }
// };

export const getPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Simple version without aggregation first
    const posts = await Post.find()
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum + 1)
      .lean();

    const hasMore = posts.length > limitNum;
    const finalPosts = hasMore ? posts.slice(0, limitNum) : posts;

    // Transform the data
    const transformedPosts = finalPosts.map(post => ({
      _id: post._id,
      content: post.content,
      type: post.type,
      media: post.media,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      username: typeof post.userId === 'object' && post.userId !== null && 'username' in post.userId
        ? (post.userId as any).username
        : 'Unknown',
      userId: typeof post.userId === 'object' && post.userId !== null && '_id' in post.userId
        ? (post.userId as any)._id
        : post.userId,
      upvotes: 0, // We'll add vote counting later
      downvotes: 0,
      score: 0,
      userUpvoted: false,
      userDownvoted: false
    }));

    res.json({
      posts: transformedPosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore
      }
    });

  } catch (error:any) {
    console.error('Feed fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch posts',
      message: error.message // Add this for debugging
    });
  }
};

// Vote on Post
export const voteOnPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const { voteType } = req.body;
    const userId = req.user!.userId;
    
    if (!['up', 'down'].includes(voteType)) {
      res.status(400).json({ error: 'Invalid vote type' });
      return;
    }
    
    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    // Check if user already voted
    const existingVote = await Vote.findOne({
      userId: new Types.ObjectId(userId),
      postId: new Types.ObjectId(postId)
    });
    
    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Remove vote if clicking same vote type
        await Vote.findByIdAndDelete(existingVote._id);
        res.json({ message: 'Vote removed' });
      } else {
        // Update vote type
        existingVote.voteType = voteType;
        await existingVote.save();
        res.json({ message: 'Vote updated' });
      }
    } else {
      // Create new vote
      const vote = new Vote({
        userId: new Types.ObjectId(userId),
        postId: new Types.ObjectId(postId),
        voteType
      });
      
      await vote.save();
      res.json({ message: 'Vote added' });
    }
    
  } catch (error) {
    console.error('Voting error:', error);
    res.status(500).json({ error: 'Failed to process vote' });
  }
};

// Get Single Post
export const getSinglePost =  async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    
    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    
    const pipeline = [
      { $match: { _id: new Types.ObjectId(postId) } },
      
      // Lookup user information
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      
      // Lookup votes
      {
        $lookup: {
          from: 'votes',
          localField: '_id',
          foreignField: 'postId',
          as: 'votes'
        }
      },
      
      // Add calculated fields
      {
        $addFields: {
          upvotes: {
            $size: {
              $filter: {
                input: '$votes',
                cond: { $eq: ['$$this.voteType', 'up'] }
              }
            }
          },
          downvotes: {
            $size: {
              $filter: {
                input: '$votes',
                cond: { $eq: ['$$this.voteType', 'down'] }
              }
            }
          },
          userUpvoted: {
            $anyElementTrue: [
              {
                $map: {
                  input: '$votes',
                  as: 'vote',
                  in: {
                    $and: [
                      { $eq: ['$$vote.userId', new Types.ObjectId(userId)] },
                      { $eq: ['$$vote.voteType', 'up'] }
                    ]
                  }
                }
              }
            ]
          },
          userDownvoted: {
            $anyElementTrue: [
              {
                $map: {
                  input: '$votes',
                  as: 'vote',
                  in: {
                    $and: [
                      { $eq: ['$$vote.userId', new Types.ObjectId(userId)] },
                      { $eq: ['$$vote.voteType', 'down'] }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      
      // Add score field
      {
        $addFields: {
          score: { $subtract: ['$upvotes', '$downvotes'] }
        }
      },
      
      // Project final fields
      {
        $project: {
          _id: 1,
          content: 1,
          type: 1,
          media: 1,
          createdAt: 1,
          updatedAt: 1,
          username: '$user.username',
          userId: '$user._id',
          upvotes: 1,
          downvotes: 1,
          score: 1,
          userUpvoted: 1,
          userDownvoted: 1
        }
      }
    ];
    
    const posts = await Post.aggregate(pipeline);
    
    if (posts.length === 0) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    res.json(posts[0]);
    
  } catch (error) {
    console.error('Post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

// Delete Post (only by owner)
export const deletePost =  async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { postId } = req.params;
    const userId = req.user!.userId;
    
    if (!Types.ObjectId.isValid(postId)) {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    
    // Check if user owns the post
    const post = await Post.findById(postId).session(session);
    
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    
    if (post.userId.toString() !== userId) {
      res.status(403).json({ error: 'Not authorized to delete this post' });
      return;
    }
    
    // Delete related votes
    await Vote.deleteMany({ postId: new Types.ObjectId(postId) }).session(session);
    
    // Delete the post
    await Post.findByIdAndDelete(postId).session(session);
    
    await session.commitTransaction();
    res.json({ message: 'Post deleted successfully' });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Post deletion error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  } finally {
    await session.endSession();
  }
};



// Haversine Formula to calculate distance between two points
const haversineDistance = (lon1: number, lat1: number, lon2: number, lat2: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  
  const R = 6371; // Radius of Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c; // Distance in kilometers
};

// Controller to find posts within 1km radius of the given longitude and latitude
export const getPostsByLocation = async (req: Request, res: Response): Promise<void> => {
  const { longitude, latitude } = req.query;

  // Validate longitude and latitude
  if (!longitude || !latitude) {
    res.status(400).json({ error: 'Longitude and Latitude are required' });
    return;
  }

  const lon = parseFloat(longitude as string);
  const lat = parseFloat(latitude as string);

  // Validate that the longitude and latitude are valid numbers
  if (isNaN(lon) || isNaN(lat)) {
    res.status(400).json({ error: 'Invalid longitude or latitude' });
    return;
  }

  try {
    // Query to find posts within a 1km radius (1000 meters) from the given point using $geoWithin
    // Ensure you have a 2dsphere index on [longitude, latitude] if you use a combined field
    const posts = await Post.find({
      longitude: { $ne: null },
      latitude: { $ne: null },
      $expr: {
        $lte: [
          {
            $divide: [
              {
                $multiply: [
                  {
                    $acos: {
                      $add: [
                        {
                          $multiply: [
                            { $sin: { $degreesToRadians: "$latitude" } },
                            Math.sin((lat * Math.PI) / 180)
                          ]
                        },
                        {
                          $multiply: [
                            { $cos: { $degreesToRadians: "$latitude" } },
                            Math.cos((lat * Math.PI) / 180),
                            { $cos: { $subtract: [
                              { $degreesToRadians: "$longitude" },
                              (lon * Math.PI) / 180
                            ] } }
                          ]
                        }
                      ]
                    }
                  },
                  6371 // Earth radius in km
                ]
              },
              1
            ]
          },
          1 // 1km radius
        ]
      }
    });

    // If there are more than 5 posts, return them
    if (posts.length > 5) {
      res.status(200).json(posts);
    } else {
      res.status(404).json({ message: 'Not enough posts found within 1km radius' });
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};
