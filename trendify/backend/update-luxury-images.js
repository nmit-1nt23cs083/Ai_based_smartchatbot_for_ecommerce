const db = require('./db');

// Update with luxury perfume image (showing an elegant bottle)
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1506755855726-21b2cf494547?w=400',
  'Titan 100ml Women Perfume'
);

// Update with luxury watch image (premium/luxurious watch)
db.prepare("UPDATE products SET image = ? WHERE name = ?").run(
  'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400',
  'Titan Luxury Steel Watch'
);

console.log('✅ Images updated with luxury versions!');
console.log('- Titan Perfume: Elegant luxury perfume bottle');
console.log('- Titan Watch: Premium luxury watch');

// Verify
const perfume = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan 100ml Women Perfume');
const watch = db.prepare('SELECT name, image FROM products WHERE name = ?').get('Titan Luxury Steel Watch');
console.log('\nUpdated Perfume Image:', perfume.image);
console.log('Updated Watch Image:', watch.image);
