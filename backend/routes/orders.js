const express = require("express");
const { randomUUID } = require("crypto");
const supabase = require("../supabase");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("orders")
      .select("id, order_number, status, total_amount, created_at, order_items(id, product_name, quantity, unit_price)")
      .eq("user_id", req.user.id).order("created_at", { ascending: false });
    if (error) return next(error);
    const orders = (data || []).map(order => ({ ...order, items: order.order_items || [] }));
    orders.forEach(order => delete order.order_items);
    res.json({ orders });
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const input = req.body.items;
    if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
      return res.status(400).json({ error: "Your cart must contain between 1 and 30 different products." });
    }
    const quantities = new Map();
    for (const item of input) {
      if (!item || typeof item.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(item.productId) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return res.status(400).json({ error: "Each cart item must have a valid product ID and quantity from 1 to 99." });
      }
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    }
    const { data: products, error: productError } = await supabase.from("products")
      .select("id, name, price, stock, active").in("id", [...quantities.keys()]);
    if (productError) return next(productError);
    if (!products || products.length !== quantities.size) return res.status(400).json({ error: "One or more products are no longer available. Refresh the store." });
    const lines = [];
    let total = 0;
    for (const product of products) {
      const quantity = quantities.get(product.id);
      if (!product.active || product.stock < quantity) return res.status(409).json({ error: `${product.name} does not have enough stock. Please update your cart.` });
      const unitPrice = Number(product.price);
      total += unitPrice * quantity;
      lines.push({ product_id: product.id, product_name: product.name, quantity, unit_price: unitPrice });
    }
    // A single PostgreSQL function creates the order, reserves stock, and creates line items atomically.
    const { data, error } = await supabase.rpc("place_customer_order", {
      p_user_id: req.user.id,
      p_order_number: `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`,
      p_items: lines
    });
    if (error) {
      if (error.message && (error.message.includes("INSUFFICIENT_STOCK") || error.message.includes("PRODUCT_UNAVAILABLE"))) {
        return res.status(409).json({ error: "Stock changed while placing your order. Refresh products and try again." });
      }
      return next(error);
    }
    res.status(201).json({ order: data });
  } catch (error) { next(error); }
});

module.exports = router;
