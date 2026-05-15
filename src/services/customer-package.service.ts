import { PrismaClient } from '@prisma/client';
import { whatsappService } from './whatsapp/whatsapp.service';
import { settingsService } from './settings.service';

const prisma = new PrismaClient();

export class CustomerPackageService {
    /**
     * Purchase a package for a customer
     */
    async purchasePackage(data: {
        customerId: string;
        packageId: number;
        authId?: string;
        adminId?: string;
        tx?: any;
    }) {
        const tx = data.tx || prisma;
        // Get package details
        const packageData = await tx.package.findUnique({
            where: { id: data.packageId }
        });

        if (!packageData) {
            throw new Error('Package not found');
        }

        if (!packageData.active) {
            throw new Error('Package is not active');
        }

        // NEW: Filter missing items from package to ensure record integrity
        const businessId = data.adminId || packageData.adminId || data.authId || packageData.authId;
        const rawItems = packageData.items as any[] || [];
        const itemNames = Array.from(new Set(rawItems.map(item => item.name).filter(Boolean)));

        const [services, products] = await Promise.all([
            prisma.service.findMany({
                where: { 
                    OR: [{ authId: businessId }, { adminId: businessId }],
                    name: { in: itemNames }
                },
                select: { name: true }
            }),
            prisma.product.findMany({
                where: { 
                    OR: [{ authId: businessId }, { adminId: businessId }],
                    name: { in: itemNames }
                },
                select: { name: true }
            })
        ]);

        const validNames = new Set([
            ...services.map(s => s.name),
            ...products.map(p => p.name)
        ]);

        // Ghost item filtering
        const items = rawItems.filter(item => validNames.has(item.name));

        const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

        // Calculate expiry date
        const expiryDate = packageData.validityDays > 0
            ? new Date(Date.now() + packageData.validityDays * 24 * 60 * 60 * 1000)
            : null;

        // Create customer package
        return await tx.customerPackage.create({
            data: {
                customerId: data.customerId,
                packageId: data.packageId,
                authId: data.authId,
                adminId: data.adminId, // Store adminId
                purchasePrice: packageData.price,
                totalQuantity,
                usedQuantity: 0,
                remainingQuantity: totalQuantity,
                usageDetails: items.map((item: any) => ({
                    itemId: item.id || item.serviceId || item.productId,
                    name: item.name,
                    type: item.type,
                    totalQuantity: item.quantity || 1,
                    usedQuantity: 0,
                    remainingQuantity: item.quantity || 1
                })),
                expiryDate,
                status: 'ACTIVE'
            },
            include: {
                package: true,
                customer: true
            }
        });
    }

    /**
     * Get all packages for a customer
     */
    async getCustomerPackages(customerId: string) {
        const packages = await prisma.customerPackage.findMany({
            where: { customerId },
            include: {
                package: true
            },
            orderBy: {
                purchaseDate: 'desc'
            }
        });

        return await this.cleanUsageDetails(packages);
    }

    /**
     * Get only active packages with remaining quantity
     */
    async getActivePackages(customerId: string) {
        const now = new Date();

        const packages = await prisma.customerPackage.findMany({
            where: {
                customerId,
                status: 'ACTIVE',
                remainingQuantity: {
                    gt: 0
                },
                OR: [
                    { expiryDate: null },
                    { expiryDate: { gte: now } }
                ]
            },
            include: {
                package: true
            },
            orderBy: {
                purchaseDate: 'desc'
            }
        });

        return await this.cleanUsageDetails(packages);
    }

    private async cleanUsageDetails(packages: any[]) {
        if (!packages.length) return packages;

        // Use business ID from first package, prioritizing adminId
        const businessId = packages[0].adminId || packages[0].package?.adminId || packages[0].authId;
        if (!businessId) return packages;

        const [services, products] = await Promise.all([
            prisma.service.findMany({
                where: { OR: [{ authId: businessId }, { adminId: businessId }] },
                select: { name: true }
            }),
            prisma.product.findMany({
                where: { OR: [{ authId: businessId }, { adminId: businessId }] },
                select: { name: true }
            })
        ]);

        // Helper to normalize names for comparison (trim and collapse multiple spaces)
        const normalize = (name: string) => name?.trim().replace(/\s+/g, ' ').toLowerCase();

        const validNames = new Set([
            ...services.map(s => normalize(s.name)),
            ...products.map(p => normalize(p.name))
        ].filter(Boolean));

        return packages.map(pkg => ({
            ...pkg,
            usageDetails: (pkg.usageDetails as any[] || []).filter(u => {
                const normalizedUName = normalize(u.name);
                return validNames.has(normalizedUName);
            })
        }));
    }

    async usePackageService(customerPackageId: string, itemId?: string, quantity: number = 1, tx: any = prisma) {
        console.log(`🎟️ usePackageService: id=${customerPackageId}, item=${itemId}, qty=${quantity}`);
        let customerPackage = await tx.customerPackage.findUnique({
            where: { id: customerPackageId }
        });

        // RESOLVER: If ID is not a direct CustomerPackage, check if it's a SALE ID prefix
        if (!customerPackage && customerPackageId && customerPackageId.length >= 8) {
            console.log(`🔍 Record not found directly. Checking Sale context for: ${customerPackageId}`);
            
            // Try prefix search for CustomerPackage records first
            const matchingPackages = await tx.customerPackage.findMany({
                where: { id: { startsWith: customerPackageId } },
                include: { package: true, customer: true }
            });

            if (matchingPackages.length === 1) {
                console.log(`✅ Found unique package match via prefix: ${matchingPackages[0].id}`);
                customerPackage = matchingPackages[0];
            } else {
                // Try prefix search for SALES records to link them to their packages
                const matchingSale = await tx.sale.findFirst({
                    where: { id: { startsWith: customerPackageId } }
                });

                if (matchingSale) {
                    console.log(`🖇️ Found associated Sale: ${matchingSale.saleNumber}. Searching for created packages...`);
                    // Find any package for this customer created around the same time as this sale (within 5 minutes)
                    const potentialPackage = await tx.customerPackage.findFirst({
                        where: {
                            customerId: matchingSale.customerId,
                            createdAt: {
                                gte: new Date(new Date(matchingSale.createdAt).getTime() - 300000), // -5 mins
                                lte: new Date(new Date(matchingSale.createdAt).getTime() + 300000)  // +5 mins
                            }
                        },
                        include: { package: true, customer: true },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (potentialPackage) {
                        console.log(`✅ Linked Sale ${matchingSale.saleNumber} to Package ${potentialPackage.id}`);
                        customerPackage = potentialPackage;
                    }
                }
            }
        }

        if (!customerPackage) {
            console.error(`❌ [Package Error] Invalid ID received: ${customerPackageId}. Not found in customer_packages table. (Context: No matching Sale found either)`);
            throw new Error(`Customer package not found. (Provided ID: ${customerPackageId}). Please ensure you are sending the correct UUID from the package list.`);
        }

        // SELF-HEALING: If it's a 'broken' historical record (staff context bug results in 0 items)
        if (customerPackage.totalQuantity === 0 && customerPackage.usedQuantity === 0 && customerPackage.package?.items) {
            console.log('🩹 [Self-Healing] Re-attaching items to historical record created during context bug...');
            
            const packageData = customerPackage.package;
            const businessId = customerPackage.adminId || packageData.adminId || customerPackage.authId;
            
            const rawItems = packageData.items as any[] || [];
            const itemNames = Array.from(new Set(rawItems.map(item => item.name).filter(Boolean)));

            // Re-validate against current services for record integrity (Healing the context too)
            const [services, products] = await Promise.all([
                tx.service.findMany({
                    where: { 
                        OR: [{ authId: businessId }, { adminId: businessId }, { adminId: customerPackage.customer?.adminId }],
                        name: { in: itemNames }
                    },
                    select: { name: true }
                }),
                tx.product.findMany({
                    where: { 
                        OR: [{ authId: businessId }, { adminId: businessId }, { adminId: customerPackage.customer?.adminId }],
                        name: { in: itemNames }
                    },
                    select: { name: true }
                })
            ]);

            const validNames = new Set([...services.map((s: any) => s.name), ...products.map((p: any) => p.name)]);
            const healedItems = rawItems
                .filter(item => validNames.has(item.name))
                .map((item: any) => ({
                    ...item,
                    remainingQuantity: item.quantity || 1,
                    usedQuantity: 0
                }));

            const healedTotalQuantity = healedItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
            
            if (healedTotalQuantity > 0) {
                const repairedRecord = await tx.customerPackage.update({
                    where: { id: customerPackage.id },
                    data: {
                        totalQuantity: healedTotalQuantity,
                        remainingQuantity: healedTotalQuantity,
                        usageDetails: healedItems,
                        adminId: customerPackage.customer?.adminId // Correct the ownership while we're at it
                    },
                    include: { package: true, customer: true }
                });
                
                console.log(`✨ Historical record ${customerPackage.id} repaired successfully: ${healedTotalQuantity} items recovered.`);
                customerPackage = repairedRecord;
            }
        }

        if (customerPackage.status !== 'ACTIVE') {
            throw new Error('Package is not active');
        }

        if (customerPackage.remainingQuantity <= 0) {
            throw new Error('No remaining services in package');
        }

        // Check expiry
        if (customerPackage.expiryDate && customerPackage.expiryDate < new Date()) {
            throw new Error('Package has expired');
        }

        let newUsageDetails = customerPackage.usageDetails as any[];

        // If usageDetails exists and itemId is provided, update specific item
        if (newUsageDetails && Array.isArray(newUsageDetails) && itemId) {
            console.log(`Checking usage details for item: ${itemId}`);
            const itemIndex = newUsageDetails.findIndex((item: any) => item.itemId === itemId || item.name === itemId); // Allow lookup by ID or Name

            if (itemIndex === -1) {
                console.error(`Item ${itemId} not found in package usage details:`, newUsageDetails);
                throw new Error(`Item not found in package usage details`);
            }

            console.log(`Found item at index ${itemIndex}, remaining: ${newUsageDetails[itemIndex].remainingQuantity}, requested: ${quantity}`);

            if (newUsageDetails[itemIndex].remainingQuantity < quantity) {
                throw new Error(`Insufficient quantity for ${newUsageDetails[itemIndex].name}. Remaining: ${newUsageDetails[itemIndex].remainingQuantity}`);
            }

            // Decrement item specific quantity
            newUsageDetails[itemIndex].usedQuantity += quantity;
            newUsageDetails[itemIndex].remainingQuantity -= quantity;

            // Update the array reference to trigger update
            newUsageDetails = [...newUsageDetails];
        } else if (itemId) {
            // Item ID provided but no usage details structure exists (legacy data case)
            throw new Error('This package does not support item-level tracking. Please contact support.');
        }

        // Always update global counters
        const newUsedQuantity = customerPackage.usedQuantity + quantity;
        const newRemainingQuantity = Math.max(0, customerPackage.totalQuantity - newUsedQuantity);
        const newStatus = newRemainingQuantity === 0 ? 'EXHAUSTED' : 'ACTIVE';

        const result = await tx.customerPackage.update({
            where: { id: customerPackage.id },
            data: {
                usedQuantity: newUsedQuantity,
                remainingQuantity: newRemainingQuantity,
                usageDetails: newUsageDetails ? newUsageDetails : undefined,
                status: newStatus
            },
            include: {
                package: true,
                customer: true
            }
        });

        // Send WhatsApp notification
        this.sendWhatsAppPackageNotification(result.id, itemId, quantity).catch(err =>
            console.error('❌ WhatsApp Package Notification Error:', err)
        );

        return result;
    }

    /**
     * Revert usage of a package (called during sale cancellation)
     */
    async revertPackageUsage(customerPackageId: string, itemId?: string, quantity: number = 1, tx: any = prisma) {
        console.log(`🎟️ revertPackageUsage: id=${customerPackageId}, item=${itemId}, qty=${quantity}`);
        const customerPackage = await tx.customerPackage.findUnique({
            where: { id: customerPackageId }
        });

        if (!customerPackage) return; // Silent return if package not found

        let newUsageDetails = customerPackage.usageDetails as any[];

        if (newUsageDetails && Array.isArray(newUsageDetails) && itemId) {
            const itemIndex = newUsageDetails.findIndex((item: any) => item.itemId === itemId || item.name === itemId);

            if (itemIndex !== -1) {
                // Revert specific item quantity (decrement used, increment remaining)
                newUsageDetails[itemIndex].usedQuantity = Math.max(0, newUsageDetails[itemIndex].usedQuantity - quantity);
                newUsageDetails[itemIndex].remainingQuantity += quantity;
                newUsageDetails = [...newUsageDetails];
            }
        }

        const newUsedQuantity = Math.max(0, customerPackage.usedQuantity - quantity);
        const newRemainingQuantity = Math.max(0, customerPackage.totalQuantity - newUsedQuantity);
        const newStatus = newRemainingQuantity > 0 ? 'ACTIVE' : customerPackage.status;

        return await tx.customerPackage.update({
            where: { id: customerPackageId },
            data: {
                usedQuantity: newUsedQuantity,
                remainingQuantity: newRemainingQuantity,
                usageDetails: newUsageDetails || undefined,
                status: newStatus
            }
        });
    }

    /**
     * Send WhatsApp notification for package usage
     */
    private async sendWhatsAppPackageNotification(customerPackageId: string, itemId?: string, quantity: number = 1) {
        try {
            const pkg = await this.getPackageById(customerPackageId);
            if (!pkg || !pkg.customer || !pkg.customer.phone || !pkg.adminId) return;

            // Find service name from usage details or itemId
            const usageDetails = pkg.usageDetails as any[];
            const item = usageDetails?.find((u: any) => u.itemId === itemId || u.name === itemId);
            const serviceName = item ? item.name : (itemId || 'Service');

            const formattedExpiry = pkg.expiryDate ? new Date(pkg.expiryDate).toLocaleDateString() : 'Never';

            await whatsappService.sendPackageUsage({
                adminId: pkg.adminId,
                customerPhone: pkg.customer.phone,
                customerName: pkg.customer.name,
                packageName: pkg.package.name,
                serviceName: serviceName,
                remainingQuantity: pkg.remainingQuantity,
                expiryDate: formattedExpiry
            });
        } catch (error) {
            console.error('❌ Error in sendWhatsAppPackageNotification:', error);
        }
    }

    /**
     * Expire packages that have passed their expiry date
     */
    async expirePackages() {
        const now = new Date();

        const result = await prisma.customerPackage.updateMany({
            where: {
                status: 'ACTIVE',
                expiryDate: {
                    lt: now
                }
            },
            data: {
                status: 'EXPIRED'
            }
        });

        return result;
    }

    /**
     * Get package by ID
     */
    async getPackageById(id: string) {
        return await prisma.customerPackage.findUnique({
            where: { id },
            include: {
                package: true,
                customer: true
            }
        });
    }

    /**
     * Cancel a customer package
     */
    async cancelPackage(id: string, tx: any = prisma) {
        return await tx.customerPackage.update({
            where: { id },
            data: {
                status: 'CANCELLED'
            },
            include: {
                package: true,
                customer: true
            }
        });
    }
}

export const customerPackageService = new CustomerPackageService();
