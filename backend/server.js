require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const supabase = require("./supabase");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set in backend/.env and contain at least 32 characters.");
  process.exit(1);
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.");
  process.exit(1);
}

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: "20kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.get("/api/health", async (req, res) => {
  try {
    const { error } = await supabase.from("products").select("id", { count: "exact", head: true });
    if (error) return res.status(503).json({ status: "degraded", database: "unavailable" });
    res.json({ status: "ok", database: "connected" });
  } catch { res.status(503).json({ status: "degraded", database: "unavailable" }); }
});

app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});
app.use((req, res) => res.status(404).json({ error: "The requested resource was not found." }));
app.use((error, req, res, next) => {
  console.error("Request failed:", error && error.message ? error.message : "Unknown error");
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "A server error occurred. Check server configuration and try again." });
});

app.listen(PORT, () => console.log(`E-Commerce and Order Management running at http://localhost:${PORT}`));
