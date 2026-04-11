const db = require('./db');

const perfume = db.prepare('SELECT name, image FROM products WHERE name LIKE ?').all('%Perfume%');
const watch = db.prepare('SELECT name, image FROM products WHERE name LIKE ?').all('%Watch%');

console.log('=== PERFUME ===');
console.log(perfume);
console.log('\n=== WATCH ===');
console.log(watch);
