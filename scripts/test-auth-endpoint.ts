import axios from 'axios';

const AUTH_SERVICE_URL = 'https://authservice-salon-backend-1.onrender.com'; // Correct URL from config
const APP_NAME = 'workly-salon';
const TEST_EMAIL = 'mohan@gmail.com'; // Use a known existing email

async function testAuthEndpoint() {
    console.log(`🔍 Testing Auth Service Endpoint: ${AUTH_SERVICE_URL}`);
    console.log(`   Target: /auth/user/email/${TEST_EMAIL}`);

    try {
        const url = `${AUTH_SERVICE_URL}/auth/user/email/${encodeURIComponent(TEST_EMAIL)}`;
        console.log(`   Full URL: ${url}`);

        const response = await axios.get(url, {
            params: { app_id: APP_NAME }
        });

        console.log('✅ Response Status:', response.status);
        console.log('✅ Response Data:', JSON.stringify(response.data, null, 2));

    } catch (error: any) {
        console.error('❌ Request Failed:');
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Error:', error.message);
        }
    }
}

testAuthEndpoint();
