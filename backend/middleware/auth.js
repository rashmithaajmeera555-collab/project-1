const jwt = require("jsonwebtoken");
const supabase = require("../supabase");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase.from("app_users")
      .select("id, name, email, role, is_active").eq("id", decoded.sub).maybeSingle();
    if (error || !user || !user.is_active) return res.status(401).json({ error: "Your session is invalid. Please log in again." });
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired or is invalid. Please log in again." });
  }
}

module.exports = { requireAuth };
