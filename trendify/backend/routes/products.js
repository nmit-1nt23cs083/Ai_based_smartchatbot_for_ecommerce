'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/products
router.get('/', (req, res) => {
  const { category, search, sort, featured, page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = ['p.active = 1'];
  let params = [];

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (search) {
    where.push('(p.name LIKE ? OR p.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (featured === 'true') {
    where.push('p.featured = 1');
  }

  let orderBy = 'p.created_at DESC';
  if (sort === 'price_asc') orderBy = 'p.price ASC';
  else if (sort === 'price_desc') orderBy = 'p.price DESC';
  else if (sort === 'rating') orderBy = 'p.rating DESC';
  else if (sort === 'name') orderBy = 'p.name ASC';

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `).get(...params).count;

  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

// GET /api/products/featured
router.get('/featured', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1 AND p.featured = 1
    ORDER BY p.rating DESC
    LIMIT 8
  `).all();
  res.json({ products });
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ? AND p.active = 1
  `).get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Get reviews
  const reviews = db.prepare(`
    SELECT r.*, u.name as user_name
    FROM reviews r
    JOIN users u ON r.user_id = u.id
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all(req.params.id);

  // Get related products
  const related = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ? AND p.active = 1
    LIMIT 4
  `).all(product.category_id, product.id);

  res.json({ product, reviews, related });
});

// GET /api/categories
router.get('/meta/categories', (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id
  `).all();
  res.json({ categories });
});

module.exports = router;
