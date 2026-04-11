'use strict';

require('dotenv').config();
const twilio = require('twilio');

// Initialize Twilio client only if credentials are properly configured
let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
    process.env.TWILIO_AUTH_TOKEN.length > 20) {
  try {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  } catch (error) {
    console.warn('Twilio initialization failed:', error.message);
  }
}

const activeTimers = new Map();
const callMade = new Map();
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// ── Read real user behavior from database ─────────────────────────────────────
function getUserBehavior(db, userId) {
  try {
    const searches = db.prepare(`
      SELECT DISTINCT target_name as query
      FROM user_traces
      WHERE user_id = ? AND action = 'search' AND target_name IS NOT NULL
      ORDER BY created_at DESC LIMIT 3
    `).all(userId);

    const cartItems = db.prepare(`
      SELECT p.id as product_id, p.name, p.price, p.stock,
             cat.name as category
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE c.user_id = ?
    `).all(userId);

    const wishlistItems = db.prepare(`
      SELECT p.id as product_id, p.name, p.price,
             cat.name as category
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE w.user_id = ?
    `).all(userId);

    const pastOrders = db.prepare(`
      SELECT oi.product_name, cat.name as category, p.id as product_id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC LIMIT 5
    `).all(userId);

    return { searches, cartItems, wishlistItems, pastOrders };
  } catch (err) {
    console.error('[DB] Error reading behavior:', err.message);
    return { searches: [], cartItems: [], wishlistItems: [], pastOrders: [] };
  }
}

// ── Get similar products from database ───────────────────────────────────────
function getSimilarProducts(db, categoryLike, excludeIds = []) {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.name, p.price, cat.name as category
      FROM products p
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE LOWER(cat.name) LIKE LOWER(?)
        AND p.active = 1
        AND p.id NOT IN (${excludeIds.length ? excludeIds.map(() => '?').join(',') : '0'})
      ORDER BY p.rating DESC
      LIMIT 2
    `).all(categoryLike, ...excludeIds);
    return rows;
  } catch (err) {
    console.error('[DB] Similar products error:', err.message);
    return [];
  }
}

// ── Call Groq AI ──────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userPrompt) {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.9
      })
    });

    if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
    const result = await response.json();
    return result.choices[0].message.content.trim();
  } catch (err) {
    console.error('[Groq] Failed:', err.message);
    throw err;
  }
}

// ── Send Telegram message WITH inline keyboard buttons ────────────────────────
// buttons format: [ [ {text, url}, {text, url} ], [ {text, url} ] ]
// Each inner array = one row of buttons
async function sendTelegram(text, buttons = null) {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const body = {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true
    };

    // Skip buttons for localhost - Telegram will auto-linkify URLs in text
    const isLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
    
    if (buttons && buttons.length > 0 && !isLocalhost) {
      // Only include buttons with valid https URLs (production only)
      const safeButtons = buttons
        .map(row => row.filter(btn => btn.url && btn.url.startsWith('https')))
        .filter(row => row.length > 0);

      if (safeButtons.length > 0) {
        body.reply_markup = { inline_keyboard: safeButtons };
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.ok) console.log('[Telegram] ✅ Message sent!');
    else console.error('[Telegram] ❌ Error:', data.description);
  } catch (err) {
    console.error('[Telegram] ❌ Failed:', err.message);
  }
}


// ── Twilio voice call — ONLY after order, ONLY once ──────────────────────────
async function sendVoiceCall(userId, voiceScript) {
  if (callMade.get(userId)) {
    console.log(`[Voice] ⏭️  Already called user ${userId}`);
    return;
  }

  if (!twilioClient) {
    console.log('[Voice] ⏭️  Skipped - Twilio not configured');
    return;
  }

  try {
    const phoneNumber = process.env.USER_PHONE_NUMBER;
    if (!phoneNumber) {
      console.error('[Voice] ❌ USER_PHONE_NUMBER not set in .env');
      return;
    }

    const clean = voiceScript
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[^\x00-\x7F]/g, '')
      .trim();

    const twiml = `<Response>
      <Say voice="alice" language="en-IN" rate="90%">${clean}</Say>
    </Response>`;

    const call = await twilioClient.calls.create({
      twiml,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    callMade.set(userId, true);
    setTimeout(() => callMade.delete(userId), 60 * 60 * 1000);
    console.log(`[Voice] ✅ Call started! SID: ${call.sid}`);
  } catch (err) {
    console.error('[Voice] ❌ Call failed:', err.message);
  }
}

// ── Generate 2 messages: short offer + excited longer ────────────────────────
async function generateTwoMessages(type, data) {
  const system = 'You are a stylish enthusiastic Trendify fashion assistant. Write natural exciting human messages. Never say cart reminder or wishlist reminder. Sound like a friend texting.';

  try {
    let shortPrompt = '';
    let longPrompt = '';

    if (type === 'cart') {
      const name = data.products[0];
      shortPrompt = `Write ONE very short punchy message (1 sentence) about "${name}" still being available with 10% OFF. Add one emoji. No quotes.`;
      longPrompt = `Write an excited 3-sentence message to someone who was looking at "${name}". Make them feel they absolutely need it. Mention exact product name. Add 2 emojis. Sound like a stylish friend. No quotes.`;
    } else if (type === 'search') {
      const q = data.query;
      shortPrompt = `Write ONE short punchy message (1 sentence) offering 15% off on "${q}" items. Add one emoji. No quotes.`;
      longPrompt = `Write an excited 3-sentence message to someone searching for "${q}". Sound like a fashion-savvy friend. Mention "${q}". Add 2 emojis. No quotes.`;
    } else if (type === 'wishlist') {
      const name = data.product;
      shortPrompt = `Write ONE very short message (1 sentence) saying "${name}" just went on special sale. Add fire emoji. No quotes.`;
      longPrompt = `Write an excited 3-sentence message to someone who saved "${name}" to wishlist. Tell them it is the perfect time to get it. Add 2 emojis. No quotes.`;
    }

    const [shortMsg, longMsg] = await Promise.all([
      callGroq(system, shortPrompt),
      callGroq(system, longPrompt)
    ]);

    return { shortMsg, longMsg };
  } catch (err) {
    console.error('[AI] generateTwoMessages failed:', err.message);
    const name = data.products ? data.products[0] : data.product || data.query || 'this item';
    return {
      shortMsg: `✨ ${name} is still yours for 10% OFF! Do not miss it 🛒`,
      longMsg: `${name} is genuinely one of our best pieces right now 😍 It has been waiting for you and we do not want you to miss out. Grab it today before it sells out — you deserve it! 🔥`
    };
  }
}

// ── Generate order confirmation messages ──────────────────────────────────────
async function generateOrderMessages(productNames, userName) {
  const system = 'You are a warm celebratory Trendify fashion assistant. Write exciting order confirmation messages.';
  try {
    const names = productNames.join(', ');
    const telegramPrompt = `Write an excited 3-sentence order confirmation for ${userName || 'a customer'} who just ordered "${names}" from Trendify. Celebrate their great taste. Add 3 celebratory emojis. Sound warm and human. No quotes.`;
    const voicePrompt = `Write a short warm voice call script (2 sentences, no emojis) confirming order for "${names}". Start with "Hello" and end with "Thank you for shopping with Trendify". Keep it professional but warm.`;

    const [telegramMsg, voiceMsg] = await Promise.all([
      callGroq(system, telegramPrompt),
      callGroq(system, voicePrompt)
    ]);

    return { telegramMsg, voiceMsg };
  } catch (err) {
    console.error('[AI] Order message failed:', err.message);
    return {
      telegramMsg: `Woohoo ${userName}! Your order for ${productNames[0]} is confirmed! We are packing it with love right now ❤️ Get ready to slay in your new Trendify piece! 🛍️`,
      voiceMsg: `Hello! Your Trendify order for ${productNames[0]} has been confirmed and is being prepared. Thank you for shopping with Trendify.`
    };
  }
}

// ── Generate recommendation message ──────────────────────────────────────────
async function generateRecommendationMessage(category, similarProducts) {
  const system = 'You are a trendy Trendify fashion stylist. Write exciting product recommendation messages.';
  try {
    const names = similarProducts.map(p => p.name).join(' and ');
    const prompt = `Write an excited 2-sentence recommendation for ${names || category + ' items'} on Trendify. Sound like a stylist. Add 2 emojis. No quotes.`;
    return await callGroq(system, prompt);
  } catch (err) {
    return `Based on your amazing taste we think you will love our new ${category} arrivals! 🔥 Check them out before they sell out 🛍️`;
  }
}

// ── ONE-TIME: Search reminder — 1 min after search ───────────────────────────
function scheduleSearchReminder(userId, searchQuery, db) {
  const DELAY = 1 * 60 * 1000;
  const key = `search_${userId}`;
  if (activeTimers.has(key)) clearTimeout(activeTimers.get(key).timer);

  const timer = setTimeout(async () => {
    console.log(`\n🔍 [Search] Firing — user ${userId} — "${searchQuery}"`);
    try {
      const similar = db ? getSimilarProducts(db, `%${searchQuery}%`, []) : [];
      const { shortMsg, longMsg } = await generateTwoMessages('search', { query: searchQuery });

      // Message 1 — short offer with shop button
      await sendTelegram(
        `🔥 Hey, still thinking about ${searchQuery}?\n\n${shortMsg}\n\n⏰ Use code TREND15 for 15% OFF!`,
        [[{ text: `🔍 Browse ${searchQuery} →`, url: `${BASE_URL}/shop.html` }]]
      );

      await new Promise(r => setTimeout(r, 3000));

      // Message 2 — excited + similar product buttons
      const msg2Buttons = similar.map(p => ([
        { text: `✨ ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
      ]));
      msg2Buttons.push([{ text: '🛍️ View Full Store →', url: `${BASE_URL}/shop.html` }]);

      await sendTelegram(longMsg, msg2Buttons);

      activeTimers.delete(key);
      console.log('[Search] ✅ Both messages sent!\n');
    } catch (err) {
      console.error('[Search] Error:', err.message);
    }
  }, DELAY);

  activeTimers.set(key, { timer });
  console.log(`[Search] ⏱️  1 min timer — user ${userId} — "${searchQuery}"`);
}

// ── ONE-TIME: Cart reminder — 2 min after add to cart ────────────────────────
function scheduleCartReminder(userId, productName, db) {
  const DELAY = 2 * 60 * 1000;
  const key = `cart_${userId}`;

  if (activeTimers.has(key)) {
    const existing = activeTimers.get(key);
    clearTimeout(existing.timer);
    if (!existing.productNames.includes(productName)) {
      existing.productNames.push(productName);
    }
    existing.timer = setTimeout(() => fireCartReminder(userId, existing.productNames, db), DELAY);
    activeTimers.set(key, existing);
    console.log(`[Cart] ♻️  Reset — user ${userId} — added "${productName}"`);
  } else {
    const productNames = [productName];
    const timer = setTimeout(() => fireCartReminder(userId, productNames, db), DELAY);
    activeTimers.set(key, { timer, productNames });
    console.log(`[Cart] ⏱️  2 min timer — user ${userId} — "${productName}"`);
  }
}

async function fireCartReminder(userId, productNames, db) {
  console.log(`\n🛒 [Cart] Firing — user ${userId} — ${productNames.join(', ')}`);
  try {
    let similar = [];
    if (db) {
      const cartProduct = db.prepare(`
        SELECT p.id, cat.name as category
        FROM products p
        LEFT JOIN categories cat ON p.category_id = cat.id
        WHERE p.name = ? LIMIT 1
      `).get(productNames[0]);

      if (cartProduct) {
        similar = getSimilarProducts(db, `%${cartProduct.category}%`, [cartProduct.id]);
      }
    }

    const { shortMsg, longMsg } = await generateTwoMessages('cart', { products: productNames });

    // Message 1 — short offer with cart button
    await sendTelegram(
      `⚡ Quick! ${productNames[0]} is still waiting for you!\n\n${shortMsg}`,
      [[{ text: '🛒 Complete My Order →', url: `${BASE_URL}/cart.html` }]]
    );

    await new Promise(r => setTimeout(r, 3000));

    // Message 2 — excited + similar product buttons
    const msg2Buttons = similar.map(p => ([
      { text: `✨ ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
    ]));
    msg2Buttons.push([{ text: '🏪 View Full Store →', url: `${BASE_URL}/shop.html` }]);

    await sendTelegram(longMsg, msg2Buttons);

    activeTimers.delete(`cart_${userId}`);
    console.log('[Cart] ✅ Both messages sent!\n');
  } catch (err) {
    console.error('[Cart] Error:', err.message);
  }
}

// ── ONE-TIME: Wishlist reminder — 3 min after wishlist add ───────────────────
function scheduleWishlistReminder(userId, productName, db) {
  const DELAY = 3 * 60 * 1000;
  const key = `wishlist_${userId}_${productName}`;
  if (activeTimers.has(key)) return;

  const timer = setTimeout(async () => {
    console.log(`\n❤️  [Wishlist] Firing — user ${userId} — "${productName}"`);
    try {
      let similar = [];
      if (db) {
        const wProduct = db.prepare(`
          SELECT p.id, cat.name as category
          FROM products p
          LEFT JOIN categories cat ON p.category_id = cat.id
          WHERE p.name = ? LIMIT 1
        `).get(productName);

        if (wProduct) {
          similar = getSimilarProducts(db, `%${wProduct.category}%`, [wProduct.id]);
        }
      }

      const { shortMsg, longMsg } = await generateTwoMessages('wishlist', { product: productName });

      // Message 1 — short sale alert with product button
      await sendTelegram(
        `💖 Your saved item just got better!\n\n${shortMsg}`,
        [[{ text: `❤️ Get ${productName} Now →`, url: `${BASE_URL}/shop.html` }]]
      );

      await new Promise(r => setTimeout(r, 3000));

      // Message 2 — excited + similar product buttons
      const msg2Buttons = similar.map(p => ([
        { text: `🔥 ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
      ]));
      msg2Buttons.push([{ text: '💜 Browse More →', url: `${BASE_URL}/shop.html` }]);

      await sendTelegram(longMsg, msg2Buttons);

      activeTimers.delete(key);
      console.log('[Wishlist] ✅ Both messages sent!\n');
    } catch (err) {
      console.error('[Wishlist] Error:', err.message);
    }
  }, DELAY);

  activeTimers.set(key, { timer });
  console.log(`[Wishlist] ⏱️  3 min timer — user ${userId} — "${productName}"`);
}

// ── ORDER PLACED: Telegram + Voice call + Recommendation ─────────────────────
async function handleOrderPlaced(userId, productNames, category, db) {
  console.log(`\n🎉 [Order] Processing — user ${userId}`);
  cancelCartReminder(userId);

  let userName = 'Valued Customer';
  if (db) {
    try {
      const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
      if (user) userName = user.name;
    } catch (e) {}
  }

  try {
    const { telegramMsg, voiceMsg } = await generateOrderMessages(productNames, userName);

    // 1. Send Telegram order confirmation with Track Order + Shop More buttons
    await sendTelegram(
      `🎊 Order Confirmed, ${userName}!\n\n${telegramMsg}\n\n📦 Your order is being packed with love!`,
      [[
        { text: '📦 Track My Order →', url: `${BASE_URL}/orders.html` },
        { text: '🛍️ Shop More →', url: `${BASE_URL}/shop.html` }
      ]]
    );
    console.log('[Order] ✅ Telegram sent!');

    // 2. Voice call immediately
    console.log('[Order] 📞 Calling...');
    await sendVoiceCall(userId, voiceMsg);

    // 3. Send recommendation after 4 minutes
    setTimeout(async () => {
      console.log(`\n💡 [Recommendation] Firing — user ${userId}`);
      try {
        const similar = db ? getSimilarProducts(db, `%${category}%`, []) : [];
        const recMsg = await generateRecommendationMessage(category, similar);

        const recButtons = similar.map(p => ([
          { text: `✨ ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
        ]));
        recButtons.push([{ text: '🛍️ Browse All →', url: `${BASE_URL}/shop.html` }]);

        await sendTelegram(
          `Hey ${userName}, since you love ${category} — check these out! 👇\n\n${recMsg}`,
          recButtons
        );
        console.log('[Recommendation] ✅ Sent!\n');
      } catch (err) {
        console.error('[Recommendation] Error:', err.message);
      }
    }, 4 * 60 * 1000);

  } catch (err) {
    console.error('[Order] Error:', err.message);
  }
}

// ── Cancel cart timer when user orders ───────────────────────────────────────
function cancelCartReminder(userId) {
  const key = `cart_${userId}`;
  if (activeTimers.has(key)) {
    clearTimeout(activeTimers.get(key).timer);
    activeTimers.delete(key);
    console.log(`[Cart] ✅ Cancelled — user ${userId} ordered!`);
  }
}

// ── SHORT INTERVAL TRAINING SYSTEM ───────────────────────────────────────────
function startIntervalTraining(db) {
  console.log('\n🚀 [Interval Training] Started!');
  console.log('   → Cart scan:     every 2 minutes');
  console.log('   → Search scan:   every 3 minutes');
  console.log('   → Wishlist scan: every 5 minutes\n');

  // Every 2 min — cart abandonment
  setInterval(async () => {
    console.log('\n⏰ [2min] Cart scan...');
    try {
      const users = db.prepare(`
        SELECT DISTINCT c.user_id, u.name
        FROM cart c JOIN users u ON c.user_id = u.id
        WHERE u.role = 'user'
      `).all();

      for (const user of users) {
        const behavior = getUserBehavior(db, user.user_id);
        if (!behavior.cartItems.length) continue;

        const productNames = behavior.cartItems.map(i => i.name);
        const category = behavior.cartItems[0].category || 'fashion';
        const similar = getSimilarProducts(
          db, `%${category}%`,
          behavior.cartItems.map(i => i.product_id)
        );

        console.log(`[2min] → user ${user.user_id} (${user.name}) — ${productNames[0]}`);

        const { shortMsg, longMsg } = await generateTwoMessages('cart', { products: productNames });

        // Message 1
        await sendTelegram(
          `⚡ ${user.name}, ${productNames[0]} is still waiting!\n\n${shortMsg}`,
          [[{ text: '🛒 Go To My Cart →', url: `${BASE_URL}/cart.html` }]]
        );
        await new Promise(r => setTimeout(r, 3000));

        // Message 2 with similar product buttons
        const msg2Buttons = similar.map(p => ([
          { text: `✨ ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
        ]));
        msg2Buttons.push([{ text: '🏪 View Full Store →', url: `${BASE_URL}/shop.html` }]);
        await sendTelegram(longMsg, msg2Buttons);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[2min] Error:', err.message);
    }
  }, 2 * 60 * 1000);

  // Every 3 min — search without purchase
  setInterval(async () => {
    console.log('\n⏰ [3min] Search scan...');
    try {
      const users = db.prepare(`
        SELECT DISTINCT t.user_id, u.name, t.target_name as query
        FROM user_traces t
        JOIN users u ON t.user_id = u.id
        WHERE t.action = 'search'
          AND t.user_id IS NOT NULL
          AND t.target_name IS NOT NULL
          AND t.created_at >= datetime('now', '-3 hours')
          AND t.user_id NOT IN (
            SELECT DISTINCT user_id FROM orders
            WHERE created_at >= datetime('now', '-3 hours')
          )
        ORDER BY t.created_at DESC
      `).all();

      for (const user of users) {
        if (!user.query) continue;
        const similar = getSimilarProducts(db, `%${user.query}%`, []);

        console.log(`[3min] → user ${user.user_id} (${user.name}) — "${user.query}"`);

        const { shortMsg, longMsg } = await generateTwoMessages('search', { query: user.query });

        // Message 1
        await sendTelegram(
          `👀 ${user.name}, still thinking about ${user.query}?\n\n${shortMsg}\n\n⏰ Use code TREND15 for 15% OFF!`,
          [[{ text: `🔍 Find ${user.query} →`, url: `${BASE_URL}/shop.html` }]]
        );
        await new Promise(r => setTimeout(r, 3000));

        // Message 2 with similar product buttons
        const msg2Buttons = similar.map(p => ([
          { text: `👗 ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
        ]));
        msg2Buttons.push([{ text: '🛍️ Browse All →', url: `${BASE_URL}/shop.html` }]);
        await sendTelegram(longMsg, msg2Buttons);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[3min] Error:', err.message);
    }
  }, 3 * 60 * 1000);

  // Every 5 min — wishlist not purchased
  setInterval(async () => {
    console.log('\n⏰ [5min] Wishlist scan...');
    try {
      const users = db.prepare(`
        SELECT DISTINCT w.user_id, u.name, p.name as product_name,
               p.id as product_id, cat.name as category
        FROM wishlist w
        JOIN users u ON w.user_id = u.id
        JOIN products p ON w.product_id = p.id
        LEFT JOIN categories cat ON p.category_id = cat.id
        WHERE w.user_id NOT IN (
          SELECT DISTINCT o.user_id FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE oi.product_id = w.product_id
        )
      `).all();

      for (const user of users) {
        const similar = getSimilarProducts(db, `%${user.category}%`, [user.product_id]);

        console.log(`[5min] → user ${user.user_id} (${user.name}) — "${user.product_name}"`);

        const { shortMsg, longMsg } = await generateTwoMessages('wishlist', { product: user.product_name });

        // Message 1 with direct product button
        await sendTelegram(
          `💖 ${user.name}, your saved item is calling!\n\n${shortMsg}`,
          [[{ text: `❤️ View ${user.product_name} →`, url: `${BASE_URL}/product.html?id=${user.product_id}` }]]
        );
        await new Promise(r => setTimeout(r, 3000));

        // Message 2 with similar product buttons
        const msg2Buttons = similar.map(p => ([
          { text: `💜 ${p.name} — $${p.price}`, url: `${BASE_URL}/product.html?id=${p.id}` }
        ]));
        msg2Buttons.push([{ text: '🛍️ Browse All →', url: `${BASE_URL}/shop.html` }]);
        await sendTelegram(longMsg, msg2Buttons);
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error('[5min] Error:', err.message);
    }
  }, 5 * 60 * 1000);
}

// ── ORDER STATUS UPDATES: Send status-specific Telegram notifications ────────
async function handleOrderProcessing(userId, orderId, userName = 'Valued Customer') {
  try {
    console.log(`\n⏳ [Processing] Order #${orderId} for user ${userId}`);
    const message = `⏳ <b>Your Order #${orderId} is Being Processed!</b>

👋 Hi ${userName},

Thank you for your order! We're now carefully packaging your items with lots of love and care.

<b>📅 Timeline:</b>
✅ Order Confirmed
⏳ Processing (1-2 days)
📦 Dispatched
🚚 In Transit
✅ Delivered

<b>What's Next?</b>
• We're picking your items
• Packing with care
• Quality check
• Ready to ship!

⏱️ <b>Expected Time:</b> 24 hours

📬 You'll receive a shipping notification with tracking details soon!

Thank you for shopping with Trendify! 🛍️`;

    await sendTelegram(
      message,
      [[
        { text: '📋 View Full Order →', url: `${BASE_URL}/orders.html?id=${orderId}` },
        { text: '🛒 Continue Shopping →', url: `${BASE_URL}/shop.html` }
      ]]
    );
    console.log('[Processing] ✅ Telegram sent!');
  } catch (err) {
    console.error('[Processing] Error:', err.message);
  }
}

async function handleOrderShipped(userId, orderId, trackingNumber, userName = 'Valued Customer') {
  try {
    console.log(`\n📦 [Shipped] Order #${orderId} for user ${userId}`);
    const message = `📦 <b>Your Order #${orderId} Has Shipped!</b>

🚚 <b>It's on its way to you!</b>

Hi ${userName},

Great news! Your order has been dispatched and is now on its way!

<b>📍 Tracking Information:</b>
Tracking Number: <code>${trackingNumber}</code>

<b>📅 Delivery Timeline:</b>
✅ Order Confirmed
✅ Processing Complete
✅ Dispatched
🚚 In Transit (5-7 Business Days)
⏳ Delivery Coming Soon

<b>What to Expect:</b>
• Package is in transit
• Updates available 24/7
• Delivery within 5-7 business days
• Track your package anytime

<b>💡 Pro Tips:</b>
✓ Keep your tracking number handy
✓ Check updates regularly
✓ Ensure someone is home for delivery
✓ Contact support if issues arise

Thank you for shopping with Trendify! 🎉`;

    await sendTelegram(
      message,
      [[
        { text: '🚚 Track Shipment in Real-Time →', url: `${BASE_URL}/orders.html?id=${orderId}&track=true` },
        { text: '📦 View Order Details →', url: `${BASE_URL}/orders.html?id=${orderId}` },
        { text: '❓ Need Help? →', url: `${BASE_URL}/shop.html` }
      ]]
    );
    console.log('[Shipped] ✅ Telegram sent!');
  } catch (err) {
    console.error('[Shipped] Error:', err.message);
  }
}

async function handleOrderDelivered(userId, orderId, userName = 'Valued Customer') {
  try {
    console.log(`\n✅ [Delivered] Order #${orderId} for user ${userId}`);
    const message = `✅ <b>Your Order #${orderId} Has Been Delivered!</b>

🎉 <b>We hope you love your new items!</b>

Hi ${userName},

Your order has arrived! We're thrilled to know your package is now in your hands.

<b>📅 Delivery Complete:</b>
✅ Order Confirmed
✅ Processing Complete
✅ Dispatched
✅ In Transit
✅ Delivered!

<b>What Now?</b>
📦 Check your package
🎁 Unbox your items
✨ Enjoy your new style
⭐ Share your feedback

<b>📣 We'd LOVE Your Feedback!</b>
✓ How was your experience?
✓ Do you love the items?
✓ Any suggestions?
✓ Help us improve!

<b>🛍️ Ready for More?</b>
• Browse new collections
• Check out trending items
• Find complementary pieces
• Exclusive member deals

Thank you for choosing Trendify! Your support means everything. 💖

Questions? We're here to help!`;

    await sendTelegram(
      message,
      [[
        { text: '⭐ Rate Your Order →', url: `${BASE_URL}/orders.html?id=${orderId}&review=true` },
        { text: '💜 View Wishlist →', url: `${BASE_URL}/wishlist.html` },
        { text: '🛍️ Shop More →', url: `${BASE_URL}/shop.html` }
      ]]
    );
    console.log('[Delivered] ✅ Telegram sent!');
  } catch (err) {
    console.error('[Delivered] Error:', err.message);
  }
}

async function handleOrderCancelled(userId, orderId, reason = '', userName = 'Valued Customer') {
  try {
    console.log(`\n❌ [Cancelled] Order #${orderId} for user ${userId}`);
    const reasonText = reason ? `<b>Reason:</b> ${reason}\n\n` : '';
    const message = `❌ <b>Your Order #${orderId} Has Been Cancelled</b>

Hi ${userName},

We wanted to let you know that your order has been cancelled.

${reasonText}<b>📋 Cancellation Details:</b>
Order ID: #${orderId}
Status: Cancelled

<b>💰 Refund Information:</b>
✓ Your refund will be processed immediately
✓ Amount will be returned within 5-7 business days
✓ Check your account for updates

<b>❓ Why Was This Cancelled?</b>
If you didn't request this cancellation or have questions, please contact us right away!

<b>🤝 We're Here to Help!</b>
✓ Reach out to our support team
✓ Reorder the items if needed
✓ Explore similar products
✓ Get special discounts

<b>💳 Payment Note:</b>
The refund will go back to your original payment method. Please allow 5-7 business days to see it reflected.

We'd love another chance! Come back soon. 💙

Questions? Contact us anytime!`;

    await sendTelegram(
      message,
      [[
        { text: '📞 Contact Support →', url: `${BASE_URL}/shop.html` },
        { text: '🛍️ Continue Shopping →', url: `${BASE_URL}/shop.html` },
        { text: '❓ View FAQs →', url: `${BASE_URL}/shop.html` }
      ]]
    );
    console.log('[Cancelled] ✅ Telegram sent!');
  } catch (err) {
    console.error('[Cancelled] Error:', err.message);
  }
}

module.exports = {
  scheduleSearchReminder,
  scheduleCartReminder,
  scheduleWishlistReminder,
  handleOrderPlaced,
  handleOrderProcessing,
  handleOrderShipped,
  handleOrderDelivered,
  handleOrderCancelled,
  cancelCartReminder,
  startIntervalTraining,
  sendTelegram,
  sendVoiceCall
};
