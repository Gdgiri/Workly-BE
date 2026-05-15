const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixUser() {
    console.log('🔧 Fixing user approval and subscription...\n');

    try {
        const authId = 'd5b30223-9f87-4869-a0a4-fb86ec517c79';

        // Step 1: Approve user
        console.log('📝 Step 1: Approving user...');
        const updatedUser = await prisma.user.update({
            where: { authId },
            data: {
                approvalStatus: 'APPROVED',
                isActive: true,
                approvedAt: new Date(),
                approvedBy: 'ad042313-fdd9-47d2-aa59-d9a3adcc0171',
            }
        });
        console.log('✅ User approved');
        console.log(`   User ID: ${updatedUser.id}`);

        // Step 2: Get Starter plan
        console.log('\n📝 Step 2: Finding Starter plan...');
        const starterPlan = await prisma.subscriptionPlan.findFirst({
            where: { name: 'Starter' }
        });

        if (!starterPlan) {
            throw new Error('Starter plan not found! Please run: node prisma/seed-subscriptions.js');
        }

        console.log('✅ Starter plan found');
        console.log(`   Plan ID: ${starterPlan.id}`);

        // Step 3: Check if subscription already exists
        let subscription = await prisma.subscription.findFirst({
            where: { userId: updatedUser.id }
        });

        if (subscription) {
            console.log('\n📝 Step 3: Updating existing subscription...');
            subscription = await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'ACTIVE',
                    planId: starterPlan.id,
                    amount: starterPlan.monthlyPrice,
                    maxStylists: starterPlan.maxStylists,
                    maxAppointments: starterPlan.maxAppointments,
                    maxCustomers: starterPlan.maxCustomers,
                    maxStaff: starterPlan.maxStaff,
                }
            });
            console.log('✅ Subscription updated');
        } else {
            console.log('\n📝 Step 3: Creating new subscription...');
            subscription = await prisma.subscription.create({
                data: {
                    userId: updatedUser.id,
                    planId: starterPlan.id,
                    status: 'ACTIVE',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                    billingCycle: 'MONTHLY',
                    nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    amount: starterPlan.monthlyPrice,
                    currency: 'INR',
                    maxStylists: starterPlan.maxStylists,
                    maxAppointments: starterPlan.maxAppointments,
                    maxCustomers: starterPlan.maxCustomers,
                    maxStaff: starterPlan.maxStaff,
                }
            });
            console.log('✅ Subscription created');
        }
        console.log(`   Subscription ID: ${subscription.id}`);

        // Step 4: Link subscription to user
        console.log('\n📝 Step 4: Linking subscription to user...');
        await prisma.user.update({
            where: { id: updatedUser.id },
            data: { subscriptionId: subscription.id }
        });
        console.log('✅ Subscription linked');

        // Step 5: Verify
        console.log('\n📝 Step 5: Verifying...');
        const verifiedUser = await prisma.user.findUnique({
            where: { authId },
            include: {
                subscription: {
                    include: {
                        plan: true
                    }
                }
            }
        });

        console.log('\n✅ User Fixed Successfully!\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📋 USER DETAILS:');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`User ID:       ${verifiedUser.id}`);
        console.log(`Auth ID:       ${verifiedUser.authId}`);
        console.log(`Role:          ${verifiedUser.role}`);
        console.log(`Approval:      ${verifiedUser.approvalStatus}`);
        console.log(`Approved At:   ${verifiedUser.approvedAt}`);
        console.log(`Subscription:  ${verifiedUser.subscriptionId}`);
        console.log(`Sub Status:    ${verifiedUser.subscription?.status}`);
        console.log(`Plan:          ${verifiedUser.subscription?.plan?.name}`);
        console.log(`Amount:        ₹${verifiedUser.subscription?.amount}/month`);
        console.log(`Expires:       ${verifiedUser.subscription?.endDate}`);
        console.log('═══════════════════════════════════════════════════════\n');

        console.log('🎯 Next Steps:');
        console.log('1. Logout from the frontend');
        console.log('2. Login again with: admin15@gmail.com');
        console.log('3. Sidebar should now show all menu items!\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('Stack:', error.stack);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

fixUser()
    .then(() => {
        console.log('✅ Script completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed');
        process.exit(1);
    });
