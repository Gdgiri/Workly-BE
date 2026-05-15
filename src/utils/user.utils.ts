import prisma from '../prisma';
import { UserRole } from '@prisma/client';

/**
 * Resolves the default admin ID for the system (the first ADMIN or SUPER_ADMIN).
 * This replaces hardcoded 'admin-1' fallbacks.
 */
export async function resolveDefaultAdminId(): Promise<string> {
    const admin = await prisma.user.findFirst({
        where: {
            role: {
                in: [UserRole.SUPER_ADMIN, UserRole.ADMIN]
            }
        },
        orderBy: { createdAt: 'asc' }
    });

    if (!admin) {
        // Fallback to finding ANY user if no admin exists (safe-guard during early setup)
        const anyUser = await prisma.user.findFirst({
            orderBy: { createdAt: 'asc' }
        });

        if (!anyUser) {
            throw new Error('System initialization required: No users found in database.');
        }

        console.warn('⚠️ No ADMIN found, falling back to first available user:', anyUser.id);
        return anyUser.id;
    }

    return admin.id;
}
