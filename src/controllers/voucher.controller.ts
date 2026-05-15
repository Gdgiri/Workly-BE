
import { Request, Response } from 'express';
import { voucherService } from '../services/voucher.service';
import { resolveDefaultAdminId } from '../utils/user.utils';

export class VoucherController {

    async createVoucher(req: Request, res: Response) {
        try {
            // Get user info from authenticate middleware
            const user = (req as any).user;

            // authId is the external Auth Service ID
            // adminId is the shared Database ID for the business (Tenant ID)
            const authId = user?.authId || user?.id || await resolveDefaultAdminId();
            const adminId = user?.adminId;

            const voucher = await voucherService.createVoucher({
                ...req.body,
                authId,
                adminId
            });
            res.json(voucher);
        } catch (error: any) {
            console.error('Error creating voucher:', error);
            res.status(500).json({ error: error.message || 'Failed to create voucher' });
        }
    }

    async getAllVouchers(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const authId = user?.authId || user?.id;
            const adminId = user?.adminId;
            const filterId = adminId || authId; // Prioritize adminId if available

            const vouchers = await voucherService.getAllVouchers(filterId);
            res.json(vouchers);
        } catch (error: any) {
            console.error('Error fetching vouchers:', error);
            res.status(500).json({ error: 'Failed to fetch vouchers' });
        }
    }

    async deleteVoucher(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await voucherService.deleteVoucher(id);
            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting voucher:', error);
            res.status(500).json({ error: 'Failed to delete voucher' });
        }
    }

    async updateVoucherStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!status || !['active', 'inactive'].includes(status)) {
                return res.status(400).json({ error: 'Status must be either active or inactive' });
            }

            const voucher = await voucherService.updateVoucherStatus(id, status);
            res.json(voucher);
        } catch (error: any) {
            console.error('Error updating voucher status:', error);
            res.status(500).json({ error: 'Failed to update voucher status' });
        }
    }

    // --- CLAIMS ---

    async getAllClaims(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const authId = user?.authId || user?.id;
            const adminId = user?.adminId;
            const filterId = adminId || authId;
            const { customerId } = req.query;

            const claims = await voucherService.getAllClaims(filterId, customerId as string);
            res.json(claims);
        } catch (error: any) {
            console.error('Error fetching claims:', error);
            res.status(500).json({ error: 'Failed to fetch claims' });
        }
    }

    async issueVoucher(req: Request, res: Response) {
        try {
            const { voucherId, customerId, customerName } = req.body;
            if (!voucherId || !customerId) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const user = (req as any).user;
            const authId = user?.authId || user?.id || await resolveDefaultAdminId();
            const adminId = user?.adminId;

            const claim = await voucherService.issueVoucher(voucherId, customerId, customerName || 'Unknown', authId, adminId);
            res.json(claim);
        } catch (error: any) {
            console.error('Error issuing voucher:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async checkClaim(req: Request, res: Response) {
        // Optional: helper to check status / value before payment
        // Not used yet but good to have
        res.status(501).json({ message: 'Not implemented' });
    }
}

export const voucherController = new VoucherController();
