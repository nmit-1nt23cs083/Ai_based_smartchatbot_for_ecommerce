const db = require('./db');

// Premium luxury perfume bottle images
const perfumeUrls = [
  'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=500',  // Luxury perfume bottles
  'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=500',  // High-end fragrance
  'https://images.unsplash.com/photo-1623293182086-7651a899d37f?w=500',  // Elegant perfume
];

db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  perfumeUrls[0],
  'Titan 100ml Women Perfume'
);

console.log('✅ Perfume image updated with LUXURY perfume bottle');
console.log('URL:', perfumeUrls[0]);

// Verify
const perfume = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan 100ml Women Perfume');
console.log('Current Image:', perfume.image);
