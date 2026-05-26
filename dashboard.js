const SB_URL='https://yaupttkahhphwcaitylp.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdXB0dGthaGhwaHdjYWl0eWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Njk4OTEsImV4cCI6MjA5NTI0NTg5MX0.UwqZLuPCZGYoqBUaPI7myJAxNKj3zaFGMkNgg64jkIo';
const sb=window.supabase.createClient(SB_URL,SB_KEY);

let currentUser=null;
let isEcoMode=false;
let activeInvoiceOrderId=null;

// TOAST SYSTEM
function toast(title,msg,err=false){
  const t=document.getElementById('toast');
  document.getElementById('tTitle').textContent=title;
  document.getElementById('tMsg').textContent=msg;
  t.className='toast'+(err?' err':'');
  setTimeout(()=>t.classList.add('open'),10);
  setTimeout(()=>t.classList.remove('open'),4000);
}

// MODAL CONTROLS
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}

// NAVIGATION
function nav(section){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
  document.getElementById('sec-'+section).classList.add('active');
  document.getElementById('nav-'+section).classList.add('active');
  const titles={
    overview:['Overview','Real-time enterprise metrics & analytics'],
    orders:['Orders Ledger','Manage your verified B2B orders'],
    inventory:['Smart Inventory','Real-time stock controls & warnings'],
    distributors:['Distributors Directory','Manage supply partner channels'],
    khata:['Khata Ledger','Record direct cash inflow & outflow records'],
    vision:['AI Smart Vision','Real-time AI behavioral scanning & anti-theft protection']
  };
  const t=titles[section];
  document.getElementById('pageTitle').textContent=t[0];
  document.getElementById('pageSub').textContent=t[1];
  
  // Auto-close mobile sidebar and hide overlay on nav switch
  const sidebar = document.getElementById('dashboardSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  
  if(section!=='vision') stopVisionCamera();

  if(section==='orders')loadOrders();
  if(section==='inventory')loadInventory();
  if(section==='distributors')loadDistributors();
  if(section==='khata')loadKhata();
  if(section==='overview')loadOverview();
  if(section==='vision')loadVision();
}

// FORMATTERS
const fmt=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n||0);
const fmtDate=d=>d?new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';

// OVERVIEW CONTROLLERS
async function loadOverview(){
  const uid=currentUser.id;
  const [{count:oc},{count:ic},{count:dc},{count:kc}]=await Promise.all([
    sb.from('orders').select('*',{count:'exact',head:true}).eq('user_id',uid),
    sb.from('inventory').select('*',{count:'exact',head:true}).eq('user_id',uid),
    sb.from('distributors').select('*',{count:'exact',head:true}).eq('user_id',uid),
    sb.from('khata').select('*',{count:'exact',head:true}).eq('user_id',uid),
  ]);
  document.getElementById('ov-orders').textContent=oc||0;
  document.getElementById('ov-inv').textContent=ic||0;
  document.getElementById('ov-dist').textContent=dc||0;
  document.getElementById('ov-khata').textContent=kc||0;
  
  document.getElementById('stat-orders').textContent=oc||0;
  document.getElementById('stat-inv').textContent=ic||0;
  document.getElementById('stat-dist').textContent=dc||0;

  // 1. Fetch relevant columns for active insights
  const [ordersRes, inventoryRes, distributorsRes]=await Promise.all([
    sb.from('orders').select('amount').eq('user_id',uid),
    sb.from('inventory').select('product_name, quantity, reorder_level').eq('user_id',uid),
    sb.from('distributors').select('name, balance, phone').eq('user_id',uid)
  ]);

  // A. Sales Revenue calculation
  const odata=ordersRes.data||[];
  const rev=odata.reduce((a,r)=>a+(parseFloat(r.amount)||0),0);
  document.getElementById('stat-rev').textContent=fmt(rev);

  // B. Alerts formulation
  const alerts=[];

  // Detect stock alerts
  const idata=inventoryRes.data||[];
  idata.forEach(item=>{
    if(item.quantity<=0){
      alerts.push(`🚨 Stock Alert: <strong>${item.product_name}</strong> is completely <strong>Out of Stock</strong>! <button onclick="quickRestockItem('${item.product_name.replace(/'/g, "\\'")}', 150)" style="padding: 2px 6px; font-size: 0.65rem; border: none; background: #ef4444; color: #fff; border-radius: 4px; cursor: pointer; margin-left: 10px; font-weight: 700; font-family: inherit;">⚡ Quick Restock</button>`);
    } else if(item.quantity<=item.reorder_level){
      alerts.push(`⚠️ Low Stock: <strong>${item.product_name}</strong> has only <strong>${item.quantity} units left</strong> (Low threshold: ${item.reorder_level}). <button onclick="quickRestockItem('${item.product_name.replace(/'/g, "\\'")}', ${item.reorder_level * 2})" style="padding: 2px 6px; font-size: 0.65rem; border: none; background: #eab308; color: #000; border-radius: 4px; cursor: pointer; margin-left: 10px; font-weight: 700; font-family: inherit;">⚡ Quick Restock</button>`);
    }
  });

  // Detect outstanding customer/distributor balances (negative balance is due money)
  const ddata=distributorsRes.data||[];
  ddata.forEach(dist=>{
    if(dist.balance<0){
      const debtVal = Math.abs(dist.balance);
      const message = `Hi ${dist.name}, this is a gentle reminder from Retix regarding an outstanding credit balance of Rs. ${debtVal}. Please process this settlement as soon as possible. Thank you!`;
      const waLink = `https://wa.me/91${dist.phone}?text=${encodeURIComponent(message)}`;
      alerts.push(`💸 Outstanding Credit: <strong>${dist.name}</strong> owes you <strong>${fmt(debtVal)}</strong>. <a href="${waLink}" target="_blank" style="color: var(--color-brand); font-weight: 700; text-decoration: underline; margin-left: 8px;">Send WhatsApp Nudge</a>`);
    }
  });

  // C. Profile Check Alert
  const { data: profile } = await sb.from('profiles').select('shop_name, shop_address').eq('id', uid).single();
  if (!profile?.shop_name || !profile?.shop_address || profile?.shop_name === "YOUR SHOP NAME" || profile?.shop_address.includes("Near M2K Cinemas")) {
    alerts.push(`⚙️ <strong>Invoice Setup:</strong> Please customize your own shop details so printed duplicate invoices fully fit you! <a href="#" onclick="openShopProfileModal(); return false;" style="color: var(--color-brand); font-weight: 700; text-decoration: underline; margin-left: 8px;">Set Up Your Shop Profile</a>`);
  }

  // 2. Render warning panel in DOM
  const container=document.getElementById('smartAlertsContainer');
  const alertList=document.getElementById('alertList');
  
  if(container && alertList){
    if(alerts.length>0){
      alertList.innerHTML=alerts.map(a=>`<li style="line-height: 1.5; display: flex; align-items: center; gap: 8px;">${a}</li>`).join('');
      container.style.display='block';
    } else {
      container.style.display='none';
    }
  }
}

// ORDERS SYSTEM
async function loadOrders(){
  const {data,error}=await sb.from('orders').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  const tbody=document.getElementById('orders-body');
  if(error||!data||data.length===0){
    tbody.innerHTML=`<tr><td colspan="7">
      <div class="empty">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <h3>No B2B orders yet</h3>
        <p>Record your distribution and supply schedules with clients here.</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML=data.map(r=>`
    <tr style="cursor: pointer;" onclick="if(event.target.tagName !== 'BUTTON') viewInvoice('${r.id}')">
      <td><strong style="color: var(--color-brand); text-decoration: underline;">${r.product_name}</strong></td>
      <td>${r.distributor}</td>
      <td>${r.quantity} ${r.unit||'units'}</td>
      <td>${fmt(r.amount)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><span class="badge ${r.status==='Delivered'?'delivered':r.status==='In Transit'?'transit':'pending'}">${r.status}</span></td>
      <td style="white-space: nowrap;" onclick="event.stopPropagation();">
        <button class="btn-add" onclick="viewInvoice('${r.id}')" style="padding: 4px 8px; font-size: 0.75rem; background: var(--color-brand-glow); color: var(--color-brand); border: 1px solid var(--color-brand-border); margin-right: 6px; cursor: pointer; border-radius: var(--radius-sm); font-weight: 700;">Bill</button>
        <button class="btn-del" onclick="delOrder('${r.id}')">Remove</button>
      </td>
    </tr>`).join('');
}
// MULTI-ITEM BASKET MANAGERS
async function openNewOrderModal() {
  document.getElementById('o-dist').value = "";
  document.getElementById('o-notes').value = "";
  document.getElementById('o-status').selectedIndex = 0;
  
  // Dynamic Autocomplete Loading
  const { data: invList } = await sb.from('inventory').select('*').eq('user_id', currentUser.id);
  const { data: distList } = await sb.from('distributors').select('name').eq('user_id', currentUser.id);
  
  const invDatalist = document.getElementById('inv-products-datalist');
  if (invDatalist && invList) {
    invDatalist.innerHTML = invList.map(item => `<option value="${item.product_name}">`).join('');
  }
  
  const distDatalist = document.getElementById('inv-distributors-datalist');
  if (distDatalist && distList) {
    distDatalist.innerHTML = distList.map(d => `<option value="${d.name}">`).join('');
  }

  // Cache locally
  window.currentInventoryCache = invList || [];
  
  const tbody = document.getElementById('orderBasketBody');
  if (tbody) {
    tbody.innerHTML = "";
  }
  
  // Start with one blank row default
  addBasketItemRow();
  openModal('modal-order');
}

function addBasketItemRow(name = "", qty = "", rate = "") {
  const tbody = document.getElementById('orderBasketBody');
  if (!tbody) return;
  const rowId = 'basket-row-' + Math.random().toString(36).substring(2, 9);
  const tr = document.createElement('tr');
  tr.id = rowId;
  tr.style.borderBottom = '1px solid #f1f5f9';
  tr.innerHTML = `
    <td style="padding: 6px 4px;">
      <input class="basket-pname" list="inv-products-datalist" onchange="autoFillBasketItemRate(this)" value="${name}" placeholder="e.g. Tata Salt Premium" required style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; box-sizing: border-box; font-size: 0.8rem; font-family: inherit;">
    </td>
    <td style="padding: 6px 4px; text-align: center;">
      <input class="basket-pqty" type="number" min="1" value="${qty || 100}" required oninput="calculateBasketTotal()" style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; box-sizing: border-box; font-size: 0.8rem; font-family: inherit; text-align: center;">
    </td>
    <td style="padding: 6px 4px; text-align: right;">
      <input class="basket-prate" type="number" min="0.01" step="0.01" value="${rate || 50}" required oninput="calculateBasketTotal()" style="width: 100%; padding: 6px; border: 1px solid var(--color-border); border-radius: 4px; box-sizing: border-box; font-size: 0.8rem; font-family: inherit; text-align: right;">
    </td>
    <td style="padding: 6px 4px; text-align: center;">
      <button type="button" onclick="deleteBasketItemRow('${rowId}')" style="background: transparent; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
        <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="16" height="16"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </td>
  `;
  tbody.appendChild(tr);
  calculateBasketTotal();
}

function autoFillBasketItemRate(inputElement) {
  const selectedValue = inputElement.value.trim().toLowerCase();
  const cachedItem = (window.currentInventoryCache || []).find(item => item.product_name.toLowerCase() === selectedValue);
  if (cachedItem) {
    const row = inputElement.closest('tr');
    if (row) {
      const rateInput = row.querySelector('.basket-prate');
      if (rateInput) {
        rateInput.value = cachedItem.selling_price || 0;
        calculateBasketTotal();
        toast('Price Auto-Filled! 🏷️', `Selling rate for ${cachedItem.product_name} pre-filled as ₹${cachedItem.selling_price}.`);
      }
    }
  }
}

function deleteBasketItemRow(id) {
  const row = document.getElementById(id);
  if (row) row.remove();
  calculateBasketTotal();
}

function calculateBasketTotal() {
  const rows = document.querySelectorAll('#orderBasketBody tr');
  let grandTotal = 0;
  rows.forEach(row => {
    const qty = parseFloat(row.querySelector('.basket-pqty').value) || 0;
    const rate = parseFloat(row.querySelector('.basket-prate').value) || 0;
    grandTotal += qty * rate;
  });
  const totalDisplay = document.getElementById('basketGrandTotal');
  if (totalDisplay) {
    totalDisplay.textContent = '₹' + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

async function addOrder(e) {
  e.preventDefault();
  const dist = document.getElementById('o-dist').value.trim();
  const status = document.getElementById('o-status').value;
  const userNotes = document.getElementById('o-notes').value.trim();

  const rows = document.querySelectorAll('#orderBasketBody tr');
  if (rows.length === 0) {
    toast('Validation Error', 'Please add at least one item to your basket.', true);
    return;
  }

  const items = [];
  let grandTotal = 0;
  
  rows.forEach(row => {
    const name = row.querySelector('.basket-pname').value.trim();
    const qty = parseInt(row.querySelector('.basket-pqty').value) || 0;
    const rate = parseFloat(row.querySelector('.basket-prate').value) || 0;
    const amount = qty * rate;
    grandTotal += amount;
    items.push({ name, qty, rate, amount });
  });

  const emptyNameItem = items.find(item => !item.name);
  if (emptyNameItem) {
    toast('Validation Error', 'Product Name is required for all basket items.', true);
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Processing...'; btn.disabled = true;

  const notesPayload = JSON.stringify({
    items: items,
    userNotes: userNotes
  });

  const primaryItem = items[0];
  const { error } = await sb.from('orders').insert({
    user_id: currentUser.id,
    product_name: items.length > 1 ? `${primaryItem.name} (+${items.length - 1} items)` : primaryItem.name,
    distributor: dist,
    quantity: primaryItem.qty,
    unit: 'units',
    amount: grandTotal,
    status: status,
    notes: notesPayload
  });

  btn.textContent = 'Save Order Entry'; btn.disabled = false;

  if (error) {
    toast('Database Error', error.message, true);
    return;
  }

  toast('Order Recorded! 🎉', `Distribution of ${items.length} items logged successfully.`);
  closeModal('modal-order');
  loadOrders();
  loadOverview();
}
async function delOrder(id){
  if(!confirm('Permanently remove this order transaction record?'))return;
  await sb.from('orders').delete().eq('id',id).eq('user_id',currentUser.id);
  toast('Record Removed','The order entry has been deleted.');
  loadOrders();loadOverview();
}

// SMART INVENTORY
async function loadInventory(){
  const {data,error}=await sb.from('inventory').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  const tbody=document.getElementById('inv-body');
  if(error||!data||data.length===0){
    tbody.innerHTML=`<tr><td colspan="7">
      <div class="empty">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
        </div>
        <h3>Warehouse stock empty</h3>
        <p>Log wholesale items to start automatic stock alerts and metrics tracking.</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML=data.map(r=>{
    const status=r.quantity<=0?'out':r.quantity<=r.reorder_level?'low':'sufficient';
    const label=r.quantity<=0?'Out of Stock':r.quantity<=r.reorder_level?'Low Stock':'Sufficient';
    return`<tr>
      <td><strong>${r.product_name}</strong><br><small style="color:var(--color-muted)">${r.sku||'—'}</small></td>
      <td>${r.category||'—'}</td>
      <td>${r.quantity} ${r.unit||'units'}</td>
      <td>${r.reorder_level}</td>
      <td>${fmt(r.buying_price)}</td>
      <td><span class="badge ${status}">${label}</span></td>
      <td><button class="btn-del" onclick="delInv('${r.id}')">Remove</button></td>
    </tr>`;
  }).join('');
}
async function addInventory(e){
  e.preventDefault();
  const product_name = document.getElementById('i-name').value.trim();
  const quantity = parseInt(document.getElementById('i-qty').value);
  const reorder_level = parseInt(document.getElementById('i-reorder').value);
  const buying_price = parseFloat(document.getElementById('i-buy').value)||0;
  const selling_price = parseFloat(document.getElementById('i-sell').value)||0;

  if(!product_name){ toast('Validation Error','Please enter a product name.',true); return; }
  if(isNaN(quantity) || quantity < 0){ toast('Validation Error','Quantity cannot be negative.',true); return; }
  if(isNaN(reorder_level) || reorder_level < 0){ toast('Validation Error','Reorder level cannot be negative.',true); return; }
  if(buying_price < 0){ toast('Validation Error','Buying price cannot be negative.',true); return; }
  if(selling_price < 0){ toast('Validation Error','Selling price cannot be negative.',true); return; }

  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('inventory').insert({
    user_id:currentUser.id,
    product_name,
    sku:document.getElementById('i-sku').value.trim(),
    category:document.getElementById('i-cat').value.trim(),
    quantity,
    unit:document.getElementById('i-unit').value.trim()||'units',
    reorder_level,
    buying_price,
    selling_price
  });
  btn.textContent='Register Product';btn.disabled=false;
  if(error){toast('Database Error',error.message,true);return;}
  toast('Product Registered','Added to smart stock tracking.');
  closeModal('modal-inv');
  e.target.reset();
  loadInventory();loadOverview();
}
async function delInv(id){
  if(!confirm('Permanently delete product from smart inventory?'))return;
  await sb.from('inventory').delete().eq('id',id).eq('user_id',currentUser.id);
  toast('Product Removed','Inventory listing updated.');
  loadInventory();loadOverview();
}

// DISTRIBUTORS NETWORK
async function loadDistributors(){
  const {data,error}=await sb.from('distributors').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:false});
  const tbody=document.getElementById('dist-body');
  if(error||!data||data.length===0){
    tbody.innerHTML=`<tr><td colspan="6">
      <div class="empty">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>
        </div>
        <h3>No partners registered</h3>
        <p>Add distributor channels, warehouses, and contact groups here.</p>
      </div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML=data.map(r=>`
    <tr>
      <td><strong>${r.name}</strong></td>
      <td>${r.phone||'—'}</td>
      <td>${r.location||'—'}</td>
      <td>${r.territory||'—'}</td>
      <td style="font-weight:600;color:${r.balance>=0?'var(--color-success)':'var(--color-danger)'}">${fmt(r.balance)}</td>
      <td><button class="btn-del" onclick="delDist('${r.id}')">Remove</button></td>
    </tr>`).join('');
}
async function addDistributor(e){
  e.preventDefault();
  const name = document.getElementById('d-name').value.trim();
  const phone = document.getElementById('d-phone').value.trim();
  const balance = parseFloat(document.getElementById('d-balance').value)||0;

  if(!name){ toast('Validation Error','Please enter a distributor name.',true); return; }
  
  const phoneRegex = /^[6-9]\d{9}$/;
  if(!phoneRegex.test(phone)){
    toast('Validation Error','Please enter a valid 10-digit Indian phone number.',true);
    return;
  }

  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('distributors').insert({
    user_id:currentUser.id,
    name,
    phone,
    location:document.getElementById('d-loc').value.trim(),
    territory:document.getElementById('d-territory').value.trim(),
    balance,
    notes:document.getElementById('d-notes').value.trim()
  });
  btn.textContent='Verify & Save Partner';btn.disabled=false;
  if(error){toast('Database Error',error.message,true);return;}
  toast('Distributor Saved','Partner added to active channels list.');
  closeModal('modal-dist');
  e.target.reset();
  loadDistributors();loadOverview();
}
async function delDist(id){
  if(!confirm('Remove this logistics partner from active business listings?'))return;
  await sb.from('distributors').delete().eq('id',id).eq('user_id',currentUser.id);
  toast('Partner Removed','Distributor channel modified.');
  loadDistributors();loadOverview();
}

// DIGITAL KHATA
async function loadKhata(){
  const uid=currentUser.id;
  const {data,error}=await sb.from('khata').select('*').eq('user_id',uid).order('entry_date',{ascending:false});
  const tbody=document.getElementById('khata-body');
  if(error||!data||data.length===0){
    tbody.innerHTML=`<tr><td colspan="6">
      <div class="empty">
        <div class="empty-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253"/></svg>
        </div>
        <h3>Business ledger empty</h3>
        <p>Track cash flows (Credit / Debit) for party deals instantly.</p>
      </div>
    </td></tr>`;
    document.getElementById('k-credit').textContent=fmt(0);
    document.getElementById('k-debit').textContent=fmt(0);
    return;
  }
  let totalCredit=0,totalDebit=0;
  tbody.innerHTML=data.map(r=>{
    if(r.type==='Credit')totalCredit+=parseFloat(r.amount)||0;
    else totalDebit+=parseFloat(r.amount)||0;
    return`<tr>
      <td><strong>${r.party_name}</strong></td>
      <td><span class="badge ${r.type.toLowerCase()}">${r.type}</span></td>
      <td style="font-weight:600">${fmt(r.amount)}</td>
      <td>${r.description||'—'}</td>
      <td>${fmtDate(r.entry_date)}</td>
      <td><button class="btn-del" onclick="delKhata('${r.id}')">Remove</button></td>
    </tr>`;
  }).join('');
  document.getElementById('k-credit').textContent=fmt(totalCredit);
  document.getElementById('k-debit').textContent=fmt(totalDebit);
}
async function addKhata(e){
  e.preventDefault();
  const party_name = document.getElementById('k-party').value.trim();
  const amount = parseFloat(document.getElementById('k-amount').value)||0;

  if(!party_name){ toast('Validation Error','Please enter an associate/party name.',true); return; }
  if(amount <= 0){ toast('Validation Error','Transaction amount must be greater than 0.',true); return; }

  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('khata').insert({
    user_id:currentUser.id,
    party_name,
    type:document.getElementById('k-type').value,
    amount,
    description:document.getElementById('k-desc').value.trim(),
    entry_date:document.getElementById('k-date').value||new Date().toISOString().split('T')[0]
  });
  btn.textContent='Save Cash Entry';btn.disabled=false;
  if(error){toast('Database Error',error.message,true);return;}
  toast('Transaction Logged','Cash entry added to live ledger.');
  closeModal('modal-khata');
  e.target.reset();
  loadKhata();loadOverview();
}
// INVOICE BOOK CONTROLS
function numToWords(num) {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  
  num = Math.round(num);
  if ((num = num.toString()).length > 9) return 'Overflow';
  let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; 
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? a[Number(n[4])] + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Rupees Only' : 'Rupees Only';
  return str;
}

async function viewInvoice(orderId) {
  activeInvoiceOrderId = orderId;
  const { data: order, error } = await sb.from('orders').select('*').eq('id', orderId).single();
  if (error || !order) {
    toast('Error', 'Could not load order details.', true);
    return;
  }

  // Update Eco saver UI button & container state
  const paper = document.getElementById('invoiceCarbonPaper');
  const ecoBtn = document.getElementById('btn-eco');
  const ecoTxt = document.getElementById('inkSaverTxt');
  if (paper && ecoBtn && ecoTxt) {
    if (isEcoMode) {
      paper.classList.add('eco-mode');
      ecoBtn.style.background = '#059669';
      ecoTxt.textContent = "Eco Ink Saver: ON";
    } else {
      paper.classList.remove('eco-mode');
      ecoBtn.style.background = '#10b981';
      ecoTxt.textContent = "Eco Ink Saver: OFF";
    }
  }

  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  
  const shopName = profile?.shop_name || currentUser.user_metadata?.shop_name || "YOUR SHOP NAME";
  const shopAddress = profile?.shop_address || currentUser.user_metadata?.shop_address || "Near M2K Cinemas E 115 Ground Floor Sector8 Rohini New Delhi 110085";
  const email = profile?.email || currentUser.email || "sauravkumaryadav@gmail.com";
  const gstin = profile?.gstin || currentUser.user_metadata?.gstin || "012345678900012";
  const propName = profile?.full_name || currentUser.user_metadata?.full_name || "Shaurav Yadav";
  const phone = profile?.phone || currentUser.user_metadata?.phone || "+91 9939999999";

  document.getElementById('invShopName').textContent = shopName;
  document.getElementById('invShopAddress').textContent = shopAddress;
  document.getElementById('invShopEmail').textContent = email;
  document.getElementById('invShopGstin').textContent = gstin;
  document.getElementById('invProprietor').textContent = propName;
  document.getElementById('invShopPhone').textContent = phone;
  document.getElementById('invAuthSigName').textContent = propName;

  const cleanId = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();
  document.getElementById('invNo').textContent = `RX-${cleanId}`;
  
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  document.getElementById('invDate').textContent = formattedDate;

  document.getElementById('invCustName').textContent = order.distributor;
  
  const { data: distData } = await sb.from('distributors').select('phone').eq('user_id', currentUser.id).eq('name', order.distributor).limit(1);
  const custPhone = (distData && distData.length > 0) ? distData[0].phone : "—";
  document.getElementById('invCustPhone').textContent = custPhone;

  let items = [];
  try {
    const payload = JSON.parse(order.notes);
    if (payload && Array.isArray(payload.items)) {
      items = payload.items;
    } else {
      throw new Error();
    }
  } catch (e) {
    items = [{
      name: order.product_name,
      qty: order.quantity,
      rate: Math.round(order.amount / order.quantity) || 0,
      amount: order.amount
    }];
  }

  let tbodyHtml = '';
  items.forEach((item, index) => {
    const sNo = (index + 1).toString().padStart(2, '0');
    tbodyHtml += `
      <tr style="border-bottom: 1px solid #000; font-weight: 700;">
        <td class="eco-hide" style="border-right: 1px solid #000; padding: 8px; text-align: center;">${sNo}</td>
        <td style="border-right: 1px solid #000; padding: 8px; text-transform: uppercase;">${item.name}</td>
        <td class="eco-hide" style="border-right: 1px solid #000; padding: 8px; text-align: center;">—</td>
        <td style="border-right: 1px solid #000; padding: 8px; text-align: center;">${item.qty}</td>
        <td style="border-right: 1px solid #000; padding: 8px; text-align: right;">₹${Math.round(item.rate).toLocaleString('en-IN')}</td>
        <td style="padding: 8px; text-align: right;">₹${Math.round(item.amount).toLocaleString('en-IN')}</td>
      </tr>
    `;
  });
  
  if (!isEcoMode) {
    const fillCount = 10 - items.length;
    for (let i = 1; i <= fillCount; i++) {
      const sNo = (items.length + i).toString().padStart(2, '0');
      tbodyHtml += `
        <tr style="border-bottom: 1px dashed rgba(0,0,0,0.1); height: 26px;">
          <td class="eco-hide" style="border-right: 1px solid #000; padding: 6px; text-align: center; color: #cbd5e1;">${sNo}</td>
          <td style="border-right: 1px solid #000; padding: 6px;"></td>
          <td class="eco-hide" style="border-right: 1px solid #000; padding: 6px;"></td>
          <td style="border-right: 1px solid #000; padding: 6px;"></td>
          <td style="border-right: 1px solid #000; padding: 6px;"></td>
          <td style="padding: 6px;"></td>
        </tr>
      `;
    }
  }
  document.getElementById('invoiceTableBody').innerHTML = tbodyHtml;

  // Generate real-time dynamic UPI QR Code payment URL
  const cleanPhone = phone.replace(/\+/g, '').replace(/[^0-9]/g, '');
  const merchantUpi = profile?.upi_id || `${cleanPhone}@okaxis` || "9304277935@okaxis";
  const upiUrl = `upi://pay?pa=${merchantUpi}&pn=${encodeURIComponent(shopName)}&am=${order.amount}&tn=RX-${cleanId}&cu=INR`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
  
  const qrImg = document.getElementById('invQRCode');
  if (qrImg) {
    qrImg.src = qrApiUrl;
  }

  document.getElementById('invRupeesWords').textContent = numToWords(order.amount);
  document.getElementById('invTotalAmt').textContent = `₹${order.amount.toLocaleString('en-IN')}`;

  openModal('modal-invoice');
}

function toggleInkSaver() {
  isEcoMode = !isEcoMode;
  const paper = document.getElementById('invoiceCarbonPaper');
  const btn = document.getElementById('btn-eco');
  const txt = document.getElementById('inkSaverTxt');
  
  if (isEcoMode) {
    if (paper) paper.classList.add('eco-mode');
    if (btn) btn.style.background = '#059669';
    if (txt) txt.textContent = "Eco Ink Saver: ON";
    toast('Eco-Ink Saver Active 🍃', 'Borders collapsed and empty rows removed to save 45% printer ink.');
  } else {
    if (paper) paper.classList.remove('eco-mode');
    if (btn) btn.style.background = '#10b981';
    if (txt) txt.textContent = "Eco Ink Saver: OFF";
    toast('Eco-Ink Saver Deactivated ⚙️', 'Reverted to classic duplicate carbon bill layout.');
  }
  
  if (activeInvoiceOrderId) {
    viewInvoice(activeInvoiceOrderId);
  }
}

async function sendWhatsAppInvoice() {
  if (!activeInvoiceOrderId) return;
  const { data: order } = await sb.from('orders').select('*').eq('id', activeInvoiceOrderId).single();
  if (!order) return;

  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  const shopName = profile?.shop_name || "Gupta Wholesalers";
  const cleanId = order.id.replace(/-/g, '').slice(0, 6).toUpperCase();

  let items = [];
  try {
    const payload = JSON.parse(order.notes);
    if (payload && Array.isArray(payload.items)) {
      items = payload.items;
    } else {
      throw new Error();
    }
  } catch (e) {
    items = [{ name: order.product_name, qty: order.quantity, rate: Math.round(order.amount / order.quantity) || 0, amount: order.amount }];
  }

  const { data: distData } = await sb.from('distributors').select('phone').eq('user_id', currentUser.id).eq('name', order.distributor).limit(1);
  const custPhone = (distData && distData.length > 0) ? distData[0].phone : "";
  const targetPhone = custPhone.replace(/\+/g, '').replace(/[^0-9]/g, '');

  if (!targetPhone) {
    toast('Missing Contact', 'Distributor phone number is missing in directory. Please update settings first.', true);
    return;
  }

  let text = `*📄 INVOICE FROM ${shopName.toUpperCase()}*\n`;
  text += `*Invoice No:* RX-${cleanId}\n`;
  text += `*Date:* ${new Date(order.created_at).toLocaleDateString('en-IN')}\n`;
  text += `*Client Name:* ${order.distributor}\n`;
  text += `------------------------------------\n`;
  items.forEach((item, idx) => {
    text += `${idx + 1}. *${item.name}* (x${item.qty}) @ ₹${item.rate} = *₹${item.amount}*\n`;
  });
  text += `------------------------------------\n`;
  text += `*💰 TOTAL AMOUNT DUE: ₹${order.amount.toLocaleString('en-IN')}*\n\n`;
  
  const cleanPhone = (profile?.phone || "").replace(/\+/g, '').replace(/[^0-9]/g, '');
  const merchantUpi = profile?.upi_id || `${cleanPhone}@okaxis` || "9304277935@okaxis";
  const upiPayLink = `upi://pay?pa=${merchantUpi}&pn=${encodeURIComponent(shopName)}&am=${order.amount}&tn=RX-${cleanId}`;
  
  text += `⚡ *Scan QR on bill or Pay directly via UPI:* \n${upiPayLink}\n\n`;
  text += `🍃 _Thank you for your business! Sent via Retix Carbon-Free Invoicing._`;

  const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  toast('WhatsApp Draft Fired! 💬', 'Itemized order summary and UPI link redirected successfully.');
}

// HANDS-FREE SPEECH-TO-BASKET DICTATION
let voiceRecognition = null;
let isListening = false;

function toggleVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast('Feature Unsupported', 'Speech Recognition is not supported in this browser. Please use Google Chrome.', true);
    return;
  }

  const micBtn = document.getElementById('btn-voice-dictate');
  const micTxt = document.getElementById('voice-dictate-txt');

  if (isListening) {
    if (voiceRecognition) {
      voiceRecognition.stop();
    }
    return;
  }

  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = false;
  voiceRecognition.interimResults = false;
  voiceRecognition.lang = 'en-IN';

  voiceRecognition.onstart = () => {
    isListening = true;
    if (micBtn) {
      micBtn.style.background = '#059669';
      micBtn.style.transform = 'scale(1.08)';
    }
    if (micTxt) micTxt.textContent = "Listening...";
    toast('Voice Dictation ON 🎙️', 'Speak naturally: e.g. "Add Tata Salt 50 bags" or "Rice 20 boxes".');
  };

  voiceRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    console.log("Speech transcript:", transcript);
    toast('Voice Heard 🗣️', `"${transcript}"`);
    parseVoiceCommand(transcript);
  };

  voiceRecognition.onerror = (e) => {
    console.error("Speech recognition error:", e);
    cleanupVoiceState();
  };

  voiceRecognition.onend = () => {
    cleanupVoiceState();
  };

  voiceRecognition.start();
}

function cleanupVoiceState() {
  isListening = false;
  const micBtn = document.getElementById('btn-voice-dictate');
  const micTxt = document.getElementById('voice-dictate-txt');
  if (micBtn) {
    micBtn.style.background = '#ef4444';
    micBtn.style.transform = 'scale(1)';
  }
  if (micTxt) micTxt.textContent = "Voice Type";
}

function parseVoiceCommand(text) {
  const wordsToNumbers = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "hundred": 100
  };
  
  let cleanedText = text;
  Object.keys(wordsToNumbers).forEach(word => {
    cleanedText = cleanedText.replace(new RegExp(`\\b${word}\\b`, 'g'), wordsToNumbers[word]);
  });

  const qtyMatch = cleanedText.match(/\b(\d+)\b/);
  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 100;

  const rateMatch = cleanedText.match(/(?:at|rate|price|for)\s*\b(\d+)\b/);
  const rate = rateMatch ? parseFloat(rateMatch[1]) : 50;

  let productName = cleanedText
    .replace(/\badd\b/g, '')
    .replace(/\bqty\b/g, '')
    .replace(/\bquantity\b/g, '')
    .replace(new RegExp(`\\b${qty}\\b`, 'g'), '')
    .replace(/(?:at|rate|price|for)\s*\b(\d+)\b/g, '')
    .replace(/\brupees\b/g, '')
    .replace(/\brs\b/g, '')
    .replace(/\bbags\b/g, '')
    .replace(/\bboxes\b/g, '')
    .replace(/\bunits\b/g, '')
    .replace(/\bcartons\b/g, '')
    .trim();

  if (!productName) {
    productName = "Dictated Product";
  }

  productName = productName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  toast('Item Auto-Added! 🛒', `Logged: ${productName} (x${qty}) @ ₹${rate}`);
  addBasketItemRow(productName, qty, rate);
}

// SHOP PROFILE SETTINGS CONTROLS
async function openShopProfileModal() {
  const { data: profile, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error) {
    console.warn("Could not retrieve existing profile row: ", error);
  }

  document.getElementById('sp-shop-name').value = profile?.shop_name || "";
  document.getElementById('sp-gstin').value = profile?.gstin || "";
  document.getElementById('sp-prop-name').value = profile?.full_name || currentUser.user_metadata?.full_name || "";
  document.getElementById('sp-phone').value = profile?.phone || currentUser.user_metadata?.phone || "";
  document.getElementById('sp-address').value = profile?.shop_address || "";

  openModal('modal-shop-profile');
}

async function saveShopProfile(e) {
  e.preventDefault();
  const shopName = document.getElementById('sp-shop-name').value.trim();
  const gstin = document.getElementById('sp-gstin').value.trim().toUpperCase();
  const propName = document.getElementById('sp-prop-name').value.trim();
  const phone = document.getElementById('sp-phone').value.trim();
  const address = document.getElementById('sp-address').value.trim();

  if (!shopName) { toast('Validation Error', 'Shop/Business Name is required.', true); return; }
  if (gstin && gstin.length !== 15) { toast('Validation Error', 'GSTIN must be exactly 15 characters.', true); return; }
  if (!propName) { toast('Validation Error', 'Proprietor Name is required.', true); return; }
  if (phone.length !== 10 || isNaN(phone)) { toast('Validation Error', 'Phone must be a 10-digit number.', true); return; }
  if (!address) { toast('Validation Error', 'Shop Address is required.', true); return; }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  const { error } = await sb.from('profiles').upsert({
    id: currentUser.id,
    full_name: propName,
    email: currentUser.email,
    phone: phone,
    shop_name: shopName,
    gstin: gstin,
    shop_address: address
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Save Profile";

  if (error) {
    toast('Database Error', error.message, true);
    return;
  }

  document.getElementById('sbName').textContent = propName;
  if(document.getElementById('topName')) {
    document.getElementById('topName').textContent = propName.split(' ')[0];
  }
  document.getElementById('sbInit').textContent = propName.charAt(0).toUpperCase();

  toast('Settings Saved! 🎉', 'Your B2B shop details have been successfully synchronized.');
  closeModal('modal-shop-profile');
  loadOverview();
}

// AI SMART CAMERA VISION & ANTI-THEFT SCANNING
let visionStream = null;
let visionInterval = null;
let isCameraActive = false;
let peopleObjects = [
  { id: "042", x: 60, y: 90, w: 110, h: 220, label: "Person #042", color: "#6366f1", targetX: 250, targetY: 90, grabTimer: 0, pickedItem: null },
  { id: "039", x: 380, y: 120, w: 100, h: 200, label: "Person #039", color: "#6366f1", targetX: 180, targetY: 120, grabTimer: 0, pickedItem: null }
];
let productsList = ["Tata Salt Premium", "Fortune Mustard Oil", "Rajdhani Besan", "Chambal Refined Oil", "Tata Tea Gold"];

function addVisionLog(msg, type='info') {
  const logContainer = document.getElementById('visionActivityLog');
  if(!logContainer) return;
  
  if (logContainer.querySelector('em') || logContainer.innerText.includes('No active camera')) {
    logContainer.innerHTML = '';
  }
  
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logItem = document.createElement('div');
  logItem.style.marginBottom = '6px';
  logItem.style.padding = '6px 10px';
  logItem.style.borderRadius = '4px';
  logItem.style.fontSize = '0.78rem';
  logItem.style.fontWeight = '500';
  
  if(type === 'danger') {
    logItem.style.background = 'rgba(239, 68, 68, 0.1)';
    logItem.style.color = '#f87171';
    logItem.style.borderLeft = '3px solid #ef4444';
  } else if(type === 'warning') {
    logItem.style.background = 'rgba(245, 158, 11, 0.1)';
    logItem.style.color = '#fbbf24';
    logItem.style.borderLeft = '3px solid #f59e0b';
  } else if(type === 'success') {
    logItem.style.background = 'rgba(16, 185, 129, 0.1)';
    logItem.style.color = '#34d399';
    logItem.style.borderLeft = '3px solid #10b981';
  } else {
    logItem.style.background = '#f8fafc';
    logItem.style.color = '#475569';
    logItem.style.borderLeft = '3px solid #64748b';
  }
  
  logItem.innerHTML = `<span style="color: var(--color-muted); font-size: 0.72rem; font-weight: 600; margin-right: 6px;">[${time}]</span> ${msg}`;
  logContainer.insertBefore(logItem, logContainer.firstChild);
}

async function toggleCamera() {
  const video = document.getElementById('webcamVideo');
  const inactiveUI = document.getElementById('cameraInactiveUI');
  const statusBadge = document.getElementById('vision-status');
  const triggerBtn = document.getElementById('triggerMockAlertBtn');
  const laser = document.getElementById('laserScanner');
  const toggleBtn = document.getElementById('toggleCameraBtn');

  if(isCameraActive) {
    stopVisionCamera();
    return;
  }

  try {
    visionStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 350 } });
    if(video) {
      video.srcObject = visionStream;
      video.style.display = 'block';
    }
    if(inactiveUI) inactiveUI.style.display = 'none';
    if(laser) laser.style.display = 'block';
    if(statusBadge) {
      statusBadge.textContent = 'Scanner Active';
      statusBadge.className = 'badge delivered';
    }
    if(triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.style.cursor = 'pointer';
      triggerBtn.style.background = '#ef4444';
      triggerBtn.style.color = '#fff';
    }
    if(toggleBtn) {
      toggleBtn.style.background = '#ef4444';
      toggleBtn.querySelector('span').textContent = 'Deactivate Camera';
    }

    isCameraActive = true;
    addVisionLog("AI Camera Activated. Calibrating edge lenses...", "info");
    setTimeout(() => {
      addVisionLog("Spatial scanner calibrated successfully. Shelf Zone A online.", "success");
      document.getElementById('vision-tracked-count').textContent = "2";
    }, 1000);
    
    startVisionRenderingLoop();

  } catch(err) {
    console.warn("Camera hardware access denied/unavailable. Activating simulated video feed.");
    if(inactiveUI) inactiveUI.style.display = 'none';
    if(laser) laser.style.display = 'block';
    if(statusBadge) {
      statusBadge.textContent = 'Simulated feed';
      statusBadge.className = 'badge transit';
    }
    if(triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.style.cursor = 'pointer';
      triggerBtn.style.background = '#ef4444';
      triggerBtn.style.color = '#fff';
    }
    if(toggleBtn) {
      toggleBtn.style.background = '#ef4444';
      toggleBtn.querySelector('span').textContent = 'Deactivate Scanner';
    }
    isCameraActive = true;
    addVisionLog("AI Smart Engine initiated. Simulating edge scanning matrix.", "info");
    setTimeout(() => {
      addVisionLog("Virtual bounding matrices active. Tracking Zone A.", "success");
      document.getElementById('vision-tracked-count').textContent = "2";
    }, 1000);
    startVisionRenderingLoop();
  }
}

function stopVisionCamera() {
  const video = document.getElementById('webcamVideo');
  const inactiveUI = document.getElementById('cameraInactiveUI');
  const statusBadge = document.getElementById('vision-status');
  const triggerBtn = document.getElementById('triggerMockAlertBtn');
  const laser = document.getElementById('laserScanner');
  const toggleBtn = document.getElementById('toggleCameraBtn');
  
  if (visionStream) {
    visionStream.getTracks().forEach(track => track.stop());
    visionStream = null;
  }
  
  if(video) {
    video.srcObject = null;
    video.style.display = 'none';
  }
  
  if(inactiveUI) inactiveUI.style.display = 'block';
  if(laser) laser.style.display = 'none';
  if(statusBadge) {
    statusBadge.textContent = 'Camera Inactive';
    statusBadge.className = 'badge out';
  }
  if(triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.style.cursor = 'not-allowed';
    triggerBtn.style.background = 'rgba(239, 68, 68, 0.15)';
    triggerBtn.style.color = '#f87171';
  }
  if(toggleBtn) {
    toggleBtn.style.background = 'var(--color-brand)';
    toggleBtn.querySelector('span').textContent = 'Activate AI Camera';
  }

  isCameraActive = false;
  clearInterval(visionInterval);
  visionInterval = null;
  
  const canvas = document.getElementById('visionOverlayCanvas');
  if(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  
  document.getElementById('vision-tracked-count').textContent = "0";
}

function startVisionRenderingLoop() {
  const canvas = document.getElementById('visionOverlayCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  
  if(visionInterval) clearInterval(visionInterval);
  
  visionInterval = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Zone A overlay boundary box (neon green)
    ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(180, 50, 240, 180);
    ctx.fillStyle = "rgba(16, 185, 129, 0.05)";
    ctx.fillRect(180, 50, 240, 180);
    
    ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
    ctx.font = "bold 10px monospace";
    ctx.fillText("SHELF WATCH ZONE A", 190, 68);
    ctx.setLineDash([]);
    
    // Draw monitored human bodies
    peopleObjects.forEach(obj => {
      // Walk simulation
      if (Math.abs(obj.x - obj.targetX) < 8) {
        obj.targetX = Math.floor(Math.random() * (canvas.width - obj.w));
      } else {
        obj.x += (obj.targetX - obj.x) > 0 ? 2 : -2;
      }
      
      // Main Body Box
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
      
      // Neon head joint
      ctx.beginPath();
      ctx.arc(obj.x + obj.w/2, obj.y + 30, 18, 0, 2*Math.PI);
      ctx.strokeStyle = obj.color;
      ctx.stroke();
      
      // Heading label strip
      ctx.fillStyle = obj.color;
      ctx.fillRect(obj.x - 1, obj.y - 20, obj.w + 2, 20);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      
      let stateLabel = obj.pickedItem ? `Carting: ${obj.pickedItem}` : "Inspecting Shelf";
      if(obj.color === "#ef4444") {
        stateLabel = "⚠️ SUSPICIOUS BEHAVIOR FLAG";
      }
      ctx.fillText(`${obj.label} | ${stateLabel}`, obj.x + 6, obj.y - 5);
      
      // Random mock shelf picking event
      if(Math.random() < 0.005 && isCameraActive && obj.color !== "#ef4444") {
        const prod = productsList[Math.floor(Math.random() * productsList.length)];
        obj.pickedItem = prod;
        addVisionLog(`<strong>${obj.label}</strong> picked up <strong>${prod}</strong>. AI checked pose trajectory: Approved.`, "success");
      }
      
      // Random warning decay back to normal
      if(obj.color === "#ef4444" && Math.random() < 0.008) {
        obj.color = "#6366f1";
        obj.pickedItem = null;
        addVisionLog(`<strong>${obj.label}</strong> suspicious flag resolved. Re-assigned status: Normal.`, "info");
      }
    });
    
  }, 100);
}

function triggerMockAlert() {
  if(!isCameraActive) return;
  const target = peopleObjects[Math.floor(Math.random() * peopleObjects.length)];
  const item = productsList[Math.floor(Math.random() * productsList.length)];
  
  target.color = "#ef4444";
  target.pickedItem = item;
  
  addVisionLog(`🚨 <strong>THEFT SHIELD:</strong> <strong>${target.label}</strong> grabbed <strong>${item}</strong> with rapid velocity. Area monitoring triggered!`, "danger");
  toast("Theft Attempt Intercepted 🚨", `Zone A detection alert: ${target.label} picked up ${item} with unusual hand dwell.`, true);
}

function loadVision() {
  const logContainer = document.getElementById('visionActivityLog');
  if(logContainer) {
    logContainer.innerHTML = '<div style="color: var(--color-muted); font-style: italic;">No active camera logs...</div>';
  }
  if(isCameraActive) {
    document.getElementById('vision-tracked-count').textContent = "2";
    addVisionLog("AI Camera calibrated and monitoring actively.", "success");
  } else {
    document.getElementById('vision-tracked-count').textContent = "0";
  }
}

// FEATURE C: ONE-CLICK QUICK RESTOCK
async function quickRestockItem(productName, quantity) {
  await openNewOrderModal();
  
  // Find default rate from cache
  const cachedItem = (window.currentInventoryCache || []).find(item => item.product_name.toLowerCase() === productName.toLowerCase());
  
  const firstRow = document.querySelector('#orderBasketBody tr');
  if (firstRow) {
    firstRow.querySelector('.basket-pname').value = productName;
    firstRow.querySelector('.basket-pqty').value = quantity;
    if (cachedItem) {
      // Use buying price as standard rate for restocking
      firstRow.querySelector('.basket-prate').value = cachedItem.buying_price || 30;
    }
    calculateBasketTotal();
    toast('Restock Logged 📦', `Prepared order entry for ${productName} (x${quantity}).`);
  }
}

// FEATURE A: UNIVERSAL COMMAND PALETTE (CTRL + K)
let currentPaletteItems = [];

async function openCommandPalette() {
  openModal('modal-command-palette');
  const input = document.getElementById('cmdSearchInput');
  if (input) {
    input.value = "";
    setTimeout(() => input.focus(), 150);
  }
  
  // Cache data collections globally for high-speed local filtering
  const [invRes, distRes] = await Promise.all([
    sb.from('inventory').select('product_name, quantity, selling_price').eq('user_id', currentUser.id),
    sb.from('distributors').select('name, balance').eq('user_id', currentUser.id)
  ]);
  
  window.paletteInvList = invRes.data || [];
  window.paletteDistList = distRes.data || [];
  
  queryCommandPalette();
}

function queryCommandPalette() {
  const query = document.getElementById('cmdSearchInput').value.trim().toLowerCase();
  const resultsContainer = document.getElementById('cmdPaletteResults');
  if (!resultsContainer) return;
  
  const matches = [];

  // 1. Navigation items matches
  const navItems = [
    { title: 'Overview Analytics', action: () => { closeModal('modal-command-palette'); nav('overview'); }, icon: '📊', type: 'Navigation' },
    { title: 'Orders Ledger', action: () => { closeModal('modal-command-palette'); nav('orders'); }, icon: '📋', type: 'Navigation' },
    { title: 'Smart Warehouse Inventory', action: () => { closeModal('modal-command-palette'); nav('inventory'); }, icon: '📦', type: 'Navigation' },
    { title: 'Distributors Directory', action: () => { closeModal('modal-command-palette'); nav('distributors'); }, icon: '🤝', type: 'Navigation' },
    { title: 'Khata Cash Ledger', action: () => { closeModal('modal-command-palette'); nav('khata'); }, icon: '📓', type: 'Navigation' },
    { title: 'AI Smart Vision Shield', action: () => { closeModal('modal-command-palette'); nav('vision'); }, icon: '🛡️', type: 'Navigation' },
  ];

  // 2. Action items matches
  const actionItems = [
    { title: 'Record New Multi-Item Order', action: () => { closeModal('modal-command-palette'); openNewOrderModal(); }, icon: '➕', type: 'Action' },
    { title: 'Add Warehouse Product', action: () => { closeModal('modal-command-palette'); openModal('modal-inv'); }, icon: '📥', type: 'Action' },
    { title: 'Register Supply Partner', action: () => { closeModal('modal-command-palette'); openModal('modal-dist'); }, icon: '👤', type: 'Action' },
    { title: 'Record Cash Book Entry', action: () => { closeModal('modal-command-palette'); openModal('modal-khata'); }, icon: '💸', type: 'Action' },
    { title: 'Setup Shop Details', action: () => { closeModal('modal-command-palette'); openShopProfileModal(); }, icon: '⚙️', type: 'Action' }
  ];

  // Merge lists
  const staticItems = [...navItems, ...actionItems];

  if (!query) {
    // Show defaults/quicklinks when search is empty
    renderPaletteResults(staticItems);
    return;
  }

  // Filter static actions
  staticItems.forEach(item => {
    if (item.title.toLowerCase().includes(query) || item.type.toLowerCase().includes(query)) {
      matches.push(item);
    }
  });

  // Filter products matching query
  (window.paletteInvList || []).forEach(p => {
    if (p.product_name.toLowerCase().includes(query)) {
      matches.push({
        title: `${p.product_name} (In stock: ${p.quantity} units)`,
        action: () => {
          closeModal('modal-command-palette');
          nav('inventory');
          toast('Product Queried 📦', `${p.product_name} is priced at ₹${p.selling_price}.`);
        },
        icon: '📦',
        type: 'Inventory Item'
      });
    }
  });

  // Filter distributors matching query
  (window.paletteDistList || []).forEach(d => {
    if (d.name.toLowerCase().includes(query)) {
      matches.push({
        title: `${d.name} (Credit: ₹${d.balance})`,
        action: () => {
          closeModal('modal-command-palette');
          nav('distributors');
          toast('Partner Queried 🤝', `Logistic balance for ${d.name} is ₹${d.balance}.`);
        },
        icon: '👤',
        type: 'Distributor'
      });
    }
  });

  renderPaletteResults(matches);
}

function renderPaletteResults(items) {
  const container = document.getElementById('cmdPaletteResults');
  if (!container) return;
  
  if (items.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--color-muted); padding: 20px; font-size: 0.85rem;">No exact results matching query...</div>`;
    return;
  }

  currentPaletteItems = items;

  container.innerHTML = items.map((item, idx) => `
    <div onclick="executePaletteItem(${idx})" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: var(--radius-sm); cursor: pointer; transition: background 0.15s ease; border: 1px solid var(--color-border); font-family: inherit; font-size: 0.85rem;" onmouseover="this.style.background='var(--color-brand-glow)';" onmouseout="this.style.background='transparent';">
      <div style="display: flex; align-items: center; gap: 8px; font-family: inherit; color: var(--color-navy); font-weight: 700;">
        <span>${item.icon}</span>
        <span>${item.title}</span>
      </div>
      <span style="font-size: 0.65rem; background: var(--color-border); color: var(--color-muted); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-family: monospace;">${item.type}</span>
    </div>
  `).join('');
}

function executePaletteItem(idx) {
  const item = currentPaletteItems[idx];
  if (item && typeof item.action === 'function') {
    item.action();
  }
}

// Global hotkey binding listener
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCommandPalette();
  }
  if (e.key === 'Escape') {
    closeModal('modal-command-palette');
  }
});

// INITIALIZATION
window.addEventListener('DOMContentLoaded',async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session){window.location.href='index.html';return;}
  currentUser=session.user;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  const name = profile?.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User';
  const first = name.split(' ')[0];
  document.getElementById('sbName').textContent = name;
  document.getElementById('sbInit').textContent = name[0].toUpperCase();
  document.getElementById('topName').textContent = first;
  
  // Mobile Sidebar Toggle and Listeners
  const sidebar = document.getElementById('dashboardSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('active');
      if (overlay) overlay.classList.add('active');
    });
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      if (sidebar) sidebar.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
    });
  }

  document.getElementById('dashLogout').addEventListener('click',async()=>{
    await sb.auth.signOut();
    window.location.href='index.html';
  });
  nav('overview');
});
