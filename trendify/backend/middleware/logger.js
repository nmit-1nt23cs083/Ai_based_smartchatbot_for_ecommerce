const db = require("../db");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || 'trendify_secret_key_2024';

const logger = (req, res, next) => {
  let userId = "guest";

  // Try to get user ID from JWT token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id || decoded.email || "guest";
    } catch (err) {
      // Token invalid or expired, use guest
    }
  }

  // Fallback to session if available
  if (userId === "guest" && req.session?.userId) {
    userId = req.session.userId;
  }

  try {
    db.prepare(`
      INSERT INTO logs (userId, action, endpoint, method)
      VALUES (?, ?, ?, ?)
    `).run(userId, "API_CALL", req.originalUrl, req.method);
  } catch (err) {
    console.error("Logging error:", err.message);
  }

  next();
};

module.exports = logger;
