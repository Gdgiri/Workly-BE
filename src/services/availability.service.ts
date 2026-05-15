import prisma from '../prisma';
import { createDateTime, addMinutes, getDayName } from '../utils/dateTime';

interface TimeSlot {
    start: string;
    end: string;
    available: boolean;
    period?: 'morning' | 'afternoon' | 'evening' | 'any';
}

export class AvailabilityService {
    async getAvailableSlots(date: string, stylistId: string, serviceId: string): Promise<TimeSlot[]> {
        // Fetch service to get duration
        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            throw new Error('Service not found');
        }

        // Fetch stylist
        const stylist = await prisma.stylist.findUnique({
            where: { id: stylistId },
        });

        if (!stylist) {
            throw new Error('Stylist not found');
        }

        // Check if stylist is available
        if (!stylist.isAvailable) {
            return [];
        }

        // Check if date is in leaves
        const leaves = (stylist.leaves as string[]) || [];
        if (leaves.includes(date)) {
            return [];
        }

        // Check for Date Specific Hours (Overrides)
        const dateSpecificHours = stylist.dateSpecificHours as Record<string, any>;
        let daySchedule = null;

        if (dateSpecificHours && dateSpecificHours[date]) {
            daySchedule = dateSpecificHours[date];
        } else {
            // Fallback to regular working hours
            const dayName = getDayName(new Date(date));
            const workingHours = stylist.workingHours as Record<string, any>;

            if (workingHours && workingHours[dayName]) {
                daySchedule = workingHours[dayName];
            }
        }

        if (!daySchedule) {
            return [];
        }

        // Fetch existing appointments for the stylist on this date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const appointments = await prisma.appointment.findMany({
            where: {
                stylistId,
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: {
                    not: 'CANCELLED',
                },
            },
            orderBy: { startTime: 'asc' },
        });

        // Generate time slots
        const slots: TimeSlot[] = [];
        const SLOT_INTERVAL = 30; // 30 minutes

        // Helper to generate slots for a given shift
        const generateSlotsForShift = (start: string, end: string, period: 'morning' | 'afternoon' | 'evening' | 'any') => {
            let currentTime = createDateTime(date, start);
            const endTime = createDateTime(date, end);

            while (currentTime < endTime) {
                const slotEnd = addMinutes(currentTime, service.duration);

                // Admin side allows slots that start before the shift end, regardless of service duration
                // We remove the strict slotEnd > endTime check to align with admin side behavior

                // Check for overlaps with existing appointments
                const hasOverlap = appointments.some((appointment: any) => {
                    return currentTime < appointment.endTime && slotEnd > appointment.startTime;
                });

                slots.push({
                    start: currentTime.toTimeString().substring(0, 5),
                    end: slotEnd.toTimeString().substring(0, 5),
                    available: !hasOverlap,
                    period
                });

                currentTime = addMinutes(currentTime, SLOT_INTERVAL);
            }
        };

        // Handle dual shift or single shift
        if (daySchedule.morning || daySchedule.afternoon) {
            if (daySchedule.morning?.start && daySchedule.morning?.end) {
                generateSlotsForShift(daySchedule.morning.start, daySchedule.morning.end, 'morning');
            }
            if (daySchedule.afternoon?.start && daySchedule.afternoon?.end) {
                generateSlotsForShift(daySchedule.afternoon.start, daySchedule.afternoon.end, 'afternoon');
            }
        } else if (daySchedule.start && daySchedule.end) {
            // Backward compatibility for single shift
            generateSlotsForShift(daySchedule.start, daySchedule.end, 'any');
        }

        return slots;
    }
}

export const availabilityService = new AvailabilityService();
