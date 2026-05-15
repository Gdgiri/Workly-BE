import prisma from '../prisma';
import { CreateAppointmentInput, RescheduleAppointmentInput } from '../schemas/appointment.schema';
import { createDateTime, addMinutes } from '../utils/dateTime';
import { AppError } from '../middleware/errorHandler';

export class AppointmentService {
    async getUserAppointments(userId: string, status?: string, from?: Date, to?: Date) {
        const whereClause: any = { userId };

        // Add date range filters
        if (from || to) {
            whereClause.startTime = {};
            if (from) whereClause.startTime.gte = from;
            if (to) whereClause.startTime.lte = to;
        }

        // Add status filter if provided
        if (status) {
            whereClause.status = status.toUpperCase();
        }

        // return await (prisma.appointment as any).findMany({
        const appointments = await (prisma.appointment as any).findMany({
            where: whereClause,
            include: {
                service: true,
                services: true,
                stylist: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
                originalStylist: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
            },
            orderBy: { startTime: 'desc' },
        });
        // Normalize attachments for each appointment
        return appointments.map((apt: any) => {
            if (apt.attachments && Array.isArray(apt.attachments)) {
                apt.attachments = apt.attachments.map((att: any) => ({
                    ...att,
                    url: att.url || att.imgUrl || att.img
                }));
            }
            return apt;
        });
    }

    // Get all appointments with optional stylist filtering and adminId for multi-tenancy
    async getAllAppointments(stylistId?: string, status?: string, adminId?: string, from?: Date, to?: Date) {
        const whereClause: any = {};

        // Add adminId filter for multi-tenant isolation (Use Database ID)
        if (adminId) {
            whereClause.adminId = adminId;
            if (stylistId) {
                whereClause.OR = [
                    { stylistId: stylistId },
                    { stylistId: null }
                ];
            }
        } else if (stylistId) {
            whereClause.stylistId = stylistId;
        }

        // Add date range filters
        if (from || to) {
            whereClause.startTime = {};
            if (from) whereClause.startTime.gte = from;
            if (to) whereClause.startTime.lte = to;
        }

        // Add status filter if provided
        if (status) {
            whereClause.status = status.toUpperCase();
        }

        // return await (prisma.appointment as any).findMany({
        const appointments = await (prisma.appointment as any).findMany({
            where: whereClause,
            include: {
                service: true,
                services: true,
                stylist: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
                originalStylist: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                payments: true,
            },
            orderBy: { startTime: 'desc' },
        });
        // Normalize attachments
        return appointments.map((apt: any) => {
            if (apt.attachments && Array.isArray(apt.attachments)) {
                apt.attachments = apt.attachments.map((att: any) => ({
                    ...att,
                    url: att.url || att.imgUrl || att.img
                }));
            }
            return apt;
        });
    }

    async getAppointmentById(appointmentId: string) {
        const appointment: any = await (prisma.appointment as any).findUnique({
            // return await (prisma.appointment as any).findUnique({
            where: { id: appointmentId },
            include: {
                payment: true,
                service: true,
                services: true,
                stylist: true,
                customer: true,
            } as any,
        });
        if (appointment && appointment.attachments && Array.isArray(appointment.attachments)) {
            appointment.attachments = appointment.attachments.map((att: any) => ({
                ...att,
                url: att.url || att.imgUrl || att.img
            }));
        }

        return appointment;
    }

    async getUpcomingAppointment(userId: string) {
        const now = new Date();

        return await (prisma.appointment as any).findFirst({
            where: {
                userId,
                startTime: { gte: now },
                status: { not: 'CANCELLED' },
            },
            include: {
                service: true,
                services: true,
                stylist: {
                    select: {
                        id: true,
                        authId: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
            },
            orderBy: { startTime: 'asc' },
        });
    }

    // Get unavailable time slots for a stylist on a specific date
    async getStylistUnavailableSlots(stylistId: string, date: string) {
        // Create start and end of the day
        const startOfDay = new Date(`${date}T00:00:00`);
        const endOfDay = new Date(`${date}T23:59:59`);

        const appointments = await (prisma.appointment as any).findMany({
            where: {
                stylistId,
                status: { not: 'CANCELLED' },
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            select: {
                startTime: true,
                endTime: true
            }
        });

        return appointments;
    }

    async createAppointment(userId: string, data: CreateAppointmentInput, userInfo?: { name: string, email: string, phone?: string | null }, authId?: string, adminId?: string) {
        // Support for multiple services (Legacy fallback to serviceId)
        const serviceIds = data.serviceIds && data.serviceIds.length > 0
            ? data.serviceIds
            : (data.serviceId ? [data.serviceId] : []);

        if (serviceIds.length === 0) {
            throw new AppError(400, 'At least one service is required');
        }

        // Fetch all services to get durations and prices
        const services = await Promise.all(
            serviceIds.map(async (id) => {
                const s = await prisma.service.findUnique({
                    where: { id },
                });
                if (!s) {
                    throw new AppError(404, `Service ${id} not found`);
                }
                return s;
            })
        );

        // Verify stylist exists (only if stylistId is provided)
        let stylist = null;
        let effectiveAdminId = adminId;

        if (data.stylistId) {
            stylist = await prisma.stylist.findUnique({
                where: { id: data.stylistId },
            });

            if (!stylist) {
                throw new AppError(404, 'Stylist not found');
            }

            if (!stylist.isAvailable) {
                throw new AppError(400, 'Stylist is not available');
            }

            // TENANCY GUARD: Check if stylist belongs to this business
            if (adminId && stylist.adminId !== adminId) {
                throw new AppError(403, 'Multi-tenancy violation: Stylist belongs to a different business');
            }

            // Use stylist's adminId if not provided (safe fallback)
            effectiveAdminId = adminId || stylist.adminId;
        } else {
            // No stylist selected - adminId must be provided
            if (!adminId) {
                throw new AppError(400, 'Admin ID is required when no stylist is selected');
            }
        }

        // TENANCY GUARD: Check if all services belong to this business
        for (const service of services) {
            if (effectiveAdminId && service.adminId && service.adminId !== effectiveAdminId) {
                throw new AppError(403, `Multi-tenancy violation: Service ${service.name} belongs to a different business`);
            }
        }

        // Check if customer exists, create if not
        const existingCustomer = await prisma.customer.findUnique({
            where: { id: userId },
        });

        if (!existingCustomer) {
            console.log(`📝 Customer ${userId} not found in database...`);
            const email = userInfo?.email || `${userId}@temp.com`;
            const conflictingCustomer = await prisma.customer.findFirst({
                where: { email, adminId: effectiveAdminId }
            });

            if (conflictingCustomer) {
                console.log(`⚠️ Conflict detected: Email ${email} exists for ID ${conflictingCustomer.id}. Auto-migrating...`);
                await prisma.customer.update({
                    where: { id: conflictingCustomer.id },
                    data: { email: `${email}.old.${Date.now()}` }
                });

                const customerData = {
                    id: userId,
                    authId: userId,
                    adminId: effectiveAdminId,
                    name: userInfo?.name || conflictingCustomer.name,
                    email: email,
                    phone: userInfo?.phone || conflictingCustomer.phone,
                    city: conflictingCustomer.city,
                    role: conflictingCustomer.role,
                };

                await prisma.customer.create({ data: customerData });
                await (prisma.appointment as any).updateMany({
                    where: { userId: conflictingCustomer.id },
                    data: { userId: userId }
                });
                await prisma.customer.delete({
                    where: { id: conflictingCustomer.id }
                });
            } else {
                const customerData = {
                    id: userId,
                    authId: userId,
                    adminId: effectiveAdminId,
                    name: userInfo?.name || 'Customer',
                    email: userInfo?.email || `${userId}@temp.com`,
                    phone: userInfo?.phone || null,
                    city: null as string | null,
                };
                await prisma.customer.create({ data: customerData });
            }
        }

        // Calculate combined duration and price
        const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
        const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

        // Support for scheduledAt in createAppointment
        const date = data.date || (data.scheduledAt ? data.scheduledAt.split('T')[0] : null);
        const time = data.time || (data.scheduledAt ? data.scheduledAt.split('T')[1]?.substring(0, 5) : null);

        if (!date || !time) {
            throw new AppError(400, 'Date and time are required (either via individual fields or scheduledAt)');
        }

        const totalStartTime = createDateTime(date, time);
        const totalEndTime = addMinutes(totalStartTime, totalDuration);

        // Fetch settings for deposit logic
        const settings = await prisma.settings.findFirst();
        const depositPercentage = settings?.partialPaymentPercentage || 20;

        // Use transaction to ensure atomicity
        return await prisma.$transaction(async (tx) => {
            // Global Overlap Validation for the whole sequence block
            if (data.stylistId) {
                const overlap = await (tx.appointment as any).findFirst({
                    where: {
                        stylistId: data.stylistId,
                        status: { not: 'CANCELLED' },
                        OR: [
                            { AND: [{ startTime: { lte: totalStartTime } }, { endTime: { gt: totalStartTime } }] },
                            { AND: [{ startTime: { lt: totalEndTime } }, { endTime: { gte: totalEndTime } }] },
                            { AND: [{ startTime: { gte: totalStartTime } }, { endTime: { lte: totalEndTime } }] },
                        ],
                    },
                });

                if (overlap) {
                    throw new AppError(409, 'Time slot sequence overlaps with an existing booking');
                }
            }

            let packageRedemption = false;
            let paymentStatus: any = 'PENDING';
            let paidAmount = 0;
            let requiresDeposit = true;
            let depositAmount = 0;

            // Manual Override or auto-calculate deposit
            if (data.depositAmount !== undefined) {
                depositAmount = data.depositAmount;
                requiresDeposit = data.requiresDeposit !== undefined ? data.requiresDeposit : (depositAmount > 0);
            } else {
                depositAmount = Math.round(totalPrice * (depositPercentage / 100) * 100) / 100;
                requiresDeposit = !settings?.allowNoPayment;
            }

            if (settings?.allowNoPayment) {
                requiresDeposit = false;
                depositAmount = 0;
            }

            // Note: Multi-service package redemption logic.
            if (data.customerPackageId) {
                const { customerPackageService } = await import('./customer-package.service');
                try {
                    await customerPackageService.usePackageService(data.customerPackageId, services[0].id, 1, tx);
                    packageRedemption = true;
                    paymentStatus = 'COMPLETED';
                    paidAmount = totalPrice; 
                    requiresDeposit = false;
                    depositAmount = 0;
                } catch (e) {
                     // Proceed without package if it fails
                }
            }

            const appointment = await (tx.appointment as any).create({
                data: {
                    userId,
                    authId,
                    adminId: effectiveAdminId,
                    serviceId: (services as any)[0].id, // fallback for legacy
                    services: {
                        connect: (services as any).map((s: any) => ({ id: s.id }))
                    } as any,
                    stylistId: data.stylistId,
                    originalStylistId: data.stylistId,
                    startTime: totalStartTime,
                    endTime: totalEndTime,
                    status: packageRedemption ? 'CONFIRMED' : 'PENDING',
                    totalAmount: Math.round(totalPrice * 100) / 100,
                    depositAmount,
                    requiresDeposit,
                    paidAmount,
                    paymentStatus,
                    notes: packageRedemption
                        ? (data.notes ? `${data.notes}\n[Redeemed from Package]` : '[Redeemed from Package]')
                        : data.notes,
                    attachments: data.attachments || [],
                },
                include: {
                    service: true,
                    services: true,
                    stylist: {
                        select: { id: true, authId: true, name: true, specialization: true, rating: true },
                    },
                    originalStylist: {
                        select: { id: true, authId: true, name: true },
                    },
                    customer: true,
                } as any,
            });

            return appointment;
        }, {
            maxWait: 5000,
            timeout: 20000
        });
    }

    async cancelAppointment(appointmentId: string, userId: string, cancellationReason?: string, userRole?: string, userAdminId?: string) {
        const appointment = await (prisma.appointment as any).findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            throw new AppError(404, 'Appointment not found');
        }

        console.log('🔍 Cancellation check - Role:', userRole, 'AdminId:', userAdminId, 'Appt AdminId:', appointment.adminId);

        const isBusinessRole = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER' || userRole === 'STAFF' || userRole === 'STYLIST' || userRole === 'EMPLOYEE' ||
            userRole === 'admin' || userRole === 'manager' || userRole === 'staff' || userRole === 'stylist' || userRole === 'employee';

        // Authorization logic:
        // 1. Business roles (ADMIN/STAFF/etc.) can cancel if they belong to the same business (adminId)
        // 2. Regular users can only cancel their own appointments
        let isAuthorized = false;

        if (isBusinessRole) {
            if (userAdminId && (appointment as any).adminId === userAdminId) {
                isAuthorized = true;
                console.log('✅ Business role authorized for this business');
            } else if (userRole?.toUpperCase() === 'SUPER_ADMIN') {
                isAuthorized = true;
                console.log('✅ Super Admin authorized');
            }
        } else if (appointment.userId === userId) {
            isAuthorized = true;
            console.log('✅ Customer authorized for own appointment');
        }

        if (!isAuthorized) {
            console.error('❌ Authorization failed! Role:', userRole, 'User ID:', userId, 'Appt Owner:', appointment.userId);
            throw new AppError(403, isBusinessRole ? 'You do not have permission to manage this business\'s appointments' : 'You can only cancel your own appointments');
        }

        if (appointment.status === 'CANCELLED') {
            throw new AppError(400, 'Appointment is already cancelled');
        }

        if (appointment.status === 'COMPLETED') {
            throw new AppError(400, 'Cannot cancel completed appointment');
        }

        // Calculate refund based on 24-hour policy
        console.log('✅ Found upcoming appointment:', (appointment as any).service?.name || 'Unknown Service', '-', appointment.startTime);
        const now = new Date();
        const appointmentTime = new Date(appointment.startTime);
        const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        const depositPaid = appointment.paidAmount || 0;
        let cancellationFee = 0;
        let refundAmount = 0;
        let refundStatus: 'PENDING' | 'NOT_APPLICABLE' | null = null;

        if (hoursUntilAppointment >= 24) {
            // More than 24 hours: Full refund
            refundAmount = depositPaid;
            refundStatus = depositPaid > 0 ? 'PENDING' : null;
            cancellationFee = 0;
            console.log(`✅ Cancellation >24hrs: Full refund of ${depositPaid}`);
        } else {
            // Less than 24 hours: No refund (deposit forfeited)
            refundAmount = 0;
            refundStatus = 'NOT_APPLICABLE';
            cancellationFee = depositPaid;
            console.log(`⚠️ Cancellation <24hrs: Deposit ${depositPaid} forfeited`);
        }

        console.log(`📅 Cancellation: ${hoursUntilAppointment.toFixed(1)} hours before appointment`);
        console.log(`💰 Deposit: ${depositPaid}, Fee: ${cancellationFee}, Refund: ${refundAmount}`);

        return await (prisma.appointment as any).update({
            where: { id: appointmentId },
            data: {
                status: 'CANCELLED',
                cancellationReason: cancellationReason || 'No reason provided',
                cancellationFee,
                refundAmount,
                refundStatus
            },
            include: {
                service: true,
                services: true,
                stylist: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
                customer: true
            },
        });
    }

    async rescheduleAppointment(
        appointmentId: string,
        userId: string,
        data: RescheduleAppointmentInput,
        userRole?: string,
        userAdminId?: string
    ) {
        const appointment = await (prisma.appointment as any).findUnique({
            where: { id: appointmentId },
            include: { service: true, services: true } as any,
        });

        if (!appointment) {
            throw new AppError(404, 'Appointment not found');
        }

        const isBusinessRole = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'MANAGER' || userRole === 'STAFF' || userRole === 'STYLIST' || userRole === 'EMPLOYEE' ||
            userRole === 'admin' || userRole === 'manager' || userRole === 'staff' || userRole === 'stylist' || userRole === 'employee';

        let isAuthorized = false;

        if (isBusinessRole) {
            if (userAdminId && (appointment as any).adminId === userAdminId) {
                isAuthorized = true;
            } else if (userRole?.toUpperCase() === 'SUPER_ADMIN') {
                isAuthorized = true;
            }
        } else if (appointment.userId === userId) {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            throw new AppError(403, isBusinessRole ? 'You do not have permission to manage this business\'s appointments' : 'You can only reschedule your own appointments');
        }

        if (appointment.status === 'CANCELLED') {
            throw new AppError(400, 'Cannot reschedule cancelled appointment');
        }

        if (appointment.status === 'COMPLETED') {
            throw new AppError(400, 'Cannot reschedule completed appointment');
        }

        // Support for scheduledAt in rescheduleAppointment
        const newDate = data.newDate || (data.scheduledAt ? data.scheduledAt.split('T')[0] : null);
        const newTime = data.newTime || (data.scheduledAt ? data.scheduledAt.split('T')[1]?.substring(0, 5) : null);

        if (!newDate || !newTime) {
            throw new AppError(400, 'New date and time are required (either via individual fields or scheduledAt)');
        }
        // Create new start and end times
        const newStartTime = createDateTime(newDate, newTime);
        const totalDuration = (appointment as any).services && (appointment as any).services.length > 0
            ? (appointment as any).services.reduce((sum: number, s: any) => sum + s.duration, 0)
            : (appointment as any).service?.duration || 0;
        const newEndTime = addMinutes(newStartTime, totalDuration);

        // Use transaction to check for overlaps and update
        return await prisma.$transaction(async (tx) => {
            // Check for overlapping appointments (excluding current appointment)
            const overlap = await (tx.appointment as any).findFirst({
                where: {
                    id: { not: appointmentId },
                    stylistId: appointment.stylistId,
                    status: { not: 'CANCELLED' },
                    OR: [
                        {
                            AND: [{ startTime: { lte: newStartTime } }, { endTime: { gt: newStartTime } }],
                        },
                        {
                            AND: [{ startTime: { lt: newEndTime } }, { endTime: { gte: newEndTime } }],
                        },
                        {
                            AND: [{ startTime: { gte: newStartTime } }, { endTime: { lte: newEndTime } }],
                        },
                    ],
                },
            });

            if (overlap) {
                throw new AppError(409, 'New time slot is already booked');
            }

            // Update appointment
            return await (tx.appointment as any).update({
                where: { id: appointmentId },
                data: {
                    startTime: newStartTime,
                    endTime: newEndTime,
                },
                include: {
                    service: true,
                    services: true,
                    stylist: {
                        select: {
                            id: true,
                            name: true,
                            specialization: true,
                            rating: true,
                        },
                    },
                    customer: true,
                },
            });
        });
    }

    async updateAppointment(appointmentId: string, data: any, updaterStylistId?: string) {
        const appointment = await (prisma.appointment as any).findUnique({
            where: { id: appointmentId },
            include: {
                service: true,
                services: true,
                customer: true,
                stylist: true
            },
        });

        if (!appointment) {
            throw new AppError(404, 'Appointment not found');
        }

        // Prepare update data
        const updateData: any = {};

        // Auto-assign stylist if unassigned and service is starting/confirming
        // This happens when a stylist clicks "Start Service" on the mobile app for an unassigned task
        if (!appointment.stylistId && updaterStylistId && (data.status === 'CONFIRMED' || data.status === 'IN_PROGRESS' || data.status === 'ARRIVED' || (data as any).status === 'CHECKED_IN')) {
            console.log(`👤 Auto-assigning stylist ${updaterStylistId} to unassigned appointment ${appointmentId}`);
            updateData.stylistId = updaterStylistId;
        }

        // Track if status is changing from PENDING to CONFIRMED
        const isConfirming = data.status === 'CONFIRMED' && appointment.status === 'PENDING';

        // Update status if provided
        if (data.status) {
            updateData.status = data.status;
        }

        // Update service if provided
        if (data.serviceId) {
            const service = await prisma.service.findUnique({
                where: { id: data.serviceId },
            });
            if (!service) {
                throw new AppError(404, 'Service not found');
            }
            updateData.serviceId = data.serviceId;
        }

        // Update stylist if provided
        if (data.stylistId) {
            const stylist = await prisma.stylist.findUnique({
                where: { id: data.stylistId },
            });
            if (!stylist) {
                throw new AppError(404, 'Stylist not found');
            }
            updateData.stylistId = data.stylistId;
        }

        // Update date/time if provided
        if (data.date && data.time) {
            let totalDuration = 0;
            if (data.serviceId && data.serviceId !== appointment.serviceId) {
                const service = await prisma.service.findUnique({
                    where: { id: data.serviceId },
                });
                totalDuration = service ? service.duration : 0;
            } else {
            totalDuration = (appointment as any).services && (appointment as any).services.length > 0
                    ? (appointment as any).services.reduce((sum: number, s: any) => sum + s.duration, 0)
                    : (appointment as any).service?.duration || 0;
            }
            const startTime = createDateTime(data.date, data.time);
            const endTime = addMinutes(startTime, totalDuration);
            updateData.startTime = startTime;
            updateData.endTime = endTime;
        }

        // Update notes if provided
        if (data.notes !== undefined) {
            updateData.notes = data.notes;
        }

        // Update attachments if provided
        if (data.attachments !== undefined) {
            updateData.attachments = data.attachments;
        }

        // Update appointment
        const updatedAppointment = await (prisma.appointment as any).update({
            where: { id: appointmentId },
            data: updateData,
            include: {
                service: true,
                services: true,
                customer: true,
                stylist: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
            },
        });

        // Send WhatsApp notification if status changed to CONFIRMED
        if (isConfirming && (appointment as any).customer && appointment.adminId) {
            try {
                const { whatsappService } = await import('./whatsapp/whatsapp.service');

                // Get admin/salon details
                const admin = await prisma.user.findUnique({
                    where: { id: appointment.adminId }
                });

                // Format date and time
                const appointmentDate = new Date(updatedAppointment.startTime);
                const formattedDate = appointmentDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const sent = await whatsappService.sendAppointmentConfirmation({
                    adminId: appointment.adminId!,
                    customerPhone: (appointment as any).customer?.phone || '', 
                    customerName: (appointment as any).customer?.name || 'Customer',
                    salonName: admin?.businessName || 'Our Salon',
                    date: formattedDate,
                    time: formattedTime,
                    serviceName: (appointment as any).service?.name || 'Service',
                    stylistName: (appointment as any).stylist?.name || 'Staff',
                    appointmentId: appointmentId
                });

                if (sent) {
                    console.log(`✅ WhatsApp confirmation sent to ${(appointment as any).customer?.name || 'Customer'}`);
                } else {
                    console.log(`⚠️ WhatsApp notification skipped or failed for ${(appointment as any).customer?.name || 'Customer'}`);
                }
            } catch (error) {
                // Don't fail the appointment update if WhatsApp fails
                console.error('❌ WhatsApp notification error:', error);
            }
        }

        return updatedAppointment;
    }

    // Process remaining payment (80%) after service completion
    async processRemainingPayment(appointmentId: string, paymentAmount: number) {
        const appointment = await (prisma.appointment as any).findUnique({
            where: { id: appointmentId },
            include: { service: true, services: true } as any,
        });

        if (!appointment) {
            throw new AppError(404, 'Appointment not found');
        }

        if (appointment.status !== 'COMPLETED') {
            throw new AppError(400, 'Service must be completed before paying remaining amount');
        }

        if (appointment.paymentStatus === 'COMPLETED') {
            throw new AppError(400, 'Payment already completed');
        }

        const totalAmount = appointment.totalAmount || 0;
        const paidAmount = appointment.paidAmount || 0;
        const remainingAmount = totalAmount - paidAmount;

        if (paymentAmount < remainingAmount - 0.01) { // Allow small rounding differences
            throw new AppError(400, `Payment amount must be at least $${remainingAmount.toFixed(2)}`);
        }

        // Update appointment payment status
        return await (prisma.appointment as any).update({
            where: { id: appointmentId },
            data: {
                paidAmount: totalAmount,
                paymentStatus: 'COMPLETED',
            },
            include: {
                service: true,
                stylist: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        rating: true,
                    },
                },
            },
        });
    }

    // Get stylist by authId for role-based access control
    async getStylistByAuthId(authId: string) {
        return await prisma.stylist.findFirst({
            where: { authId },
            select: {
                id: true,
                authId: true,
                adminId: true,
                name: true,
                email: true,
            },
        });
    }

    // Get stylist by email for role-based access control
    async getStylistByEmail(email: string) {
        return await prisma.stylist.findFirst({
            where: { email },
            select: {
                id: true,
                authId: true,
                adminId: true,
                name: true,
                email: true,
            },
        });
    }
}

export const appointmentService = new AppointmentService();