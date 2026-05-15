const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const adminId = '6302dd5b-226a-47d5-95b3-d82d6bf02e62';
    const settings = await prisma.settings.findUnique({
        where: { adminId }
    });
    process.stdout.write(JSON.stringify(settings, null, 2));
}

main()
    .catch((e) => {
        process.stderr.write(e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
