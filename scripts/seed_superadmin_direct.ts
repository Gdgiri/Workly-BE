
import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const AUTH_DB_URL = "mysql://root:SdkoaoCMiWttKWBWSGMmxHHCpCcuydCp@yamanote.proxy.rlwy.net:55337/railway";
const APP_NAME = 'workly-salon';
let appIdStr = '';

async function main() {
    console.log('🚀 Starting Super Admin Direct Seeding...');

    // 1. Connect to AuthService DB
    console.log('🔌 Connecting to AuthService DB...');
    const authConnection = await mysql.createConnection(AUTH_DB_URL);

    const email = 'superadmin@workly.com';
    const password = 'Super@123';
    const name = 'Super Admin';
    const phone = '0000000000'; // dummy

    let authId = '';

    try {
        // 0. Get App ID
        const [appRows]: any = await authConnection.execute(
            'SELECT id FROM apps WHERE name = ?',
            [APP_NAME]
        );
        if (appRows.length === 0) {
            console.error(`❌ App '${APP_NAME}' not found in AuthService DB!`);
            // Optional: Create it?
            // process.exit(1); 
            // For now, let's assume it exists or fail.
            process.exit(1);
        }
        appIdStr = appRows[0].id;
        console.log(`✅ Found App ID for '${APP_NAME}': ${appIdStr}`);

        // Check if user exists
        const [rows]: any = await authConnection.execute(
            'SELECT id FROM users WHERE email = ? AND app_id = ?',
            [email, appIdStr]
        );

        if (rows.length > 0) {
            console.log('ℹ️  User already exists in AuthService DB.');
            authId = rows[0].id;
        } else {
            console.log('📝 Creating new user in AuthService DB...');
            // Need UUID
            authId = uuidv4();
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            await authConnection.execute(
                `INSERT INTO users (id, name, email, phone_number, password, app_id, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [authId, name, email, phone, hashedPassword, appIdStr]
            );
            console.log('✅ User inserted into AuthService DB.');
        }

        console.log(`🔑 Auth ID: ${authId}`);

    } catch (e: any) {
        console.error('❌ AuthService DB Error:', e.message);
        process.exit(1);
    } finally {
        await authConnection.end();
    }

    // 2. Seed salon_be1
    console.log(`💾 Seeding user in salon_be1 DB...`);
    try {
        const user = await prisma.user.upsert({
            where: { authId },
            update: {
                role: 'SUPER_ADMIN',
                isActive: true
            },
            create: {
                authId,
                role: 'SUPER_ADMIN',
                isActive: true
            }
        });
        console.log(`✅ Super Admin created/updated in salon_be1:`, user);
    } catch (dbError: any) {
        console.error('❌ Salon DB Error:', dbError.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
