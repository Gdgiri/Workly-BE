const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function r(){
    const v = await p.voucher.findFirst({ where: { code: 'LEGACY-PREPAID-1777728662435' } });
    console.log(v);
    await p.$disconnect();
}
r();
