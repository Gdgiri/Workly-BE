import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import dashboardService from '../services/dashboard.service';

class DashboardController {
    /**
     * Get dashboard statistics
     * Multi-tenant: Uses adminId from authenticated user
     */
    async getDashboard(req: AuthRequest, res: Response) {
        try {
            const adminId = req.user?.adminId;

            // console.log(`📊 Dashboard request - adminId: ${adminId || 'undefined'}`);

            // ✅ If no adminId, return empty dashboard (no 403 error)
            if (!adminId) {
                // console.warn('⚠️  No adminId found, returning empty dashboard');
                return res.json({
                    success: true,
                    data: {
                        totalEarnings: 0,
                        totalExpenses: 0,
                        todayServices: [],
                        todayExpenses: []
                    }
                });
            }

            const stats = await dashboardService.getDashboardStats(adminId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error: any) {
            console.error('❌ Dashboard error:', error);
            res.status(500).json({
                error: 'Failed to fetch dashboard',
                message: error.message
            });
        }
    }
}

export default new DashboardController();
