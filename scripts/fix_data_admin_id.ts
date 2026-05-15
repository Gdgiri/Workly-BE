
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUTH_ID = 'c3d14ddf-9da1-4464-b7ae-5a2f92f2d046';

async function main() {
    console.log(`🔍 Finding DB ID for Auth ID: ${AUTH_ID}...`);

    const user = await prisma.user.findUnique({
        where: { authId: AUTH_ID },
    });

    if (!user) {
        console.error('❌ User not found!');
        return;
    }

    const DB_ID = user.id;
    console.log(`✅ Found DB ID: ${DB_ID}`);

    if (DB_ID === AUTH_ID) {
        console.log('⚠️ IDs match, no migration needed (or already done).');
        return;
    }

    console.log('🔄 Migrating data from Auth ID to DB ID...');

    // Update Appointments
    const appointments = await prisma.appointment.updateMany({
        where: { adminId: AUTH_ID },
        data: { adminId: DB_ID }
    });
    console.log(`- Updated ${appointments.count} appointments`);

    // Update Services
    const services = await prisma.service.updateMany({
        where: { adminId: AUTH_ID },
        data: { adminId: DB_ID }
    });
    console.log(`- Updated ${services.count} services`);

    // Update Stylists
    const stylists = await prisma.stylist.updateMany({
        where: { adminId: AUTH_ID },
        data: { adminId: DB_ID }
    });
    console.log(`- Updated ${stylists.count} stylists`);

    // Update Customers
    const customers = await prisma.customer.updateMany({
        where: { adminId: AUTH_ID },
        data: { adminId: DB_ID }
    });
    console.log(`- Updated ${customers.count} customers`);

    // Update Products
    const products = await prisma.product.updateMany({
        where: { adminId: AUTH_ID },
        data: { adminId: DB_ID }
    });
    console.log(`- Updated ${products.count} products`);

    console.log('✅ Data migration complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
