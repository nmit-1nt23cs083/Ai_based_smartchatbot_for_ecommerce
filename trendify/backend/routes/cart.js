'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { scheduleCartReminder, cancelCartReminder } = require('../services/notificationService');

const router = express.Router();

// GET /api/cart
router.get('/', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.original_price,
           p.image, p.stock, cat.name as category_name
    FROM cart c
    JOIN products p ON c.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    WHERE c.user_id = ? AND p.active = 1
    ORDER BY c.created_at DESC
  `).all(req.user.id);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  res.json({ items, total: Math.round(total * 100) / 100, count });
});

// POST /api/cart/add
router.post('/add', requireAuth, (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) return res.status(400).json({ error: 'Product ID required' });

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (product.stock < 1) return res.status(400).json({ error: 'Product out of stock' });

  const existing = db.prepare('SELECT * FROM cart WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, product_id);

  if (existing) {
    const newQty = Math.min(existing.quantity + parseInt(quantity), product.stock);
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(req.user.id, product_id, Math.min(parseInt(quantity), product.stock));
  }

  // Return updated cart count
  const count = db.prepare('SELECT SUM(quantity) as total FROM cart WHERE user_id = ?')
    .get(req.user.id).total || 0;

  // Schedule cart reminder (3 minutes) if items in cart
  if (count > 0) {
    const cartItems = db.prepare(`
      SELECT c.quantity, p.id as product_id, p.name, p.price, p.image
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ? AND p.active = 1
    `).all(req.user.id);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    scheduleCartReminder(req.user.id, user, cartItems).catch(err => {
      console.error('Failed to schedule cart reminder:', err.message);
    });
  }

  res.json({ message: 'Added to cart', cartCount: count });
});

// PUT /api/cart/:id
router.put('/:id', requireAuth, (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'Invalid quantity' });

  const item = db.prepare('SELECT c.*, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?')
    .get(req.params.id, req.user.id);

  // Check if cart is now empty, if so cancel reminder
  const remaining = db.prepare('SELECT COUNT(*) as count FROM cart WHERE user_id = ?')
    .get(req.user.id).count;
  
  if (remaining === 0) {
    cancelCartReminder(req.user.id);
  }

  if (!item) return res.status(404).json({ error: 'Cart item not found' });

  const newQty = Math.min(parseInt(quantity), item.stock);
  db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(newQty, item.id);

  res.json({ message: 'Cart updated', quantity: newQty });
});

// DELETE /api/cart/:id
router.delete('/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);

  if (!result.changes) return res.status(404).json({ error: 'Cart item not found' });

  res.json({ message: 'Removed from cart' });
});

// DELETE /api/cart (clear all)
router.delete('/', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Cart cleared' });
});

// POST /api/cart/wishlist/add
router.post('/wishlist/add', requireAuth, (req, res) => {
  const { product_id } = req.body;
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  try {
    db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.user.id, product_id);
    res.json({ message: 'Added to wishlist' });
  } catch {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, product_id);
    res.json({ message: 'Removed from wishlist' });
  }
});

// GET /api/cart/wishlist
router.get('/wishlist', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM wishlist w
    JOIN products p ON w.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE w.user_id = ?
  `).all(req.user.id);
  res.json({ items });
});

module.exports = router;
