import prisma from '../prisma';

class DashboardService {
    /**
     * Get dashboard statistics for a business
     * Multi-tenant: Filters by adminId
     */
    async getDashboardStats(adminId: string) {
        // Γ£à FIX: Use Local-based date calculation to match frontend filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Calculate Month Start and End
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        // Initialize date-based range for thirty days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let results: any[];
        try {
            results = await Promise.all([
                // 1. Today's Sales
                prisma.sale.findMany({
                    where: {
                        adminId: adminId as any,
                        createdAt: { gte: today, lt: tomorrow },
                    } as any,
                    select: {
                        id: true,
                        totalAmount: true,
                        paidAmount: true,
                        saleStatus: true,
                        customerId: true,
                        createdAt: true,
                        createdBy: true,
                        payments: {
                            select: { amount: true, paymentMethod: true, cashierName: true }
                        },
                        appointment: {
                            select: {
                                customer: { select: { name: true } }
                            }
                        }
                    } as any,
                    orderBy: { createdAt: 'desc' } as any,
                }),
                // 2. Today's Expenses
                prisma.expense.findMany({
                    where: {
                        adminId: adminId as any,
                        date: { gte: today, lt: tomorrow },
                    } as any,
                    orderBy: { date: 'desc' } as any,
                }),
                // 3. This Month's Expenses Sum
                prisma.expense.aggregate({
                    where: {
                        adminId: adminId as any,
                        date: { gte: monthStart, lte: monthEnd }
                    } as any,
                    _sum: { amount: true } as any,
                }),
                // 4. Total Earnings
                prisma.sale.aggregate({
                    where: { adminId: adminId as any, saleStatus: 'COMPLETED' } as any,
                    _sum: { totalAmount: true },
                    _count: { id: true },
                }),
                // 5. Total Expenses
                prisma.expense.aggregate({
                    where: { adminId: adminId as any } as any,
                    _sum: { amount: true } as any,
                }),
                // 6. Total Customers
                prisma.customer.count({
                    where: { adminId: adminId as any } as any
                }),
                // 7. Pending Requests
                prisma.appointment.count({
                    where: {
                        adminId: adminId as any,
                        status: 'PENDING',
                        startTime: { gte: today, lt: tomorrow },
                        customer: { id: { not: '' } },
                        service: { id: { not: '' } }
                    } as any
                }),
                // 8. Active Packages
                prisma.package.findMany({
                    where: { adminId: adminId as any, active: true } as any,
                    select: { id: true, name: true, price: true, description: true }
                }),
                // 9. This Month's Sales
                prisma.sale.aggregate({
                    where: {
                        adminId: adminId as any,
                        createdAt: { gte: monthStart, lte: monthEnd },
                        saleStatus: 'COMPLETED'
                    } as any,
                    _sum: { totalAmount: true },
                    _count: { id: true }
                }),
                // 10. This Month's Appointments
                prisma.appointment.count({
                    where: {
                        adminId: adminId as any,
                        startTime: { gte: monthStart, lte: monthEnd }
                    } as any
                }),
                // 11. Top Visits (Current Month)
                prisma.sale.groupBy({
                    by: ['customerId'],
                    where: {
                        adminId: adminId as any,
                        saleStatus: 'COMPLETED',
                        customerId: { not: null },
                        createdAt: { gte: monthStart, lte: monthEnd }
                    } as any,
                    _count: { id: true },
                    orderBy: { _count: { id: 'desc' } },
                    take: 5
                }),
                // 12. Top Spend (Current Month)
                prisma.sale.groupBy({
                    by: ['customerId'],
                    where: {
                        adminId: adminId as any,
                        saleStatus: 'COMPLETED',
                        customerId: { not: null },
                        createdAt: { gte: monthStart, lte: monthEnd }
                    } as any,
                    _sum: { totalAmount: true },
                    orderBy: { _sum: { totalAmount: 'desc' } },
                    take: 5
                }),
                // 13. Today's Appointments Count
                prisma.appointment.count({
                    where: {
                        adminId: adminId as any,
                        startTime: { gte: today, lt: tomorrow },
                    } as any
                }),
                // 14. Recent Sales for Top Services
                prisma.sale.findMany({
                    where: {
                        adminId: adminId as any,
                        saleStatus: 'COMPLETED',
                        createdAt: { gte: thirtyDaysAgo }
                    } as any,
                    select: { items: true }
                }),
                // 15. Recent Appointments for Top Stylists
                prisma.appointment.findMany({
                    where: {
                        adminId: adminId as any,
                        status: 'COMPLETED',
                        startTime: { gte: thirtyDaysAgo }
                    } as any,
                    include: { stylist: { select: { name: true } } }
                }),
                // 16. Low Stock Alerts
                prisma.product.findMany({
                    where: {
                        adminId: adminId as any,
                        stock: { lte: 5 },
                        isActive: true
                    } as any,
                    select: { name: true, stock: true }
                }),
                // 17. High Stock Items
                prisma.product.findMany({
                    where: { adminId: adminId as any, stock: { gt: 20 }, isActive: true } as any,
                    select: { name: true, stock: true, price: true },
                    take: 10
                }),
                // 18. High Price Items
                prisma.product.findMany({
                    where: { adminId: adminId as any, isActive: true } as any,
                    orderBy: { price: 'desc' },
                    select: { name: true, stock: true, price: true },
                    take: 5
                }),
                // 19. Low Price Items
                prisma.product.findMany({
                    where: { adminId: adminId as any, isActive: true } as any,
                    orderBy: { price: 'asc' },
                    select: { name: true, stock: true, price: true },
                    take: 5
                }),
                // 20. Available Specialists
                prisma.stylist.findMany({
                    where: { adminId: adminId as any, isAvailable: true } as any,
                    select: { name: true, phone: true }
                }),
                // 21. Monthly Reconciliation
                prisma.payment.groupBy({
                    by: ['paymentMethod'],
                    where: {
                        adminId: adminId as any,
                        createdAt: { gte: monthStart, lte: monthEnd },
                        paymentStatus: 'COMPLETED'
                    } as any,
                    _sum: { amount: true }
                }),
                // 22. Recent Transactions
                prisma.sale.findMany({
                    where: { adminId: adminId as any } as any,
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        totalAmount: true,
                        paidAmount: true,
                        balanceAmount: true,
                        paymentStatus: true,
                        saleStatus: true,
                        createdAt: true,
                        customerId: true,
                        appointment: {
                            select: {
                                customer: { select: { name: true } }
                            }
                        }
                    } as any
                }),
                // 23. Pending Payments
                prisma.sale.findMany({
                    where: {
                        adminId: adminId as any,
                        balanceAmount: { gt: 0 },
                        saleStatus: { not: 'CANCELLED' }
                    } as any,
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        totalAmount: true,
                        balanceAmount: true,
                        paymentStatus: true,
                        createdAt: true,
                        customerId: true,
                        appointment: {
                            select: {
                                customer: { select: { name: true } }
                            }
                        }
                    } as any
                }),
                // 24. Recent Inventory Movements
                prisma.inventoryMovement.findMany({
                    where: { adminId: adminId as any } as any,
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { product: { select: { name: true } } }
                }),
                // 25. Vouchers Basic Info
                prisma.voucher.findMany({
                    where: { adminId: adminId as any } as any,
                    select: { code: true, value: true, status: true, expiryDate: true }
                }),
                // 26. Voucher Claims Summary
                prisma.voucherClaim.aggregate({
                    where: { adminId: adminId as any } as any,
                    _sum: { balance: true },
                    _count: { id: true }
                }),
                // 27. Customer Packages Detailed
                prisma.customerPackage.findMany({
                    where: { adminId: adminId as any, status: 'ACTIVE' } as any,
                    take: 15,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        customer: { select: { name: true } },
                        package: { select: { name: true } }
                    }
                }),
                // 28. Cashier Summary (Today)
                prisma.payment.groupBy({
                    by: ['cashierName'],
                    where: {
                        adminId: adminId as any,
                        createdAt: { gte: today, lt: tomorrow },
                        paymentStatus: 'COMPLETED'
                    } as any,
                    _sum: { amount: true }
                }),
                // 29. New Customers (Today)
                prisma.customer.findMany({
                    where: {
                        adminId: adminId as any,
                        createdAt: { gte: today, lt: tomorrow }
                    } as any,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        city: true,
                        createdAt: true,
                        createdBy: true
                    } as any,
                    orderBy: { createdAt: 'desc' } as any,
                    take: 10
                })
            ]);
        } catch (error: any) {
            console.error('Γ¥î Dashboard Queries Failed:', error);
            throw error;
        }

        const [
            todaySales,
            todayExpensesList,
            thisMonthExpensesQuery,
            totalEarningsQuery,
            totalExpensesQuery,
            totalCustomers,
            pendingRequestsCount,
            activePackages,
            thisMonthSalesQuery,
            thisMonthAppointmentsCount,
            topVisitsRaw,
            topSpendRaw,
            todayAppointmentsCount,
            recentSalesForTop,
            recentAppointments,
            lowStockAlerts,
            highStockItems,
            highPriceItems,
            lowPriceItems,
            availableSpecialists,
            monthlyReconciliationRaw,
            recentTransactionsRaw,
            pendingPaymentsRaw,
            inventoryMovements,
            vouchersData,
            voucherClaimsSummary,
            customerPackagesList,
            cashierSummaryRaw,
            newCustomersTodayRaw
        ] = results;

        // [Fix] Resolve customer names for today's sales
        const missingCustomerIds = todaySales
            .filter((s: any) => s.customerId && !s.appointment?.customer)
            .map((s: any) => s.customerId);

        let customerMap = new Map<string, string>();
        if (missingCustomerIds.length > 0) {
            try {
                const complementaryCustomers = await prisma.customer.findMany({
                    where: { id: { in: missingCustomerIds } },
                    select: { id: true, name: true }
                });
                complementaryCustomers.forEach((c: any) => customerMap.set(c.id, c.name));
            } catch (err) {
                console.error('ΓÜá∩╕Å Failed to fetch complementary customers:', err);
            }
        }

        // [New] Resolve customer names for Recent Transactions and Pending Payments
        const extraCustomerIds = [
            ...recentTransactionsRaw.filter((s: any) => s.customerId && !s.appointment?.customer).map((s: any) => s.customerId),
            ...pendingPaymentsRaw.filter((s: any) => s.customerId && !s.appointment?.customer).map((s: any) => s.customerId)
        ];

        if (extraCustomerIds.length > 0) {
            try {
                const extraCustomers = await prisma.customer.findMany({
                    where: { id: { in: extraCustomerIds } },
                    select: { id: true, name: true }
                });
                extraCustomers.forEach((c: any) => customerMap.set(c.id, c.name));
            } catch (err) {
                console.error('ΓÜá∩╕Å Failed to fetch extra customers:', err);
            }
        }

        const recentTransactions = recentTransactionsRaw.map((sale: any) => ({
            id: sale.id,
            customerName: sale.appointment?.customer?.name || customerMap.get(sale.customerId) || 'Walk-in',
            totalAmount: sale.totalAmount,
            paidAmount: sale.paidAmount || 0,
            balanceAmount: sale.balanceAmount || 0,
            paymentStatus: sale.paymentStatus,
            status: sale.saleStatus || sale.status,
            createdAt: sale.createdAt,
            type: 'service'
        }));

        const pendingPayments = pendingPaymentsRaw.map((sale: any) => ({
            id: sale.id,
            customerName: sale.appointment?.customer?.name || customerMap.get(sale.customerId) || 'Walk-in',
            totalAmount: sale.totalAmount,
            balanceAmount: sale.balanceAmount,
            status: sale.paymentStatus,
            createdAt: sale.createdAt
        }));

        const serviceCounts = new Map<string, number>();
        recentSalesForTop.forEach((sale: any) => {
            let items: any[] = [];
            try {
                if (typeof sale.items === 'string') {
                    items = JSON.parse(sale.items);
                } else if (Array.isArray(sale.items)) {
                    items = sale.items;
                } else if (sale.items && typeof sale.items === 'object') {
                    // Handle single object items if any
                    items = [sale.items];
                }
            } catch (e) {
                console.error('Γ¥î Error parsing sale items for top analytics:', e);
            }

            if (Array.isArray(items)) {
                items.forEach((item: any) => {
                    // Count services, combos, and packages towards "Top Services"
                    if (item && (item.type === 'service' || item.type === 'combo' || item.type === 'package')) {
                        serviceCounts.set(item.name, (serviceCounts.get(item.name) || 0) + (item.quantity || 1));
                    }
                });
            }
        });

        const topServices = Array.from(serviceCounts.entries())
            .map(([name, count]) => ({ name, value: count })) // Changed 'count' to 'value' for frontend chart compatibility
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Deriving top customers from raw results (previously fetched in Promise.all)
        const topCustomersByVisits = topVisitsRaw.map((item: any) => ({
            customerId: item.customerId,
            count: item._count.id,
            customerName: customerMap.get(item.customerId) || 'Unknown'
        }));

        const topCustomersBySpend = topSpendRaw.map((item: any) => ({
            customerId: item.customerId,
            totalAmount: item._sum.totalAmount || 0,
            customerName: customerMap.get(item.customerId) || 'Unknown'
        }));

        const stylistCounts = new Map<string, number>();
        recentAppointments.forEach((apt: any) => {
            const name = apt.stylist?.name || 'Unknown';
            stylistCounts.set(name, (stylistCounts.get(name) || 0) + 1);
        });

        const topStylists = Array.from(stylistCounts.entries())
            .map(([name, count]) => ({ name, value: count }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Γ£à Financial Reconciliation (Payment Methods)
        // 1. Daily Reconciliation (In-Memory from todaySales)
        const dailyReconciliation: Record<string, number> = {};
        todaySales.forEach((sale: any) => {
            if (sale.payments && Array.isArray(sale.payments)) {
                sale.payments.forEach((payment: any) => {
                    const method = payment.paymentMethod || 'UNKNOWN';
                    dailyReconciliation[method] = (dailyReconciliation[method] || 0) + (payment.amount || 0);
                });
            }
        });

        // 2. Monthly Reconciliation (Already fetched in Promise.all)

        const monthlyReconciliation = monthlyReconciliationRaw.reduce((acc: any, item: any) => {
            const method = item.paymentMethod || 'UNKNOWN';
            acc[method] = item._sum.amount || 0;
            return acc;
        }, {});

        // Calculate today's revenue (Sum of paidAmount for today's sales to match Dashboard)
        const todayRevenue = todaySales.reduce((sum: number, sale: any) => sum + (sale.paidAmount || 0), 0);

        // Format data for the UI
        const stats = {
            todaySalesCount: todaySales.length,
            todayAppointmentsCount,
            todayRevenue,
            pendingRequestsCount,
            activePackages,
            topServices,
            topStylists,
            lowStockAlerts,
            // [Fix] totalEarnings is now ALL TIME for this business
            totalEarnings: totalEarningsQuery._sum.totalAmount || 0,
            // [Fix] totalExpenses is now ALL TIME for this business
            totalExpenses: totalExpensesQuery._sum.amount || 0,

            // Overall Visits (All time completed sales)
            totalVisits: totalEarningsQuery._count?.id || 0,

            // Total Customers
            totalCustomers: totalCustomers,

            // [Fix] todayServices expects an array of services/sales in the UI
            // Renaming or expanding this to show more than just today
            todayExpenses: todayExpensesList.map((e: any) => ({
                id: e.id,
                title: e.title,
                category: e.category,
                amount: e.amount,
                date: e.date
            })),
            thisMonthExpenses: thisMonthExpensesQuery._sum.amount || 0, // [New] Monthly Expense Total

            // [New] Monthly Metrics
            thisMonthRevenue: thisMonthSalesQuery._sum.totalAmount || 0,
            thisMonthSalesCount: thisMonthSalesQuery._count.id || 0,
            thisMonthAppointmentsCount,

            // [New] AI Context Extensions
            inventoryMovements: inventoryMovements.map((m: any) => ({
                product: m.product?.name || 'Unknown',
                type: m.type,
                quantity: m.quantity,
                balanceAfter: m.balanceAfter,
                date: m.createdAt
            })),
            vouchersStatus: {
                totalCount: vouchersData.length,
                activeCount: vouchersData.filter((v: any) => v.status === 'active').length,
                totalRedeemableBalance: voucherClaimsSummary._sum.balance || 0,
                activeClaimsCount: voucherClaimsSummary._count.id || 0
            },
            customerPackagesDetail: customerPackagesList.map((cp: any) => ({
                customer: cp.customer?.name || 'Unknown',
                packageName: cp.package?.name || 'Unknown',
                remaining: cp.remainingQuantity,
                total: cp.totalQuantity,
                expiry: cp.expiryDate
            })),

            // [New] Customer Insights
            topCustomersByVisits,
            topCustomersBySpend,

            // [New] Inventory Intelligence
            highStockItems,
            highPriceItems,
            lowPriceItems,

            // [New] Operations
            availableSpecialists,
            dailyReconciliation,
            monthlyReconciliation,
            cashierSummary: cashierSummaryRaw.map((item: any) => ({
                name: item.cashierName || 'Admin',
                amount: item._sum.amount || 0
            })).sort((a: any, b: any) => b.amount - a.amount),
            todayServices: todaySales.map((sale: any) => {
                // Determine customer name from appointment, direct lookup, or default to Walk-in
                let customerName = 'Walk-in';
                if (sale.appointment?.customer?.name) {
                    customerName = sale.appointment.customer.name;
                } else if (sale.customerId && customerMap.has(sale.customerId)) {
                    customerName = customerMap.get(sale.customerId)!;
                }

                return {
                    id: sale.id,
                    customerName,
                    totalAmount: sale.totalAmount,
                    paidAmount: sale.paidAmount,
                    status: sale.saleStatus || sale.status,
                    cashierName: sale.payments?.[0]?.cashierName || sale.createdBy || 'Admin',
                    createdAt: sale.createdAt,
                };
            }),

            // ✅ Add Recent Transactions (Overall - not just today)
            recentTransactions,

            todayExpensesSum: todayExpensesList.reduce((sum: number, exp: any) => sum + exp.amount, 0),

            // ✅ Add Pending Payments (Sales with balance > 0)
            pendingPayments,

            // Keep recentSales for backward compatibility
            recentSales: todaySales.slice(0, 5).map((sale: any) => ({
                id: sale.id,
                totalAmount: sale.totalAmount,
                createdAt: sale.createdAt,
            })),

            // [New] New Customers Today
            newCustomersToday: newCustomersTodayRaw.map((c: any) => ({
                id: c.id,
                name: c.name,
                email: c.email,
                city: c.city,
                joinedAt: c.createdAt,
                createdBy: c.createdBy
            }))
        };

        // console.log('≡ƒôê Dashboard stats calculated:', {
        //     todaySalesCount: stats.todaySalesCount,
        //     todayRevenue: stats.todayRevenue,
        //     todayServicesCount: stats.todayServices.length,
        //     todayExpensesCount: stats.todayExpenses.length
        // });

        return stats;
    }
}

const dashboardService = new DashboardService();
export default dashboardService;
