
import { serviceService } from '../src/services/service.service';
import prisma from '../src/prisma';

async function main() {
    // This AdminID has 3 services in the DB screenshot (sample, sa, sa)
    const targetAdminId = 'be9be1e7-f338-4c94-8887-4027928e1833';
    console.log(`🔍 Testing ServiceService for Admin: ${targetAdminId}`);

    try {
        const services = await serviceService.getAllServices(targetAdminId);
        console.log(`✅ Result: Found ${services.length} services.`);
        services.forEach(s => console.log(`   - ${s.name} (${s.id})`));
    } catch (e) {
        console.error('❌ ServiceService failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
