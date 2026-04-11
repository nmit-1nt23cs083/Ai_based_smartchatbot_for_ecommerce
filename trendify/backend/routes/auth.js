'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { sendSmartNotification } = require('../services/notificationService');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password, phone, countryCode, emailNotifications, whatsappConsent, telegramConsent } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password, phone, country_code, email_notifications, whatsapp_consent, telegram_consent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name.trim(),
    email.toLowerCase(),
    hashed,
    phone || null,
    countryCode || null,
    emailNotifications ? 1 : 0,
    whatsappConsent ? 1 : 0,
    telegramConsent ? 1 : 0
  );

  const token = jwt.sign(
    { id: result.lastInsertRowid, email: email.toLowerCase(), role: 'user', name: name.trim(), phone: phone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const newUser = {
    id: result.lastInsertRowid,
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone,
    role: 'user'
  };

  // Send welcome email (async - don't wait)
  sendSmartNotification('register', newUser).catch(err => {
    console.error('Failed to send welcome email:', err.message);
  });

  res.status(201).json({
    message: 'Account created successfully',
    token,
    user: newUser
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Send welcome back email (async - don't wait)
  sendSmartNotification('login_welcome', user).catch(err => {
    console.error('Failed to send login welcome email:', err.message);
  });

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  let updates = [];
  let params = [];

  if (name && name.trim()) {
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change password' });
    }
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    updates.push('password = ?');
    params.push(bcrypt.hashSync(newPassword, 10));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  params.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: 'Profile updated', user: updated });
});

// GET /api/auth/preferences
router.get('/preferences', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id, name, email, email_notifications, whatsapp_consent, telegram_consent 
    FROM users WHERE id = ?
  `).get(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Create masked email for privacy (e.g., a@*****.com)
  const [localPart, domain] = user.email.split('@');
  const maskedEmail = `${localPart[0]}${'*'.repeat(Math.max(1, localPart.length - 1))}@${domain}`;

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      maskedEmail: maskedEmail,
      email_notifications: !!user.email_notifications,
      whatsapp_consent: !!user.whatsapp_consent,
      telegram_consent: !!user.telegram_consent
    }
  });
});

// PUT /api/auth/preferences
router.put('/preferences', requireAuth, (req, res) => {
  const { email_notifications, whatsapp_consent, telegram_consent } = req.body;

  try {
    db.prepare(`
      UPDATE users 
      SET email_notifications = ?, whatsapp_consent = ?, telegram_consent = ? 
      WHERE id = ?
    `).run(
      email_notifications ? 1 : 0,
      whatsapp_consent ? 1 : 0,
      telegram_consent ? 1 : 0,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, name, email, email_notifications, whatsapp_consent, telegram_consent 
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create masked email for privacy
    const [localPart, domain] = updated.email.split('@');
    const maskedEmail = `${localPart[0]}${'*'.repeat(Math.max(1, localPart.length - 1))}@${domain}`;

    res.json({
      message: 'Preferences updated successfully',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        maskedEmail: maskedEmail,
        email_notifications: !!updated.email_notifications,
        whatsapp_consent: !!updated.whatsapp_consent,
        telegram_consent: !!updated.telegram_consent
      }
    });
  } catch (err) {
    console.error('Error updating preferences:', err.message);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

module.exports = router;
