import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles, auditLog } from '../middleware/auth.js';

const router = Router();

// Get all departments
router.get('/', requireAuth, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        hod: true,
        _count: {
          select: {
            staff: true,
            reports: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(departments);
  } catch (error) {
    console.error('Departments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// Get department by ID
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const department = await prisma.department.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        hod: true,
        staff: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            lastLogin: true,
            _count: {
              select: { reports: true }
            }
          }
        },
        _count: {
          select: {
            reports: true
          }
        }
      }
    });
    
    if (!department) return res.status(404).json({ error: 'Department not found' });
    res.json(department);
  } catch (error) {
    console.error('Department fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create department (Admin/HR only)
router.post('/', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { name, description, hodId } = req.body || {};
  
  if (!name) return res.status(400).json({ error: 'Department name is required' });
  
  try {
    // Check if department already exists
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) return res.status(409).json({ error: 'Department already exists' });
    
    // Validate HOD if provided
    if (hodId) {
      const hod = await prisma.user.findUnique({ where: { id: hodId } });
      if (!hod || hod.role !== 'HOD') {
        return res.status(400).json({ error: 'Invalid HOD user' });
      }
      
      // Check if HOD is already assigned to another department
      const hodDepartment = await prisma.department.findUnique({ where: { hodId } });
      if (hodDepartment) {
        return res.status(409).json({ error: 'HOD is already assigned to another department' });
      }
    }
    
    const department = await prisma.department.create({
      data: { name, description, hodId: hodId ? parseInt(hodId) : null },
      include: { hod: true }
    });
    
    await auditLog('USER_CREATE', `Department created: ${name}`, req, { departmentId: department.id });
    
    res.status(201).json(department);
  } catch (error) {
    console.error('Department creation error:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department (Admin/HR only)
router.put('/:id', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { name, description, hodId } = req.body || {};
  const departmentId = parseInt(req.params.id);
  
  try {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    
    // Check if name is already taken by another department
    if (name && name !== department.name) {
      const existing = await prisma.department.findFirst({
        where: { name, id: { not: departmentId } }
      });
      if (existing) return res.status(409).json({ error: 'Department name already exists' });
    }
    
    // Validate HOD if provided
    if (hodId) {
      const hod = await prisma.user.findUnique({ where: { id: hodId } });
      if (!hod || hod.role !== 'HOD') {
        return res.status(400).json({ error: 'Invalid HOD user' });
      }
      
      // Check if HOD is already assigned to another department
      const hodDepartment = await prisma.department.findFirst({
        where: { hodId, id: { not: departmentId } }
      });
      if (hodDepartment) {
        return res.status(409).json({ error: 'HOD is already assigned to another department' });
      }
    }
    
    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: { name, description, hodId: hodId ? parseInt(hodId) : null },
      include: { hod: true }
    });
    
    await auditLog('USER_UPDATE', `Department updated: ${updated.name}`, req, { departmentId });
    
    res.json(updated);
  } catch (error) {
    console.error('Department update error:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Delete department (Admin only)
router.delete('/:id', requireAuth, requireRoles(['ADMIN']), async (req, res) => {
  const departmentId = parseInt(req.params.id);
  
  try {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        _count: {
          select: {
            staff: true,
            reports: true
          }
        }
      }
    });
    
    if (!department) return res.status(404).json({ error: 'Department not found' });
    
    if (department._count.staff > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned staff' });
    }
    
    if (department._count.reports > 0) {
      return res.status(400).json({ error: 'Cannot delete department with associated reports' });
    }
    
    await prisma.department.delete({ where: { id: departmentId } });
    
    await auditLog('USER_DELETE', `Department deleted: ${department.name}`, req, { departmentId });
    
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    console.error('Department deletion error:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

// Assign staff to department
router.post('/:id/staff', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { staffIds } = req.body || {};
  const departmentId = parseInt(req.params.id);
  
  if (!staffIds || !Array.isArray(staffIds)) {
    return res.status(400).json({ error: 'Staff IDs array is required' });
  }
  
  try {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    
    // Validate all staff IDs
    const staff = await prisma.user.findMany({
      where: { id: { in: staffIds.map(id => parseInt(id)) } },
      select: { id: true, name: true, role: true }
    });
    
    if (staff.length !== staffIds.length) {
      return res.status(400).json({ error: 'Some staff members not found' });
    }
    
    // Update staff department assignments
    await prisma.user.updateMany({
      where: { id: { in: staffIds.map(id => parseInt(id)) } },
      data: { departmentId }
    });
    
    await auditLog('USER_UPDATE', `Staff assigned to department: ${department.name}`, req, { 
      departmentId, 
      staffIds: staffIds.map(id => parseInt(id)) 
    });
    
    res.json({ message: 'Staff assigned successfully', assignedCount: staffIds.length });
  } catch (error) {
    console.error('Staff assignment error:', error);
    res.status(500).json({ error: 'Failed to assign staff' });
  }
});

// Remove staff from department
router.delete('/:id/staff/:staffId', requireAuth, requireRoles(['ADMIN', 'HR']), async (req, res) => {
  const { staffId } = req.params;
  const departmentId = parseInt(req.params.id);
  
  try {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ error: 'Department not found' });
    
    const staff = await prisma.user.findUnique({ where: { id: parseInt(staffId) } });
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });
    
    if (staff.departmentId !== departmentId) {
      return res.status(400).json({ error: 'Staff member is not assigned to this department' });
    }
    
    await prisma.user.update({
      where: { id: parseInt(staffId) },
      data: { departmentId: null }
    });
    
    await auditLog('USER_UPDATE', `Staff removed from department: ${department.name}`, req, { 
      departmentId, 
      staffId: parseInt(staffId) 
    });
    
    res.json({ message: 'Staff removed successfully' });
  } catch (error) {
    console.error('Staff removal error:', error);
    res.status(500).json({ error: 'Failed to remove staff' });
  }
});

export default router;
