const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- FINDING DUPLICATES ---');

    console.log('--- CUSTOMERS ---');
    const customers = await prisma.customer.findMany({
        select: { id: true, name: true, email: true, adminId: true }
    });

    const emailMap = new Map();
    const duplicates = [];

    customers.forEach(c => {
        const key = `${c.email}-${c.adminId}`;
        /* 
           Actually, the issue is that if we CHANGE adminId from authId to internalId, 
           it might clash with an EXISTING record that already has internalId.
        */
    });

    // Let's just group by email and see what adminIds they have
    const byEmail = {};
    customers.forEach(c => {
        if (!byEmail[c.email]) byEmail[c.email] = [];
        byEmail[c.email].push(c);
    });

    for (const email in byEmail) {
        if (byEmail[email].length > 1) {
            console.log(`Duplicate Email: ${email}`);
            console.log(JSON.stringify(byEmail[email], null, 2));
        }
    }

    console.log('--- STYLISTS ---');
    const stylists = await prisma.stylist.findMany({
        select: { id: true, name: true, email: true, adminId: true }
    });
    const sByEmail = {};
    stylists.forEach(s => {
        if (!sByEmail[s.email]) sByEmail[s.email] = [];
        sByEmail[s.email].push(s);
    });

    for (const email in sByEmail) {
        if (sByEmail[email].length > 1) {
            console.log(`Duplicate Email: ${email}`);
            console.log(JSON.stringify(sByEmail[email], null, 2));
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
