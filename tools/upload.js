const multer = require('multer');

const storage = multer.diskStorage({
  // Limits are specified on the Multer object itself, not the storage directly
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1000 * 1024 * 1024, // 100MB limit
    files: 100
  }
});

module.exports = {
  upload
};
