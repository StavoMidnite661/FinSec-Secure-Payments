# 🚀 FinSec Integrated - Live Testing Setup

## ✅ Current Status

**Backend**: ✅ Running on port 3000 with Polygon mainnet integration
**Blockchain**: ✅ Connected to live Polygon mainnet (block 77471249+)
**Extension**: ✅ Ready for ngrok URL configuration

## 🔧 Quick Setup for Live Testing

### 1. Get Ngrok URL
```bash
# In terminal, run:
ngrok http 3000

# Copy the https://xxxx.ngrok.io URL
# This is your live backend URL
```

### 2. Update Extension Configuration
Edit `extension/background.js` and replace:
```javascript
// REPLACE THESE TWO LINES:
const POLY_URL = "ws://localhost:3000";
const backendResponse = await fetch(`http://localhost:3000/api/payment/initiate`, {

// WITH YOUR NGROK URL:
const POLY_URL = "ws://YOUR_NGROK_URL";  // e.g., "ws://abc123.ngrok.io"
const backendResponse = await fetch(`https://YOUR_NGROK_URL/api/payment/initiate`, {
```

### 3. Load Extension
1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and choose: `extension/`
4. Pin **FinSec Secure Payments** extension

## 🧪 Testing Workflow

### Phase 1: Basic Connectivity Test
1. **Health Check**: Visit `https://YOUR_NGROK_URL/` in browser
   - Expected: "SOVR Credit Bridge Backend is running!"

2. **Extension Connection**: Open extension popup
   - Click "Log In" (uses Google OAuth)
   - Should authenticate successfully

### Phase 2: Payment Flow Test
1. **Visit Test Merchant**: Go to any supported merchant site
   - Extension should detect checkout page
   - Popup should show payment details

2. **Initiate Payment**: Click "Pay Now" in extension
   - Should call backend API
   - Backend processes Stripe payment intent

3. **Blockchain Integration**: Backend burns SOVR tokens on Polygon
   - Monitor terminal for blockchain events
   - Check Stripe dashboard for payment status

### Phase 3: Webhook Verification
1. **Stripe Webhook**: Configure webhook endpoint in Stripe dashboard
   - URL: `https://YOUR_NGROK_URL/api/webhook/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

2. **Test Webhook**: Complete a test payment
   - Should trigger blockchain token burning
   - Monitor backend logs for webhook events

## 🔑 Required Credentials

### Stripe (in `backend/.env`)
```env
STRIPE_SECRET_KEY=sk_test_your_actual_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Blockchain (in `backend/.env`)
```env
SOVR_TOKEN_ADDRESS=0x_your_contract_address
HONOR_VAULT_ADDRESS=0x_your_vault_address
```

## 🛠️ Troubleshooting

### Backend Issues
- **Blockchain RPC errors**: Normal for testing - backend continues without blockchain
- **Stripe errors**: Check API keys in `.env` file
- **Port conflicts**: Ensure port 3000 is available

### Extension Issues
- **CORS errors**: Update ngrok URLs in `background.js`
- **OAuth failures**: Check Google OAuth credentials in `manifest.json`
- **Content script not loading**: Check merchant URL patterns in `manifest.json`

### Network Issues
- **ngrok tunnel down**: Restart ngrok and update extension URLs
- **Firewall blocking**: Allow ngrok ports in firewall settings

## 📊 Monitoring

### Backend Logs
- **Blockchain events**: Monitor for "TokensBurned" events
- **Payment processing**: Watch for Stripe payment intent creation
- **Webhook handling**: Check for incoming webhook events

### Extension Logs
- Open `chrome://extensions`
- Click "Service Worker" link under FinSec extension
- Monitor console for connection and payment status

## 🚨 Security Notes

- **ngrok URLs are temporary** - Generate new ones for each testing session
- **API keys exposed** - Never commit real credentials to version control
- **CORS configuration** - Update CSP in `manifest.json` for production domains

## 🎯 Next Steps

1. **Complete initial payment test** with small amount
2. **Verify blockchain integration** - confirm tokens are burned
3. **Test error scenarios** - failed payments, network issues
4. **Performance testing** - multiple concurrent payments
5. **Security audit** - review logs for vulnerabilities

## 📞 Support

- **Backend logs**: Check terminal output for errors
- **Extension logs**: Use Chrome DevTools on extension pages
- **Blockchain explorer**: Monitor Polygon transactions at polygonscan.com
- **Stripe dashboard**: Monitor payments and webhooks

---

**Ready for live testing! 🚀**
Your FinSec Integrated system is configured with:
- ✅ Live Polygon mainnet integration
- ✅ Stripe payment processing
- ✅ Chrome extension with OAuth
- ✅ Real-time WebSocket communication
- ✅ Comprehensive error handling