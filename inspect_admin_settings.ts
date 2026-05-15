
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const targetAdminId = '70f5c9f3-c418-4bba-8182-00d1355dbbbe';
    console.log(`__START_CONFIG__`);

    const settings = await (prisma as any).settings.findUnique({
        where: { adminId: targetAdminId },
        select: { apiIntegrations: true }
    });

    if (!settings) {
        console.log('NO_SETTINGS');
        return;
    }

    let integrations = settings.apiIntegrations;
    if (typeof integrations === 'string') {
        try { integrations = JSON.parse(integrations); } catch (e) { }
    }

    if (Array.isArray(integrations)) {
        const wa = integrations.find((i: any) => i.type === 'whatsapp');
        if (wa) {
            // Log as single line to avoid buffering issues/formatting truncations
            console.log(JSON.stringify(wa));
        } else {
            console.log('NO_WA_CONFIG');
        }
    } else {
        console.log('INTEGRATIONS_NOT_ARRAY');
    }
    console.log(`__END_CONFIG__`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
