import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await prisma.appointment.deleteMany();
    await prisma.service.deleteMany();
    await prisma.stylist.deleteMany();

    console.log('✅ Database cleared successfully!');
    console.log('');
    console.log('📝 Seeding real salon data...');
    console.log('');

    const ADMIN_ID = 'test-admin-id-123';

    // Create Services
    const services = await Promise.all([
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Haircut & Styling',
                description: 'Professional haircut with wash and styling',
                duration: 45,
                price: 35.00,
                isActive: true,
            },
        }),
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Hair Coloring',
                description: 'Full hair coloring service with premium products',
                duration: 120,
                price: 85.00,
                isActive: true,
            },
        }),
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Highlights',
                description: 'Partial or full highlights',
                duration: 90,
                price: 65.00,
                isActive: true,
            },
        }),
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Deep Conditioning Treatment',
                description: 'Intensive hair treatment and conditioning',
                duration: 30,
                price: 25.00,
                isActive: true,
            },
        }),
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Blowout',
                description: 'Professional blow dry and styling',
                duration: 30,
                price: 30.00,
                isActive: true,
            },
        }),
        prisma.service.create({
            data: {
                authId: ADMIN_ID,
                name: 'Keratin Treatment',
                description: 'Smoothing keratin treatment for frizz control',
                duration: 180,
                price: 150.00,
                isActive: true,
            },
        }),
    ]);
    console.log(`✅ Created ${services.length} services`);

    // Create Stylists
    const stylists = await Promise.all([
        prisma.stylist.create({
            data: {
                authId: 'stylist-auth-id-1',
                adminId: ADMIN_ID,
                name: 'Sarah Johnson',
                email: 'sarah.johnson@salon.com',
                phone: '+1-555-0101',
                specialization: 'Hair Coloring Specialist',
                rating: 4.9,
                isAvailable: true,
                workingHours: {
                    monday: { start: '09:00', end: '18:00' },
                    tuesday: { start: '09:00', end: '18:00' },
                    wednesday: { start: '09:00', end: '18:00' },
                    thursday: { start: '09:00', end: '18:00' },
                    friday: { start: '09:00', end: '18:00' },
                    saturday: { start: '10:00', end: '16:00' },
                },
                leaves: [],
            },
        }),
        prisma.stylist.create({
            data: {
                authId: 'stylist-auth-id-2',
                adminId: ADMIN_ID,
                name: 'Michael Chen',
                email: 'michael.chen@salon.com',
                phone: '+1-555-0102',
                specialization: 'Master Stylist',
                rating: 4.8,
                isAvailable: true,
                workingHours: {
                    monday: { start: '10:00', end: '19:00' },
                    tuesday: { start: '10:00', end: '19:00' },
                    wednesday: { start: '10:00', end: '19:00' },
                    thursday: { start: '10:00', end: '19:00' },
                    friday: { start: '10:00', end: '19:00' },
                },
                leaves: [],
            },
        }),
        prisma.stylist.create({
            data: {
                authId: 'stylist-auth-id-3',
                adminId: ADMIN_ID,
                name: 'Emily Rodriguez',
                email: 'emily.rodriguez@salon.com',
                phone: '+1-555-0103',
                specialization: 'Keratin & Treatment Expert',
                rating: 5.0,
                isAvailable: true,
                workingHours: {
                    tuesday: { start: '09:00', end: '17:00' },
                    wednesday: { start: '09:00', end: '17:00' },
                    thursday: { start: '09:00', end: '17:00' },
                    friday: { start: '09:00', end: '17:00' },
                    saturday: { start: '09:00', end: '15:00' },
                },
                leaves: [],
            },
        }),
        prisma.stylist.create({
            data: {
                authId: 'stylist-auth-id-4',
                adminId: ADMIN_ID,
                name: 'David Martinez',
                email: 'david.martinez@salon.com',
                phone: '+1-555-0104',
                specialization: 'Men\'s Grooming Specialist',
                rating: 4.7,
                isAvailable: true,
                workingHours: {
                    monday: { start: '08:00', end: '16:00' },
                    tuesday: { start: '08:00', end: '16:00' },
                    wednesday: { start: '08:00', end: '16:00' },
                    thursday: { start: '08:00', end: '16:00' },
                    friday: { start: '08:00', end: '16:00' },
                    saturday: { start: '09:00', end: '14:00' },
                },
                leaves: [],
            },
        }),
    ]);
    console.log(`✅ Created ${stylists.length} stylists`);

    // Create Sample Products
    const products = await Promise.all([
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Lumière Shampoo',
                category: 'Hair Care',
                sku: 'SHP-001',
                price: 24.99,
                stock: 45,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Lumière Conditioner',
                category: 'Hair Care',
                sku: 'CND-001',
                price: 26.99,
                stock: 38,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Argan Oil Serum',
                category: 'Treatment',
                sku: 'SRM-001',
                price: 32.50,
                stock: 22,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Keratin Hair Mask',
                category: 'Treatment',
                sku: 'MSK-001',
                price: 28.00,
                stock: 30,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Heat Protection Spray',
                category: 'Styling',
                sku: 'SPR-001',
                price: 18.99,
                stock: 50,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Volumizing Mousse',
                category: 'Styling',
                sku: 'MUS-001',
                price: 22.50,
                stock: 35,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Hair Color - Ash Blonde',
                category: 'Color',
                sku: 'CLR-001',
                price: 45.00,
                stock: 15,
                isActive: true,
            },
        }),
        prisma.product.create({
            data: {
                authId: ADMIN_ID,
                name: 'Hair Color - Chocolate Brown',
                category: 'Color',
                sku: 'CLR-002',
                price: 45.00,
                stock: 18,
                isActive: true,
            },
        }),
    ]);
    console.log(`✅ Created ${products.length} products`);

    // Create Sample Customers
    const customers = await Promise.all([
        prisma.customer.create({
            data: {
                authId: 'customer-auth-id-1',
                adminId: ADMIN_ID,
                name: 'Jessica Williams',
                email: 'jessica.williams@email.com',
                phone: '+1-555-1001',
                city: 'New York',
            },
        }),
        prisma.customer.create({
            data: {
                authId: 'customer-auth-id-2',
                adminId: ADMIN_ID,
                name: 'Robert Brown',
                email: 'robert.brown@email.com',
                phone: '+1-555-1002',
                city: 'Los Angeles',
            },
        }),
        prisma.customer.create({
            data: {
                authId: 'customer-auth-id-3',
                adminId: ADMIN_ID,
                name: 'Amanda Davis',
                email: 'amanda.davis@email.com',
                phone: '+1-555-1003',
                city: 'Chicago',
            },
        }),
        prisma.customer.create({
            data: {
                authId: 'customer-auth-id-4',
                adminId: ADMIN_ID,
                name: 'Christopher Wilson',
                email: 'christopher.wilson@email.com',
                phone: '+1-555-1004',
                city: 'Houston',
            },
        }),
        prisma.customer.create({
            data: {
                authId: 'customer-auth-id-5',
                adminId: ADMIN_ID,
                name: 'Michelle Taylor',
                email: 'michelle.taylor@email.com',
                phone: '+1-555-1005',
                city: 'Phoenix',
            },
        }),
    ]);
    console.log(`✅ Created ${customers.length} customers`);

    console.log('');
    console.log('🎉 Seed completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Error during seed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
