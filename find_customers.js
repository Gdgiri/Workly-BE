const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();
const authId = 'c8d368c3-7cf4-4c1d-abeb-e8cc3185c20f';
const adminId = '184a171d-504c-4bd1-b425-58ce8838ee8d';

async function main() {
  const path = 'c:\\Users\\girid\\Downloads\\woodlands data (1).xlsx';
  const workbook = xlsx.readFile(path);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet);

  for (const row of data) {
    let phoneStr = String(row['Phone Number']).trim();
    const name = row['Name']?.trim();
    
    // Find customer by phone or name
    const customers = await prisma.customer.findMany({
      where: {
        adminId: adminId,
        authId: authId,
        OR: [
          { phone: { contains: phoneStr } },
          { name: { contains: name } }
        ]
      }
    });

    console.log(`Searching for Excel: Name=${name}, Phone=${phoneStr}`);
    console.log(`Found ${customers.length} matching customers in DB.`);
    for (const c of customers) {
      console.log(`  -> DB Customer: id=${c.id}, name=${c.name}, phone=${c.phone}`);
      
      const claims = await prisma.voucherClaim.findMany({
        where: {
          customerId: c.id
        }
      });
      console.log(`     Found ${claims.length} voucher claims.`);
      for (const cl of claims) {
        console.log(`       -> Claim: id=${cl.id}, balance=${cl.balance}, code=${cl.voucherCode}`);
      }
      
      const packages = await prisma.customerPackage.findMany({
          where: { customerId: c.id }
      });
      console.log(`     Found ${packages.length} customer packages.`);
      for (const pk of packages) {
          console.log(`       -> Package: id=${pk.id}, remaining=${pk.remainingQuantity}, used=${pk.usedQuantity}`);
      }
    }
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
