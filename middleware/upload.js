const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directories exist
const uploadDirs = ['uploads', 'uploads/properties', 'uploads/documents'];
uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Allowed MIME types with their magic bytes signatures
const IMAGE_SIGNATURES = {
  'image/jpeg': [
    { offset: 0, bytes: [0xFF, 0xD8, 0xFF] }
  ],
  'image/png': [
    { offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }
  ],
  'image/gif': [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }  // GIF89a
  ],
  'image/webp': [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] } // RIFF
  ]
};

// Sanitize filename - prevent directory traversal and special characters
function sanitizeFilename(filename) {
  // Remove any path components
  const basename = path.basename(filename);
  // Replace non-alphanumeric characters except dots and hyphens
  return basename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100);
}

// Generate cryptographically secure unique filename
function generateSecureFilename(originalname) {
  const ext = path.extname(originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
  const safeExt = allowedExts.includes(ext) ? ext : '';
  const randomId = crypto.randomBytes(16).toString('hex');
  return `${Date.now()}-${randomId}${safeExt}`;
}

// Configure storage for property images
const propertyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'properties'));
  },
  filename: (req, file, cb) => {
    cb(null, `property-${generateSecureFilename(file.originalname)}`);
  }
});

// Configure storage for documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads', 'documents'));
  },
  filename: (req, file, cb) => {
    cb(null, `doc-${generateSecureFilename(file.originalname)}`);
  }
});

// Strict file filter for images with mimetype validation
const imageFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts = /\.(jpeg|jpg|png|gif|webp)$/i;

  const extValid = allowedExts.test(file.originalname);
  const mimeValid = allowedMimes.includes(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'), false);
  }
};

// Strict file filter for documents
const documentFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const allowedExts = /\.(pdf|doc|docx)$/i;

  const extValid = allowedExts.test(file.originalname);
  const mimeValid = allowedMimes.includes(file.mimetype);

  if (extValid && mimeValid) {
    cb(null, true);
  } else {
    cb(new Error('Only document files (pdf, doc, docx) are allowed'), false);
  }
};

// Property image upload middleware
const uploadPropertyImages = multer({
  storage: propertyStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
    files: 20 // Max 20 files per upload
  },
  fileFilter: imageFilter
});

// Document upload middleware
const uploadDocuments = multer({
  storage: documentStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
    files: 5 // Max 5 files per upload
  },
  fileFilter: documentFilter
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

module.exports = {
  uploadPropertyImages,
  uploadDocuments,
  handleUploadError
};
