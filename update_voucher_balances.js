const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();
const authId = 'c8d368c3-7cf4-4c1d-abeb-e8cc3185c20f';
const adminId = '184a171d-504c-4bd1-b425-58ce8838ee8d';
const voucherId = 'eddf29c7-323a-4e7f-9f5d-bb31db10962a';
const voucherCode = 'LEGACY-PREPAID-1777728662435';

async function main() {
  const path = 'c:\\Users\\girid\\Downloads\\woodlands data (1).xlsx';
  const workbook = xlsx.readFile(path);
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`Processing ${data.length} records...`);

  for (const row of data) {
    const name = row['Name']?.trim();
    const phone = String(row['Phone Number']).trim();
    const balance = parseFloat(row['BalanceValue']);

    console.log(`\nAnalyzing Excel: Name=${name}, Phone=${phone}, NewBalance=${balance}`);

    // Exact Match Strategy
    let customer = await prisma.customer.findFirst({
        where: {
            adminId,
            authId,
            phone: phone
        }
    });

    if (!customer) {
        // Fallback: Check if phone contains the excel phone (handle possible prefix in DB)
        customer = await prisma.customer.findFirst({
            where: {
                adminId,
                authId,
                phone: { contains: phone }
            }
        });
    }

    if (!customer) {
        // Fallback: Try Name matching exactly
        customer = await prisma.customer.findFirst({
            where: {
                adminId,
                authId,
                name: { contains: name }
            }
        });
    }

    if (customer) {
      console.log(`Matched DB Customer: ID=${customer.id}, Name=${customer.name}, Phone=${customer.phone}`);
      
      const claim = await prisma.voucherClaim.findFirst({
        where: { customerId: customer.id, voucherId }
      });

      if (claim) {
        console.log(`Updating existing claim ID=${claim.id} balance from ${claim.balance} to ${balance}`);
        await prisma.voucherClaim.update({
          where: { id: claim.id },
          data: { balance: balance }
        });
      } else {
        console.log(`Creating new claim for customer ID=${customer.id} with balance ${balance}`);
        await prisma.voucherClaim.create({
          data: {
            authId,
            adminId,
            voucherId,
            voucherCode,
            customerId: customer.id,
            customerName: customer.name,
            balance: balance,
            status: 'claimed'
          }
        });
      }
    } else {
      console.log(`WARNING: No matching customer found in DB for ${name} (${phone})`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
