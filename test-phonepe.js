
const axios = require('axios');
const crypto = require('crypto');

// Config from .env (hardcoded here to verify stand-alone)
const MERCHANT_ID = 'PGTESTPAYUAT86';
const SALT_KEY = '96434309-7796-489d-8924-ab56988a6076';
const SALT_INDEX = '1';
const HOST_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox';

async function testPayment() {
    console.log('Testing PhonePe Connection...');

    const merchantTransactionId = 'TEST' + Date.now();
    const payload = {
        merchantId: MERCHANT_ID,
        merchantTransactionId: merchantTransactionId,
        merchantUserId: 'TEST_USER',
        amount: 10000, // 100 INR
        redirectUrl: 'http://localhost:5000/callback',
        redirectMode: 'POST',
        callbackUrl: 'http://localhost:5000/callback',
        mobileNumber: '9999999999',
        paymentInstrument: {
            type: 'PAY_PAGE'
        }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + SALT_KEY;
    const sha256 = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = `${sha256}###${SALT_INDEX}`;

    try {
        const response = await axios.post(
            `${HOST_URL}/pg/v1/pay`,
            { request: base64Payload },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-VERIFY': xVerify,
                },
            }
        );

        console.log('✅ SUCCESS! PhonePe API responded.');
        console.log('Payment URL:', response.data.data.instrumentResponse.redirectInfo.url);
        return true;
    } catch (error) {
        console.error('❌ FAILED! Could not connect to PhonePe.');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
        return false;
    }
}

testPayment();
