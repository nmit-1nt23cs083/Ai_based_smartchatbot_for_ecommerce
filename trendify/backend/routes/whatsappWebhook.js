'use strict';

const express = require('express');
const db = require('../db');
const { sendWhatsApp } = require('../services/whatsappService');

const router = express.Router();

/**
 * WhatsApp Webhook - Handle incoming messages and interactive button replies
 * Webhook URL: http://your-domain/api/whatsapp-webhook
 */

// GET hook for WhatsApp verification
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

// POST hook for incoming WhatsApp messages
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    // WhatsApp sends messages in a specific format
    if (body.object) {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const senderPhone = message.from; // Format: 91XXXXXXXXXX (without +)
        const messageText = message.text?.body || '';
        const messageType = message.type; // 'text', 'button', 'interactive', etc.

        console.log(`📨 [WhatsApp] From: ${senderPhone} | Type: ${messageType} | Text: ${messageText}`);

        // Handle interactive button replies
        if (message.interactive) {
          const buttonReply = message.interactive.button_reply;
          const buttonId = buttonReply?.id;
          const buttonTitle = buttonReply?.title;

          console.log(`🔘 [WhatsApp Interactive] Button ID: ${buttonId} | Title: ${buttonTitle}`);

          // Handle different button responses
          if (buttonId === 'cart_view') {
            // User wants to go to cart
            await sendWhatsApp(`+${senderPhone}`, '🛍️ Great! Visit your cart now: http://localhost:3000/cart.html\n\nUse code TREND20  for 20% off! 🎁');
          } else if (buttonId === 'shop_explore') {
            // User wants to explore shop
            await sendWhatsApp(`+${senderPhone}`, '✨ Explore our latest collections:\nhttp://localhost:3000/shop.html\n\nHappy shopping! 🛍️');
          } else if (buttonId === 'track_order') {
            // User wants to track order
            await sendWhatsApp(`+${senderPhone}`, '📦 Track your order here:\nhttp://localhost:3000/orders.html\n\nStay updated! 👀');
          } else if (buttonId === 'back_to_shop') {
            // User wants to continue shopping
            await sendWhatsApp(`+${senderPhone}`, '🏪 Back to shopping:\nhttp://localhost:3000/shop.html\n\nFinding more deals! 💰');
          }
        } else if (messageType === 'text') {
          // Handle text message replies
          const text = messageText.toLowerCase().trim();

          console.log(`💬 [WhatsApp Text] Message: "${text}"`);

          // Simple keyword matching for interactive demo
          if (text === '1' || text === '1️⃣' || text.includes('cart')) {
            await sendWhatsApp(`+${senderPhone}`, '🛍️ Taking you to your cart...\n\nhttp://localhost:3000/cart.html\n\nUse code SAVE30 for 30% off! 🎉');
          } else if (text === '2' || text === '2️⃣' || text.includes('explore') || text.includes('shop')) {
            await sendWhatsApp(`+${senderPhone}`, '✨ Explore our amazing collections:\n\nhttp://localhost:3000/shop.html\n\nFresh arrivals added today! 🆕');
          } else if (text === '3' || text === '3️⃣' || text.includes('track') || text.includes('order')) {
            await sendWhatsApp(`+${senderPhone}`, '📦 Track your order:\n\nhttp://localhost:3000/orders.html\n\nGet real-time updates! 📲');
          } else if (text === 'hello' || text === 'hi' || text === 'help') {
            // Send menu/help
            await sendWhatsApp(`+${senderPhone}`, `👋 Welcome to Trendify!\n\nReply with:\n1️⃣ - Go to Cart\n2️⃣ - Explore Shop\n3️⃣ - Track Order\n\n📞 How can we help?`);
          } else {
            // Default fallback response
            await sendWhatsApp(`+${senderPhone}`, `👋 Thanks for your message!\n\nReply:\n1️⃣ - Cart\n2️⃣ - Shop\n3️⃣ - Orders\n\nOr type "help" for more options 💬`);
          }
        }

        // Always return 200 OK to WhatsApp so it doesn't retry
        res.status(200).json({ success: true });
      } else {
        res.status(200).json({ success: true }); // Acknowledge receipt
      }
    } else {
      res.status(400).json({ error: 'Invalid payload' });
    }
  } catch (error) {
    console.error('❌ WhatsApp Webhook Error:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Manual trigger for WhatsApp product recommendation (Demo feature)
 * POST /api/whatsapp-webhook/send-product-demo
 */
router.post('/send-product-demo', async (req, res) => {
  try {
    const { phone, productName, price } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const message = `🛍 Trendify Offer\n\n📦 Product: ${productName || 'Premium Item'}\n💰 Price: ₹${price || '999'}\n\n*Reply:*\n1️⃣ → Buy Now\n2️⃣ → View Product`;

    await sendWhatsApp(phone, message);

    console.log(`📤 [Demo] Product recommendation sent to ${phone}`);
    res.json({ success: true, message: 'Product recommendation sent!' });
  } catch (error) {
    console.error('❌ Demo Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
