import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'sumo@gmail.com'; // User from the logs
    const businessName = 'demo';

    console.log(`--- Debuging Access for ${email} to ${businessName} ---`);

    // 1. Get Customer(s) by email to find authId
    const customersWithEmail = await prisma.customer.findMany({
        where: { email: email }
    });
    console.log('Customers with this email:', customersWithEmail);

    if (customersWithEmail.length === 0) {
        console.log('No customer found with this email!');
        // If no customer record, we can't find authId from DB easily unless we check Stylist or assume it's somewhere else.
        // But 'sumo' is likely a customer.
        return;
    }

    const authId = customersWithEmail[0].authId;
    console.log('Resolved AuthID:', authId);

    // 1a. Get User by AuthID (just to check role)
    const user = await prisma.user.findFirst({
        where: { authId: authId }
    });
    console.log('User Record:', user);

    // 2. Get Admin for 'demo'
    const admin = await prisma.user.findFirst({
        where: { businessName: businessName }
    });
    console.log('Admin (Store) Record:', admin);

    if (!admin) {
        console.log('Store/Admin not found!');
        return;
    }

    // 3. Check Customer Link
    const customer = await prisma.customer.findFirst({
        where: {
            authId: user.id, // Using the user's ID
            adminId: admin.id
        }
    });

    console.log('Customer Link:', customer);

    // 4. Check ANY customer record for this user
    const allCustomers = await prisma.customer.findMany({
        where: { authId: user.id }
    });
    console.log('All Customer affiliations for this user:', allCustomers);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
