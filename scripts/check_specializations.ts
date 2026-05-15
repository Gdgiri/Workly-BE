
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- FETCHING STYLISTS & SERVICES ---');

    // Fetch all stylists
    const stylists = await prisma.stylist.findMany({
        select: {
            id: true,
            name: true,
            specialization: true
        }
    });

    // Fetch all services
    const services = await prisma.service.findMany({
        select: {
            id: true,
            name: true
        }
    });

    console.log(`Found ${stylists.length} stylists and ${services.length} services.`);

    console.log('\n--- STYLIST SPECIALIZATIONS ---');
    stylists.forEach(s => {
        console.log(`Stylist: ${s.name} | Specialization: "${s.specialization}"`);
    });

    console.log('\n--- SERVICE NAMES ---');
    services.slice(0, 10).forEach(s => {
        console.log(`Service: ${s.name}`);
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
