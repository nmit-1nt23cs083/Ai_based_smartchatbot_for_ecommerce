'use strict';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Generate multimodal messages for notifications (Email + WhatsApp)
 * Returns both HTML for email and text for WhatsApp
 */
async function generateMessage(event, user, order = null, cartItems = null) {
  try {
    switch (event) {
      case 'product_offer':
        return {
          subject: '🎁 Exclusive Offer Just For You!',
          whatsapp: `🎁 *TRENDIFY*
━━━━━━━━━━━━━━━

*Exclusive Offer!*

Hi ${user.name},

We have something special just for you!

━━━━━━━━━━━━━━━

*What would you like to do?*

1️⃣ *Buy Now*
2️⃣ *View Product*
3️⃣ *Cancel*

Reply with number!`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h2 style="color: #c9a96e; text-align: center;">🎁 Exclusive Offer!</h2><p>Hi ${user.name},</p><p>We have something special just for you!</p><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/shop.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">VIEW OFFER →</a></div></div></body></html>`
        };

      case 'cart_added':
        return {
          subject: '🛍 You Added Something Amazing to Your Cart!',
          whatsapp: `🛍 *TRENDIFY*
━━━━━━━━━━━━━━━

*Item Added!*

Hi ${user.name},

You just added something great to your cart!

━━━━━━━━━━━━━━━

🎁 *Special Offer:*
*20% OFF* - Code: TREND20

📦 Free shipping ₹4,565+

⏰ Complete checkout today!

🛒 Go to cart: ${FRONTEND_URL}/cart.html

Reply *1️⃣* to checkout!`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h2 style="color: #c9a96e; text-align: center;">🛍 Your Perfect Items Are Waiting!</h2><p>Hi ${user.name},</p><p>You just added something amazing to your cart! Don't forget to complete your checkout.</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0;"><p style="color: #c9a96e; font-weight: bold;">⏰ Complete your order within the next 24 hours to lock in your items!</p><p style="margin: 15px 0; color: #e2c48a;">✨ <strong>Exclusive Offer Just For You:</strong></p><ul style="color: #f0ece4; margin: 10px 0;"><li>🎁 <strong>TREND20</strong> - 20% OFF your first purchase</li><li>📦 FREE SHIPPING on orders over ₹4,565</li><li>💳 Easy checkout with multiple payment options</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="http://localhost:3000/cart.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">GO TO CART →</a></div>TRENDIFY</div></body></html>`
        };

      case 'order_placed':
        let productsHtml = '';
        let productsSummary = '';
        let productDetails = '';
        if (cartItems && cartItems.length > 0) {
          productsHtml = `<div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 15px 0;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">📦 Your Order Items:</p>${cartItems.map(item => `<div style="border-bottom: 1px solid #2e2b27; padding: 10px 0;"><p style="margin: 5px 0;"><strong>${item.product_name}</strong></p><p style="margin: 5px 0; color: #8a857c;">Qty: ${item.quantity} × ₹${item.price} = <strong style="color: #c9a96e;">₹${(item.quantity * item.price).toFixed(2)}</strong></p></div>`).join('')}<div style="border-top: 2px solid #c9a96e; padding-top: 10px; margin-top: 10px;"><p style="font-size: 18px; color: #c9a96e; font-weight: bold;">Total: ₹${order.total}</p></div></div>`;
          productsSummary = cartItems.slice(0, 2).map(item => `${item.product_name} (Qty: ${item.quantity})`).join(', ');
          productDetails = cartItems.map((item, idx) => `${idx + 1}. *${item.product_name}*\n   Qty: ${item.quantity} | Price: ₹${item.price}\n   Subtotal: ₹${(item.quantity * item.price).toFixed(2)}`).join('\n\n');
          if (cartItems.length > 2) productsSummary += ` +${cartItems.length - 2} more`;
        }
        return {
          subject: `🎉 Order Confirmed! #${order.id}`,
          whatsapp: `🎉 *TRENDIFY - ORDER CONFIRMATION*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ *YOUR ORDER IS CONFIRMED!* ✨

Hello *${user.name}*! 👋
Thank you for your amazing purchase!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 *ORDER DETAILS:*

🔢 Order ID: *#${order.id}*
📅 Date: ${new Date().toLocaleDateString('en-IN')}
⏰ Time: ${new Date().toLocaleTimeString('en-IN')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *ITEMS ORDERED:*

${productDetails}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *PRICE BREAKDOWN:*

💵 Subtotal: ₹${(order.total * 0.95).toFixed(2)}
🎁 Discount: ₹${(order.total * 0.05).toFixed(2)}
📦 Shipping: FREE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *TOTAL AMOUNT: ₹${order.total}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚚 *DELIVERY TIMELINE:*

✅ Order Confirmed (Today)
⚙️ Processing (24 hours)
📦 Dispatched (1-2 days)
🚚 In Transit (5-7 days)
🏠 Delivered (Expected within 7-10 days)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 *TRACK YOUR ORDER:*
🔗 ${FRONTEND_URL}/orders.html

❓ *NEED HELP?*
📧 Email: support@trendify.com
💬 Chat with us in the app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💌 We're packing your order with love! 📦💝

Happy Shopping! 🛍️
© 2026 Trendify`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #c9a96e; text-align: center;">🎉 Order Confirmed!</h1><p>Hi ${user.name},</p><p>Thank you for your order! We're excited to process it right away.</p><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="color: #8a857c; margin: 5px 0;">Order ID: <strong style="color: #c9a96e; font-size: 16px;">#${order.id}</strong></p><p style="color: #8a857c; margin: 5px 0;">Date: ${new Date().toLocaleDateString()}</p><p style="color: #8a857c; margin: 5px 0;">Status: <strong style="color: #4caf82;">PENDING</strong></p></div>${productsHtml}<div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c9a96e;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">📍 What Happens Next?</p><ol style="margin: 10px 0; color: #f0ece4;"><li>Order Confirmation Sent (Today)</li><li>Processing Complete (24 hours)</li><li>Dispatched 📦 (1-2 days)</li><li>In Transit 🚚 (5-7 days)</li><li>Delivered ✅</li></ol></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/orders.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">TRACK ORDER →</a></div></div></body></html>`
        };

      case 'cart_reminder':
      case 'cart_abandoned':
        let remindProducts = '';
        let cartSummary = '';
        let cartDetails = '';
        let cartTotal = 0;
        if (cartItems && cartItems.length > 0) {
          cartDetails = cartItems.map((item, idx) => `${idx + 1}. *${item.name || 'Product'}*\n   Price: ₹${item.price} | Qty: ${item.quantity}\n   Subtotal: ₹${(item.price * item.quantity).toFixed(2)}`).join('\n\n');
          cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          remindProducts = `<div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 15px 0;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">🛍 Items in Your Cart:</p>${cartItems.map(item => `<div style="border-bottom: 1px solid #2e2b27; padding: 10px 0;"><p style="margin: 5px 0;"><strong>${item.name || 'Product'}</strong></p><p style="margin: 5px 0; color: #8a857c;">₹${item.price} × ${item.quantity} = <strong style="color: #c9a96e;">₹${(item.price * item.quantity).toFixed(2)}</strong></p></div>`).join('')}</div>`;
          cartSummary = cartItems.slice(0, 2).map(item => `${item.name || 'Product'}`).join(', ');
          if (cartItems.length > 2) cartSummary += ` +${cartItems.length - 2} more`;
        }
        return {
          subject: '⏰ Your Cart is Expiring Soon! 🚨 Last Chance to Save 30%',
          whatsapp: `⏰ *TRENDIFY*
━━━━━━━━━━━━━━━

*Don't Miss Out!*

Hi ${user.name}, you left items in your cart!

🛍 *Your Items:*
${cartSummary || 'Cart items'}

━━━━━━━━━━━━━━━

🎁 *Exclusive Offer*
*30% OFF* on cart

*Code:* SAVE30

⏱️ Valid 24 hours only!

💳 Complete now: ${FRONTEND_URL}/cart.html

Reply *1️⃣* to checkout!`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h2 style="color: #d64e4e; text-align: center;">⏰ Don't Miss Out!</h2><p>Hi ${user.name},</p><p style="font-size: 16px; color: #c9a96e;"><strong>You left something amazing in your cart!</strong></p>${remindProducts}<div style="background: linear-gradient(135deg, #c9a96e, #e2c48a); padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;"><p style="color: #0f0e0d; font-weight: bold; font-size: 18px; margin: 10px 0;">🎁 EXCLUSIVE OFFER - 30% OFF</p><p style="color: #0f0e0d; font-size: 24px; font-weight: bold; margin: 10px 0;">Use Code: <strong>SAVE30</strong></p><p style="color: #0f0e0d; font-size: 12px; margin: 10px 0;">✨ Valid for next 24 hours only!</p></div><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf82;"><p style="color: #4caf82; font-weight: bold; margin-bottom: 10px;">✅ Why Shop With Us?</p><ul style="margin: 10px 0; color: #f0ece4; padding-left: 20px;"><li>📦 FREE SHIPPING on orders over ₹4,565</li><li>🔒 100% Secure Checkout</li><li>↩️ 30-Day Hassle-Free Returns</li><li>⭐ Trusted by 50,000+ Customers</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/cart.html" style="background: #d64e4e; color: #fff; padding: 15px 40px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">⚡ COMPLETE PURCHASE NOW ⚡</a></div></div></body></html>`
        };

      case 'order_shipped':
        const trackingNum = `TRN${order.id}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        return {
          subject: `📦 Your Order #${order.id} Has Been Shipped! 🚚`,
          whatsapp: `📦 *TRENDIFY*
━━━━━━━━━━━━━━━

*Order Shipped!*

*Order ID:* #${order.id}
✅ *Status:* SHIPPED

📍 *Tracking:* ${trackingNum}
⏳ *Delivery:* 5-7 days

━━━━━━━━━━━━━━━

🚚 On its way to you!

Track live: ${FRONTEND_URL}/orders.html`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #4caf82; text-align: center;">📦 On Its Way!</h1><p>Hi ${user.name},</p><p style="color: #4caf82; font-weight: bold;">Great news! Your order <strong>#${order.id}</strong> has been shipped and is on its way! 🚚</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf82;"><p style="color: #8a857c; margin: 5px 0;">Shipped Date: <strong style="color: #4caf82;">${new Date().toLocaleDateString()}</strong></p><p style="color: #8a857c; margin: 5px 0;">Estimated Delivery: <strong style="color: #4caf82;">5-7 Business Days</strong></p><p style="color: #8a857c; margin: 5px 0;">Tracking: <strong style="color: #c9a96e;">${trackingNum}</strong></p></div><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">📍 Timeline:</p><div style="color: #f0ece4;"><p style="margin: 10px 0;">✅ Confirmed ✅ Processed ✅ In Transit ⏳ Delivery</p></div></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/orders.html" style="background: #4caf82; color: #0f0e0d; padding:12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">TRACK SHIPMENT →</a></div></div></body></html>`
        };

      case 'register':
        return {
          subject: '✨ Welcome to Trendify - Your 20% Discount Awaits!',
          whatsapp: `✨ *TRENDIFY*
━━━━━━━━━━━━━━━

👋 Welcome, ${user.name}!

🎁 *SPECIAL WELCOME GIFT*
*20% OFF* on first purchase

*Code:* TREND20

━━━━━━━━━━━━━━━

📦 Free shipping on orders ₹4,565+
🔒 Secure checkout
↩️ 30-day returns

🛍 Shop now: ${FRONTEND_URL}/shop.html

Reply *1️⃣* to explore!`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #c9a96e; text-align: center;">✨ Welcome!</h1><p>Hi ${user.name},</p><p>Thank you for joining Trendify!</p><div style="background: linear-gradient(135deg, #c9a96e, #e2c48a); padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;"><p style="color: #0f0e0d; margin: 5px 0;">🎁 YOUR WELCOME GIFT</p><p style="color: #0f0e0d; font-size: 24px; font-weight: bold; margin: 10px 0;">20% OFF</p><p style="color: #0f0e0d; font-size: 18px; margin: 10px 0;">Code: <strong>TREND20</strong></p></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/shop.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">START SHOPPING →</a></div></div></body></html>`
        };

      case 'login_alert':
        return {
          subject: '🔐 Login Alert - Trendify Account',
          whatsapp: `🔐 *TRENDIFY*
━━━━━━━━━━━━━━━

*Unrecognized Login*

A login was detected at:
${new Date().toLocaleString()}

Was this you?

❌ *No?* Reset now:
${FRONTEND_URL}/login.html

━━━━━━━━━━━━━━━

Stay safe!`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h2 style="color: #d64e4e; text-align: center;">🔐 Login Detected</h2><p>Hi ${user.name},</p><p>A login was detected at ${new Date().toLocaleString()}</p><p style="color: #d64e4e; font-weight: bold;">If this wasn't you, secure your account now!</p><div style="text-align: center;"><a href="${FRONTEND_URL}/login.html" style="background: #d64e4e; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">RESET PASSWORD</a></div></div></body></html>`
        };

      case 'login_welcome':
        return {
          subject: '👋 Welcome Back to Trendify!',
          whatsapp: `👋 *TRENDIFY*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ *WELCOME BACK, ${user.name.toUpperCase()}!*

Great to see you again! We've missed your fabulous taste in fashion! 😊

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 *WHAT'S NEW:*

👗 *Trending This Season:*
  • Latest Designer Collections
  • Exclusive Luxury Arrivals 
  • Limited Edition Pieces
  • Seasonal Best Sellers

💰 *SPECIAL OFFERS WAITING:*
  🎁 Free Shipping on ₹4,565+
  ⏰ Limited Time Flash Sales
  ✨ Member Exclusive Deals

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 *QUICK LINKS:*

🛍️ BROWSE COLLECTIONS
${FRONTEND_URL}/shop.html

📦 YOUR ORDERS  
${FRONTEND_URL}/orders.html

❤️ SAVED WISHLIST
${FRONTEND_URL}/wishlist.html

🛒 YOUR CART
${FRONTEND_URL}/cart.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💌 Happy Shopping! 🛍️
© 2026 Trendify - Luxury Fashion Destination`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h2 style="color: #c9a96e; text-align: center;">👋 Welcome Back ${user.name}!</h2><p>Hi ${user.name},</p><p>Great to see you again! Your account is secure and ready to shop.</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;"><p style="color: #c9a96e; font-weight: bold; font-size: 18px;">✨ Explore New Collections</p><p style="color: #f0ece4; margin: 10px 0;">Check out our latest arrivals and exclusive deals!</p></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/shop.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">EXPLORE NOW →</a></div><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c9a96e;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">⭐ Quick Links:</p><ul style="margin: 10px 0; color: #f0ece4; padding-left: 20px;"><li><a href="${FRONTEND_URL}/orders.html" style="color: #c9a96e; text-decoration: none;">My Orders</a></li><li><a href="${FRONTEND_URL}/wishlist.html" style="color: #c9a96e; text-decoration: none;">Wishlist</a></li><li><a href="${FRONTEND_URL}/shop.html" style="color: #c9a96e; text-decoration: none;">Continue Shopping</a></li></ul></div><p style="color: #8a857c; font-size: 12px; text-align: center;">Happy shopping! 🛍</p></div></body></html>`
        };

      case 'order_processing':
        return {
          subject: `⚙️ Order #${order.id} is Being Processed`,
          whatsapp: `⚙️ *TRENDIFY*
━━━━━━━━━━━━━━━

*Processing Order*

*Order ID:* #${order.id}
*Status:* PROCESSING ✅

📦 Preparing for shipment
⏳ Ships in 1-2 days

━━━━━━━━━━━━━━━

Tracking info coming soon!

📍 Track: ${FRONTEND_URL}/orders.html`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #e2c48a; text-align: center;">⚙️ Processing Your Order</h1><p>Hi ${user.name},</p><p style="color: #e2c48a; font-weight: bold;">Your order <strong>#${order.id}</strong> is now being processed! We're preparing it for shipment.</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #e2c48a;"><p style="color: #8a857c; margin: 5px 0;">Expected Date: <strong style="color: #e2c48a;">1-2 Business Days</strong></p><p style="color: #8a857c; margin: 5px 0;">Status: <strong style="color: #e2c48a;">PROCESSING</strong></p><p style="color: #8a857c; margin: 10px 0; font-size: 12px;">You'll receive tracking details once it ships! 📦</p></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/orders.html" style="background: #e2c48a; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">VIEW ORDER →</a></div></div></body></html>`
        };

      case 'order_out_of_delivery':
        return {
          subject: `🚚 Order #${order.id} Out For Delivery!`,
          whatsapp: `🚚 *TRENDIFY*
━━━━━━━━━━━━━━━

*Out For Delivery!*

*Order ID:* #${order.id}
✅ *Status:* OUT FOR DELIVERY

📍 *Arriving TODAY!*

━━━━━━━━━━━━━━━

💡 *Tips:*
• Keep phone accessible
• Have ID ready
• Track for time window

Track: http://localhost:3000/orders.html`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #4caf82; text-align: center;">🚚 Out for Delivery!</h1><p>Hi ${user.name},</p><p style="color: #4caf82; font-weight: bold;">Your order <strong>#${order.id}</strong> is out for delivery today! 🎉</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf82;"><p style="color: #8a857c; margin: 5px 0;">Delivery Date: <strong style="color: #4caf82;">Today</strong></p><p style="color: #8a857c; margin: 5px 0;">Status: <strong style="color: #4caf82;">OUT FOR DELIVERY</strong></p><p style="color: #8a857c; margin: 10px 0; font-size: 12px;">Your package is on its way! Please ensure someone is available to receive it. 📍</p></div><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf82;"><p style="color: #4caf82; font-weight: bold; margin-bottom: 5px;">💡 Tips:</p><ul style="margin: 5px 0; color: #f0ece4; font-size: 12px; padding-left: 20px;"><li>Track real-time updates on your phone</li><li>Keep your phone accessible</li><li>Have your ID ready for verification</li></ul></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/orders.html" style="background: #4caf82; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">TRACK NOW →</a></div></div></body></html>`
        };

      case 'order_delivered':
        return {
          subject: `✅ Order #${order.id} Delivered!`,
          whatsapp: `✅ *TRENDIFY*
━━━━━━━━━━━━━━━

*Order Delivered!*

*Order ID:* #${order.id}
🎊 *Status:* DELIVERED

📅 ${new Date().toLocaleDateString()}

━━━━━━━━━━━━━━━

💬 *Rate Your Experience*

Leave review: ${FRONTEND_URL}/orders.html

🛍 Shop more: ${FRONTEND_URL}/shop.html

Thank you! 🛍`,
          html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family: Arial, sans-serif; background: #0f0e0d; color: #f0ece4; padding: 20px;"><div style="max-width: 600px; margin: 0 auto; background: #181714; padding: 30px; border-radius: 12px; border: 1px solid #2e2b27;"><h1 style="color: #4caf82; text-align: center;">✅ Delivered!</h1><p>Hi ${user.name},</p><p style="color: #4caf82; font-weight: bold;">Your order <strong>#${order.id}</strong> has been delivered successfully! 🎊</p><div style="background: #1e1c19; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf82;"><p style="color: #8a857c; margin: 5px 0;">Delivered Date: <strong style="color: #4caf82;">${new Date().toLocaleDateString()}</strong></p><p style="color: #8a857c; margin: 5px 0;">Status: <strong style="color: #4caf82;">DELIVERED</strong></p></div><div style="background: #1e1c19; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;"><p style="color: #c9a96e; font-weight: bold; margin-bottom: 10px;">💬 We'd Love Your Feedback!</p><p style="color: #f0ece4; margin: 10px 0; font-size: 14px;">Rate your experience and help us improve!</p></div><div style="text-align: center; margin: 30px 0;"><a href="${FRONTEND_URL}/orders.html" style="background: #4caf82; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: block; margin-bottom: 10px;">REVIEW → </a><a href="${FRONTEND_URL}/shop.html" style="background: #c9a96e; color: #0f0e0d; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: block;">SHOP MORE →</a></div></div></body></html>`
        };

      default:
        return {
          subject: 'Notification from Trendify',
          whatsapp: `✨ *TRENDIFY*
━━━━━━━━━━━━━━━

Thank you for using Trendify! 💝`,
          html: `<p>Thank you for using Trendify! 💝</p>`
        };
    }
  } catch (err) {
    console.error('AI message generation error:', err.message);
    return {
      subject: 'Notification from Trendify',
      html: `<p>Thank you for using Trendify! 💝</p>`
    };
  }
}

module.exports = { generateMessage };
