'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend in production
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/chat',     require('./routes/chat'));
app.use('/api/coupons',  require('./routes/coupons'));      // Coupon validation and generation
app.use('/api/traces',   require('./routes/traces'));       // User activity tracking
app.use('/api/whatsapp-webhook', require('./routes/whatsappWebhook')); // WhatsApp webhook for interactive messages

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 5MB)' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Start the AI recommendation engine (interval training)
const db = require('./db');
const { startIntervalTraining } = require('./services/reminderService');

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║      🛍️  Trendify Server Running      ║
  ╠══════════════════════════════════════╣
  ║  Local:   http://localhost:${PORT}       ║
  ║  API:     http://localhost:${PORT}/api   ║
  ╚══════════════════════════════════════╝

  Admin: admin@trendify.com / admin123
  User:  user@trendify.com  / user123
  `);

  // Start AI recommendation interval training after 5 seconds
  setTimeout(() => {
    console.log('\n🤖 Starting AI Recommendation Engine...\n');
    startIntervalTraining(db);
  }, 5000);
});

module.exports = app;
