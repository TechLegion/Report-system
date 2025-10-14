import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, auditLog, withAudit } from '../middleware/auth.js';

const router = Router();

// Get all users with pagination and filtering
router.get('/users', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      departmentId, 
      isActive, 
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const where = {};
    
    if (role) where.role = role;
    if (departmentId) where.departmentId = parseInt(departmentId);
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orderBy = { [sortBy]: sortOrder };
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
        include: {
          department: true,
          _count: {
            select: {
              reports: true,
              notifications: { where: { isRead: false } }
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);
    
    // Remove password hashes from response
    const sanitizedUsers = users.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json({
      users: sanitizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (Admin/HR only)
router.post('/users', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { name, username, email, password, role, departmentId, phone, isActive = true } = req.body || {};
  
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email, and password are required' });
  }
  
  const validRoles = ['STAFF', 'HOD', 'ADMIN', 'HR'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  try {
    const existing = await prisma.user.findFirst({ 
      where: { OR: [{ username }, { email }] } 
    });
    if (existing) return res.status(409).json({ error: 'User already exists' });
    
    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) return res.status(400).json({ error: 'Invalid department' });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: { 
        name, 
        username, 
        email, 
        passwordHash, 
        role: role || 'STAFF',
        departmentId: departmentId ? parseInt(departmentId) : null,
        phone,
        isActive
      },
      include: { department: true }
    });
    
    await auditLog('USER_CREATE', `User created: ${username}`, req, { 
      userId: created.id,
      createdBy: req.user.id
    });
    
    const { passwordHash: _, ...userWithoutPassword } = created;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (Admin/HR only)
router.put('/users/:id', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { name, email, role, departmentId, phone, isActive } = req.body || {};
  const userId = parseInt(req.params.id);
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Validate role if provided
    if (role) {
      const validRoles = ['STAFF', 'HOD', 'ADMIN', 'HR'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
    }
    
    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: userId } }
      });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }
    
    // Validate department if provided
    if (departmentId) {
      const department = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!department) return res.status(400).json({ error: 'Invalid department' });
    }
    
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { 
        name, 
        email, 
        role, 
        departmentId: departmentId ? parseInt(departmentId) : null,
        phone,
        isActive
      },
      include: { department: true }
    });
    
    await auditLog('USER_UPDATE', `User updated: ${updated.username}`, req, { 
      userId,
      updatedBy: req.user.id,
      changes: Object.keys(req.body)
    });
    
    const { passwordHash, ...userWithoutPassword } = updated;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  const userId = parseInt(req.params.id);
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user has reports
    const reportCount = await prisma.report.count({ where: { staffId: userId } });
    if (reportCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with existing reports. Deactivate instead.' 
      });
    }
    
    // Delete user and related data
    await prisma.comment.deleteMany({ where: { authorId: userId } });
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    
    await auditLog('USER_DELETE', `User deleted: ${user.username}`, req, { 
      deletedUserId: userId,
      deletedBy: req.user.id
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password (Admin/HR only)
router.post('/users/:id/reset-password', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { newPassword } = req.body || {};
  const userId = parseInt(req.params.id);
  
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
    
    await auditLog('USER_UPDATE', `Password reset for: ${user.username}`, req, { 
      userId,
      resetBy: req.user.id
    });
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get audit logs
router.get('/audit-logs', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      userId, 
      dateFrom, 
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const where = {};
    
    if (action) where.action = action;
    if (userId) where.userId = parseInt(userId);
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const orderBy = { [sortBy]: sortOrder };
    
    const [auditLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
        include: {
          user: {
            select: { id: true, name: true, username: true, role: true }
          }
        }
      }),
      prisma.auditLog.count({ where })
    ]);
    
    res.json({
      auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get system settings
router.get('/settings', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  try {
    const settings = await prisma.systemSettings.findMany({
      orderBy: { key: 'asc' }
    });
    
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.key] = {
        value: setting.value,
        description: setting.description,
        updatedAt: setting.updatedAt
      };
      return acc;
    }, {});
    
    res.json(settingsObject);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update system settings
router.put('/settings', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  try {
    const settings = req.body || {};
    
    const updatePromises = Object.entries(settings).map(([key, data]) => {
      return prisma.systemSettings.upsert({
        where: { key },
        update: { 
          value: data.value,
          description: data.description,
          updatedBy: req.user.id
        },
        create: {
          key,
          value: data.value,
          description: data.description,
          updatedBy: req.user.id
        }
      });
    });
    
    await Promise.all(updatePromises);
    
    await auditLog('SETTINGS_UPDATE', 'System settings updated', req, { 
      updatedBy: req.user.id,
      settings: Object.keys(settings)
    });
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get system statistics
router.get('/stats', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalReports,
      totalDepartments,
      reportsThisMonth,
      usersThisMonth,
      recentLogins
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.report.count(),
      prisma.department.count(),
      prisma.report.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);
    
    const reportsByStatus = await prisma.report.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });
    
    res.json({
      overview: {
        totalUsers,
        activeUsers,
        totalReports,
        totalDepartments,
        reportsThisMonth,
        usersThisMonth,
        recentLogins
      },
      reportsByStatus,
      usersByRole,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('System stats error:', error);
    res.status(500).json({ error: 'Failed to fetch system statistics' });
  }
});

export default router;
