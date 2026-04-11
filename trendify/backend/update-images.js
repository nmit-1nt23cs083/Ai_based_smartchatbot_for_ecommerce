const db = require('./db');

// Update Titan Perfume image
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1541643600914-78b084683702?w=400',
  'Titan 100ml Women Perfume'
);

// Update Titan Watch image
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
  'Titan Luxury Steel Watch'
);

console.log('✅ Images updated successfully!');
console.log('- Titan Perfume image updated');
console.log('- Titan Watch image updated');
