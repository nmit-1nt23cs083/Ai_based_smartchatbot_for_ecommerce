'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendSmartNotification, cancelCartReminder } = require('../services/notificationService');
const { handleOrderPlaced } = require('../services/reminderService');

const router = express.Router();

// POST /api/orders/checkout
router.post('/checkout', requireAuth, (req, res) => {
  const { shipping_name, shipping_email, shipping_address, shipping_city, shipping_zip, payment_method } = req.body;

  if (!shipping_name || !shipping_email || !shipping_address || !shipping_city || !shipping_zip) {
    return res.status(400).json({ error: 'All shipping fields are required' });
  }

  // Get cart items
  const cartItems = db.prepare(`
    SELECT c.quantity, p.id as product_id, p.name, p.price, p.stock
    FROM cart c
    JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ? AND p.active = 1
  `).all(req.user.id);

  if (cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Check stock
  for (const item of cartItems) {
    if (item.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for "${item.name}"` });
    }
  }

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Create order in transaction
  const placeOrder = db.transaction(() => {
    const order = db.prepare(`
      INSERT INTO orders (user_id, total, shipping_name, shipping_email, shipping_address, shipping_city, shipping_zip, payment_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, Math.round(total * 100) / 100,
      shipping_name, shipping_email, shipping_address, shipping_city, shipping_zip,
      payment_method || 'card'
    );

    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(order.lastInsertRowid, item.product_id, item.name, item.price, item.quantity);
      updateStock.run(item.quantity, item.product_id);
    }

    // Clear cart
    db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);

    return order.lastInsertRowid;
  });

  const orderId = placeOrder();

  // Cancel any pending cart reminder
  cancelCartReminder(req.user.id);

  // Send order confirmation email with product details (async - don't wait)
  const orderData = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  
  if (orderData && user) {
    sendSmartNotification('order_placed', user, orderData, orderItems).catch(err => {
      console.error('Failed to send order email:', err.message);
    });

    // Trigger AI recommendations on order (async - don't wait)
    const productNames = orderItems.map(oi => oi.product_name);
    const primaryProduct = orderItems[0];
    const primaryCategory = primaryProduct ? primaryProduct.category : 'fashion';
    
    handleOrderPlaced(req.user.id, productNames, primaryCategory, db).catch(err => {
      console.error('Failed to send recommendations:', err.message);
    });
  }

  res.status(201).json({ message: 'Order placed successfully', orderId });
});

// GET /api/orders
router.get('/', requireAuth, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, COUNT(oi.id) as item_count
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = ?
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `).all(req.user.id);

  res.json({ orders });
});

// GET /api/orders/:id
router.get('/:id', requireAuth, (req, res) => {
  const order = db.prepare(`
    SELECT * FROM orders WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.user.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare(`
    SELECT oi.*, p.image
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(order.id);

  res.json({ order, items });
});

// POST /api/reviews
router.post('/reviews', requireAuth, (req, res) => {
  const { product_id, rating, comment } = req.body;
  if (!product_id || !rating) return res.status(400).json({ error: 'Product and rating required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

  try {
    db.prepare('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)')
      .run(product_id, req.user.id, rating, comment || null);

    // Update product average rating
    const avg = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ?').get(product_id);
    db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?')
      .run(Math.round(avg.avg * 10) / 10, avg.cnt, product_id);

    res.status(201).json({ message: 'Review submitted' });
  } catch {
    return res.status(409).json({ error: 'You have already reviewed this product' });
  }
});

module.exports = router;
