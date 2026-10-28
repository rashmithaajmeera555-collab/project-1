const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many login attempts. Please wait 15 minutes and try again." } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "2h", issuer: "e-commerce-order-management" });
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }

router.post("/signup", authLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Name must contain 2–80 characters." });
    if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Password must contain 8–128 characters." });
    const password_hash = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase.from("app_users")
      .insert({ name, email, password_hash, role: "customer" })
      .select("id, name, email, role").single();
    if (error) {
      if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists. Please log in." });
      return next(error);
    }
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (!emailPattern.test(email) || !password) return res.status(400).json({ error: "Enter a valid email and password." });
    const { data: user, error } = await supabase.from("app_users")
      .select("id, name, email, role, password_hash, is_active").eq("email", email).maybeSingle();
    if (error) return next(error);
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password. Please try again." });
    }
    return res.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

module.exports = router;
