# E-Commerce and Order Management

A beginner-friendly online shopping application built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express.js, and Supabase PostgreSQL.

## 1. Overview

This project demonstrates a small online store. Visitors can browse and search available products, filter by category, sort by price, add products to a cart, register or log in, place orders, and view their own order history. Product data, accounts, inventory, and orders are persisted in Supabase PostgreSQL.

**Important demo scope:** This MVP does not collect payment details or connect to a payment gateway. Orders are recorded with status `Placed`. It is intended for learning and demonstration, not as a production commerce platform.

## 2. Problem statement and objectives

Small sellers need a simple way to display products and keep customer orders organized. This project demonstrates how a browser UI, REST API, and relational database work together.

Objectives:
- Display products with prices, categories, descriptions, and stock availability.
- Search, filter, and sort products.
- Support account signup and login with hashed passwords.
- Maintain a per-session shopping cart and submit orders.
- Store order items and totals in PostgreSQL.
- Reduce stock atomically when an order is placed.
- Let a signed-in customer view only their own order history.

## 3. Users and features

- **Visitor:** browse, search, filter, and sort products; build a cart.
- **Customer:** sign up, log in, place orders, view personal orders, log out.
- **Admin:** an admin role exists in the schema for future development, but an admin dashboard is not included in this MVP.

## 4. Technology stack

- Frontend: HTML5, CSS3, Vanilla JavaScript.
- Backend: Node.js and Express.js.
- Database: Supabase PostgreSQL.
- Security helpers: `bcryptjs` (password hashing), `jsonwebtoken` (short-lived bearer tokens), `helmet`, and `express-rate-limit`.
- Version control: Git and GitHub.

## 5. Folder structure

```text
e-commerce-and-order-management/
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── backend/
│   ├── server.js
│   ├── supabase.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   └── orders.js
│   ├── middleware/
│   │   └── auth.js
│   ├── package.json
│   ├── .env
│   ├── .env.example
│   └── .gitignore
├── database/
│   └── schema.sql
├── .gitignore
└── README.md
```

`node_modules/` and `package-lock.json` are created by npm during installation and are not included in this starter archive.

## 6. Prerequisites

Install:
- Visual Studio Code: https://code.visualstudio.com/
- Node.js LTS (Node 20 or newer): https://nodejs.org/
- Git: https://git-scm.com/downloads
- A free Supabase account: https://supabase.com/

Verify Node and npm in a terminal:
```bash
node --version
npm --version
git --version
```

## 7. Supabase setup

1. Sign in to Supabase and create a new project. Save the database password privately.
2. Open **SQL Editor** in your project.
3. Open `database/schema.sql` in VS Code, copy the complete script, paste it into the SQL Editor, and click **Run**.
4. In **Table Editor**, confirm `app_users`, `products`, `orders`, and `order_items` exist. The `products` table should contain eight starter products.
5. Open **Project Settings → API** (or the project's API keys settings). Copy the project URL and the server-side secret/service-role key. Never put that key in frontend code or commit it to GitHub.

The SQL creates tables, constraints, indexes, an updated timestamp trigger, starter products, and a PostgreSQL function that places an order and decrements inventory in one transaction. RLS is enabled and direct `anon`/`authenticated` table access is revoked because the Express server is the only application data gateway in this design. The backend uses the privileged key, so its authorization checks are essential.

## 8. Environment configuration

1. Open a terminal in the project root, then run:
   ```bash
   cd backend
   npm install
   ```
2. Copy `.env.example` to `.env`:
   - Windows Command Prompt: `copy .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
   - macOS/Linux: `cp .env.example .env`
3. Edit `backend/.env` and set:
   ```env
   PORT=3000
   NODE_ENV=development
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SECRET_KEY
   JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
   ```
4. Generate a strong JWT secret from the `backend/` directory:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Copy the output into `JWT_SECRET`. Do not share it.
5. `.env` contains your real local secrets and is ignored by Git. `.env.example` contains placeholders and is safe to commit. Never put the service-role key in `frontend/`.

## 9. Run the application

From the `backend/` directory:
```bash
npm run dev
```
Expected terminal message:
```text
E-Commerce and Order Management running at http://localhost:3000
```
Open http://localhost:3000 in your browser. Do not open `frontend/index.html` directly from the file system; the API needs the Express server.

Check the API/database health at http://localhost:3000/api/health. A successful response looks like:
```json
{"status":"ok","database":"connected"}
```
If the response says `503`, check the Supabase URL, server-side key, SQL setup, and network connection.

To stop the server, focus the terminal and press `Ctrl+C`.

## 10. Architecture

```text
Browser (HTML/CSS/JS)
        | fetch() + JSON
        v
Express REST API (Node.js)
        | Supabase client (server-only secret)
        v
Supabase PostgreSQL
```

The frontend never connects to Supabase directly. Signup hashes passwords using bcrypt before saving. Login verifies the hash and returns a JWT that expires after two hours. The browser keeps the token in `sessionStorage` for the current tab session and sends it as a bearer token. The backend verifies the token and re-reads the active user from the database on protected requests.

## 11. API reference

All responses are JSON. Protected endpoints require `Authorization: Bearer <token>`.

| Method | Path | Purpose | Auth | Common errors |
|---|---|---|---|---|
| GET | `/api/health` | Check database connection | No | 503 database unavailable |
| POST | `/api/auth/signup` | Create customer account | No | 400 invalid input, 409 email exists, 429 rate limit |
| POST | `/api/auth/login` | Login | No | 400 invalid input, 401 invalid credentials, 429 rate limit |
| GET | `/api/auth/me` | Get current account | Customer token | 401 invalid/expired token |
| GET | `/api/products` | List active, in-stock products | No | 500 server/database error |
| GET | `/api/orders` | List current customer's orders | Customer token | 401 invalid/expired token |
| POST | `/api/orders` | Place order and decrement stock | Customer token | 400 invalid cart, 409 stock changed, 401 unauthorized |

Example signup request:
```json
{"name":"Asha Student","email":"asha@example.com","password":"strong-demo-password"}
```

Example order request:
```json
{"items":[{"productId":"PRODUCT_UUID_FROM_API","quantity":2}]}
```
The order total is calculated from current database prices, not a total supplied by the browser. Stock and order creation are handled by the database function in one transaction.

## 12. Using the app

1. Browse the product cards and use the search bar or category chips.
2. Add one or more products to the cart and change quantities.
3. Choose **Create account**, enter a name, email, and password of at least eight characters.
4. The account is created and signed in automatically.
5. Open the cart and choose **Place order**.
6. Choose **My orders** to review the order and status.
7. Use **Logout** when finished. A later visit requires logging in again.

The cart is held in browser memory only; refreshing the page clears it. Accounts, products, inventory, and placed orders are stored in Supabase.

## 13. Testing checklist

| Test | Expected result |
|---|---|
| Open `/api/health` with correct setup | JSON reports database connected |
| Open store | Products load from Supabase |
| Search for `headphones` | Matching product appears |
| Select a category | Only products in that category show |
| Sort low to high | Prices appear in ascending order |
| Signup with valid details | Account created and token returned |
| Signup with an existing email | Friendly duplicate-email error |
| Signup with short password or invalid email | Validation error |
| Login with wrong password | Generic invalid email/password error |
| Place order while logged out | Login dialog opens |
| Place order with valid cart | Order is saved and inventory decreases |
| Try ordering more than available stock | Order is rejected; stock is not oversold by the SQL transaction |
| View orders as a customer | Only that customer's order history appears |
| Call `/api/orders` without token | HTTP 401 |
| Resize browser to mobile width | Header and product grid adapt to screen |
| Stop or misconfigure Supabase | Health check fails and UI displays a useful error |

Run syntax checks from `backend/`:
```bash
npm run check
```
This checks JavaScript syntax; it does not prove that a live Supabase project is configured correctly. Test the live database using the health endpoint and the checklist above.

## 14. Troubleshooting

- **`JWT_SECRET must be set`**: set a random secret of at least 32 characters in `backend/.env`, then restart the server.
- **Supabase environment error**: verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, with no surrounding quotes or extra spaces.
- **Health endpoint returns 503**: make sure the SQL schema ran successfully and the URL/key belong to the same Supabase project.
- **Products do not load**: inspect the terminal for the server error and verify the `products` table has rows.
- **Email already exists**: use the login tab instead of signing up again.
- **401 on orders**: log in again; the token expires after two hours.
- **Stock conflict**: reload the store and update the cart.
- **Port already in use**: change `PORT` in `.env`, for example to `3001`, and open the matching localhost URL.
- **`npm` not recognized**: install Node.js LTS and reopen the terminal.
- **SQL function permission/operation errors**: rerun the complete `database/schema.sql` using the Supabase SQL Editor and confirm the function and tables exist.

## 15. Git and GitHub

1. Create a new empty repository on https://github.com/ (do not add a second README if you already have this one).
2. Open the terminal in the root `e-commerce-and-order-management/` folder.
3. Check ignored files:
   ```bash
   git status --ignored
   ```
4. Initialize and upload:
   ```bash
   git init
   git status
   git add .
   git status
   git commit -m "Build E-Commerce and Order Management"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPOSITORY_URL
   git push -u origin main
   ```
5. Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual GitHub repository URL. Verify the files appear on GitHub.

Before committing, ensure `backend/.env`, `node_modules/`, real keys, private customer data, and database exports are not tracked. The `.env.example` file should be included. `.gitignore` does not erase a secret that was committed earlier. If a key is exposed, rotate it immediately and clean repository history where appropriate.

## 16. Security notes and limitations

- Passwords are stored as bcrypt hashes, not plaintext.
- JWTs expire after two hours; this student MVP does not implement refresh tokens or a full account recovery flow.
- Login and API requests have rate limits, and Helmet adds common HTTP security headers.
- The Supabase privileged key is server-only. Because it bypasses RLS, keep backend authorization checks in place.
- There is no payment gateway, shipping integration, coupon system, product administration dashboard, email verification, or password reset in this MVP.
- Before production use, add a proper admin workflow, payment provider, CSRF/session strategy appropriate to the deployment, audit logging, monitoring, backups, and broader automated tests.
