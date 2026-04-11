'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Trendify Chat Route  —  routes/chat.js
   Uses server-side product search and local response logic.
═══════════════════════════════════════════════════════════════════ */

const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Search products from DB for a given query string.
 * Returns up to 5 best matches across name, description, and category.
 */
function searchProducts(query) {
  const q = `%${query.trim().toLowerCase()}%`;
  return db.prepare(`
    SELECT p.id, p.name, p.price, p.original_price, p.rating,
           p.review_count, p.stock, p.description,
           c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND (
        LOWER(p.name)           LIKE ?
        OR LOWER(p.description) LIKE ?
        OR LOWER(c.name)        LIKE ?
      )
    ORDER BY p.featured DESC, p.rating DESC
    LIMIT 5
  `).all(q, q, q);
}

/**
 * Detect whether the user message is product-related so we can perform
 * a live product catalog search.
 */
function isProductRelated(message) {
  return /\b(product|item|style|price|cost|available|stock|show|find|search|buy|purchase|shop|recommend|suggest|dress|shirt|top|shoes?|boots?|sneakers?|heels?|bag|purse|jacket|jeans|coat|accessories|collection|outfit|fashion|cheap|affordable|discount|sale|gift|new arrival|best seller)\b/i
    .test(message);
}

// ── Route ───────────────────────────────────────────────────────────

// POST /api/chat
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const trimmed = message.trim().slice(0, 500);
    if (!trimmed) return res.status(400).json({ error: 'Message cannot be empty' });

    // ── Live product search injection ─────────────────────────────────
    let productResults = [];
    if (isProductRelated(trimmed)) {
      // Strip common filler phrases to get cleaner search terms
      const searchQuery = trimmed
        .replace(/\b(can you|please|what|show me|find|search for|do you have|i want|i need|looking for|any|got|get me|tell me about)\b/gi, '')
        .trim();
      productResults = searchProducts(searchQuery);
    }

    // ── Build a local reply from product search results ───────────────
    const replyText = buildReply(trimmed, productResults);

    // Return the text reply + matched product cards for frontend rendering
    res.json({
      reply: replyText,
      products: productResults.slice(0, 4).map(p => ({
        id: p.id,
        name: p.name,
        price: parseFloat(p.price).toFixed(2),
        original_price: p.original_price ? parseFloat(p.original_price).toFixed(2) : null,
        category: p.category_name,
        rating: p.rating,
        review_count: p.review_count,
        stock: p.stock,
        url: `/product.html?id=${p.id}`
      }))
    });

  } catch (err) {
    console.error('[Chat Route Error]', err.message || err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
