import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res) => {
        const { name, username, email, password, role } = req.body || {};
        if (!name || !username || !email || !password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Validate role
        const validRoles = ['STAFF', 'HOD'];
        if (role && !validRoles.includes(role.toUpperCase())) {
          return res.status(400).json({ error: 'Invalid role' });
        }
        
        try {
          const existing = await prisma.user.findFirst({ 
            where: { OR: [{ username }, { email }] } 
          });
          if (existing) return res.status(409).json({ error: 'User already exists' });
          
          const passwordHash = await bcrypt.hash(password, 12);
          const created = await prisma.user.create({
            data: { 
              name, 
              username, 
              email, 
              passwordHash, 
              role: role?.toUpperCase() || 'STAFF'
            }
          });
          
          return res.status(201).json({ 
            id: created.id,
            message: 'User registered successfully' 
          });
  } catch (e) {
    console.error('Registration error:', e);
    return res.status(500).json({ error: 'Failed to register' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  
  try {
        const user = await prisma.user.findUnique({ 
          where: { username }
        });
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    
    
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    
        const userResponse = {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role
        };
    
    return res.json({ token, user: userResponse });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.get('/profile', requireAuth, async (req, res) => {
  try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id }
        });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const { passwordHash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
        const { name, email } = req.body || {};
  
  try {
    // Check if email is already taken by another user
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: req.user.id } }
      });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }
    
        const updated = await prisma.user.update({
          where: { id: req.user.id },
          data: { name, email }
        });
    
    
    const { passwordHash, ...userWithoutPassword } = updated;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.put('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const currentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newPasswordHash }
    });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;

