import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { authRequired } from '../middleware/auth.js';
import { ENV } from '../utils/env.js';
import { generateId } from '@oc/shared';

const router = Router();

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const dir = path.resolve(ENV.UPLOAD_DIR);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().slice(0, 10) || '.bin';
    cb(null, `${generateId('f', 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: ENV.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(png|jpe?g|gif|webp)|video\/(mp4|webm|quicktime)|audio\/(mpeg|webm|ogg|wav|mp4))/.test(file.mimetype);
    if (!ok) return cb(new Error('Unsupported media type'));
    cb(null, ok);
  },
});

router.post('/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const base = process.env.MEDIA_BASE_URL || '';
  const url = `${base}/uploads/${req.file.filename}`;
  res.json({ url, mimeType: req.file.mimetype, size: req.file.size, filename: req.file.filename });
});

export default router;
