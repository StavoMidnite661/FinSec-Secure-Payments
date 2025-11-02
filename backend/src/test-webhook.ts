
import * as crypto from 'crypto';
import * as http from 'http';

// 1. Define your webhook secret (replace with your actual secret)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_AMB1vvWOMVDD8oHWl7vYqbvxrar2SQPv'; // IMPORTANT: Replace with your actual secret

// 2. Define a mock payment_intent.succeeded event payload
const eventPayload = {
  id: 'evt_12345',
  object: 'event',
  api_version: '2020-08-27',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'pi_12345',
      object: 'payment_intent',
      amount: 2000,
      currency: 'usd',
      metadata: {
        complianceHash: 'cus_PabU52P1z633cM', // Using a valid test customer ID
        customerId: 'cus_PabU52P1z633cM', // Add a test customer ID
        payerAddress: '0xB1C73a24AB3B4Caa02C200b1A98C31329154F230' // Add a test payer address
      },
      status: 'succeeded',
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: {
    id: 'req_12345',
    idempotency_key: null,
  },
  type: 'payment_intent.succeeded',
};

const body = JSON.stringify(eventPayload, null, 2);

// 3. Create the Stripe signature
const timestamp = Math.floor(Date.now() / 1000);
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${body}`, 'utf8')
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

// 4. Define the request options
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhook/stripe',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': body.length,
    'stripe-signature': stripeSignature,
  },
};

// 5. Send the request
const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response Body:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(body);
req.end();

console.log('Sending test webhook event...');
