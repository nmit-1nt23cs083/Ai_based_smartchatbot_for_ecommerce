const db = require('./db');

// Try multiple perfume image URLs to find one that displays
const luxuryPerfumeUrls = [
  'https://images.unsplash.com/photo-1595777872200-1aea2653b3c9?w=400',  // High-end perfume bottles
  'https://images.unsplash.com/photo-1523293313671-a7dc19d615b5?w=400',  // Luxury fragrance
  'https://images.unsplash.com/photo-1627456803646-ca5c0f981efd?w=400',  // Elegant perfume
];

// Use the first luxury perfume image
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  luxuryPerfumeUrls[0],
  'Titan 100ml Women Perfume'
);

console.log('✅ Titan Perfume image updated');
console.log('New URL:', luxuryPerfumeUrls[0]);

// Verify
const perfume = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan 100ml Women Perfume');
console.log('Verified:', perfume.image);
