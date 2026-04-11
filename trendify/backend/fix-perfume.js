const db = require('./db');

// Update Titan Perfume with a different image URL
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1588405748507-c3519504b33f?w=400',
  'Titan 100ml Women Perfume'
);

console.log('✅ Titan Perfume image updated with new URL');

// Verify
const perfume = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan 100ml Women Perfume');
console.log('Updated:', perfume);
