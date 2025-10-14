import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/reports', requireAuth, requireRole('HOD'), async (_req, res) => {
  try {
    const items = await prisma.report.findMany({ include: { staff: true }, orderBy: { id: 'desc' } });
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.post('/reports/:id/approve', requireAuth, requireRole('HOD'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const updated = await prisma.report.update({ where: { id }, data: { status: 'APPROVED' } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve report' });
  }
});

router.post('/reports/:id/reject', requireAuth, requireRole('HOD'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const updated = await prisma.report.update({ where: { id }, data: { status: 'REJECTED' } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to reject report' });
  }
});

router.get('/staff', requireAuth, requireRole('HOD'), async (_req, res) => {
  try {
    const staff = await prisma.user.findMany({ where: { role: 'STAFF' } });
    res.json(staff);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

export default router;

