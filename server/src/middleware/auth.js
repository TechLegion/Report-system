import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = payload; // { id, role }
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    return next();
  };
}

export function requireRoles(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

export async function auditLog(action, details, req, metadata = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        details,
        userId: req.user.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata
      }
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

export function withAudit(action, details) {
  return async (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode < 400) {
        auditLog(action, details, req, { response: data });
      }
      originalSend.call(this, data);
    };
    next();
  };
}

export async function requireActiveUser(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { department: true }
    });
    
    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Account is inactive' });
    }
    
    req.userData = user;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify user' });
  }
}

