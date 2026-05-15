import { Request, Response } from 'express';
import { availabilityService } from '../services/availability.service';
import { availabilityQuerySchema } from '../schemas/appointment.schema';

export class AvailabilityController {
    async getAvailableSlots(req: Request, res: Response) {
        const validatedQuery = availabilityQuerySchema.parse(req.query);

        const slots = await availabilityService.getAvailableSlots(
            validatedQuery.date,
            validatedQuery.stylistId,
            validatedQuery.serviceId
        );

        res.json({ slots });
    }
}

export const availabilityController = new AvailabilityController();
