import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function fixCustomerAuthIds() {
    try {
        console.log('🔍 Finding all customers...');

        // Get all customers
        const allCustomers = await prisma.customer.findMany();
        console.log(`Found ${allCustomers.length} total customers`);

        // Find the first admin user for adminId
        const firstAdmin = await prisma.user.findFirst({
            where: {
                role: 'ADMIN'
            }
        });

        if (!firstAdmin) {
            console.log('⚠️ No admin user found in database');
            return;
        }

        console.log(`Using admin: ${firstAdmin.authId} as default adminId`);
        console.log('\n📋 Customer Status:');
        console.log('─'.repeat(80));

        const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8000';
        const APP_NAME = 'workly-salon';

        for (const customer of allCustomers) {
            console.log(`\n👤 Customer: ${customer.name} (${customer.email})`);
            console.log(`   Current authId: ${customer.authId || 'NULL'}`);
            console.log(`   Current adminId: ${customer.adminId || 'NULL'}`);

            let needsUpdate = false;
            let updateData: any = {};

            // Fix adminId if null
            if (!customer.adminId) {
                updateData.adminId = firstAdmin.authId;
                needsUpdate = true;
                console.log(`   ➕ Will set adminId to: ${firstAdmin.authId}`);
            }

            // Fix authId if null - create auth service account
            if (!customer.authId) {
                try {
                    // Generate password from phone or random
                    const password = customer.phone
                        ? `Customer@${customer.phone.slice(-4)}`
                        : `Customer@${Math.floor(1000 + Math.random() * 9000)}`;

                    console.log(`   📝 Creating AuthService account...`);

                    // Register user in AuthService
                    const registerResponse = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
                        app_id: APP_NAME,
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone || '',
                        password,
                        role: 'CUSTOMER'
                    }, {
                        timeout: 30000
                    });

                    const responseData = registerResponse.data?.data;
                    const authUser = responseData?.user;

                    if (authUser && authUser.id) {
                        updateData.authId = authUser.id;
                        needsUpdate = true;
                        console.log(`   ✅ AuthService account created: ${authUser.id}`);
                        console.log(`   🔑 Password: ${password}`);
                    }
                } catch (authError: any) {
                    const errorMsg = authError.response?.data?.message || authError.message;

                    if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
                        console.log(`   ℹ️  Email already exists in AuthService - skipping authId creation`);
                    } else {
                        console.log(`   ⚠️  Failed to create AuthService account: ${errorMsg}`);
                    }
                }
            }

            // Update customer if needed
            if (needsUpdate) {
                await prisma.customer.update({
                    where: { id: customer.id },
                    data: updateData
                });
                console.log(`   ✅ Customer updated in database`);
            } else {
                console.log(`   ✓ Customer already has both authId and adminId`);
            }
        }

        console.log('\n' + '─'.repeat(80));
        console.log('✅ Migration completed!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixCustomerAuthIds();
