const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const settings = await prisma.settings.findFirst();
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
