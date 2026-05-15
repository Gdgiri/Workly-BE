
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Testing Package Query...');
    try {
        const packages = await prisma.package.findMany({
            where: {
                OR: [
                    { adminId: 'test' }
                ]
            }
        });
        console.log('✅ Query SUCCESS. Found:', packages.length, 'packages.');
    } catch (error) {
        console.error('❌ Query FAILED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
