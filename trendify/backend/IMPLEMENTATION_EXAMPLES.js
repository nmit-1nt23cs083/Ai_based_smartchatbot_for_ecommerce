// ═══════════════════════════════════════════════════════════════════════════════
// 🔔 TRENDIFY NOTIFICATION SYSTEM - IMPLEMENTATION EXAMPLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * This file shows practical examples of how to use the notification system
 * in different parts of your backend application.
 */

// ───────────────────────────────────────────────────────────────────────────────
// 1️⃣  USER REGISTRATION (auth.js) - ALREADY DONE ✅
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/auth.js - POST /api/auth/register

const example1_registration = `
router.post('/register', (req, res) => {
  const { name, email, password, phone, countryCode } = req.body;
  
  // ... validation and hashing ...
  
  const newUser = {
    id: result.lastInsertRowid,
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone,
    country_code: countryCode || '+91',
    role: 'user'
  };

  // 🔔 SEND REGISTRATION WELCOME NOTIFICATION
  sendSmartNotification('register', newUser).catch(err => {
    console.error('Failed to send welcome email:', err.message);
  });

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: newUser
  });
});
`;

// Output:
// ✅ Email: Beautiful welcome with TREND20 code
// 📱 WhatsApp: "Welcome {{name}}! 20% OFF - TREND20"

// ───────────────────────────────────────────────────────────────────────────────
// 2️⃣  USER LOGIN (auth.js) - ALREADY DONE ✅
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/auth.js - POST /api/auth/login

const example2_login = `
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  // ... validation ...
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  
  // ... password check ...

  // 🔔 SEND LOGIN WELCOME NOTIFICATION
  sendSmartNotification('login_welcome', user).catch(err => {
    console.error('Failed to send login email:', err.message);
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});
`;

// Output:
// ✅ Email: Welcome back with personalized message
// 📱 WhatsApp: "Welcome back {{name}}! Check new collections"

// ───────────────────────────────────────────────────────────────────────────────
// 3️⃣  CART ITEM ADDED - EXAMPLE INTEGRATION
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/cart.js - POST /api/cart/add

const example3_cart_add = `
const { sendSmartNotification } = require('../services/notificationService');

router.post('/add', requireAuth, (req, res) => {
  const { product_id, quantity } = req.body;
  
  // ... add to cart logic ...
  
  // Get product and user details
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  
  // 🔔 SEND IMMEDIATE CART NOTIFICATION
  sendSmartNotification('cart_added', user).catch(err => {
    console.error('Failed to send cart email:', err.message);
  });

  res.json({ message: 'Item added to cart' });
});
`;

// Output:
// ✅ Email: Immediate nudge with TREND20 offer
// 📱 WhatsApp: "You added {{product}} to cart! 20% OFF - TREND20"

// ───────────────────────────────────────────────────────────────────────────────
// 4️⃣  CART REMINDER (3 minutes) - ALREADY IMPLEMENTED ✅
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/cart.js - Already scheduled automatically

const example4_cart_reminder = `
const { scheduleCartReminder, cancelCartReminder } = require('../services/notificationService');

// When checkout completes, reminder is cancelled:
cancelCartReminder(req.user.id);

// When item added to cart, reminder starts (fires after 3 minutes):
const cartItems = db.prepare('SELECT * FROM cart WHERE user_id = ?').all(req.user.id);
scheduleCartReminder(req.user.id, user, cartItems);

// ⏰ After 3 minutes → Automatic notification sent:
// Email: "Don't miss out! Save 30% with SAVE30"
// WhatsApp: "⏰ Don't Miss Out! Use SAVE30 for 30% OFF"
`;

// ───────────────────────────────────────────────────────────────────────────────
// 5️⃣  ORDER PLACED (Checkout) - ALREADY DONE ✅
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/orders.js - POST /api/orders/checkout

const example5_order_placed = `
const { sendSmartNotification, cancelCartReminder } = require('../services/notificationService');

router.post('/checkout', requireAuth, (req, res) => {
  const { shipping_name, shipping_email, shipping_address, ... } = req.body;
  
  // ... create order in database ...
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  
  // Cancel pending cart reminder
  cancelCartReminder(req.user.id);
  
  // 🔔 SEND ORDER CONFIRMATION WITH ITEMS LIST
  sendSmartNotification('order_placed', user, order, orderItems).catch(err => {
    console.error('Failed to send order email:', err.message);
  });

  res.json({
    message: 'Order placed successfully',
    order_id: orderId
  });
});
`;

// Output:
// ✅ Email: Order details with product list and timeline
// 📱 WhatsApp: "Order #123 Confirmed! Total: ₹2500. Items: Premium Perfume (1), Watch (1)"

// ───────────────────────────────────────────────────────────────────────────────
// 6️⃣  ORDER STATUS UPDATES (Admin) - ALREADY DONE ✅
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/admin.js - PUT /api/admin/orders/:id/status

const example6_order_status = `
const { sendSmartNotification } = require('../services/notificationService');

router.put('/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'shipped', 'out_of_delivery', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  // Update status
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  
  // Get user details
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
  
  // Map status to event type
  let eventType = null;
  switch (status) {
    case 'processing':
      eventType = 'order_processing';      // ⚙️ Processing
      break;
    case 'shipped':
      eventType = 'order_shipped';         // 📦 Shipped with tracking
      break;
    case 'out_of_delivery':
      eventType = 'order_out_of_delivery'; // 🚚 Out for delivery today
      break;
    case 'delivered':
      eventType = 'order_delivered';       // ✅ Delivered + review request
      break;
  }
  
  // 🔔 SEND STATUS UPDATE NOTIFICATION
  if (eventType) {
    sendSmartNotification(eventType, user, order).catch(err => {
      console.error(\`Failed to send \${eventType}:\`, err.message);
    });
  }
  
  res.json({ message: 'Order status updated' });
});
`;

// Output for each status change:
// Processing:
//   Email: "Order processing, ETA 1-2 days"
//   WhatsApp: "⚙️ Order Processing. We're packing it now!"
//
// Shipped:
//   Email: "Shipped with tracking TRN123ABC. ETA 5-7 days"
//   WhatsApp: "📦 Order Shipped! Track: TRN123ABC"
//
// Out for Delivery:
//   Email: "Out for delivery TODAY! Tips provided"
//   WhatsApp: "🚚 Out for Delivery Today! Keep phone accessible"
//
// Delivered:
//   Email: "Delivered successfully! Please review"
//   WhatsApp: "✅ Delivered! Rate your experience"

// ───────────────────────────────────────────────────────────────────────────────
// 7️⃣  WHATSAPP WEBHOOK - INTERACTIVE REPLIES
// ───────────────────────────────────────────────────────────────────────────────

// Location: /backend/routes/whatsappWebhook.js

const example7_webhook = `
// GET /api/whatsapp-webhook/webhook - Verification endpoint
router.get('/webhook', (req, res) => {
  const token = process.env.WHATSAPP_VERIFY_TOKEN || 'trendify_secret_token';
  const mode = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const verify_token = req.query['hub.verify_token'];

  if (mode && verify_token) {
    if (mode === 'subscribe' && verify_token === token) {
      console.log('✅ WhatsApp Webhook Verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// POST /api/whatsapp-webhook/webhook - Incoming messages
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const senderPhone = message.from;
      const messageText = message.text?.body || '';
      
      console.log(\`📨 From: \${senderPhone} | Text: \${messageText}\`);
      
      // Handle text replies
      if (messageText.toLowerCase() === '1' || messageText.includes('cart')) {
        // User wants to go to cart
        await sendWhatsApp(\`+\${senderPhone}\`, '🛍️ Going to cart now! Use SAVE30 for 30% off\');
      } else if (messageText.toLowerCase() === '2' || messageText.includes('shop')) {
        // User wants to explore shop
        await sendWhatsApp(\`+\${senderPhone}\`, '✨ Explore new collections: http://localhost:3000/shop.html\');
      }
      
      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('❌ Webhook Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
`;

// ───────────────────────────────────────────────────────────────────────────────
// 8️⃣  MANUAL PRODUCT RECOMMENDATION DEMO
// ───────────────────────────────────────────────────────────────────────────────

// Usage: POST /api/whatsapp-webhook/send-product-demo

const example8_product_demo = `
// Manual trigger for testing
// curl -X POST http://localhost:3000/api/whatsapp-webhook/send-product-demo \\
//   -H "Content-Type: application/json" \\
//   -d '{
//     "phone": "+919876543210",
//     "productName": "Premium Perfume",
//     "price": "2500"
//   }'

// Response:
// {
//   "success": true,
//   "message": "Product recommendation sent!"
// }

// User receives on WhatsApp:
// 🛍 Trendify Offer
// 📦 Product: Premium Perfume
// 💰 Price: ₹2500
// Reply: 1️⃣ → Buy Now, 2️⃣ → View Product
`;

// ───────────────────────────────────────────────────────────────────────────────
// 9️⃣  PHONE NUMBER FORMATTING
// ───────────────────────────────────────────────────────────────────────────────

const example9_phone_format = `
const { formatPhoneForWhatsApp } = require('../services/phoneFormatter');

// All these work - auto-converts to +91XXXXXXXXXX
formatPhoneForWhatsApp('9876543210');            // → +919876543210 ✓
formatPhoneForWhatsApp('919876543210');          // → +919876543210 ✓
formatPhoneForWhatsApp('+919876543210');         // → +919876543210 ✓
formatPhoneForWhatsApp('98-765-43210');          // → +919876543210 ✓
formatPhoneForWhatsApp('+91 98765-43210');       // → +919876543210 ✓

// Custom country codes
formatPhoneForWhatsApp('2125551234', '+1');      // → +12125551234 (USA)
formatPhoneForWhatsApp('7911123456', '+44');     // → +447911123456 (UK)
`;

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 QUICK START - INTEGRATION STEPS
// ═══════════════════════════════════════════════════════════════════════════════

const integrationSteps = `
1. Update .env with credentials:
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   TWILIO_SID=AC...
   TWILIO_AUTH_TOKEN=...
   WHATSAPP_VERIFY_TOKEN=trendify_secret_token

2. Import in routes:
   const { sendSmartNotification, cancelCartReminder, scheduleCartReminder } = require('../services/notificationService');

3. Call notifications:
   // Registration
   sendSmartNotification('register', newUser);
   
   // Order placed
   sendSmartNotification('order_placed', user, order, cartItems);
   
   // Order status
   sendSmartNotification('order_shipped', user, order);

4. Configure WhatsApp webhook (in Twilio Console):
   Webhook URL: https://your-domain/api/whatsapp-webhook/webhook
   Verify Token: trendify_secret_token

5. Test locally with ngrok:
   ngrok http 3000
   Use ngrok URL in Twilio webhook configuration

6. Monitor logs:
   [order_placed] ✅ Email | ✅ WhatsApp | User: john@example.com | Phone: 9876543210
`;

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ ALL IMPLEMENTED FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

const implementedFeatures = `
✅ 9 notification events (register, login, cart, orders, status updates)
✅ Dual channel (Email HTML + WhatsApp text)
✅ Smart phone formatting
✅ Auto cart reminders (3-minute scheduling)
✅ Order status workflow
✅ Interactive WhatsApp webhook
✅ Manual product recommendation demo
✅ Comprehensive error logging
✅ No preference checking (sends to all)
✅ Modular, scalable architecture
`;

module.exports = {
  example1_registration,
  example2_login,
  example3_cart_add,
  example4_cart_reminder,
  example5_order_placed,
  example6_order_status,
  example7_webhook,
  example8_product_demo,
  example9_phone_format,
  integrationSteps,
  implementedFeatures
};
