import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Ensure upload dir exists
fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, unique + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF allowed'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Get all reports (for HOD to see all staff reports)
router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await prisma.report.findMany({ 
      include: { staff: true }, 
      orderBy: { id: 'desc' } 
    });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Submit new report
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const { weekEnding } = req.body || {};
  if (!weekEnding || !req.file) return res.status(400).json({ error: 'Missing weekEnding or file' });
  try {
    const created = await prisma.report.create({
      data: {
        weekEnding: new Date(weekEnding),
        fileName: req.file.originalname,
        filePath: `/uploads/${req.file.filename}`,
        staffId: req.user.id
      }
    });
    return res.status(201).json(created);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to submit report' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const items = await prisma.report.findMany({ where: { staffId: req.user.id }, orderBy: { id: 'desc' } });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load reports' });
  }
});

export default router;

