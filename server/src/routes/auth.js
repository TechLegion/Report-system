import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

const router = Router();

router.post('/register', async (req, res) => {
  const { name, username, email, password, role } = req.body || {};
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: { name, username, email, passwordHash, role: role === 'hod' ? 'HOD' : 'STAFF' }
    });
    return res.status(201).json({ id: created.id });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;

