const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');
const path = require('path');
const logger = require('./logger');

// Initialize AWS S3
let s3 = null;
const S3_BUCKET = process.env.AWS_S3_BUCKET;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && S3_BUCKET) {
  try {
    s3 = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });
    logger.info('AWS S3 client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize AWS S3 client:', error);
  }
} else {
  logger.warn('AWS S3 configuration missing. File uploads will fail.');
}

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, Excel, images, and text files are allowed'));
  }
};

// S3 storage configuration
const createS3Storage = (folder) => {
  if (!s3) {
    logger.error('S3 client not initialized. Cannot create storage.');
    throw new Error('S3 client not initialized. Please check AWS credentials.');
  }
  
  if (!S3_BUCKET) {
    logger.error('S3 bucket not configured.');
    throw new Error('S3 bucket not configured.');
  }
  
  try {
    return multerS3({
      s3: s3,
      bucket: S3_BUCKET,
      acl: 'private',
      key: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${folder}/${uniqueSuffix}-${file.originalname}`;
        cb(null, filename);
      },
      contentType: multerS3.AUTO_CONTENT_TYPE,
      metadata: (req, file, cb) => {
        cb(null, {
          originalName: file.originalname,
          uploadedBy: req.user?._id?.toString() || 'system'
        });
      }
    });
  } catch (error) {
    logger.error('Error creating S3 storage:', error);
    throw error;
  }
};

// Form file storage (S3) - only create if S3 is initialized
let formStorage = null;
let filledFormStorage = null;

if (s3 && S3_BUCKET) {
  try {
    formStorage = createS3Storage('forms');
    filledFormStorage = createS3Storage('filled-forms');
    logger.info('S3 storage configured successfully');
  } catch (error) {
    logger.error('Failed to create S3 storage:', error);
  }
} else {
  logger.warn('S3 storage not configured - file uploads will fail');
}

// Create multer instances only if storage is configured
let uploadForm = null;
let uploadFilledForm = null;

if (formStorage && filledFormStorage) {
  uploadForm = multer({
    storage: formStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
  });

  uploadFilledForm = multer({
    storage: filledFormStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
  });
} else {
  // Create a dummy multer that will fail with a clear error
  const errorStorage = multer.memoryStorage();
  uploadForm = multer({
    storage: errorStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
  });
  uploadFilledForm = multer({
    storage: errorStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: fileFilter
  });
  logger.warn('Using memory storage as fallback - files will not be saved to S3');
}

// Generate signed URL for S3 files (expires in 1 hour)
const getSignedUrl = async (fileKey) => {
  if (!fileKey || !s3) return null;
  
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: fileKey,
      Expires: 3600 // 1 hour
    };
    
    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    logger.error('Error generating signed URL:', error);
    return null;
  }
};

// Delete file from S3
const deleteFile = async (filePath) => {
  if (!filePath || !s3) return;
  
  try {
    await s3.deleteObject({
      Bucket: S3_BUCKET,
      Key: filePath
    }).promise();
    logger.info(`Deleted file from S3: ${filePath}`);
  } catch (error) {
    logger.error('Error deleting file from S3:', error);
  }
};

// Export multer middleware with error handling
const uploadFormMiddleware = (req, res, next) => {
  if (!formStorage || !uploadForm) {
    logger.error('S3 storage not configured when upload attempted');
    return res.status(500).json({ message: 'S3 storage not configured. Please check AWS credentials.' });
  }
  
  uploadForm.single('formFile')(req, res, (err) => {
    if (err) {
      logger.error('Multer/S3 upload error in uploadFormMiddleware:', err);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: err.message || 'File upload failed. Please check S3 configuration.',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }
    if (!res.headersSent) {
      next();
    }
  });
};

const uploadFilledFormMiddleware = (req, res, next) => {
  if (!filledFormStorage || !uploadFilledForm) {
    logger.error('S3 storage not configured when upload attempted');
    return res.status(500).json({ message: 'S3 storage not configured. Please check AWS credentials.' });
  }
  
  uploadFilledForm.single('filledFormFile')(req, res, (err) => {
    if (err) {
      logger.error('Multer/S3 upload error in uploadFilledFormMiddleware:', err);
      if (!res.headersSent) {
        return res.status(500).json({ 
          message: err.message || 'File upload failed. Please check S3 configuration.',
          error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
      }
    }
    if (!res.headersSent) {
      next();
    }
  });
};

module.exports = {
  uploadForm: uploadFormMiddleware,
  uploadFilledForm: uploadFilledFormMiddleware,
  getSignedUrl,
  deleteFile
};

