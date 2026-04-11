'use strict';

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './trendify.db';
const db = new Database(path.resolve(DB_PATH));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  phone TEXT,
  country_code TEXT,
  google_id TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'user',
  avatar TEXT,
  email_notifications INTEGER DEFAULT 1,
  whatsapp_consent INTEGER DEFAULT 0,
  telegram_consent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// Migrate existing users to add notification preference columns
try {
  db.prepare('ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1').run();
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.prepare('ALTER TABLE users ADD COLUMN whatsapp_consent INTEGER DEFAULT 0').run();
} catch (e) {
  // Column already exists, ignore error
}

try {
  db.prepare('ALTER TABLE users ADD COLUMN telegram_consent INTEGER DEFAULT 0').run();
} catch (e) {
  // Column already exists, ignore error
}

db.exec(`CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT
)`);

db.exec(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price REAL NOT NULL,
  original_price REAL,
  category_id INTEGER REFERENCES categories(id),
  image TEXT,
  image_hover TEXT,
  badge TEXT,
  badge_color TEXT DEFAULT 'green',
  stock INTEGER NOT NULL DEFAULT 0,
  rating REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  featured INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS cart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_name TEXT NOT NULL,
  shipping_email TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'card',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  product_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, product_id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, user_id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS user_traces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  target_name TEXT,
  page_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);

// ─── Create indexes for faster queries ──────────────────────────────────────
try {
  db.prepare('CREATE INDEX IF NOT EXISTS idx_user_traces_user ON user_traces(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_user_traces_action ON user_traces(action)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_cart_user ON cart(user_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id)').run();
} catch (e) {
  // Indexes already exist
}

// ─── Seed Database ──────────────────────────────────────────────────────────

function checkSeeding() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return; // already seeded

  console.log('🌱 Seeding database...');

  // Admin user
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Admin User', 'admin@trendify.com', ?, 'admin')
  `).run(hashedPassword);

  // Sample user
  const userPass = bcrypt.hashSync('user123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES ('Jane Doe', 'user@trendify.com', ?, 'user')
  `).run(userPass);

  // Categories
  const cats = [
    { name: 'Clothes',   slug: 'clothes',   icon: '👗' },
    { name: 'Footwear',  slug: 'footwear',  icon: '👟' },
    { name: 'Jewelry',   slug: 'jewelry',   icon: '💍' },
    { name: 'Perfume',   slug: 'perfume',   icon: '🧴' },
    { name: 'Cosmetics', slug: 'cosmetics', icon: '💄' },
    { name: 'Watches',   slug: 'watches',   icon: '⌚' },
    { name: 'Bags',      slug: 'bags',      icon: '👜' },
    { name: 'Glasses',   slug: 'glasses',   icon: '🕶️' },
  ];
  const insertCat = db.prepare('INSERT INTO categories (name, slug, icon) VALUES (@name, @slug, @icon)');
  cats.forEach(c => insertCat.run(c));

  // Products (USD to INR: 1 USD = 83 INR)
  const products = [
    // Clothes
    { name: "Relaxed Short Sleeve T-Shirt", slug: "relaxed-short-tshirt", description: "Premium cotton blend t-shirt with a relaxed fit, perfect for casual everyday wear.", price: 2489, original_price: 3735, category_id: 1, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400", badge: "NEW", badge_color: "pink", stock: 50, rating: 4.5, review_count: 23, featured: 1 },
    { name: "Black Floral Wrap Midi Skirt", slug: "black-floral-midi-skirt", description: "Elegant wrap-style midi skirt featuring delicate floral prints on premium fabric.", price: 2075, original_price: 2905, category_id: 1, image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400", badge: "SALE", badge_color: "black", stock: 30, rating: 5.0, review_count: 41, featured: 1 },
    { name: "Pure Garment Dyed Cotton Shirt", slug: "garment-dyed-cotton-shirt", description: "Luxuriously soft garment-dyed cotton shirt with a perfectly worn-in look.", price: 3735, original_price: 4648, category_id: 1, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400", stock: 45, rating: 4.0, review_count: 18 },
    { name: "Men Yarn Fleece Full-Zip Jacket", slug: "men-fleece-zip-jacket", description: "Warm and cozy full-zip fleece jacket made from premium recycled yarn.", price: 5063, original_price: 6640, category_id: 1, image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400", badge: "15%", badge_color: "green", stock: 25, rating: 4.0, review_count: 12, featured: 1 },
    { name: "Men Winter Leather Jacket", slug: "men-winter-leather-jacket", description: "Classic leather jacket with insulated lining for harsh winters.", price: 2656, original_price: 3735, category_id: 1, image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400", stock: 20, rating: 4.5, review_count: 33 },
    { name: "French Terry Sweatshorts", slug: "french-terry-sweatshorts", description: "Comfortable sweatshorts made from soft French terry fabric.", price: 1660, original_price: 2324, category_id: 1, image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400", badge: "SALE", badge_color: "black", stock: 60, rating: 4.0, review_count: 8 },

    // Footwear
    { name: "Running & Trekking Shoes - White", slug: "running-trekking-shoes-white", description: "High-performance trail running shoes with superior grip and comfort.", price: 4067, original_price: 5395, category_id: 2, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", stock: 40, rating: 4.5, review_count: 56, featured: 1 },
    { name: "Trekking Shoes - Black", slug: "trekking-shoes-black", description: "Durable all-terrain trekking shoes for the adventurous spirit.", price: 4814, original_price: 6225, category_id: 2, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400", badge: "SALE", badge_color: "black", stock: 35, rating: 4.0, review_count: 29 },
    { name: "Women Party Wear Shoes", slug: "women-party-wear-shoes", description: "Elegant strappy heels designed for special occasions and parties.", price: 2075, original_price: 3320, category_id: 2, image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400", badge: "SALE", badge_color: "black", stock: 22, rating: 4.0, review_count: 15 },
    { name: "Men Leather Formal Shoes", slug: "men-leather-formal-shoes", description: "Handcrafted genuine leather Oxford shoes for formal occasions.", price: 4648, original_price: 6474, category_id: 2, image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400", stock: 18, rating: 4.5, review_count: 37, featured: 1 },
    { name: "Casual Men Brown Shoes", slug: "casual-men-brown-shoes", description: "Versatile casual shoes in warm brown leather, pairs with everything.", price: 4150, original_price: 5395, category_id: 2, image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=400", stock: 28, rating: 5.0, review_count: 44 },

    // Jewelry
    { name: "Rose Gold Peacock Earrings", slug: "rose-gold-peacock-earrings", description: "Stunning rose gold earrings inspired by the majestic peacock feather.", price: 1660, original_price: 2490, category_id: 3, image: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400", stock: 55, rating: 4.5, review_count: 62, featured: 1 },
    { name: "Silver Deer Heart Necklace", slug: "silver-deer-heart-necklace", description: "Delicate sterling silver necklace with a nature-inspired deer heart pendant.", price: 6972, original_price: 8300, category_id: 3, image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400", stock: 30, rating: 4.0, review_count: 19 },
    { name: "Platinum Zircon Classic Ring", slug: "platinum-zircon-ring", description: "Timeless platinum-plated ring set with sparkling cubic zirconia stones.", price: 5146, original_price: 6640, category_id: 3, image: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400", badge: "SALE", badge_color: "black", stock: 40, rating: 4.5, review_count: 28 },

    // Perfume
    { name: "Titan 100ml Women Perfume", slug: "titan-womens-perfume", description: "An enchanting floral fragrance for the modern woman with long-lasting notes.", price: 3486, original_price: 4565, category_id: 4, image:"https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400", stock: 65, rating: 4.5, review_count: 47, featured: 1 },

    // Cosmetics
    { name: "Shampoo & Conditioner Pack", slug: "shampoo-conditioner-pack", description: "Professional-grade hair care system for silky, healthy hair.", price: 1660, original_price: 2490, category_id: 5, image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400", badge: "SALE", badge_color: "black", stock: 80, rating: 3.5, review_count: 11 },

    // Watches
    { name: "Titan Luxury Steel Watch", slug: "titan-luxury-steel-watch", description: "Premium Titan stainless steel watch with precision movement and sapphire crystal glass. Water-resistant to 100m with elegant minimalist design.", price: 23655, original_price: 31540, category_id: 6, image: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400", badge: "SALE", badge_color: "gold", stock: 28, rating: 4.8, review_count: 95, featured: 1 },
    { name: "Pocket Watch Leather Pouch", slug: "pocket-watch-leather-pouch", description: "Classic pocket watch with an elegant leather carrying pouch.", price: 12450, original_price: 14940, category_id: 6, image: "https://images.unsplash.com/photo-1587836374828-4dbafa94cf0e?w=400", badge: "SALE", badge_color: "black", stock: 12, rating: 4.0, review_count: 9, featured: 1 },
    { name: "Smart Watch Vital Plus", slug: "smart-watch-vital-plus", description: "Advanced health tracking smartwatch with GPS and 7-day battery life.", price: 8300, original_price: 10790, category_id: 6, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400", stock: 35, rating: 4.5, review_count: 78, featured: 1 },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (name, slug, description, price, original_price, category_id, image, badge, badge_color, stock, rating, review_count, featured)
    VALUES (@name, @slug, @description, @price, @original_price, @category_id, @image, @badge, @badge_color, @stock, @rating, @review_count, @featured)
  `);
  products.forEach(p => insertProduct.run({
    badge: null, badge_color: 'green', featured: 0, original_price: null, ...p
  }));

  console.log('✅ Database seeded successfully!');
}

checkSeeding();

module.exports = db;
