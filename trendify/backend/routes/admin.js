'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { sendSmartNotification } = require('../services/notificationService');
const { 
  handleOrderProcessing, 
  handleOrderShipped, 
  handleOrderDelivered, 
  handleOrderCancelled 
} = require('../services/reminderService');

const router = express.Router();

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `product-${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, (req, res) => {
  const totalRevenue = db.prepare("SELECT SUM(total) as sum FROM orders WHERE status != 'cancelled'").get().sum || 0;
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get().count;
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").get().count;
  const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count;

  const recentOrders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC LIMIT 10
  `).all();

  const topProducts = db.prepare(`
    SELECT p.name, p.price, SUM(oi.quantity) as sold, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    GROUP BY p.id ORDER BY sold DESC LIMIT 5
  `).all();

  const salesByCategory = db.prepare(`
    SELECT c.name, SUM(oi.quantity) as total_sold
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    GROUP BY c.id ORDER BY total_sold DESC
  `).all();

  res.json({ totalRevenue, totalOrders, totalProducts, totalUsers, pendingOrders, recentOrders, topProducts, salesByCategory });
});

// GET /api/admin/products
router.get('/products', requireAdmin, (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = [];
  let params = [];

  if (search) {
    where.push('p.name LIKE ?');
    params.push(`%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${whereClause}`).get(...params).c;
  const products = db.prepare(`
    SELECT p.*, c.name as category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ products, total, pages: Math.ceil(total / parseInt(limit)) });
});

// POST /api/admin/products
router.post('/products', requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, original_price, category_id, badge, badge_color, stock, featured } = req.body;

  if (!name || !price) return res.status(400).json({ error: 'Name and price are required' });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO products (name, slug, description, price, original_price, category_id, image, badge, badge_color, stock, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, slug, description || null, parseFloat(price), original_price ? parseFloat(original_price) : null,
    category_id ? parseInt(category_id) : null, image, badge || null, badge_color || 'green',
    parseInt(stock) || 0, featured ? 1 : 0);

  res.status(201).json({ message: 'Product created', id: result.lastInsertRowid });
});

// PUT /api/admin/products/:id
router.put('/products/:id', requireAdmin, upload.single('image'), (req, res) => {
  const { name, description, price, original_price, category_id, badge, badge_color, stock, featured, active } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const image = req.file ? `/uploads/${req.file.filename}` : product.image;

  db.prepare(`
    UPDATE products SET name=?, description=?, price=?, original_price=?, category_id=?,
    image=?, badge=?, badge_color=?, stock=?, featured=?, active=? WHERE id=?
  `).run(
    name || product.name, description ?? product.description,
    price ? parseFloat(price) : product.price,
    original_price ? parseFloat(original_price) : product.original_price,
    category_id ? parseInt(category_id) : product.category_id, image,
    badge ?? product.badge, badge_color || product.badge_color,
    stock !== undefined ? parseInt(stock) : product.stock,
    featured !== undefined ? (featured ? 1 : 0) : product.featured,
    active !== undefined ? (active ? 1 : 0) : product.active,
    req.params.id
  );

  res.json({ message: 'Product updated' });
});

// DELETE /api/admin/products/:id (soft delete)
router.delete('/products/:id', requireAdmin, (req, res) => {
  const result = db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

// GET /api/admin/orders
router.get('/orders', requireAdmin, (req, res) => {
  const { status, page = 1 } = req.query;
  const offset = (parseInt(page) - 1) * 20;
  let where = status ? ['o.status = ?'] : [];
  let params = status ? [status] : [];

  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email, COUNT(oi.id) as item_count
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY o.id ORDER BY o.created_at DESC LIMIT 20 OFFSET ?
  `).all(...params, offset);

  res.json({ orders });
});

// PUT /api/admin/orders/:id/status
router.put('/orders/:id/status', requireAdmin, (req, res) => {
  const { status, trackingNumber } = req.body;
  const validStatuses = ['pending', 'processing', 'shipped', 'out_of_delivery', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  
  // Send notification based on status change
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
  if (user) {
    let eventType = null;
    switch (status) {
      case 'processing':
        eventType = 'order_processing';
        break;
      case 'shipped':
        eventType = 'order_shipped';
        break;
      case 'out_of_delivery':
        eventType = 'order_out_of_delivery';
        break;
      case 'delivered':
        eventType = 'order_delivered';
        break;
    }

    if (eventType) {
      // Send Email + WhatsApp + Telegram notification
      sendSmartNotification(eventType, user, order).catch(err => {
        console.error(`Failed to send ${eventType} notification:`, err.message);
      });

      // Send status-specific Telegram with buttons and links
      setTimeout(async () => {
        try {
          switch (status) {
            case 'processing':
              await handleOrderProcessing(order.user_id, order.id, user.name);
              break;
            case 'shipped':
              await handleOrderShipped(order.user_id, order.id, trackingNumber || 'TRK-' + order.id, user.name);
              break;
            case 'delivered':
              await handleOrderDelivered(order.user_id, order.id, user.name);
              break;
            case 'cancelled':
              await handleOrderCancelled(order.user_id, order.id, req.body.reason || '', user.name);
              break;
          }
        } catch (err) {
          console.error(`[Telegram Status] Error:`, err.message);
        }
      }, 1000);
    }
  }

  res.json({ message: 'Order status updated' });
});

// GET /api/admin/users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COUNT(DISTINCT o.id) as order_count,
           SUM(o.total) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();
  res.json({ users });
});

// ── AI RECOMMENDATION ENDPOINTS ─────────────────────────────────────────────

// POST /api/admin/users/:userId/send-personalized-message
router.post('/users/:userId/send-personalized-message', requireAdmin, async (req, res) => {
  const { sendTelegram } = require('../services/reminderService');
  const userId = parseInt(req.params.userId, 10);
  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const searches = db.prepare(`
      SELECT target_name FROM user_traces WHERE user_id = ?  
      AND action = 'search' AND target_name IS NOT NULL
      ORDER BY created_at DESC LIMIT 3
    `).all(userId).map(r => r.target_name);

    const cartItems = db.prepare(`
      SELECT p.id, p.name, p.price, cat.name as category
      FROM cart c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE c.user_id = ?
    `).all(userId);

    const wishlistItems = db.prepare(`
      SELECT p.id, p.name, p.price, cat.name as category
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE w.user_id = ?
    `).all(userId);

    const message = `🎉 Hi ${user.name}!\n\nWe have amazing new items you'll love based on your interests!\n\n✨ Check out what's new →`;
    
    const links = [];
    if (cartItems.length) {
      links.push([{ text: `🛒 ${cartItems[0].name}`, url: `${process.env.FRONTEND_URL}/product.html?id=${cartItems[0].id}` }]);
    }
    if (wishlistItems.length) {
      links.push([{ text: `💖 ${wishlistItems[0].name}`, url: `${process.env.FRONTEND_URL}/product.html?id=${wishlistItems[0].id}` }]);
    }
    links.push([{ text: '🛍️ Browse All →', url: `${process.env.FRONTEND_URL}/shop.html` }]);

    await sendTelegram(message, links);
    return res.json({ success: true, message: 'Personalized message sent!' });
  } catch (err) {
    console.error('Personalized message error:', err.message);
    return res.status(500).json({ error: 'Failed to send personalized message' });
  }
});

// POST /api/admin/users/:userId/send-recommendations
router.post('/users/:userId/send-recommendations', requireAdmin, async (req, res) => {
  const { 
    getUserBehavior, 
    getSimilarProducts, 
    generateRecommendationMessage, 
    sendTelegram 
  } = require('../services/reminderService');
  
  const userId = parseInt(req.params.userId, 10);
  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const behavior = getUserBehavior(db, userId);
    const category = behavior.cartItems[0]?.category || 
                     behavior.wishlistItems[0]?.category || 
                     behavior.pastOrders[0]?.category || 'fashion';
    
    const similarProducts = getSimilarProducts(db, `%${category}%`, []);
    const recMsg = await generateRecommendationMessage(category, similarProducts);

    const buttons = similarProducts.map(p => ([
      { text: `✨ ${p.name} — ₹${p.price}`, url: `${process.env.FRONTEND_URL}/product.html?id=${p.id}` }
    ]));
    buttons.push([{ text: '🛍️ Browse All →', url: `${process.env.FRONTEND_URL}/shop.html` }]);

    const message = `Hey ${user.name}, check out these amazing picks!\n\n${recMsg}`;
    
    await sendTelegram(message, buttons);
    return res.json({ success: true, message: 'Recommendations sent!' });
  } catch (err) {
    console.error('Recommendations error:', err.message);
    return res.status(500).json({ error: 'Failed to send recommendations' });
  }
});

module.exports = router;
