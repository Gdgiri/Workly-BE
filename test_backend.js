const axios = require('axios');

async function testBackend() {
    console.log('Testing Salon Backend (http://localhost:5000)...');
    try {
        // Test Root
        const start = Date.now();
        const res = await axios.get('http://localhost:5000/', { timeout: 5000 });
        const end = Date.now();
        console.log(`✅ Root Endpoint OK (${end - start}ms):`, res.data);

        // Test Settings Public (one of the failing endpoints)
        console.log('Testing Public Settings...');
        const res2 = await axios.get('http://localhost:5000/api/v1/settings/public', { timeout: 5000 });
        console.log('✅ Public Settings OK:', res2.status, res2.data ? 'Data received' : 'No data');

    } catch (error) {
        console.error('❌ Backend Test Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testBackend();
