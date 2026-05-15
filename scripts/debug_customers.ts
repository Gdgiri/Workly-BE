import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkCustomers() {
    console.log('Checking Customers...');
    const customers = await prisma.customer.findMany();

    console.log(`Found ${customers.length} customers:`);
    customers.forEach(c => {
        console.log(`- [${c.id}] ${c.name} (${c.email})`);
    });

    const userEmail = "test4@gmail.com"; // Example from previous context, adjust if needed or just listing helps
    const clash = customers.find(c => c.email === userEmail);
    if (clash) {
        console.log(`\n⚠️  Email ${userEmail} already exists with ID: ${clash.id}`);
    }
}

checkCustomers()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
