const SB_URL='https://yaupttkahhphwcaitylp.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhdXB0dGthaGhwaHdjYWl0eWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Njk4OTEsImV4cCI6MjA5NTI0NTg5MX0.UwqZLuPCZGYoqBUaPI7myJAxNKj3zaFGMkNgg64jkIo';
const sb=window.supabase.createClient(SB_URL,SB_KEY);

let currentUser=null;

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
      alerts.push(`🚨 Stock Alert: <strong>${item.product_name}</strong> is completely <strong>Out of Stock</strong>!`);
    } else if(item.quantity<=item.reorder_level){
      alerts.push(`⚠️ Low Stock: <strong>${item.product_name}</strong> has only <strong>${item.quantity} units left</strong> (Low threshold: ${item.reorder_level}).`);
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
    <tr>
      <td><strong>${r.product_name}</strong></td>
      <td>${r.distributor}</td>
      <td>${r.quantity} ${r.unit||'units'}</td>
      <td>${fmt(r.amount)}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td><span class="badge ${r.status==='Delivered'?'delivered':r.status==='In Transit'?'transit':'pending'}">${r.status}</span></td>
      <td><button class="btn-del" onclick="delOrder('${r.id}')">Remove</button></td>
    </tr>`).join('');
}
async function addOrder(e){
  e.preventDefault();
  const product_name = document.getElementById('o-product').value.trim();
  const distributor = document.getElementById('o-dist').value.trim();
  const quantity = parseInt(document.getElementById('o-qty').value)||0;
  const amount = parseFloat(document.getElementById('o-amount').value)||0;

  if(!product_name){ toast('Validation Error','Please enter a product name.',true); return; }
  if(!distributor){ toast('Validation Error','Please enter a distributor store.',true); return; }
  if(quantity <= 0){ toast('Validation Error','Quantity must be greater than 0.',true); return; }
  if(amount <= 0){ toast('Validation Error','Amount must be greater than 0.',true); return; }

  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('orders').insert({
    user_id:currentUser.id,
    product_name,
    distributor,
    quantity,
    unit:document.getElementById('o-unit').value,
    amount,
    status:document.getElementById('o-status').value,
    notes:document.getElementById('o-notes').value.trim()
  });
  btn.textContent='Save Order Entry';btn.disabled=false;
  if(error){toast('Database Error',error.message,true);return;}
  toast('Transaction Logged','Order registered securely.');
  closeModal('modal-order');
  e.target.reset();
  loadOrders();loadOverview();
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

// INITIALIZATION
window.addEventListener('DOMContentLoaded',async()=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session){window.location.href='index.html';return;}
  currentUser=session.user;
  const name=currentUser.user_metadata?.full_name||currentUser.email?.split('@')[0]||'User';
  const first=name.split(' ')[0];
  document.getElementById('sbName').textContent=name;
  document.getElementById('sbInit').textContent=name[0].toUpperCase();
  document.getElementById('topName').textContent=first;
  
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
