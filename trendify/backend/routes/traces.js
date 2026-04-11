'use strict';

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/traces
router.post('/', (req, res) => {
  const { action, target_type, target_id, target_name, page_url, session_id, user_agent, ip_address } = req.body;

  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'trendify_secret_key_2024');
      userId = decoded.id;
    } catch (err) {}
  }

  try {
    db.prepare(`
      INSERT INTO user_traces (user_id, session_id, action, target_type, target_id, target_name, page_url, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, session_id, action, target_type, target_id, target_name, page_url, user_agent, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error('Trace logging error:', err.message);
    res.status(500).json({ error: 'Failed to log trace' });
  }
});

// GET /api/traces (admin only)
router.get('/', requireAdmin, (req, res) => {
  const { email, action, target_type, limit = 100 } = req.query;
  const filters = [];
  const params = [];

  if (email) { filters.push('u.email = ?'); params.push(email.toLowerCase()); }
  if (action) { filters.push('t.action = ?'); params.push(action); }
  if (target_type) { filters.push('t.target_type = ?'); params.push(target_type); }

  const whereClause = filters.length ? 'WHERE ' + filters.join(' AND ') : '';
  const traces = db.prepare(`
    SELECT t.id, t.user_id, u.name as user_name, u.email as user_email, t.session_id,
           t.action, t.target_type, t.target_id, t.target_name, t.page_url,
           t.user_agent, t.ip_address, t.created_at
    FROM user_traces t
    LEFT JOIN users u ON t.user_id = u.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ?
  `).all(...params, parseInt(limit, 10));

  res.json({ traces });
});

module.exports = router;
