import { z } from 'zod';

export const createAppointmentSchema = z.object({
    serviceId: z.string().uuid('Invalid service ID').optional(),
    serviceIds: z.array(z.string().uuid('Invalid service ID')).optional(),
    // Allow empty string for stylistId and transform it to null
    stylistId: z.preprocess((val) => (val === "" ? null : val), z.string().uuid('Invalid stylist ID').nullable().optional()),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
    scheduledAt: z.string().optional(), // Mobile app compatibility
    customerId: z.string().optional(), // Mobile app compatibility
    notes: z.string().optional(),
    customerPackageId: z.string().uuid().optional(),
    packageItemId: z.string().optional(),
    depositAmount: z.number().optional(),
    requiresDeposit: z.boolean().optional(),
    attachments: z.array(z.object({
        title: z.string().optional(),
        remarks: z.string().optional(),
        imgUrl: z.string().optional(),
        url: z.string().optional()
    })).optional(),
});

export const rescheduleAppointmentSchema = z.object({
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    newTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
    scheduledAt: z.string().optional(), // Mobile app compatibility
});

export const availabilityQuerySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    stylistId: z.string().uuid('Invalid stylist ID'),
    serviceId: z.string().uuid('Invalid service ID'),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
