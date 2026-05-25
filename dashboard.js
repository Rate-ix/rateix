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
    khata:['Khata Ledger','Record direct cash inflow & outflow records']
  };
  const t=titles[section];
  document.getElementById('pageTitle').textContent=t[0];
  document.getElementById('pageSub').textContent=t[1];
  
  // Auto-close mobile sidebar and hide overlay on nav switch
  const sidebar = document.getElementById('dashboardSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
  
  if(section==='orders')loadOrders();
  if(section==='inventory')loadInventory();
  if(section==='distributors')loadDistributors();
  if(section==='khata')loadKhata();
  if(section==='overview')loadOverview();
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
  
  // Calculate total direct sales revenue from orders
  const {data:odata}=await sb.from('orders').select('amount').eq('user_id',uid);
  const rev=(odata||[]).reduce((a,r)=>a+(parseFloat(r.amount)||0),0);
  
  document.getElementById('stat-rev').textContent=fmt(rev);
  document.getElementById('stat-orders').textContent=oc||0;
  document.getElementById('stat-inv').textContent=ic||0;
  document.getElementById('stat-dist').textContent=dc||0;
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
  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('orders').insert({
    user_id:currentUser.id,
    product_name:document.getElementById('o-product').value.trim(),
    distributor:document.getElementById('o-dist').value.trim(),
    quantity:parseInt(document.getElementById('o-qty').value)||1,
    unit:document.getElementById('o-unit').value,
    amount:parseFloat(document.getElementById('o-amount').value)||0,
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
  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('inventory').insert({
    user_id:currentUser.id,
    product_name:document.getElementById('i-name').value.trim(),
    sku:document.getElementById('i-sku').value.trim(),
    category:document.getElementById('i-cat').value.trim(),
    quantity:parseInt(document.getElementById('i-qty').value)||0,
    unit:document.getElementById('i-unit').value.trim()||'units',
    reorder_level:parseInt(document.getElementById('i-reorder').value)||15,
    buying_price:parseFloat(document.getElementById('i-buy').value)||0,
    selling_price:parseFloat(document.getElementById('i-sell').value)||0
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
  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('distributors').insert({
    user_id:currentUser.id,
    name:document.getElementById('d-name').value.trim(),
    phone:document.getElementById('d-phone').value.trim(),
    location:document.getElementById('d-loc').value.trim(),
    territory:document.getElementById('d-territory').value.trim(),
    balance:parseFloat(document.getElementById('d-balance').value)||0,
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
  const btn=e.target.querySelector('.btn-save');
  btn.textContent='Processing...';btn.disabled=true;
  const {error}=await sb.from('khata').insert({
    user_id:currentUser.id,
    party_name:document.getElementById('k-party').value.trim(),
    type:document.getElementById('k-type').value,
    amount:parseFloat(document.getElementById('k-amount').value)||0,
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
async function delKhata(id){
  if(!confirm('Permanently remove this ledger entry?'))return;
  await sb.from('khata').delete().eq('id',id).eq('user_id',currentUser.id);
  toast('Transaction Removed','Hisaab book entries revised.');
  loadKhata();loadOverview();
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
