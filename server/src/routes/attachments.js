const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const NoteAttachment = require('../models/NoteAttachment');
const Note = require('../models/Note');
const demoReset = require('../services/demoReset');
const storageService = require('../services/storage.service');

const DEMO_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in demo mode
const DEMO_ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/markdown', 'text/csv',
]);

// Configure storage
const storage = multer.memoryStorage();

// multer captures `limits` and `fileFilter` at construction time, but
// demoReset.init() runs after this module is required — so we can't read
// demoReset.isEnabled() here. Use a runtime fileFilter and a pre-multer
// guard instead.
const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (demoReset.isEnabled() && !DEMO_ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('This file type is not allowed in demo mode.'));
    }
    cb(null, true);
  }
});

// Reject oversized demo uploads before multer buffers the body.
const demoSizeGuard = (req, res, next) => {
  if (!demoReset.isEnabled()) return next();
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > DEMO_MAX_FILE_SIZE) {
    return res.status(413).json({ message: 'File too large. Maximum size in demo mode is 10MB.' });
  }
  next();
};

// Clean up any partially-written file when multer itself errors (e.g. size limit, fileFilter rejection)
const handleUploadError = (err, req, res, next) => {
  if (req.file && req.file.path && fs.existsSync(req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch (_) {}
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = demoReset.isEnabled()
      ? 'File too large. Maximum size in demo mode is 10MB.'
      : 'File too large.';
    return res.status(413).json({ message });
  }
  return res.status(400).json({ message: err.message || 'Upload rejected.' });
};

// Upload attachment
router.post('/notes/:noteId/attachments', demoSizeGuard, upload.single('file'), async (req, res) => {
  try {
    const { noteId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Verify note exists
    const note = await Note.findById(noteId);
    if (!note) {
      // Clean up uploaded file if note doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: 'Note not found' });
    }

    let storedFilePath = null;
    let isLocalFallback = false;

    try {
      const uploadResult = await storageService.upload(req.file, noteId);
      storedFilePath = uploadResult.path;
    } catch (error) {
      if (error.message && error.message.includes('not configured')) {
        isLocalFallback = true;
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = `${uniqueSuffix}${path.extname(req.file.originalname)}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        storedFilePath = filename;
      } else {
        throw error;
      }
    }

    const attachment = await NoteAttachment.create({
      note_id: noteId,
      file_path: storedFilePath,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size: req.file.size,
      is_local: isLocalFallback
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error('Error uploading attachment:', error);
    // Try to clean up file if database insert fails
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error cleaning up file:', e);
      }
    }
    res.status(500).json({ message: 'Error uploading attachment', error: error.message });
  }
});
router.use('/notes/:noteId/attachments', handleUploadError);

// Get all attachments for a note
router.get('/notes/:noteId/attachments', async (req, res) => {
  try {
    const { noteId } = req.params;
    const attachments = await NoteAttachment.findByNoteId(noteId);
    res.json(attachments);
  } catch (error) {
    console.error('Error fetching attachments:', error);
    res.status(500).json({ message: 'Error fetching attachments', error: error.message });
  }
});

// Download attachment
router.get('/attachments/:id', async (req, res) => {
  try {
    const attachment = await NoteAttachment.findById(req.params.id);
    
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    if (attachment.is_local) {
      const filePath = path.join(__dirname, '../../uploads', attachment.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }
      return res.download(filePath, attachment.original_name);
    }

    try {
      const signedUrl = await storageService.createSignedUrl(storageService.BUCKET, attachment.file_path);
      return res.redirect(signedUrl);
    } catch (error) {
      console.error('Error downloading from Supabase:', error);
      return res.status(500).json({ message: 'Error downloading attachment', error: error.message });
    }
  } catch (error) {
    console.error('Error downloading attachment:', error);
    res.status(500).json({ message: 'Error downloading attachment', error: error.message });
  }
});

// Delete attachment
router.delete('/attachments/:id', async (req, res) => {
  try {
    const attachment = await NoteAttachment.findById(req.params.id);
    
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    // Delete from database
    await NoteAttachment.delete(req.params.id);

    if (attachment.is_local) {
      const filePath = path.join(__dirname, '../../uploads', attachment.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } else {
      try {
        await storageService.deleteFile(storageService.BUCKET, attachment.file_path);
      } catch (error) {
        console.error('Error deleting attachment from Supabase:', error);
      }
    }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({ message: 'Error deleting attachment', error: error.message });
  }
});

module.exports = router;
