/* ─── AI Chatbot Route ─────────────────────────────────────────────────────────── */

'use strict';

const express = require('express');
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

function addUserPrefix(text, userName) {
  if (!userName) return text;
  return `Hey ${userName}, ${text}`;
}

function personalizeText(text, userName) {
  if (!userName) return text;
  return `Hey ${userName}, ${text}`;
}

function getUserFirstName(context = {}) {
  const name = context.user?.name || context.user?.email || '';
  return name ? name.split(' ')[0] : null;
}

function makeChatResponse({ summary, details = null, products = [], followUp = null, includeOffer = false }, userName = null) {
  userName = userName || makeChatResponse.currentUserName || null;
  summary = addUserPrefix(summary, userName);
  let response = { summary, details, products, followUp };

  // Randomly include an offer suggestion (30% chance) for non-offer queries
  if (includeOffer && Math.random() < 0.3) {
    const offerSuggestion = getRandomOfferSuggestion();
    if (offerSuggestion) {
      response.offerSuggestion = offerSuggestion;
    }
  }

  return response;
}

function searchProducts(query) {
  const normalized = `%${query.trim().toLowerCase()}%`;
  return db.prepare(`
    SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
           c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND (
        LOWER(p.name) LIKE ?
        OR LOWER(p.description) LIKE ?
        OR LOWER(c.name) LIKE ?
        OR LOWER(c.slug) LIKE ?
      )
    ORDER BY p.featured DESC, p.rating DESC, p.name ASC
    LIMIT 10
  `).all(normalized, normalized, normalized, normalized);
}

function searchProductsByPriceRange(minPrice, maxPrice) {
  return db.prepare(`
    SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
           c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND p.price >= ?
      AND p.price <= ?
    ORDER BY p.featured DESC, p.rating DESC, p.name ASC
    LIMIT 20
  `).all(minPrice, maxPrice);
}

function searchProductsOnOffer(limit = 10) {
  const offerProducts = db.prepare(`
    SELECT p.id, p.name, p.price, p.original_price, p.rating, p.featured,
           c.name as category_name, c.slug as category_slug,
           ROUND(((p.original_price - p.price) / p.original_price) * 100) as discount_percentage
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND p.original_price IS NOT NULL
      AND p.original_price > p.price
    ORDER BY discount_percentage DESC, p.featured DESC, p.rating DESC
    LIMIT ?
  `).all(limit);

  if (offerProducts.length === 0) {
    return db.prepare(`
      SELECT p.id, p.name, p.price, p.original_price, p.rating, p.featured,
             c.name as category_name, c.slug as category_slug,
             0 as discount_percentage
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1 AND p.featured = 1
      ORDER BY p.rating DESC, p.name ASC
      LIMIT ?
    `).all(limit);
  }

  return offerProducts;
}

function getRandomOfferSuggestion() {
  const offers = searchProductsOnOffer(3);
  if (offers.length === 0) return null;

  const randomOffer = offers[Math.floor(Math.random() * offers.length)];
  return {
    summary: `💡 By the way, this ${randomOffer.name} is currently on offer with ${Math.round(((randomOffer.original_price - randomOffer.price) / randomOffer.original_price) * 100)}% off!`,
    product: buildProductEntry(randomOffer)
  };
}

function searchProductsByCategory(categoryName) {
  return db.prepare(`
    SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
           c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND LOWER(c.name) = LOWER(?)
    ORDER BY p.featured DESC, p.rating DESC, p.name ASC
    LIMIT 20
  `).all(categoryName);
}

function searchProductsByCategoryAndPrice(categoryName, minPrice, maxPrice) {
  let priceCondition = '';
  let params = [categoryName];

  if (maxPrice !== null) {
    if (minPrice > 0) {
      priceCondition = 'AND p.price >= ? AND p.price <= ?';
      params.push(minPrice, maxPrice);
    } else {
      priceCondition = 'AND p.price <= ?';
      params.push(maxPrice);
    }
  } else if (minPrice > 0) {
    priceCondition = 'AND p.price >= ?';
    params.push(minPrice);
  }

  return db.prepare(`
    SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
           c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
      AND LOWER(c.name) = LOWER(?)
      ${priceCondition}
    ORDER BY p.featured DESC, p.rating DESC, p.name ASC
    LIMIT 20
  `).all(...params);
}

function getCategoryKeyword(query) {
  const keywords = {
    clothes: 'clothes',
    clothing: 'clothes',
    apparel: 'clothes',
    outfit: 'clothes',
    outfits: 'clothes',
    shirt: 'clothes',
    shirts: 'clothes',
    dress: 'clothes',
    dresses: 'clothes',
    jeans: 'clothes',
    jacket: 'clothes',
    jackets: 'clothes',
    coat: 'clothes',
    coats: 'clothes',
    footwear: 'footwear',
    shoe: 'footwear',
    shoes: 'footwear',
    sneaker: 'footwear',
    sneakers: 'footwear',
    boot: 'footwear',
    boots: 'footwear',
    sandal: 'footwear',
    sandals: 'footwear',
    bag: 'bags',
    bags: 'bags',
    jewelry: 'jewelry',
    jewellery: 'jewelry',
    necklace: 'jewelry',
    ring: 'jewelry',
    earrings: 'jewelry',
    perfume: 'perfume',
    fragrance: 'perfume',
    fragrances: 'perfume',
    cosmetics: 'cosmetics',
    makeup: 'cosmetics',
    watch: 'watches',
    watches: 'watches',
    glass: 'glasses',
    glasses: 'glasses',
    sunglasses: 'glasses'
  };

  const words = query.toLowerCase().match(/\b[\w']+\b/g) || [];
  for (const word of words) {
    if (keywords[word]) return keywords[word];
  }
  return null;
}

function buildProductEntry(product) {
  const discountPercentage = product.original_price && product.original_price > product.price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : null;

  return {
    id: product.id,
    name: product.name,
    price: parseFloat(product.price).toFixed(2),
    original_price: product.original_price ? parseFloat(product.original_price).toFixed(2) : null,
    discount_percentage: discountPercentage,
    category: product.category_name || 'Uncategorized',
    rating: product.rating || 'N/A',
    description: product.description ? product.description.trim().replace(/\s+/g, ' ').slice(0, 220) : 'No description available.',
    url: `/product.html?id=${product.id}`,
    on_offer: discountPercentage !== null
  };
}

function isProductQuery(message) {
  const query = message.toLowerCase();
  return /\b(product|item|style|details|price|available|stock|size|fit|color|colour|collection|search|find|clothes|clothing|dress|shirt|skirt|shorts|sweater|blouse|top|bag|shoes|sneaker|jacket|jeans|coat|purse|add|cart|basket|range|under|below|less than|offer|offers|discount|sale|deal|deals)\b/.test(query);
}

function isOrderQuery(message) {
  const query = message.toLowerCase();
  return /\b(order|orders|track|tracking|shipment|delivery|status|checkout|cart)\b/.test(query);
}

function generateAIResponse(message, context = {}) {
  const lowerMessage = message.toLowerCase();
  const user = context.user || null;
  const userName = getUserFirstName(context);
  const previousUserName = makeChatResponse.currentUserName || null;
  makeChatResponse.currentUserName = userName;

  try {
    const productContext = context.product || '';
    const targetQuery = message.trim() || productContext;
    const categoryKeyword = getCategoryKeyword(lowerMessage);

    // Extract price range from message
    const priceRangeMatch = lowerMessage.match(/price range (?:of )?(\d+)(?:\s*-\s*(\d+))?/i) ||
                           lowerMessage.match(/under (\d+)/i) ||
                           lowerMessage.match(/below (\d+)/i) ||
                           lowerMessage.match(/less than (\d+)/i) ||
                           lowerMessage.match(/(\d+)\s*-\s*(\d+)/i);

    let minPrice = 0;
    let maxPrice = null;

    if (priceRangeMatch) {
      if (priceRangeMatch[2]) {
        minPrice = parseFloat(priceRangeMatch[1]);
        maxPrice = parseFloat(priceRangeMatch[2]);
      } else if (lowerMessage.includes('under') || lowerMessage.includes('below') || lowerMessage.includes('less than')) {
        maxPrice = parseFloat(priceRangeMatch[1]);
      } else {
        maxPrice = parseFloat(priceRangeMatch[1]);
      }
    }

    // Handle category + price combination
    if (categoryKeyword && /\b(cloth|clothes|apparel|wardrobe|outfits|footwear|shoe|shoes|bag|bags|jewelry|jewellery|perfume|cosmetics|makeup|watch|watches|glass|glasses|sunglasses)\b/.test(lowerMessage)) {
      let matches;

      if (maxPrice !== null) {
        matches = searchProductsByCategoryAndPrice(categoryKeyword, minPrice, maxPrice);
      } else {
        matches = searchProductsByCategory(categoryKeyword);
      }

      if (matches.length === 0) {
        const priceText = maxPrice !== null ? ` in the price range ₹${minPrice} - ₹${maxPrice || 'unlimited'}` : '';
        return makeChatResponse({
          summary: `I could not find products for ${categoryKeyword}${priceText} right now.`,
          details: 'Try a different price range or browse the Shop page for more options.',
          followUp: 'What kind of item are you looking for next?'
        });
      }

      const productEntries = matches.map(buildProductEntry);
      const priceText = maxPrice !== null ? ` in the price range ₹${minPrice} - ₹${maxPrice || 'unlimited'}` : '';
      return makeChatResponse({
        summary: `I found ${matches.length} products in the ${categoryKeyword} category${priceText}.`,
        details: 'Here are the top matches from that category:',
        products: productEntries,
        followUp: 'Would you like me to narrow this to a specific style or brand?'
      });
    }

    // Handle just price range (no category)
    if (maxPrice !== null && !categoryKeyword) {
      const matches = searchProductsByPriceRange(minPrice, maxPrice || 999999);
      if (matches.length === 0) {
        return makeChatResponse({
          summary: `No products found in the price range ₹${minPrice} - ₹${maxPrice || 'unlimited'}.`,
          details: 'Try adjusting your price range or browse by category.',
          followUp: 'Would you like to search by category instead?'
        });
      }
      const productEntries = matches.map(buildProductEntry);
      return makeChatResponse({
        summary: `Great! I found ${matches.length} products in that price range.`,
        products: productEntries,
        followUp: 'Do any of these catch your eye?',
        includeOffer: true
      });
    }

    // Handle new arrivals / latest products
    if (/\b(new arrival|new arrivals|latest|recently added|just in|show new|latest product)\b/i.test(lowerMessage)) {
      const matches = db.prepare(`
        SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
               c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.active = 1
        ORDER BY p.id DESC
        LIMIT 12
      `).all();

      if (matches.length === 0) {
        return makeChatResponse({
          summary: 'No new arrivals at the moment.',
          details: 'Check back soon for fresh collections!',
          followUp: 'Would you like to browse our current collection?'
        });
      }

      const productEntries = matches.map(buildProductEntry);
      return makeChatResponse({
        summary: `✨ Check out our ${matches.length} newest arrivals!`,
        details: 'Fresh items just added to our collection:',
        products: productEntries,
        followUp: 'See anything you like?',
        includeOffer: true
      });
    }

    // Handle best sellers / top rated
    if (/\b(best seller|top seller|best rated|top rated|popular|trending|hot item)\b/i.test(lowerMessage)) {
      const matches = db.prepare(`
        SELECT p.id, p.name, p.price, p.description, p.rating, p.featured,
               c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.active = 1 AND p.featured = 1
        ORDER BY p.rating DESC, p.id DESC
        LIMIT 12
      `).all();

      if (matches.length === 0) {
        return makeChatResponse({
          summary: 'Our best sellers are temporarily unavailable.',
          details: 'Try browsing our full collection to find something great!',
          followUp: 'Would you like to search for something specific?'
        });
      }

      const productEntries = matches.map(buildProductEntry);
      return makeChatResponse({
        summary: `🔥 Here are our ${matches.length} best sellers!`,
        details: 'These are customer favorites:',
        products: productEntries,
        followUp: 'Which one catches your eye?',
        includeOffer: true
      });
    }

    // Handle shipping & delivery questions
    if (/\b(shipping|delivery|free shipping|dispatch|how long|when will|arrive|reach|shipping cost|shipping charge)\b/i.test(lowerMessage)) {
      return makeChatResponse({
        summary: '🚚 Great question about shipping!',
        details: 'We offer free worldwide delivery on orders over ₹4,565. Most orders are dispatched within 1-2 business days and take 5-7 business days to arrive. You\'ll get tracking updates via email.',
        followUp: 'Anything else about your order?'
      });
    }

    // Handle returns & refunds
    if (/\b(return|refund|exchange|return policy|how to return|return process|money back)\b/i.test(lowerMessage)) {
      return makeChatResponse({
        summary: '↩️ Easy returns within 30 days!',
        details: 'We offer hassle-free returns within 30 days of delivery. Items must be unused and in original packaging. Refunds are processed within 5-7 business days.',
        followUp: 'Need help with anything else?'
      });
    }

    // Handle size guide / fit questions
    if (/\b(size|fit|measurements|size guide|how does it fit|what size should i|sizing)\b/i.test(lowerMessage)) {
      return makeChatResponse({
        summary: '📏 Let me help with sizing!',
        details: 'Each product page has a detailed size guide with measurements. We recommend checking the specific product\'s size chart before ordering to ensure the perfect fit.',
        followUp: 'Looking for a specific item?'
      });
    }

    // Handle payment & checkout questions
    if (/\b(payment|pay|checkout|secure|card|credit|debit|accept|payment method)\b/i.test(lowerMessage)) {
      return makeChatResponse({
        summary: '💳 We accept multiple payment methods!',
        details: 'We securely accept Credit Cards, Debit Cards, Wallets, and Bank Transfers. All transactions are encrypted and secure.',
        followUp: 'Ready to checkout?'
      });
    }

    // Handle coupon / discount / promo questions
    if (/\b(coupon|discount|promo|code|offer|deal|save|percentage off|sale)\b/i.test(lowerMessage)) {
      return makeChatResponse({
        summary: '🎉 Amazing discounts available!',
        details: 'Use code TREND20 for 20% off sitewide. Check our homepage for more ongoing offers and spin the wheel for a surprise discount code!',
        followUp: 'Found something you like?'
      });
    }

    // Handle product searches
    if (isProductQuery(lowerMessage) && targetQuery) {
      const matches = searchProducts(targetQuery);
      if (matches.length === 0) {
        return makeChatResponse({
          summary: `Hmm, I couldn't find any products matching "${targetQuery}".`,
          details: 'Try a broader search or explore our Shop page to discover what we have.',
          followUp: 'What else can I help you find?'
        });
      }

      const productEntries = matches.map(buildProductEntry);
      return makeChatResponse({
        summary: `Found ${matches.length} amazing product${matches.length !== 1 ? 's' : ''} for you!`,
        details: 'Check these out:',
        products: productEntries,
        followUp: 'Interested in any of these?',
        includeOffer: true
      });
    }

    // Handle order/tracking queries
    if (isOrderQuery(lowerMessage)) {
      return makeChatResponse({
        summary: 'I can help with orders!',
        details: `To track your order, please visit "My Orders" in your account. You'll see your order status, tracking details, and estimated delivery date.`
      });
    }

    // General queries
    if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
      return makeChatResponse({
        summary: 'How can I help you today?',
        details: 'I can assist you with: finding products, checking prices, discussing delivery & returns, or general questions about Trendify.'
      });
    }

    if (lowerMessage.includes('about') || lowerMessage.includes('trendify')) {
      return makeChatResponse({
        summary: 'Trendify is your destination for luxury fashion and lifestyle.',
        details: 'We curate the finest products from independent designers and established brands, delivering style and quality directly to your door.',
        followUp: 'Would you like to explore our collection?'
      });
    }

    // Fallback
    return makeChatResponse({
      summary: 'That sounds interesting!',
      details: 'While I\'m still learning, I\'m here to help you find amazing products. Try asking me about a specific item, category, or price range.',
      followUp: 'What are you looking for today?'
    });

  } catch (err) {
    console.error('Chat generation error:', err.message);
    return makeChatResponse({
      summary: 'I encountered a small issue, but I\'m still here to help!',
      details: 'Could you try rephrasing your question?',
      followUp: 'What can I help you find?'
    });
  }
}

// POST /api/chat - Handle chat messages
router.post('/', optionalAuth, (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const trimmedMessage = message.trim().substring(0, 500);

    if (!trimmedMessage) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const aiResponse = generateAIResponse(trimmedMessage, context || {});

    // Build the reply field from summary, details, and followUp
    let reply = aiResponse.summary || 'Hello! How can I help?';
    if (aiResponse.details) {
      reply += '\n\n' + aiResponse.details;
    }
    if (aiResponse.followUp) {
      reply += '\n\n' + aiResponse.followUp;
    }

    // Add small delay to feel more natural
    setTimeout(() => {
      res.json({
        ...aiResponse,
        reply: reply  // Include both formats for compatibility
      });
    }, 300 + Math.random() * 700);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
