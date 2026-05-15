import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const rbac = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = req.user.role || '';
        const hasPermission = allowedRoles.includes(userRole);

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have permission to access this resource',
            });
        }

        next();
    };
};

// Export as requireRole for consistency with route imports
export const requireRole = rbac;
