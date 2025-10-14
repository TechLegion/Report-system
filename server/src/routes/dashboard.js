import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

// Get dashboard analytics
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { period = '30d', departmentId } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    const where = { createdAt: { gte: startDate } };
    
    // Apply role-based filtering
    if (req.user.role === 'STAFF') {
      where.staffId = req.user.id;
    } else if (req.user.role === 'HOD') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { department: true }
      });
      if (user.department) {
        where.departmentId = user.department.id;
      }
    }
    
    if (departmentId) {
      where.departmentId = parseInt(departmentId);
    }
    
    // Get basic stats
    const [
      totalReports,
      submittedReports,
      approvedReports,
      rejectedReports,
      pendingReports,
      totalUsers,
      totalDepartments
    ] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.count({ where: { ...where, status: 'SUBMITTED' } }),
      prisma.report.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.report.count({ where: { ...where, status: 'REJECTED' } }),
      prisma.report.count({ where: { ...where, status: 'UNDER_REVIEW' } }),
      req.user.role === 'ADMIN' ? prisma.user.count() : null,
      req.user.role === 'ADMIN' ? prisma.department.count() : null
    ]);
    
    // Get reports by status
    const reportsByStatus = await prisma.report.groupBy({
      by: ['status'],
      where,
      _count: { status: true }
    });
    
    // Get reports by department (for HOD/Admin)
    const reportsByDepartment = req.user.role !== 'STAFF' ? await prisma.report.groupBy({
      by: ['departmentId'],
      where,
      _count: { departmentId: true },
      _avg: { fileSize: true }
    }) : [];
    
    // Get monthly report trends
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', "createdAt") as month,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected
      FROM "Report" 
      WHERE "createdAt" >= ${startDate}
      ${req.user.role === 'STAFF' ? prisma.$queryRaw`AND "staffId" = ${req.user.id}` : ''}
      ${req.user.role === 'HOD' ? prisma.$queryRaw`AND "departmentId" = (SELECT "departmentId" FROM "User" WHERE id = ${req.user.id})` : ''}
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month
    `;
    
    // Get top performers (for HOD/Admin)
    const topPerformers = req.user.role !== 'STAFF' ? await prisma.user.findMany({
      where: {
        role: 'STAFF',
        reports: {
          some: { createdAt: { gte: startDate } }
        }
      },
      select: {
        id: true,
        name: true,
        username: true,
        department: true,
        _count: {
          select: {
            reports: {
              where: {
                createdAt: { gte: startDate },
                status: 'APPROVED'
              }
            }
          }
        }
      },
      orderBy: {
        reports: {
          _count: 'desc'
        }
      },
      take: 5
    }) : [];
    
    // Get recent activity
    const recentReports = await prisma.report.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: {
          select: { id: true, name: true, username: true }
        },
        department: {
          select: { id: true, name: true }
        }
      }
    });
    
    res.json({
      summary: {
        totalReports,
        submittedReports,
        approvedReports,
        rejectedReports,
        pendingReports,
        approvalRate: totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0,
        totalUsers,
        totalDepartments
      },
      charts: {
        reportsByStatus,
        reportsByDepartment,
        monthlyTrends,
        topPerformers
      },
      recentActivity: recentReports,
      period,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// Get department performance metrics
router.get('/department-performance', requireAuth, requireRoles(['HOD', 'ADMIN', 'HR']), async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    const departments = await prisma.department.findMany({
      include: {
        hod: {
          select: { id: true, name: true, username: true }
        },
        staff: {
          select: { id: true, name: true, username: true }
        },
        reports: {
          where: { createdAt: { gte: startDate } },
          select: {
            id: true,
            status: true,
            createdAt: true,
            fileSize: true
          }
        },
        _count: {
          select: {
            staff: true,
            reports: {
              where: { createdAt: { gte: startDate } }
            }
          }
        }
      }
    });
    
    const departmentMetrics = departments.map(dept => {
      const totalReports = dept.reports.length;
      const approvedReports = dept.reports.filter(r => r.status === 'APPROVED').length;
      const pendingReports = dept.reports.filter(r => ['SUBMITTED', 'UNDER_REVIEW'].includes(r.status)).length;
      const rejectedReports = dept.reports.filter(r => r.status === 'REJECTED').length;
      
      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        hod: dept.hod,
        staffCount: dept._count.staff,
        totalReports,
        approvedReports,
        pendingReports,
        rejectedReports,
        approvalRate: totalReports > 0 ? Math.round((approvedReports / totalReports) * 100) : 0,
        avgFileSize: totalReports > 0 ? Math.round(dept.reports.reduce((sum, r) => sum + r.fileSize, 0) / totalReports) : 0
      };
    });
    
    res.json({
      departments: departmentMetrics,
      period,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Department performance error:', error);
    res.status(500).json({ error: 'Failed to fetch department performance' });
  }
});

// Get user activity summary
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }
    
    const userId = req.user.id;
    
    const [
      reportsSubmitted,
      reportsApproved,
      reportsRejected,
      commentsMade,
      lastActivity
    ] = await Promise.all([
      prisma.report.count({
        where: { staffId: userId, createdAt: { gte: startDate } }
      }),
      prisma.report.count({
        where: { staffId: userId, status: 'APPROVED', approvedDate: { gte: startDate } }
      }),
      prisma.report.count({
        where: { staffId: userId, status: 'REJECTED', rejectedDate: { gte: startDate } }
      }),
      prisma.comment.count({
        where: { authorId: userId, createdAt: { gte: startDate } }
      }),
      prisma.report.findFirst({
        where: { staffId: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ]);
    
    res.json({
      reportsSubmitted,
      reportsApproved,
      reportsRejected,
      commentsMade,
      lastActivity: lastActivity?.createdAt,
      period,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('User activity error:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

export default router;
