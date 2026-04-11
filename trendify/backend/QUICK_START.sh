#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 TRENDIFY NOTIFICATION SYSTEM - QUICK START CHECKLIST
# ═══════════════════════════════════════════════════════════════════════════════

# This file provides step-by-step instructions to get notifications working

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "🔔 TRENDIFY NOTIFICATION SYSTEM - QUICK START"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 1: SETUP GMAIL CREDENTIALS
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 1️⃣  - SETUP EMAIL (Gmail)"
echo "─────────────────────────────────────────────────────────────────────────────"
echo "
1. Go to: https://myaccount.google.com/security
2. Enable 2-Step Verification (if not already done)
3. Go to: https://myaccount.google.com/apppasswords
4. Select: Mail + Windows Computer
5. Copy the 16-character password
6. Update /backend/.env:
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx  (paste 16-char password)
"
echo "✅ Gmail setup complete"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 2: SETUP TWILIO CREDENTIALS
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 2️⃣  - SETUP WHATSAPP (Twilio)"
echo "─────────────────────────────────────────────────────────────────────────────"
echo "
1. Go to: https://www.twilio.com/console
2. Navigate to: Messaging → WhatsApp Sandbox
3. Copy: Account SID
4. Copy: Auth Token
5. Update /backend/.env:
   TWILIO_SID=AC...
   TWILIO_AUTH_TOKEN=...
   WHATSAPP_VERIFY_TOKEN=trendify_secret_token
6. Join sandbox: Send 'join <code>' to Twilio sandbox number
"
echo "✅ Twilio setup complete"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 3: START SERVER
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 3️⃣  - START SERVER"
echo "─────────────────────────────────────────────────────────────────────────────"
echo "
Run these commands:
  cd backend
  node server.js

You should see:
  ✅ Email service ready for your-email@gmail.com
  ✅ Express server running on port 3000
"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 4: TEST ALL 9 EVENTS
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 4️⃣  - TEST NOTIFICATIONS"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""

# Event tracking
events_tested=0
total_events=9

echo "Test each event in order:"
echo ""

echo "1. REGISTER (event: register)"
echo "   ├─ Go to: http://localhost:3000/login.html"
echo "   ├─ Click: Create Account"
echo "   ├─ Enter: Name, email, password, phone (9-digit)"
echo "   ├─ Check: Email inbox (subject: ✨ Welcome to Trendify)"
echo "   └─ Check: WhatsApp (message: Welcome to Trendify, ${user.name}!)"
echo ""
((events_tested++))

echo "2. LOGIN (event: login_welcome)"
echo "   ├─ Go to: http://localhost:3000/login.html"
echo "   ├─ Login with existing account"
echo "   ├─ Check: Email inbox (subject: 👋 Welcome Back)"
echo "   └─ Check: WhatsApp (message: Welcome back)"
echo ""
((events_tested++))

echo "3. CART ADDED (event: cart_added)"
echo "   ├─ Go to: http://localhost:3000/shop.html"
echo "   ├─ Click: Add to Cart on any product"
echo "   ├─ Check: Email inbox (subject: 🛍 You Added Something)"
echo "   └─ Check: WhatsApp (immediate message about cart)"
echo ""
((events_tested++))

echo "4. CART REMINDER (event: cart_reminder)"
echo "   ├─ Wait: 3 minutes"
echo "   ├─ Check: Email inbox (subject: ⏰ Your Cart is Expiring)"
echo "   └─ Check: WhatsApp (message: Don't Miss Out! Save 30%)"
echo ""
((events_tested++))

echo "5. ORDER PLACED (event: order_placed)"
echo "   ├─ Go to: http://localhost:3000/cart.html"
echo "   ├─ Click: Checkout"
echo "   ├─ Fill shipping details"
echo "   ├─ Complete payment"
echo "   ├─ Check: Email inbox (subject: 🎉 Order Confirmed)"
echo "   └─ Check: WhatsApp (message: Order Confirmed! Items list)"
echo ""
((events_tested++))

echo "6. ORDER PROCESSING (event: order_processing)"
echo "   ├─ Go to: Admin Dashboard → Orders"
echo "   ├─ Click: Change Status → Processing"
echo "   ├─ Check: Email inbox (subject: ⚙️ Order is Being Processed)"
echo "   └─ Check: WhatsApp (message: Order is Processing)"
echo ""
((events_tested++))

echo "7. ORDER SHIPPED (event: order_shipped)"
echo "   ├─ Go to: Admin Dashboard → Orders"
echo "   ├─ Click: Change Status → Shipped"
echo "   ├─ Check: Email inbox (subject: 📦 Order Has Been Shipped)"
echo "   └─ Check: WhatsApp (message: Order Shipped! Tracking: TRN...)"
echo ""
((events_tested++))

echo "8. ORDER OUT FOR DELIVERY (event: order_out_of_delivery)"
echo "   ├─ Go to: Admin Dashboard → Orders"
echo "   ├─ Click: Change Status → Out For Delivery"
echo "   ├─ Check: Email inbox (subject: 🚚 Out For Delivery)"
echo "   └─ Check: WhatsApp (message: Out for Delivery Today!)"
echo ""
((events_tested++))

echo "9. ORDER DELIVERED (event: order_delivered)"
echo "   ├─ Go to: Admin Dashboard → Orders"
echo "   ├─ Click: Change Status → Delivered"
echo "   ├─ Check: Email inbox (subject: ✅ Order Delivered)"
echo "   └─ Check: WhatsApp (message: Delivered! Rate your experience)"
echo ""
((events_tested++))

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✅ TESTING SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "If you saw ALL messages on both Email and WhatsApp: ✅ SUCCESS!"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 5: WHAT EACH NOTIFICATION CONTAINS
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 5️⃣  - WHAT YOU RECEIVE"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "EMAIL (Beautiful HTML format):"
echo "  • Branded with Trendify gold/green colors"
echo "  • Product details and prices"
echo "  • Action buttons (links)"
echo "  • Professional layout"
echo ""
echo "WHATSAPP (Short text messages):"
echo "  • Emojis for clarity"
echo "  • Key details only"
echo "  • Action links"
echo "  • Mobile-optimized"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 6: DEBUG MODE
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 6️⃣  - MONITORING & DEBUGGING"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Watch console logs:"
echo "  cd backend && node server.js"
echo ""
echo "Look for logs like:"
echo "  [register] ✅ Email | ✅ WhatsApp | User: john@ex.com | Phone: +919876543210"
echo "  [order_placed] ✅ Email | ✅ WhatsApp | User: jane@ex.com | Phone: +919876543211"
echo ""
echo "Each log shows:"
echo "  • [event] - Which notification"
echo "  • ✅ Email - Email sent successfully"
echo "  • ✅ WhatsApp - WhatsApp sent successfully"
echo "  • User: - Customer email"
echo "  • Phone: - Customer phone (WhatsApp target)"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 7: TROUBLESHOOTING
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 7️⃣  - IF SOMETHING DOESN'T WORK"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Email not arriving?"
echo "  1. Check console for errors"
echo "  2. Verify EMAIL_USER and EMAIL_PASS in .env"
echo "  3. Generate new app password from myaccount.google.com/apppasswords"
echo "  4. Make sure junk/spam folder is checked"
echo ""
echo "WhatsApp not arriving?"
echo "  1. Check console for errors"
echo "  2. Verify TWILIO_SID and TWILIO_AUTH_TOKEN in .env"
echo "  3. Make sure you joined sandbox: send 'join <code>' to sandbox number"
echo "  4. Check phone format: must be +91XXXXXXXXXX"
echo ""
echo "Phone format issue?"
echo "  1. Register with: 9876543210 (10-digit Indian number)"
echo "  2. OR: +919876543210 (with country code)"
echo "  3. OR: 919876543210 (without +)"
echo "  4. System auto-converts all to: +919876543210"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# STEP 8: PRODUCTION DEPLOYMENT
# ───────────────────────────────────────────────────────────────────────────────

echo "STEP 8️⃣  - BEFORE GOING TO PRODUCTION"
echo "─────────────────────────────────────────────────────────────────────────────"
echo ""
echo "Checklist:"
echo "  □ Update .env with production credentials"
echo "  □ Test all 9 events with real users"
echo "  □ Setup Twilio production account (sandbox has limits)"
echo "  □ Configure webhook in Twilio: https://your-domain.com/api/whatsapp-webhook/webhook"
echo "  □ Setup rate limiting to prevent abuse"
echo "  □ Add error alerts (email/Slack)"
echo "  □ Monitor Twilio usage (charges apply)"
echo "  □ Keep audit logs of all notifications"
echo ""

# ───────────────────────────────────────────────────────────────────────────────
# FINAL
# ───────────────────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "You now have:"
echo "  ✅ 9 notification events"
echo "  ✅ Email + WhatsApp channels"
echo "  ✅ Auto cart reminders (3-min)"
echo "  ✅ Order status updates"
echo "  ✅ WhatsApp webhook support"
echo ""
echo "Documentation:"
echo "  📖 README_NOTIFICATIONS.md"
echo "  📖 NOTIFICATIONS_GUIDE.md"
echo "  📖 IMPLEMENTATION_EXAMPLES.js"
echo "  📖 IMPLEMENTATION_SUMMARY.md"
echo ""
echo "Next Steps:"
echo "  1. Start server: cd backend && node server.js"
echo "  2. Register a new user"
echo "  3. Check email + WhatsApp inbox"
echo "  4. Test other events"
echo ""
echo "Happy notifying! 🚀📧📱"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
