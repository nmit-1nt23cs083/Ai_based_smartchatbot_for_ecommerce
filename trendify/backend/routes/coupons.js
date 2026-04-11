'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/coupons/validate - Validate and apply a coupon
router.post('/validate', (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const upperCode = code.toUpperCase();
    
    // Check for spin-wheel style codes (SAVE5-*, SAVE10-*, HOT20-*, etc.)
    const wheelMatch = upperCode.match(/^([A-Z]+)(\d+)-[A-Z0-9]{4}$/);
    if (wheelMatch) {
      const prefix = wheelMatch[1];
      const discountPercent = parseInt(wheelMatch[2]);
      
      // Validate it's a known spin-wheel code
      if (['SAVE', 'HOT'].includes(prefix) && [5, 10, 20].includes(discountPercent)) {
        return res.json({
          code: upperCode,
          discountPercent: discountPercent,
          isSpinWheelCoupon: true
        });
      }
    }

    // Check database for other coupon codes
    const coupon = db.prepare(`
      SELECT * FROM coupons 
      WHERE UPPER(code) = ? AND is_active = 1
    `).get(upperCode);

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Check expiration
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Coupon has expired' });
    }

    // Check max uses
    if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ error: 'Coupon usage limit exceeded' });
    }

    res.json({
      code: coupon.code,
      discountPercent: coupon.discount_percent
    });
  } catch (e) {
    console.error('Coupon validation error:', e);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// POST /api/coupons/generate - Generate spin-wheel coupons (admin only)
router.post('/generate', (req, res) => {
  try {
    const { discountPercent, count = 1 } = req.body;

    if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
      return res.status(400).json({ error: 'Invalid discount percentage' });
    }

    const generated = [];
    
    for (let i = 0; i < count; i++) {
      // Generate code like SAVE10-AB42
      const prefix = `SAVE${discountPercent}`;
      const suffix = Math.random().toString(36).substring(2, 4) + 
                     Math.floor(Math.random() * 100).toString().padStart(2, '0');
      const code = `${prefix}-${suffix}`.toUpperCase();

      try {
        db.prepare(`
          INSERT INTO coupons (code, discount_percent, is_active)
          VALUES (?, ?, 1)
        `).run(code, discountPercent);
        
        generated.push(code);
      } catch (e) {
        // Code already exists, try again
        i--;
      }
    }

    res.json({ coupons: generated });
  } catch (e) {
    console.error('Coupon generation error:', e);
    res.status(500).json({ error: 'Failed to generate coupon' });
  }
});

// POST /api/coupons/use - Mark coupon as used
router.post('/use', (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const coupon = db.prepare(`
      SELECT * FROM coupons WHERE code = ? AND is_active = 1
    `).get(code.toUpperCase());

    if (!coupon) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    // Increment used count
    db.prepare(`
      UPDATE coupons SET used_count = used_count + 1 WHERE code = ?
    `).run(code.toUpperCase());

    res.json({ success: true });
  } catch (e) {
    console.error('Coupon use error:', e);
    res.status(500).json({ error: 'Failed to use coupon' });
  }
});

// GET /api/coupons - Get all coupons (admin only)
router.get('/', (req, res) => {
  try {
    const coupons = db.prepare(`
      SELECT * FROM coupons ORDER BY created_at DESC
    `).all();

    res.json(coupons);
  } catch (e) {
    console.error('Coupon fetch error:', e);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

module.exports = router;
