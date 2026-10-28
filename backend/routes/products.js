const express = require("express");
const supabase = require("../supabase");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("products")
      .select("id, name, description, category, price, stock, emoji, color, tag, active")
      .eq("active", true).gt("stock", 0).order("id");
    if (error) return next(error);
    res.json({ products: data });
  } catch (error) { next(error); }
});

module.exports = router;
