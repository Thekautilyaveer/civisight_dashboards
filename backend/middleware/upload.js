const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const formsDir = path.join(uploadsDir, 'forms');
const filledFormsDir = path.join(uploadsDir, 'filled-forms');

[uploadsDir, formsDir, filledFormsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage for form files (admin uploads)
const formStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, formsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `form-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Storage for filled forms (county users upload)
const filledFormStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, filledFormsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `filled-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common document types
  const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, Word, Excel, images, and text files are allowed'));
  }
};

const uploadForm = multer({
  storage: formStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

const uploadFilledForm = multer({
  storage: filledFormStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

module.exports = {
  uploadForm: uploadForm.single('formFile'),
  uploadFilledForm: uploadFilledForm.single('filledFormFile')
};

