# 🔔 Trendify AI-Driven Notification System

Complete email + WhatsApp notification system for e-commerce orders, user management, and cart reminders.

## 📋 System Overview

### 9 Notification Events Supported

| Event | Trigger | Channel | Use Case |
|-------|---------|---------|----------|
| `register` | User signs up | Email + WhatsApp | Welcome with 20% discount code |
| `login_welcome` | User logs in | Email + WhatsApp | Welcome back message |
| `cart_added` | Item added to cart | Email + WhatsApp | Nudge to complete purchase |
| `cart_reminder` | 3-minute reminder | Email + WhatsApp | Abandoned cart with 30% offer |
| `order_placed` | Checkout complete | Email + WhatsApp | Order confirmation with items |
| `order_processing` | Admin marks processing | Email + WhatsApp | Status: processing, ETA 1-2 days |
| `order_shipped` | Admin marks shipped | Email + WhatsApp | Tracking number + 5-7 day ETA |
| `order_out_of_delivery` | Admin marks out for delivery | Email + WhatsApp | Delivery today + tips |
| `order_delivered` | Admin marks delivered | Email + WhatsApp | Delivered + review request |

---

## 🎯 Architecture

```
┌─────────────────────────────────────────┐
│  Event Triggered (route)                │
├─────────────────────────────────────────┤
│  ↓ calls                                │
├─────────────────────────────────────────┤
│ sendSmartNotification(event, user, order)
├─────────────────────────────────────────┤
│  ├─ generateMessage() → {subject, html, whatsapp}
│  ├─ sendEmail() → Nodemailer/Gmail
│  └─ sendWhatsApp() → Twilio Sandbox
└─────────────────────────────────────────┘
```

### 📁 File Structure

```
backend/
├── services/
│   ├── aiService.js ..................... Message generator (email + WhatsApp)
│   ├── notificationService.js ........... Smart notification orchestrator
│   ├── emailService.js ................. Nodemailer wrapper
│   ├── whatsappService.js .............. Twilio wrapper
│   └── phoneFormatter.js ............... Phone number formatter (+91XXXXXXXXXX)
├── routes/
│   ├── auth.js ......................... Register + Login notifications
│   ├── cart.js ......................... Cart reminders  
│   ├── orders.js ....................... Order placement notifications
│   ├── admin.js ........................ Order status update notifications
│   └── whatsappWebhook.js .............. WhatsApp interactive webhook
└── server.js ........................... Route registration
```

---

## 🛠️ Setup & Configuration

### 1. Environment Variables (.env)

```env
# Email Configuration
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-char-app-password    # Generate at: https://myaccount.google.com/apppasswords

# WhatsApp Configuration
TWILIO_SID=AC...                        # From Twilio Console
TWILIO_AUTH_TOKEN=...                   # From Twilio Console
WHATSAPP_VERIFY_TOKEN=trendify_secret_token  # For webhook verification

# Server
PORT=3000
FRONTEND_URL=http://localhost:3000
```

### 2. Twilio Setup (WhatsApp Sandbox)

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Navigate to: **Messaging → WhatsApp Sandbox**
3. Copy your: `ACCOUNT SID` and `AUTH TOKEN`
4. Add to `.env`

### 3. Gmail App Password

1. Go to [Google Account](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Generate "App Password" for Mail
4. Use 16-character password in `.env`

---

## 📱 Usage Examples

### Example 1: Send Registration Welcome

**Location:** `/backend/routes/auth.js` (Already implemented)

```javascript
// User registration
const newUser = { id: 1, name: 'John', email: 'john@example.com', phone: '9876543210' };

// Trigger notification
sendSmartNotification('register', newUser).catch(err => {
  console.error('Failed to send:', err.message);
});

// Output:
// ✅ Email sent to john@example.com
// 📤 WhatsApp sent to +919876543210
// [register] ✅ Email | ✅ WhatsApp | User: john@example.com | Phone: 9876543210
```

---

### Example 2: Send Order Confirmation

**Location:** `/backend/routes/orders.js` (Already implemented)

```javascript
// After order placed
const order = { id: 123, total: 2500, status: 'pending' };
const user = { id: 1, name: 'John', email: 'john@example.com', phone: '9876543210' };
const cartItems = [
  { product_name: 'Premium Perfume', quantity: 1, price: 2500 },
  { product_name: 'Designer Watch', quantity: 1, price: 1500 }
];

sendSmartNotification('order_placed', user, order, cartItems).catch(err => {
  console.error('Failed:', err.message);
});

// Output:
// 📧 Email: Beautiful HTML with product details
// 📱 WhatsApp: "🎉 Order Confirmed! Order ID: #123. Total: ₹2500" + product list
```

---

### Example 3: Admin Triggers Order Status Update

**Location:** `/backend/routes/admin.js` (Already implemented)

```javascript
// When admin marks order as shipped
const order = { id: 123, user_id: 1 };
const user = { id: 1, name: 'John', email: 'john@example.com', phone: '9876543210' };

sendSmartNotification('order_shipped', user, order).catch(err => {
  console.error('Failed:', err.message);
});

// Output:
// 📧 Email: Shipped status + tracking number
// 📱 WhatsApp: "📦 Order Shipped! Tracking: TRN123ABC. ETA: 5-7 days"
```

---

### Example 4: Cart Reminder (Auto-scheduled)

**Location:** `/backend/routes/cart.js`

```javascript
const cartReminder = require('../services/notificationService');

// When user adds item to cart
cartReminder.scheduleCartReminder(userId, user, cartItems);

// After 3 minutes → Will automatically send:
// 📧 Email: Cart reminder with SAVE30 code
// 📱 WhatsApp: "⏰ Don't Miss Out! Save 30% with SAVE30"
```

---

## 🔗 WhatsApp Webhook Integration

### Setup Webhook URL

1. Go to Twilio Console → WhatsApp Sandbox Settings
2. Set **Webhook URL** to: `https://your-domain.com/api/whatsapp-webhook/webhook`
3. Set **Verify Token** to: `trendify_secret_token` (from .env)

### Webhook Endpoints

#### GET `/api/whatsapp-webhook/webhook`
- WhatsApp verification endpoint
- Used by Twilio to validate your webhook

#### POST `/api/whatsapp-webhook/webhook`
- Receive incoming WhatsApp messages
- Handle interactive button replies
- Send auto-responses

#### POST `/api/whatsapp-webhook/send-product-demo`
- Manual trigger for product recommendation demo
- Request body:
```json
{
  "phone": "+919876543210",
  "productName": "Premium Perfume",
  "price": "2500"
}
```

### Interactive Message Flow

```
User receives: "Reply 1 → Buy Now, 2 → View Product"
       ↓
User taps button 1
       ↓
Webhook receives: button_id = 'buy_now'
       ↓
Auto-response sent: "Taking you to checkout..."
```

---

## 📊 Logging & Debugging

### Console Output Format

```
[event_type] ✅ Email | ✅ WhatsApp | User: email@example.com | Phone: +919876543210
```

### Available Log Types

```javascript
// Success
console.log(`✅ Email sent`);
console.log(`✅ WhatsApp sent`);

// Warnings
console.warn(`⚠️ WhatsApp skipped - no phone`);
console.log(`📤 Attempting WhatsApp to: +919876543210`);

// Errors
console.error(`❌ Email failed: ${error}`);
console.error(`❌ Critical error: ${error}`);

// Info
console.log(`📨 WhatsApp message received from: 919876543210`);
console.log(`🔘 Interactive button clicked: buy_now`);
```

### Check Logs in Real-time

```bash
# Terminal
cd backend
node server.js

# Watch for messages like:
# [order_placed] ✅ Email | ✅ WhatsApp | User: john@example.com | Phone: 9876543210
```

---

## 🔐 Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Verify webhook token** - Twilio validates before sending
3. **Validate phone numbers** - Format check in `phoneFormatter.js`
4. **Rate limiting** - Consider adding on production
5. **Audit logs** - Log all notifications sent

---

## 📞 Phone Number Format

### Supported Formats (Auto-converted to +91XXXXXXXXXX)

```javascript
const { formatPhoneForWhatsApp } = require('./services/phoneFormatter');

// All these work:
formatPhoneForWhatsApp('9876543210')           // → +919876543210
formatPhoneForWhatsApp('919876543210')         // → +919876543210
formatPhoneForWhatsApp('+919876543210')        // → +919876543210
formatPhoneForWhatsApp('98-765-43210')         // → +919876543210
formatPhoneForWhatsApp('+91 98765-43210')      // → +919876543210

// Custom country code:
formatPhoneForWhatsApp('19876543210', '+1')    // → +119876543210 (USA)
```

---

## ✅ Testing Checklist

- [ ] User registers → receives welcome email + WhatsApp  
- [ ] User logs in → receives "welcome back" notification
- [ ] Item added to cart → receives immediate nudge
- [ ] Cart reminder fires (3 min) → receives special discount offer
- [ ] Order placed → receives confirmation with items list
- [ ] Admin marks processing → user gets update
- [ ] Admin marks shipped → user gets tracking number
- [ ] Admin marks out for delivery → user gets delivery tips
- [ ] Admin marks delivered → user gets review request
- [ ] WhatsApp webhook receives message → bot replies correctly
- [ ] Phone formats work for all variations

---

## 🚀 Deployment Notes

### Production Checklist

1. **Configure real Twilio account** (not sandbox)
2. **Update webhook URL** to production domain
3. **Add rate limiting** to prevent abuse
4. **Enable email logging** to database
5. **Setup error alerts** (email/Slack)
6. **Test with real numbers** before going live
7. **Monitor Twilio usage** (charges apply)

### Environment-Specific Setup

```javascript
// In production, might want:
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  console.log(`📲 Phone: ${formattedPhone}`); // Debug in dev
}
```

---

## 📞 API Reference

### sendSmartNotification()

```javascript
async function sendSmartNotification(event, user, order = null, cartItems = null)
```

**Parameters:**
- `event` (string): One of the 9 event types
- `user` (object): `{id, name, email, phone, country_code}`
- `order` (object, optional): `{id, total, status}`
- `cartItems` (array, optional): `[{product_name, quantity, price}]`

**Returns:**
- `true` if at least one channel succeeded
- `false` if both failed

**Example:**
```javascript
await sendSmartNotification('order_placed', user, order, cartItems);
```

---

## 🎨 Message Customization

### Edit EmailHTML

**File:** `/backend/services/aiService.js`
- Modify HTML templates in each `case` statement
- Colors: `#c9a96e` (gold), `#4caf82` (green), `#d64e4e` (red)

### Edit WhatsAppText

**File:** `/backend/services/aiService.js`
- Modify `whatsapp` field in message objects
- Keep it short (160-240 chars ideal)
- Use emojis for clarity

---

## ❓ Troubleshooting

### WhatsApp message not sending?

```javascript
// Check 1: Phone format
console.log(formatPhoneForWhatsApp(user.phone));

// Check 2: Twilio credentials
console.log(process.env.TWILIO_SID);

// Check 3: Sandbox number confirmed
// Go to Twilio → join sandbox with "join <code>"
```

### Email not sending?

```javascript
// Check 1: Gmail credentials
// Generate new app password: myaccount.google.com/apppasswords

// Check 2: 2FA enabled
// Settings → Security → 2-Step Verification

// Check 3: Less secure apps
// myaccount.google.com/lesssecureapps
```

### Webhook not receiving messages?

```javascript
// Check 1: Webhook URL configured in Twilio
// Check 2: Verify token matches .env
// Check 3: Make webhook URL public (ngrok for local dev)
```

---

## 📚 Additional Resources

- [Twilio WhatsApp API Docs](https://www.twilio.com/docs/whatsapp)
- [Nodemailer Gmail Setup](https://nodemailer.com/smtp/gmail/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

---

## 📝 Version History

- **v1.0** - Initial release with 9 event types
- **Features:** Email + WhatsApp dual channel, smart phone formatting, interactive webhooks

Happy notifying! 🚀
