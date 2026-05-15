const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
  const authId = 'c8d368c3-7cf4-4c1d-abeb-e8cc3185c20f';
  const adminId = '184a171d-504c-4bd1-b425-58ce8838ee8d';

  const customers = await prisma.customer.findMany({
    where: {
      adminId: adminId,
      authId: authId,
    },
    include: {
      packages: true,
    }
  });

  const claims = await prisma.voucherClaim.findMany({
      where: {
          adminId: adminId,
          authId: authId,
      }
  });
  
  let out = `Total Customers: ${customers.length}\n`;
  for(let c of customers) {
      const c_claims = claims.filter(cl => cl.customerId === c.id);
      out += `Customer: ID=${c.id}, Name=${c.name}, Phone=${c.phone}, Claims=${c_claims.length}, Packages=${c.packages.length}\n`;
  }
  fs.writeFileSync('all_customers.txt', out);
}

main().catch(console.error).finally(() => prisma.$disconnect());
