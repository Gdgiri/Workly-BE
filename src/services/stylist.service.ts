import prisma from '../prisma';
import { Stylist, Prisma } from '@prisma/client';
import { UpdateRosterInput } from '../schemas/stylist.schema';

const DEFAULT_AVATARS: Record<string, string> = {
    male: 'https://avatar.iran.liara.run/public/boy',
    female: 'https://avatar.iran.liara.run/public/girl',
    other: ''
};

export interface CreateStylistInput {
    authId: string;
    adminId: string;
    name: string;
    email: string;
    phone: string;
    specialization: string;
    workingHours: any; // Prisma Json type
    permissions?: any; // Prisma Json type
    gender?: string;
    imgUrl?: string; // Manual image override
}

export interface UpdateStylistInput {
    name?: string;
    email?: string;
    phone?: string;
    specialization?: string;
    workingHours?: any;
    isAvailable?: boolean;
    leaves?: any;
    dateSpecificHours?: any;
    permissions?: any;
    gender?: string;
    imgUrl?: string;
}

export class StylistService {
    /**
     * Helper to get avatar URL based on gender
     */
    private getAvatarForGender(gender?: string): string {
        if (!gender) return '';
        const normalizedGender = gender.toLowerCase();
        return DEFAULT_AVATARS[normalizedGender] || DEFAULT_AVATARS.other || '';
    }

    async getAllStylists(adminId?: string, authId?: string) {
        const where: Prisma.StylistWhereInput = {};

        if (adminId && authId) {
            where.OR = [
                { adminId },
                { authId }
            ];
        } else if (adminId) {
            where.adminId = adminId;
        } else if (authId) {
            where.authId = authId;
        }

        return await prisma.stylist.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                authId: true,
                adminId: true,
                name: true,
                email: true,
                phone: true,
                specialization: true,
                rating: true,
                isAvailable: true,
                workingHours: true,
                dateSpecificHours: true,
                leaves: true,
                permissions: true,
                gender: true,
                imgUrl: true
            },
        });
    }

    async getStylistById(id: string) {
        return await prisma.stylist.findUnique({
            where: { id },
        });
    }

    async createStylist(data: CreateStylistInput) {
        // Use provided imgUrl OR fallback to gender-based
        const imgUrl = data.imgUrl || this.getAvatarForGender(data.gender);

        return await prisma.stylist.create({
            data: {
                authId: data.authId,
                adminId: data.adminId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                specialization: data.specialization,
                workingHours: data.workingHours ?? {},
                permissions: data.permissions ?? [],
                gender: data.gender,
                imgUrl: imgUrl,
                rating: 5.0,
                isAvailable: true,
                leaves: []
            }
        });
    }

    async updateStylist(id: string, data: UpdateStylistInput) {
        const updateData: Prisma.StylistUpdateInput = {
            ...(data.name && { name: data.name }),
            ...(data.email && { email: data.email }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.specialization !== undefined && { specialization: data.specialization }),
            ...(data.workingHours !== undefined && { workingHours: data.workingHours }),
            ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
            ...(data.leaves !== undefined && { leaves: data.leaves }),
            ...(data.dateSpecificHours !== undefined && { dateSpecificHours: data.dateSpecificHours }),
            ...(data.permissions !== undefined && { permissions: data.permissions }),
        };

        if (data.imgUrl !== undefined) {
            updateData.imgUrl = data.imgUrl;
        } else if (data.gender) {
            // Only update avatar based on gender if no specific imgUrl provided/updated
            // But if we are just changing gender and NOT image, we might validly want to update the avatar?
            // The safest behavior: If imgUrl is NOT in updateData, check if we should auto-update it based on gender.
            // If they meant to keep the old image with new gender, they probably won't send imgUrl?
            // For now: Always update avatar on gender change UNLESS imgUrl is explicitly provided.
            updateData.gender = data.gender;
            updateData.imgUrl = this.getAvatarForGender(data.gender);
        }

        return await prisma.stylist.update({
            where: { id },
            data: updateData
        });
    }

    async updateRoster(id: string, data: UpdateRosterInput) {
        // Use standard Prisma update instead of raw query
        // Validation is already handled by Zod schema in controller
        const updateData: Prisma.StylistUpdateInput = {};

        if (data.workingHours) {
            updateData.workingHours = data.workingHours;
        }
        if (data.dateSpecificHours) {
            updateData.dateSpecificHours = data.dateSpecificHours;
        }
        if (data.leaves) {
            updateData.leaves = data.leaves;
        }
        if (data.isAvailable !== undefined) {
            updateData.isAvailable = data.isAvailable;
        }

        if (Object.keys(updateData).length === 0) return null;

        return await prisma.stylist.update({
            where: { id },
            data: updateData
        });
    }

    async deleteStylist(id: string) {
        return await prisma.stylist.delete({
            where: { id }
        });
    }
}

export const stylistService = new StylistService();
