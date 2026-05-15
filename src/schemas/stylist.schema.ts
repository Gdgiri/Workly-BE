import { z } from 'zod';

const shiftSchema = z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
    end: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
});

const dayScheduleSchema = z.object({
    morning: shiftSchema.optional(),
    afternoon: shiftSchema.optional(),
}).or(shiftSchema); // Keep backward compatibility for single shift

export const updateRosterSchema = z.object({
    workingHours: z.record(dayScheduleSchema).optional(),
    dateSpecificHours: z.record(dayScheduleSchema).optional(),
    leaves: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')).optional(),
    isAvailable: z.boolean().optional(),
});

export type UpdateRosterInput = z.infer<typeof updateRosterSchema>;
