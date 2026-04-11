# Trendify — Full-Stack eCommerce

A complete eCommerce website with Node.js backend, SQLite database, and modern frontend.

## Tech Stack

- **Frontend**: HTML5, CSS3 (custom design system), Vanilla JS
- **Backend**: Node.js (Express.js)
- **Database**: SQLite3 (via `better-sqlite3`)
- **Auth**: JWT tokens + bcrypt password hashing
- **File Uploads**: Multer (product images)

## Project Structure

```
trendify/
├── backend/
│   ├── server.js          # Main Express app
│   ├── db.js              # SQLite setup & seed
│   ├── routes/
│   │   ├── auth.js        # Register, login, logout
│   │   ├── products.js    # CRUD products
│   │   ├── cart.js        # Cart management
│   │   ├── orders.js      # Checkout & orders
│   │   └── admin.js       # Admin dashboard API
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   ├── uploads/           # Product images
│   └── package.json
├── frontend/
│   ├── index.html         # Home / shop page
│   ├── login.html         # Login & Register
│   ├── cart.html          # Shopping cart
│   ├── checkout.html      # Checkout page
│   ├── product.html       # Product detail
│   ├── admin.html         # Admin dashboard
│   └── assets/
│       ├── css/
│       │   ├── main.css   # Design system
│       │   └── admin.css  # Admin styles
│       └── js/
│           ├── api.js     # API client
│           ├── auth.js    # Auth helpers
│           ├── cart.js    # Cart logic
│           ├── shop.js    # Shop page
│           └── admin.js   # Admin page
└── README.md
```

## Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.4.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "multer": "^1.4.5-lts.1"
  }
}
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Start Server
```bash
node server.js
```

### 4. Open Frontend
Open `frontend/index.html` in browser, or serve with:
```bash
npx serve frontend -p 3001
```

## Default Admin Account
- Email: `admin@trendify.com`
- Password: `admin123`

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | None | Create account |
| POST | /api/auth/login | None | Login |
| GET | /api/products | None | List products |
| GET | /api/products/:id | None | Product detail |
| GET | /api/cart | User | Get cart |
| POST | /api/cart/add | User | Add to cart |
| PUT | /api/cart/:id | User | Update quantity |
| DELETE | /api/cart/:id | User | Remove item |
| POST | /api/orders/checkout | User | Place order |
| GET | /api/orders | User | My orders |
| GET | /api/admin/stats | Admin | Dashboard stats |
| POST | /api/admin/products | Admin | Add product |
| PUT | /api/admin/products/:id | Admin | Edit product |
| DELETE | /api/admin/products/:id | Admin | Delete product |
