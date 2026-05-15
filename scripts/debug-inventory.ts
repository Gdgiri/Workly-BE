
import prisma from '../src/prisma';

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.user.findMany();
    console.table(users.map(u => ({ id: u.id, role: u.role, authId: u.authId })));

    console.log('\n--- PRODUCTS ---');
    const products = await prisma.product.findMany();
    console.table(products.map(p => ({
        id: p.id,
        name: p.name,
        authId: p.authId,
        adminId: p.adminId
    })));

    console.log('\n--- PACKAGES ---');
    const packages = await prisma.package.findMany();
    console.table(packages.map(p => ({
        id: p.id,
        name: p.name,
        authId: p.authId,
        adminId: p.adminId
    })));

    console.log('\n--- SERVICES ---');
    const services = await prisma.service.findMany();
    console.table(services.map(s => ({
        id: s.id,
        name: s.name,
        authId: s.authId,
        adminId: s.adminId
    })));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
