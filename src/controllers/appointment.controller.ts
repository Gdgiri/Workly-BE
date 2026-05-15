import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { appointmentService } from '../services/appointment.service';
import { resolveDefaultAdminId } from '../utils/user.utils';

import {
    createAppointmentSchema,
    rescheduleAppointmentSchema,
} from '../schemas/appointment.schema';

export class AppointmentController {
    async getUserAppointments(req: AuthRequest, res: Response) {
        const userId = req.user?.userId || req.user?.id;
        const userRole = req.user?.role;
        const userEmail = req.user?.email;
        const statusFilter = req.query.status as string | undefined;
        const from = req.query.from ? new Date(req.query.from as string) : undefined;
        const to = req.query.to ? new Date(req.query.to as string) : undefined;

        // Debug logging
        // console.log('🔍 getUserAppointments - User Info:', {
        //     userId,
        //     userRole,
        //     userEmail,
        //     hasUser: !!req.user,
        //     statusFilter
        // });

        // If user is a stylist/employee, find their stylist record and filter appointments
        if (userRole === 'stylist' || userRole === 'EMPLOYEE' || userRole === 'STAFF') {
            console.log('✅ User is EMPLOYEE/stylist, filtering appointments...');

            // Prioritize IDs from context (middleware-resolved)
            const stylistId = (req.user as any)?.stylistId;
            const adminId = req.user?.adminId;

            if (stylistId && adminId) {
                console.log('✅ Using context-aware StylistID:', stylistId, 'AdminID:', adminId);
                const appointments = await appointmentService.getAllAppointments(stylistId, statusFilter, adminId, from, to);
                return res.json(appointments);
            }

            // Fallback: Find stylist by email (Legacy/Discovery mode)
            const stylist = await appointmentService.getStylistByEmail(userEmail || '');
            console.log('🔍 Stylist lookup result (fallback):', stylist);

            if (!stylist) {
                console.log('❌ Stylist not found for email:', userEmail);
                return res.status(404).json({ error: 'Stylist not found' });
            }

            // Return only appointments for this stylist
            console.log('✅ Returning appointments for stylist:', stylist.id);
            const appointments = await appointmentService.getAllAppointments(stylist.id, statusFilter, stylist.adminId, from, to);
            return res.json(appointments);
        }

        // Admin or other roles see all appointments (filtered by their authId for multi-tenancy)
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'admin' || userRole === 'super_admin';

        if (isAdmin) {
            // Strict Admin ID resolution
            let adminId = (req as any).user?.adminId;
            const authId = (req as any).user?.id || (req as any).user?.authId;

            if (!adminId && authId) {
                const prisma = require('../prisma').default;
                const dbUser = await prisma.user.findUnique({ 
                    where: { authId },
                    select: { id: true, role: true, businessEmail: true }
                });

                if (dbUser) {
                    if (dbUser.role === 'ADMIN') {
                        adminId = dbUser.id;
                    } else {
                        // Look for Stylist profile (By AuthID or Email)
                        const stylist = await prisma.stylist.findFirst({
                            where: {
                                OR: [
                                    { authId: authId },
                                    { email: dbUser.businessEmail || (req as any).user?.email }
                                ]
                            },
                            select: { adminId: true }
                        });
                        
                        if (stylist) {
                            adminId = stylist.adminId;
                        } else if (dbUser.role === 'CUSTOMER') {
                            const customer = await prisma.customer.findFirst({
                                where: {
                                    OR: [
                                        { authId: authId },
                                        { email: dbUser.businessEmail || (req as any).user?.email }
                                    ]
                                },
                                select: { adminId: true }
                            });
                            adminId = customer?.adminId;
                        }
                    }
                }
            }

            // Fallback to default only if no authenticated identity or no associations found
            if (!adminId) {
                console.warn(`⚠️ [AppointmentController] No specific business context for user ${authId || 'Guest'}. Using default.`);
                adminId = await resolveDefaultAdminId();
            }

            // console.log('👤 User is admin, showing appointments for adminId:', adminId);
            // Pass adminId instead of authId
            const appointments = await appointmentService.getAllAppointments(undefined, statusFilter, adminId, from, to);
            return res.json(appointments);
        }

        // Regular users see ONLY their own appointments
        if (userId) {
            console.log('👤 Regular user, filtering by userId:', userId);
            const appointments = await appointmentService.getUserAppointments(userId, statusFilter, from, to);
            return res.json(appointments);
        }

        // Should not happen with authMiddleware, but as a safety net:
        return res.status(401).json({ error: 'Unauthorized' });
    }

    async getUpcomingAppointment(req: AuthRequest, res: Response) {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(400).json({ error: 'User ID required for this endpoint' });
        }

        console.log('🔍 Getting upcoming appointment for user:', userId);
        console.log('⏰ Current time:', new Date().toISOString());

        try {
            const appointment = await appointmentService.getUpcomingAppointment(userId);

            if (!appointment) {
                console.log('❌ No upcoming appointment found');

                // Debug: Let's see ALL appointments for this user
                const allAppointments = await appointmentService.getUserAppointments(userId);
                console.log(`📋 Total appointments for user: ${allAppointments.length}`);
                allAppointments.forEach((apt: any, index: number) => {
                    console.log(`  ${index + 1}. ${apt.service?.name || 'Unknown Service'} - ${apt.startTime} - Status: ${apt.status}`);
                });

                // return res.status(404).json({ error: 'No upcoming appointments found' });
                return res.json([]); // Return empty array instead of 404 to avoid frontend error
            }

            console.log('✅ Found upcoming appointment:', (appointment as any).service?.name || 'Unknown Service', '-', appointment.startTime);
            return res.json([appointment]); // Return as array to match frontend expectations
        } catch (error) {
            console.error('Error getting upcoming appointment:', error);
            return res.status(500).json({ error: 'Failed to get upcoming appointment' });
        }
    }

    async getAvailability(req: AuthRequest, res: Response) {
        const { stylistId, date } = req.query;

        console.log('🔍 Checking availability for:', { stylistId, date });

        if (!stylistId || !date) {
            return res.status(400).json({ error: 'Stylist ID and Date are required' });
        }

        try {
            const unavailableSlots = await appointmentService.getStylistUnavailableSlots(
                stylistId as string,
                date as string
            );
            return res.json(unavailableSlots);
        } catch (error: any) {
            console.error('❌ Error fetching availability:', error);
            return res.status(500).json({ error: 'Failed to fetch availability' });
        }
    }

    async createAppointment(req: AuthRequest, res: Response) {
        try {
            // Determine userId:
            // 1. If explicit customerId provided (Admin/Stylist booking for someone), use it.
            // 2. If no customerId, use the authenticated user's ID (Customer booking for self).
            // 3. Fallback to 'guest' (though schema might require valid ID).
            let userId = req.body.customerId;

            // If no customerId provided, and user is authenticated, check if they are booking for themselves
            if (!userId) {
                // If Admin/Employee doesn't provide customerId, we might have an issue, but let's assume they might be booking for themselves? 
                // Or better, standard flow: Customer uses req.user.userId.
                userId = req.user?.id || req.user?.userId || 'guest';
            }

            // Allow Admin/Stylist to override with customerId even if they have a userId
            const userRole = req.user?.role;
            if ((userRole === 'ADMIN' || userRole === 'EMPLOYEE' || userRole === 'stylist') && req.body.customerId) {
                userId = req.body.customerId;
            }

            // Extract authId from authenticated admin user (for tracking who created this appointment)
            const authId = req.user?.id || req.user?.userId;

            // Determine adminId (Business Owner) - now reliably set by auth middleware
            let adminId = req.user?.adminId;

            console.log('📝 Create Appointment Request:');
            console.log('User ID (customer):', userId);
            console.log('Auth ID (creator):', authId);
            console.log('Admin ID (business):', adminId);

            if (req.body.scheduledAt && (!req.body.date || !req.body.time)) {
                try {
                    const parts = req.body.scheduledAt.split('T');
                    if (parts.length >= 2) {
                        req.body.date = parts[0]; // YYYY-MM-DD
                        req.body.time = parts[1].substring(0, 5); // HH:mm
                    }
                } catch (e) {
                    console.error('Error parsing scheduledAt:', e);
                }
            }

            const validatedData = createAppointmentSchema.parse(req.body);

            // Extract user info for customer creation
            const userInfo = {
                name: req.user?.name || req.body.userName || 'Customer',
                email: req.user?.email || req.body.userEmail || `${userId}@temp.com`,
                phone: req.user?.phone || req.body.userPhone || null,
            };

            const appointment = await appointmentService.createAppointment(userId, validatedData, userInfo, authId, adminId);
            console.log('✅ Appointment created with authId:', authId, 'adminId:', adminId);
            return res.status(201).json(appointment);
        } catch (error: any) {
            console.error('❌ Appointment creation error:', error);
            if (error.name === 'ZodError') {
                console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
            }

            // Handle AppError with specific status code
            if (error.statusCode) {
                return res.status(error.statusCode).json({
                    message: error.message,
                    error: error.message // Frontend seemingly uses this
                });
            }

            return res.status(500).json({ error: error.message || 'Failed to create appointment' });
        }
    }

    async cancelAppointment(req: AuthRequest, res: Response) {
        try {
            // Support both userId and id from auth middleware
            const userId = req.user?.userId || req.user?.id || 'guest';
            const { id } = req.params;
            const { cancellationReason } = req.body;

            console.log('🔍 Cancel request - User ID:', userId, 'Appointment ID:', id);

            const userRole = req.user?.role;
            const adminId = req.user?.adminId;

            const appointment = await appointmentService.cancelAppointment(id, userId, cancellationReason, userRole, adminId);
            return res.json(appointment);
        } catch (error: any) {
            console.error('Error cancelling appointment:', error);
            return res.status(500).json({ error: 'Failed to cancel appointment' });
        }
    }

    async rescheduleAppointment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId || 'guest';
            const { id } = req.params;

            // Compatibility: Extract newDate and newTime from scheduledAt if provided (mobile app format)
            if (req.body.scheduledAt && (!req.body.newDate || !req.body.newTime)) {
                try {
                    const parts = req.body.scheduledAt.split('T');
                    if (parts.length >= 2) {
                        req.body.newDate = parts[0]; // YYYY-MM-DD
                        req.body.newTime = parts[1].substring(0, 5); // HH:mm
                    }
                } catch (e) {
                    console.error('Error parsing scheduledAt for rescheduling:', e);
                }
            }

            const validatedData = rescheduleAppointmentSchema.parse(req.body);

            const userRole = req.user?.role;
            const adminId = req.user?.adminId;

            const appointment = await appointmentService.rescheduleAppointment(id, userId, validatedData, userRole, adminId);
            return res.json(appointment);
        } catch (error: any) {
            console.error('❌ Reschedule appointment error:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: error.errors
                });
            }

            if (error.statusCode) {
                return res.status(error.statusCode).json({
                    message: error.message,
                    error: error.message
                });
            }

            return res.status(500).json({ error: error.message || 'Failed to reschedule appointment' });
        }
    }

    async updateAppointment(req: AuthRequest, res: Response) {
        try {
            const userId = req.user?.userId || req.user?.id;
            const userRole = req.user?.role;
            const { id } = req.params;

            console.log('📝 Update Appointment Request:');
            console.log('User ID:', userId);
            console.log('User Role:', userRole);
            console.log('Appointment ID:', id);
            console.log('Update Data:', JSON.stringify(req.body, null, 2));

            // Skip ownership check for admins and employees (STAFF, MANAGER, STYLIST)
            const isBusinessRole = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER' || userRole === 'STAFF' || userRole === 'STYLIST' || userRole === 'EMPLOYEE' ||
                userRole === 'admin' || userRole === 'manager' || userRole === 'staff' || userRole === 'stylist' || userRole === 'employee';

            if (!isBusinessRole && userId) {
                // Regular users: verify they own this appointment
                const existing = await appointmentService.getUserAppointments(userId);
                console.log('🔍 User appointments count:', existing.length);
                console.log('🔍 User appointment IDs:', existing.map((apt: any) => apt.id));
                console.log('🔍 Looking for appointment ID:', id);

                const userOwnsAppointment = existing.some((apt: any) => apt.id === id);
                console.log('🔍 Ownership check result:', userOwnsAppointment);

                if (!userOwnsAppointment) {
                    console.log('❌ User does not own this appointment');
                    console.log('❌ User ID from token:', userId);
                    console.log('❌ Appointment ID being updated:', id);
                    return res.status(403).json({ error: 'You can only edit your own appointments' });
                }
            } else {
                console.log('✅ Business role access - skipping ownership check');
            }

            const appointment = await appointmentService.updateAppointment(id, req.body, req.user?.stylistId);
            console.log('✅ Appointment updated successfully');
            return res.json(appointment);
        } catch (error: any) {
            console.error('❌ Update appointment error:', error);
            return res.status(error.status || 500).json({
                error: error.message || 'Failed to update appointment'
            });
        }
    }
}

export const appointmentController = new AppointmentController();



// import { Response } from 'express';
// import { AuthRequest } from '../middleware/auth';
// import { appointmentService } from '../services/appointment.service';
// import {
//     createAppointmentSchema,
//     rescheduleAppointmentSchema,
// } from '../schemas/appointment.schema';

// export class AppointmentController {
//     async getUserAppointments(req: AuthRequest, res: Response) {
//         const userId = req.user?.userId;
//         const userRole = req.user?.role;
//         const userEmail = req.user?.email;

//         // Debug logging
//         console.log('🔍 getUserAppointments - User Info:', {
//             userId,
//             userRole,
//             userEmail,
//             hasUser: !!req.user
//         });

//         // If user is a stylist/employee, find their stylist record and filter appointments
//         if (userRole === 'stylist' || userRole === 'EMPLOYEE') {
//             console.log('✅ User is EMPLOYEE/stylist, filtering appointments...');

//             // Find stylist by email to get stylistId
//             const stylist = await appointmentService.getStylistByEmail(userEmail || '');
//             console.log('🔍 Stylist lookup result:', stylist);

//             if (!stylist) {
//                 console.log('❌ Stylist not found for email:', userEmail);
//                 return res.status(404).json({ error: 'Stylist not found' });
//             }

//             // Return only appointments for this stylist
//             console.log('✅ Returning appointments for stylist:', stylist.id);
//             const appointments = await appointmentService.getAllAppointments(stylist.id);
//             return res.json(appointments);
//         }

//         // Admin or other roles see all appointments
//         console.log('👤 User is admin or other role, showing all appointments');
//         const appointments = await appointmentService.getAllAppointments();
//         res.json(appointments);
//     }

//     async getUpcomingAppointment(req: AuthRequest, res: Response) {
//         const userId = req.user?.userId;
//         if (!userId) {
//             return res.status(400).json({ error: 'User ID required for this endpoint' });
//         }
//         const appointment = await appointmentService.getUpcomingAppointment(userId);

//         if (!appointment) {
//             return res.status(404).json({ error: 'No upcoming appointments found' });
//         }

//         res.json(appointment);
//     }

//     async createAppointment(req: AuthRequest, res: Response) {
//         // TEMPORARY: Use customerId from body when auth is disabled
//         const userId = req.user?.userId || req.body.customerId || 'guest';
//         const validatedData = createAppointmentSchema.parse(req.body);

//         const appointment = await appointmentService.createAppointment(userId, validatedData);
//         res.status(201).json(appointment);
//     }

//     async cancelAppointment(req: AuthRequest, res: Response) {
//         const userId = req.user?.userId || 'guest';
//         const { id } = req.params;
//         const { cancellationReason } = req.body;

//         const appointment = await appointmentService.cancelAppointment(id, userId, cancellationReason);
//         res.json(appointment);
//     }

//     async rescheduleAppointment(req: AuthRequest, res: Response) {
//         const userId = req.user?.userId || 'guest';
//         const { id } = req.params;
//         const validatedData = rescheduleAppointmentSchema.parse(req.body);

//         const appointment = await appointmentService.rescheduleAppointment(id, userId, validatedData);
//         res.json(appointment);
//     }

//     async updateAppointment(req: AuthRequest, res: Response) {
//         const { id } = req.params;
//         const appointment = await appointmentService.updateAppointment(id, req.body);
//         res.json(appointment);
//     }
// }

// export const appointmentController = new AppointmentController();
