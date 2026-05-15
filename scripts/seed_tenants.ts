import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Salon Tenants...');
  console.log('Using DB URL:', process.env.DATABASE_URL);

  const admins: any[] = [
  {
    "name": "demo",
    "email": "demo@gmail.com",
    "authId": "0dabdf69-2007-493f-86e7-8095baea129d",
    "password": "SyncedUser"
  },
  {
    "name": "Demo Admin 2",
    "email": "demoadmin2@gmail.com",
    "authId": "146c86ad-f222-429d-bb42-4770e290f794",
    "password": "SyncedUser"
  },
  {
    "name": "Admin",
    "email": "admin@workly.test",
    "authId": "79f7310e-6ce0-49f4-a81c-128019be2284",
    "password": "SyncedUser"
  },
  {
    "name": "Demo Admin 1",
    "email": "demoadmin1@gmail.com",
    "authId": "923dd079-1732-4b93-a177-0e5230a97e16",
    "password": "SyncedUser"
  },
  {
    "name": "Admin 18",
    "email": "admin18@gmail.com",
    "authId": "ecf44c8e-e122-46e9-b7e8-dd47cb204d0d",
    "password": "SyncedUser"
  }
];

  for (const admin of admins) {
    console.log(`Processing ${admin.email} (AuthID: ${admin.authId})...`);

    try {
        // 1. Create User in Salon Backend (Role: ADMIN)
        const user = await prisma.user.upsert({
          where: { authId: admin.authId },
          update: {
            role: 'ADMIN',
            isActive: true,
          },
          create: {
            authId: admin.authId,
            role: 'ADMIN',
            isActive: true,
            approvalStatus: 'APPROVED'
          },
        });
        console.log(`✅ Created/Updated User: ${user.id}`);

        // 2. Create Settings
        await prisma.settings.upsert({
          where: { adminId: user.id },
          update: {},
          create: {
            adminId: user.id,
            authId: user.authId,
            currency: 'INR',
            salonName: `Salon of ${admin.name}`,
            activePaymentMethods: [
                { name: "CASH", status: true },
                { name: "CARD", status: true },
                { name: "UPI", status: true }
            ]
          }
        });
        console.log(`✅ Created Settings for Admin: ${user.id}`);

        // 3. Create active subscription
        let plan = await prisma.subscriptionPlan.findFirst({ where: { name: 'Basic Plan' } });
        if (!plan) {
            plan = await prisma.subscriptionPlan.create({
                data: {
                    name: 'Basic Plan',
                    monthlyPrice: 0,
                    quarterlyPrice: 0,
                    yearlyPrice: 0,
                    maxStylists: 5,
                    maxAppointments: 100,
                    maxCustomers: 500,
                    maxStaff: 5,
                    features: {}
                }
            });
        }

        await prisma.subscription.upsert({
            where: { userId: user.id },
            update: { status: 'ACTIVE' },
            create: {
                userId: user.id,
                planId: plan.id,
                status: 'ACTIVE',
                amount: 0,
                startDate: new Date(),
            }
        });
        console.log(`✅ Subscription Active for: ${user.id}`);

    } catch (err) {
        console.error(`❌ Error processing ${admin.email}:`, JSON.stringify(err, null, 2));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
