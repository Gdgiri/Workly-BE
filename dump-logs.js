const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const logs = await prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    process.stdout.write(JSON.stringify(logs, null, 2));
}

main()
    .catch((e) => {
        process.stderr.write(e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
