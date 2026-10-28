const API = "/api";
const state = { products: [], categories: [], category: "All", query: "", sort: "featured", cart: new Map(), user: null, authMode: "login" };
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value) || 0);
const safe = (value) => String(value ?? "");
let toastTimer;

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = sessionStorage.getItem("shop_token");
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      sessionStorage.removeItem("shop_token"); state.user = null; updateAuthButton();
    }
    throw new Error(payload.error || "Something went wrong. Please try again.");
  }
  return payload;
}
function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function showNotice(message = "") { $("#catalog-message").textContent = message; }
function iconFor(product) { return product.emoji || "🛍️"; }
function backgroundFor(product) { return product.color || "#f1f0ff"; }

function renderCategories() {
  const categories = ["All", ...new Set(state.products.map(p => p.category).filter(Boolean))];
  $("#category-list").replaceChildren();
  categories.forEach(category => {
    const button = document.createElement("button");
    button.className = `category-chip${state.category === category ? " active" : ""}`;
    button.type = "button"; button.textContent = category;
    button.addEventListener("click", () => { state.category = category; renderCategories(); renderProducts(); });
    $("#category-list").append(button);
  });
}
function getVisibleProducts() {
  let products = state.products.filter(p => p.active !== false && Number(p.stock) > 0);
  if (state.category !== "All") products = products.filter(p => p.category === state.category);
  if (state.query) {
    const q = state.query.toLowerCase();
    products = products.filter(p => [p.name, p.category, p.description].some(v => safe(v).toLowerCase().includes(q)));
  }
  if (state.sort === "price-asc") products.sort((a,b) => Number(a.price)-Number(b.price));
  if (state.sort === "price-desc") products.sort((a,b) => Number(b.price)-Number(a.price));
  if (state.sort === "name") products.sort((a,b) => a.name.localeCompare(b.name));
  return products;
}
function renderProducts() {
  const grid = $("#product-grid"); grid.replaceChildren();
  const products = getVisibleProducts();
  if (!products.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.style.gridColumn = "1/-1";
    const strong = document.createElement("strong"); strong.textContent = "No products found";
    const p = document.createElement("p"); p.textContent = "Try another search or category.";
    empty.append(strong,p); grid.append(empty); return;
  }
  products.forEach(product => {
    const card = document.createElement("article"); card.className = "product-card";
    const visual = document.createElement("div"); visual.className = "product-visual"; visual.style.setProperty("--product-bg", backgroundFor(product));
    const emoji = document.createElement("span"); emoji.textContent = iconFor(product); visual.append(emoji);
    if (product.tag) { const tag = document.createElement("span"); tag.className = "product-tag"; tag.textContent = product.tag; visual.append(tag); }
    const info = document.createElement("div"); info.className = "product-info";
    const category = document.createElement("div"); category.className = "product-category"; category.textContent = product.category;
    const name = document.createElement("h3"); name.textContent = product.name;
    const description = document.createElement("p"); description.className = "product-description"; description.textContent = product.description || "A great pick for everyday use.";
    const bottom = document.createElement("div"); bottom.className = "product-bottom";
    const price = document.createElement("span"); price.className = "product-price"; price.textContent = money(product.price);
    const add = document.createElement("button"); add.className = "add-button"; add.type = "button"; add.textContent = "+"; add.setAttribute("aria-label", `Add ${product.name} to cart`);
    add.addEventListener("click", () => addToCart(product));
    bottom.append(price,add); info.append(category,name,description,bottom); card.append(visual,info); grid.append(card);
  });
}
function addToCart(product) {
  const existing = state.cart.get(product.id);
  if (existing) {
    if (existing.quantity >= Number(product.stock)) return toast("You've reached the available stock for this item.");
    existing.quantity++;
  } else state.cart.set(product.id, { product, quantity: 1 });
  renderCart(); toast(`${product.name} added to your cart`);
}
function cartSubtotal() { return [...state.cart.values()].reduce((sum,item) => sum + Number(item.product.price)*item.quantity, 0); }
function renderCart() {
  const items = $("#cart-items"); items.replaceChildren();
  const count = [...state.cart.values()].reduce((sum,item) => sum+item.quantity,0);
  $("#cart-count").textContent = count; $("#cart-total").textContent = money(cartSubtotal());
  $("#checkout-button").disabled = count === 0;
  if (!count) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.innerHTML = "<strong>Your cart is waiting</strong><span>Add a product to get started.</span>"; items.append(empty); return;
  }
  state.cart.forEach((item,id) => {
    const row = document.createElement("div"); row.className = "cart-item";
    const visual = document.createElement("div"); visual.className = "cart-item-visual"; visual.style.background = backgroundFor(item.product); visual.textContent = iconFor(item.product);
    const details = document.createElement("div"); const name = document.createElement("h3"); name.textContent = item.product.name;
    const price = document.createElement("p"); price.textContent = money(item.product.price);
    const qty = document.createElement("div"); qty.className = "quantity-control";
    const minus = document.createElement("button"); minus.type="button"; minus.textContent="−"; minus.setAttribute("aria-label","Decrease quantity");
    const quantity = document.createElement("span"); quantity.textContent=item.quantity;
    const plus = document.createElement("button"); plus.type="button"; plus.textContent="+"; plus.setAttribute("aria-label","Increase quantity");
    minus.addEventListener("click",()=>{ if(item.quantity<=1) state.cart.delete(id); else item.quantity--; renderCart(); });
    plus.addEventListener("click",()=>{ if(item.quantity>=Number(item.product.stock)) return toast("Available stock limit reached."); item.quantity++; renderCart(); });
    qty.append(minus,quantity,plus);
    const remove = document.createElement("button"); remove.type="button"; remove.className="remove-item"; remove.textContent="Remove"; remove.addEventListener("click",()=>{state.cart.delete(id);renderCart();});
    details.append(name,price,qty,remove); row.append(visual,details); items.append(row);
  });
}
function openPanel(id) { $("#overlay").classList.remove("hidden"); $(id).classList.remove("hidden"); }
function closePanels() { $("#overlay").classList.add("hidden"); $("#cart-drawer").classList.add("hidden"); $("#auth-modal").classList.add("hidden"); }
function setAuthMode(mode) {
  state.authMode = mode; const signup = mode === "signup";
  $("#login-tab").classList.toggle("active",!signup); $("#signup-tab").classList.toggle("active",signup);
  $("#name-field").classList.toggle("hidden",!signup);
  $("#auth-title").textContent = signup ? "Create your account" : "Welcome back";
  $("#auth-subtitle").textContent = signup ? "Join us for a simpler shopping experience." : "Enter your details to continue.";
  $("#auth-submit").textContent = signup ? "Create account" : "Login";
  $("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("#auth-message").textContent = ""; $("#auth-message").classList.remove("success");
}
function openAuth(mode="login") { setAuthMode(mode); openPanel("#auth-modal"); }
function updateAuthButton() { $("#auth-nav").textContent = state.user ? "Logout" : "Login"; }
async function handleAuth(event) {
  event.preventDefault();
  const message = $("#auth-message"); message.textContent = ""; message.classList.remove("success");
  const mode = state.authMode;
  const body = { email: $("#auth-email").value.trim(), password: $("#auth-password").value };
  if (mode === "signup") body.name = $("#auth-name").value.trim();
  $("#auth-submit").disabled = true; $("#auth-submit").textContent = "Please wait…";
  try {
    const result = await api(`/auth/${mode}`, { method:"POST", body:JSON.stringify(body) });
    sessionStorage.setItem("shop_token", result.token); state.user = result.user; updateAuthButton(); closePanels();
    $("#auth-form").reset(); toast(mode === "signup" ? "Account created. Welcome!" : `Welcome back, ${state.user.name}!`);
    if (state.cart.size) $("#checkout-message").textContent = "";
  } catch(error) { message.textContent = error.message; }
  finally { $("#auth-submit").disabled = false; $("#auth-submit").textContent = mode === "signup" ? "Create account" : "Login"; }
}
async function checkout() {
  $("#checkout-message").textContent = ""; $("#checkout-message").classList.remove("success");
  if (!state.cart.size) return;
  if (!state.user) { closePanels(); openAuth("login"); $("#auth-message").textContent = "Please log in to place your order."; return; }
  const button = $("#checkout-button"); button.disabled = true; button.textContent = "Placing order…";
  try {
    const items = [...state.cart.values()].map(item => ({ productId:item.product.id, quantity:item.quantity }));
    const result = await api("/orders", {method:"POST",body:JSON.stringify({items})});
    state.cart.clear(); renderCart(); closePanels(); toast(`Order ${result.order.order_number} placed successfully!`);
    await loadProducts(); await showOrders();
  } catch(error) { $("#checkout-message").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Place order"; }
}
async function showOrders() {
  closePanels(); $("#hero").classList.add("hidden"); $(".benefits").classList.add("hidden"); $("#catalog").classList.add("hidden"); $("#orders-section").classList.remove("hidden");
  const list = $("#orders-list"); list.replaceChildren();
  if (!state.user) { const box = document.createElement("div"); box.className="empty-state"; const strong=document.createElement("strong");strong.textContent="Log in to see your orders";const p=document.createElement("p");p.textContent="Your order history is linked to your account.";const button=document.createElement("button");button.className="full-button";button.textContent="Login";button.style.maxWidth="180px";button.addEventListener("click",()=>openAuth("login"));box.append(strong,p,button);list.append(box);return; }
  list.innerHTML = '<p class="muted">Loading your orders…</p>';
  try {
    const data = await api("/orders"); list.replaceChildren();
    if (!data.orders.length) { const empty=document.createElement("div");empty.className="empty-state";empty.innerHTML="<strong>No orders yet</strong><span>Your placed orders will appear here.</span>";list.append(empty);return; }
    data.orders.forEach(order=>{
      const card=document.createElement("article");card.className="order-card";
      const top=document.createElement("div");top.className="order-top";
      const left=document.createElement("div");const title=document.createElement("h3");title.textContent=order.order_number;const date=document.createElement("p");date.textContent=new Date(order.created_at).toLocaleString();left.append(title,date);
      const status=document.createElement("span");status.className="status-pill";status.textContent=order.status;top.append(left,status);
      const itemList=document.createElement("div");itemList.className="order-items";
      (order.items||[]).forEach(item=>{const line=document.createElement("div");line.textContent=`${item.product_name} × ${item.quantity} — ${money(item.unit_price*item.quantity)}`;itemList.append(line);});
      const total=document.createElement("div");total.className="order-total";total.textContent=`Order total: ${money(order.total_amount)}`;card.append(top,itemList,total);list.append(card);
    });
  } catch(error) { list.replaceChildren(); const p=document.createElement("p");p.className="form-message";p.textContent=error.message;list.append(p); }
}
function showCatalog() { $("#hero").classList.remove("hidden");$(".benefits").classList.remove("hidden");$("#catalog").classList.remove("hidden");$("#orders-section").classList.add("hidden"); }
async function loadProducts() {
  showNotice("Loading products…");
  try { const result=await api("/products");state.products=result.products;showNotice("");renderCategories();renderProducts(); }
  catch(error) { showNotice(error.message);$("#product-grid").replaceChildren();const box=document.createElement("div");box.className="empty-state";box.style.gridColumn="1/-1";const strong=document.createElement("strong");strong.textContent="We couldn't load the store";const p=document.createElement("p");p.textContent="Check your server and Supabase setup, then refresh the page.";box.append(strong,p);$("#product-grid").append(box); }
}
async function restoreSession() {
  const token=sessionStorage.getItem("shop_token"); if(!token) return updateAuthButton();
  try { const result=await api("/auth/me");state.user=result.user; }
  catch { sessionStorage.removeItem("shop_token");state.user=null; }
  updateAuthButton();
}
$("#search-form").addEventListener("submit",event=>{event.preventDefault();state.query=$("#search-input").value.trim();showCatalog();renderProducts();$("#catalog").scrollIntoView({behavior:"smooth"});});
$("#search-input").addEventListener("input",()=>{state.query=$("#search-input").value.trim();renderProducts();});
$("#sort-select").addEventListener("change",event=>{state.sort=event.target.value;renderProducts();});
$("#cart-nav").addEventListener("click",()=>openPanel("#cart-drawer"));
$("#auth-nav").addEventListener("click",async()=>{if(state.user){sessionStorage.removeItem("shop_token");state.user=null;updateAuthButton();toast("You have logged out.");showCatalog();}else openAuth("login");});
$("#orders-nav").addEventListener("click",showOrders);
$("#back-shop").addEventListener("click",()=>{showCatalog();window.scrollTo({top:0,behavior:"smooth"});});
$("#checkout-button").addEventListener("click",checkout);
$("#login-tab").addEventListener("click",()=>setAuthMode("login"));
$("#signup-tab").addEventListener("click",()=>setAuthMode("signup"));
$("#auth-form").addEventListener("submit",handleAuth);
$("#overlay").addEventListener("click",closePanels);
document.querySelectorAll("[data-close]").forEach(button=>button.addEventListener("click",closePanels));
document.addEventListener("keydown",event=>{if(event.key==="Escape")closePanels();});
(async()=>{await restoreSession();await loadProducts();renderCart();})();
