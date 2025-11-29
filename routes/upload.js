const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../uploads/')
});

// POST /upload-csv - upload and parse CSV file
router.post('/upload-csv', upload.single('file'), (req, res) => {
  console.log('Upload route hit');
  console.log('File received:', req.file);
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ message: 'File received', filename: req.file.filename });
});

module.exports = router;