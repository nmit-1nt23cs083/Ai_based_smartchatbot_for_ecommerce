const db = require('./db');

// Use a simpler, direct perfume image URL that's known to work
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=500',
  'Titan 100ml Women Perfume'
);

console.log('✅ Perfume image updated with new URL');
console.log('URL: https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=500');

// Verify
const perfume = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan 100ml Women Perfume');
console.log('Verified:', perfume.image);
