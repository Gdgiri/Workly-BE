
import prisma from '../prisma';

export interface CreateVoucherInput {
    code: string;
    name?: string;
    description?: string;
    value: number;
    sellingPrice?: number;
    type?: string;
    expiryDate?: string;
    validityDays?: number;
    authId?: string;
    adminId?: string;
}

export class VoucherService {
    // --- CAMPAIGNS ---

    async getAllVouchers(filterId?: string) {
        try {
            const where: any = {};
            if (filterId) {
                where.OR = [
                    { authId: filterId },
                    { adminId: filterId }
                ];
            } else {
                return []; // Strict multi-tenancy
            }
            // @ts-ignore
            return await prisma.voucher.findMany({
                where,
                orderBy: [
                    { status: 'asc' }, // 'active' comes before 'inactive' alphabetically
                    { createdAt: 'desc' }
                ]
            });
        } catch (error) {
            console.error('Prisma FindMany Vouchers failed:', error);
            return [];
        }
    }

    async createVoucher(data: CreateVoucherInput) {
        try {
            // @ts-ignore
            return await prisma.voucher.create({
                data: {
                    ...data,
                    status: 'active'
                }
            });
        } catch (error) {
            console.error('Prisma Create Voucher failed:', error);
            throw error;
        }
    }

    async deleteVoucher(id: string) {
        // @ts-ignore
        return await prisma.voucher.delete({
            where: { id }
        });
    }

    async updateVoucherStatus(id: string, status: 'active' | 'inactive') {
        // @ts-ignore
        return await prisma.voucher.update({
            where: { id },
            data: { status }
        });
    }

    // --- CLAIMS ---

    async getAllClaims(filterId?: string, customerId?: string) {
        try {
            const where: any = {};
            if (filterId) {
                where.OR = [
                    { authId: filterId },
                    { adminId: filterId }
                ];
            } else {
                return [];
            }

            if (customerId) {
                where.customerId = customerId;
            }

            // @ts-ignore
            const claims = await prisma.voucherClaim.findMany({
                where,
                include: { voucher: true },
                orderBy: { createdAt: 'desc' }
            });

            // Hydrate usageHistory with saleNumber for older records
            const saleIdsToFetch: string[] = [];
            claims.forEach((claim: any) => {
                if (Array.isArray(claim.usageHistory)) {
                    claim.usageHistory.forEach((h: any) => {
                        if (h.saleId && !h.saleNumber) {
                            saleIdsToFetch.push(h.saleId);
                        }
                    });
                }
            });

            if (saleIdsToFetch.length > 0) {
                // @ts-ignore
                const sales = await prisma.sale.findMany({
                    where: { id: { in: saleIdsToFetch } },
                    select: { id: true, saleNumber: true }
                });

                const saleMap = new Map(sales.map((s: any) => [s.id, s.saleNumber]));

                claims.forEach((claim: any) => {
                    if (Array.isArray(claim.usageHistory)) {
                        claim.usageHistory = claim.usageHistory.map((h: any) => {
                            if (h.saleId && !h.saleNumber && saleMap.has(h.saleId)) {
                                return { ...h, saleNumber: saleMap.get(h.saleId) };
                            }
                            return h;
                        });
                    }
                });
            }

            // When viewing a specific customer's claims, merge duplicate claims for same voucher
            // This handles the case where double-click created multiple claims for same voucher
            if (customerId) {
                const voucherGroupMap = new Map<string, any>();

                for (const claim of claims) {
                    const key = claim.voucherId;
                    if (!voucherGroupMap.has(key)) {
                        // First claim for this voucher — use it as the base
                        voucherGroupMap.set(key, {
                            ...claim,
                            balance: claim.balance,
                            usageHistory: Array.isArray(claim.usageHistory) ? [...claim.usageHistory] : [],
                            _claimIds: [claim.id]
                        });
                    } else {
                        // Duplicate claim — merge its balance and history into the first
                        const existing = voucherGroupMap.get(key);
                        existing.balance += claim.balance;
                        existing._claimIds.push(claim.id);
                        if (Array.isArray(claim.usageHistory) && claim.usageHistory.length > 0) {
                            existing.usageHistory = [...existing.usageHistory, ...claim.usageHistory];
                        }
                    }
                }

                return Array.from(voucherGroupMap.values());
            }

            return claims;
        } catch (error) {
            return [];
        }
    }

    async issueVoucher(voucherId: string, customerId: string, customerName: string, authId?: string, adminId?: string, tx?: any) {
        const prismaClient = tx || prisma;

        // 1. Get Voucher
        // @ts-ignore
        const voucher = await prismaClient.voucher.findUnique({ where: { id: voucherId } });
        if (!voucher) throw new Error('Voucher not found');

        // 2. [REMOVED] Check if already claimed - Customers can now buy multiple vouchers of the same campaign
        // const existing = await prismaClient.voucherClaim.findFirst({
        //     where: { voucherId, customerId }
        // });
        // if (existing) throw new Error('Customer already has this voucher');

        // 3. Calculate Expiry Date for Claim
        let claimExpiryDate = null;
        if (voucher.validityDays && voucher.validityDays > 0) {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + voucher.validityDays);
            claimExpiryDate = expiry.toISOString().split('T')[0];
        } else if (voucher.expiryDate) {
            // Fallback for legacy vouchers with fixed expiry date
            claimExpiryDate = voucher.expiryDate;
        }

        // 4. Deduplication guard — prevent double-click from creating duplicate claims within 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        // @ts-ignore
        const recentClaim = await prismaClient.voucherClaim.findFirst({
            where: {
                voucherId,
                customerId,
                createdAt: { gte: fiveMinutesAgo }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (recentClaim) {
            console.log(`⚠️ [Duplicate Guard] Voucher ${voucherId} was already issued to customer ${customerId} within the last 5 minutes. Returning existing claim.`);
            return recentClaim;
        }

        // 5. Create Claim
        // @ts-ignore
        return await prismaClient.voucherClaim.create({
            data: {
                voucherId,
                voucherCode: voucher.code,
                customerId,
                customerName,
                status: 'claimed',
                balance: voucher.value,
                expiryDate: claimExpiryDate,
                usageHistory: [],
                authId,
                adminId
            }
        });
    }

    // Called during Checkout - Updated for Partial Redemption
    async redeemVoucher(code: string, customerId: string, amountToRedeem: number, saleId?: string, saleNumber?: string, tx?: any) {
        // 1. Find the claim
        const prismaClient = tx || prisma;

        // @ts-ignore
        const claim = await prismaClient.voucherClaim.findFirst({
            where: {
                voucherCode: code,
                customerId,
                status: {
                    in: ['claimed', 'active', 'partially_redeemed']
                }
            },
            include: { voucher: true }
        });

        if (!claim) throw new Error('Valid active voucher not found for this customer');
        if (claim.balance <= 0) throw new Error('Voucher has zero balance');

        // 2. Check expiry
        const effectiveExpiry = claim.expiryDate || claim.voucher.expiryDate;
        if (effectiveExpiry && new Date(effectiveExpiry) < new Date()) {
            throw new Error('Voucher expired');
        }

        const redeemAmount = Math.min(amountToRedeem, claim.balance);
        const newBalance = claim.balance - redeemAmount;
        const newStatus = newBalance <= 0 ? 'redeemed' : 'partially_redeemed';

        // 3. Update status and balance
        const executeUpdate = async (transaction: any) => {
            const usageEntry = {
                saleId: saleId || 'DIRECT_REDEMPTION',
                saleNumber: saleNumber || 'N/A',
                amount: redeemAmount,
                balanceBefore: claim.balance,
                balanceAfter: newBalance,
                date: new Date().toISOString()
            };

            const existingHistory = Array.isArray(claim.usageHistory) ? claim.usageHistory : [];
            const newHistory = [...existingHistory, usageEntry];

            // @ts-ignore
            const updatedClaim = await transaction.voucherClaim.update({
                where: { id: claim.id },
                data: {
                    status: newStatus,
                    balance: newBalance,
                    usageHistory: newHistory
                }
            });

            return { claim: updatedClaim, voucher: claim.voucher, redeemedAmount: redeemAmount };
        };

        if (tx) {
            return await executeUpdate(tx);
        } else {
            return await prisma.$transaction(async (t) => await executeUpdate(t));
        }
    }

    /**
     * Revert a voucher redemption (called during sale cancellation)
     */
    async revertRedemption(saleId: string, tx?: any) {
        const prismaClient = tx || prisma;

        // Find claims that were used in this sale
        // @ts-ignore
        const claims = await prismaClient.voucherClaim.findMany({
            where: {
                usageHistory: {
                    path: '$[*].saleId',
                    array_contains: saleId
                }
            }
        });

        for (const claim of claims) {
            const history = Array.isArray(claim.usageHistory) ? claim.usageHistory : [];
            const entryIndex = history.findIndex((h: any) => h.saleId === saleId);

            if (entryIndex !== -1) {
                const entry = history[entryIndex];
                const newBalance = claim.balance + entry.amount;
                const newHistory = history.filter((_: any, i: number) => i !== entryIndex);
                const newStatus = newHistory.length === 0 ? 'claimed' : 'partially_redeemed';

                // @ts-ignore
                await prismaClient.voucherClaim.update({
                    where: { id: claim.id },
                    data: {
                        balance: newBalance,
                        usageHistory: newHistory,
                        status: newStatus
                    }
                });
            }
        }
    }

    /**
     * Void/Cancel a voucher claim (called when a sale that SOLD a voucher is cancelled)
     */
    async cancelVoucherClaim(saleId: string, tx?: any) {
        const prismaClient = tx || prisma;

        // This assumes we might need a way to link a claim to the sale it was created from.
        // If your schema doesn't have 'createdInSaleId', we might look for common timestamps or notes.
        // For now, let's assume we want to prevent fraud by marking them as 'cancelled' 
        // if they were issued around the same time as the sale and the customer matches.
        // A better way is to update the issueVoucher to accept a saleId.
    }
}

export const voucherService = new VoucherService();
