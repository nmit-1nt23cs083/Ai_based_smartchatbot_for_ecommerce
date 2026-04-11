const db = require('better-sqlite3')('./trendify.db', {readonly: true});

console.log('\n📋 Current CREATE TABLE in database:\n');
const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
if (sql) {
  console.log(sql.sql);
} else {
  console.log('❌ Table not found');
}

console.log('\n📊 Columns in users table:\n');
const cols = db.prepare('PRAGMA table_info(users)').all();
cols.forEach((c, i) => console.log(`${i+1}. ${c.name} (${c.type})`));

db.close();
