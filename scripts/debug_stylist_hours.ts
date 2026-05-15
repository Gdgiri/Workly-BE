import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function checkStylists() {
    console.log('Checking Stylist Availability...');
    const stylists = await prisma.stylist.findMany();

    stylists.forEach(stylist => {
        console.log(`\n---------------------------------`);
        console.log(`ID: ${stylist.id}`);
        console.log(`Name: ${stylist.name}`);
        console.log(`Is Available: ${stylist.isAvailable}`);
        console.log(`Leaves:`, stylist.leaves);
        console.log(`Working Hours Type: ${typeof stylist.workingHours}`);
        console.log(`Working Hours Value:`, JSON.stringify(stylist.workingHours, null, 2));

        if (!stylist.workingHours) {
            console.log('❌ ALERT: Working Hours is NULL or Undefined');
        } else {
            // Check keys
            const keys = Object.keys(stylist.workingHours as object);
            console.log('Keys:', keys);
            if (keys.length === 0) {
                console.log('❌ ALERT: Working Hours object is EMPTY');
            }
        }
    });
}

checkStylists()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
