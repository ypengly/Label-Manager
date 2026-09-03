/* =========================================================================
   LABEL MANAGER
   Production label printing app — local-first, Google Sheets-synced.
   Vanilla JS, no build step. Single state object + full re-render.
   ========================================================================= */

(function(){
"use strict";

/* ----------------------------- utilities ------------------------------ */
const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayISO = () => new Date().toISOString().slice(0,10);
const addDaysISO = (iso, days) => {
  if(!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + Number(days||0));
  return d.toISOString().slice(0,10);
};
const fmtDMY = (iso) => {
  if(!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; };
const clamp = (n,min,max) => Math.max(min, Math.min(max, n));
const byId = (arr, id) => arr.find(x => x.id === id);

/* ----------------------------- seed data ------------------------------
   Derived from the uploaded Print Label1.xlsx (categories, products,
   and each category's M->R / M->D day offsets). */
const SEED = {
  categories: [
    { id:'cat_seafood',    name:'Seafood',    mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:1, mToD:3, autoCalc:true },
    { id:'cat_vegetables', name:'Vegetables', mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:0, mToD:3, autoCalc:true },
    { id:'cat_pasta',      name:'Pasta',      mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:0, mToD:7, autoCalc:true },
    { id:'cat_pizza',      name:'Pizza',      mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:1, mToD:7, autoCalc:true },
  ],
  products: [
    ['cat_seafood', ['Seafood mix']],
    ['cat_vegetables', ['Capsicum','Onion','Salad','Cherry tomato','Parsley','Mint','Garlic peel','Fresh Chilli','Cooking Cream','Full cream milk','Spaghetti','Bread','Pizza Sauce']],
    ['cat_pasta', ['Rice']],
    ['cat_pizza', ['Cheese sausage']],
  ],
  customFieldCatalog: ['Batch No','Quantity','Storage','Location','Prepared By','Expiry'],
  templates: [
    { id:'tpl_standard', name:'Standard Food Label', font:'display', align:'left',   border:true,  scale:'md', fieldOrder:['product','mrd','custom','name'] },
    { id:'tpl_large',    name:'Large Product Label', font:'display', align:'center', border:true,  scale:'lg', fieldOrder:['product','mrd','custom','name'] },
    { id:'tpl_simple',   name:'Simple Label',        font:'ui',      align:'left',   border:false, scale:'md', fieldOrder:['product','mrd','name'] },
  ],
};

function buildSeedState(){
  const products = [];
  SEED.products.forEach(([catId, names]) => {
    names.forEach((n,i) => products.push({ id: uid('prod'), categoryId: catId, name:n, sortOrder:i, active:true }));
  });
  return {
    categories: SEED.categories.map(c => ({...c})),
    products,
    labels: [],
    templates: SEED.templates.map(t => ({...t})),
    customFieldCatalog: [...SEED.customFieldCatalog],
    queue: [],           // [{labelId, copies}]
    settings: { defaultTemplateId:'tpl_standard' },
  };
}

/* ------------------------------ storage -------------------------------- */
const STORAGE_KEY = 'labelManager.data.v1';
const GOOGLE_KEY  = 'labelManager.google.v1';

const Storage = {
  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ console.error('Storage load failed', e); return null; }
  },
  save(data){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    }catch(e){ console.error('Storage save failed', e); return false; }
  },
  loadGoogle(){
    try{ return JSON.parse(localStorage.getItem(GOOGLE_KEY) || '{}'); }catch(e){ return {}; }
  },
  saveGoogle(cfg){
    localStorage.setItem(GOOGLE_KEY, JSON.stringify(cfg));
  }
};

/* ------------------------------- state --------------------------------- */
const App = {
  data: Storage.load() || buildSeedState(),
  ui: {
    route: 'dashboard',
    activeCategoryId: null,
    draft: null,          // in-progress label being edited
    editingLabelId: null, // null = new label
    search: '',
    modal: null,           // {type, ...}
    toasts: [],
    printJob: null,        // {labels:[...], index}
    productSearch: '',
  },
  google: Object.assign({
    clientId: '', apiKey: '', spreadsheetId: '',
    connected: false, tokenClient: null, accessToken: null,
    status: 'idle', // idle | syncing | ok | error | offline
    error: null, lastSyncAt: null,
  }, Storage.loadGoogle()),
};
if(!App.ui.activeCategoryId && App.data.categories[0]) App.ui.activeCategoryId = App.data.categories[0].id;

let saveTimer = null;
function persist(){
  Storage.save(App.data);
}
const persistDebounced = debounce(() => {
  persist();
  toast('Saved', 'ok', 900);
  GoogleSync.pushDirtyDebounced();
}, 700);

function toast(msg, kind='', ms=2600){
  const id = uid('t');
  App.ui.toasts.push({id, msg, kind});
  render();
  setTimeout(() => {
    App.ui.toasts = App.ui.toasts.filter(t => t.id !== id);
    render();
  }, ms);
}

/* =========================================================================
   GOOGLE SHEETS SYNC
   Client-side OAuth via Google Identity Services (token client). No backend,
   no client secret — that's the correct model for a purely client-side app;
   only a public OAuth Client ID + restricted API key ever touch the browser.
   ========================================================================= */
const SHEETS = {
  Categories:  ['id','name','m_time','r_time','d_time','m_to_r_days','m_to_d_days','auto_calc','created_at'],
  Products:    ['id','category_id','name','sort_order','active'],
  Labels:      ['id','product_id','category_id','product_name','m_time','m_date','r_time','r_date','d_time','d_date','name','template_id','custom_fields_json','created_at','updated_at'],
  Settings:    ['key','value'],
};

const GoogleSync = {
  init(){
    // GIS script loads async; poll briefly for it.
    const tryInit = () => {
      if(window.google && google.accounts && google.accounts.oauth2 && App.google.clientId){
        App.google.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: App.google.clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets',
          callback: (resp) => {
            if(resp.error){ App.google.status='error'; App.google.error=resp.error; render(); return; }
            App.google.accessToken = resp.access_token;
            App.google.connected = true;
            App.google.status = 'ok';
            App.google.error = null;
            Storage.saveGoogle(sanitizeGoogleCfg());
            render();
            toast('Connected to Google', 'ok');
          }
        });
      }
    };
    tryInit();
    window.addEventListener('load', tryInit);
  },
  connect(){
    if(!App.google.clientId || !App.google.apiKey || !App.google.spreadsheetId){
      toast('Add Client ID, API key and Spreadsheet ID first', 'err');
      return;
    }
    GoogleSync.init();
    if(!App.google.tokenClient){
      toast('Google sign-in is still loading — try again in a second', 'err');
      return;
    }
    App.google.tokenClient.requestAccessToken({ prompt: App.google.accessToken ? '' : 'consent' });
  },
  disconnect(){
    App.google.connected = false;
    App.google.accessToken = null;
    App.google.status = 'idle';
    Storage.saveGoogle(sanitizeGoogleCfg());
    render();
  },
  async apiFetch(path, opts={}){
    if(!App.google.accessToken) throw new Error('Not connected to Google');
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${App.google.spreadsheetId}${path}${path.includes('?')?'&':'?'}key=${encodeURIComponent(App.google.apiKey)}`, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${App.google.accessToken}`,
        'Content-Type': 'application/json',
        ...(opts.headers||{}),
      },
    });
    if(!res.ok){
      const body = await res.text().catch(()=> '');
      throw new Error(`Sheets API ${res.status}: ${body.slice(0,200)}`);
    }
    return res.json();
  },
  // Create the four tabs with header rows if the spreadsheet doesn't have them.
  async ensureStructure(){
    App.google.status = 'syncing'; render();
    try{
      const meta = await GoogleSync.apiFetch('');
      const existing = new Set((meta.sheets||[]).map(s => s.properties.title));
      const toAdd = Object.keys(SHEETS).filter(name => !existing.has(name));
      if(toAdd.length){
        await GoogleSync.apiFetch(':batchUpdate', {
          method:'POST',
          body: JSON.stringify({ requests: toAdd.map(name => ({ addSheet: { properties: { title: name } } })) })
        });
      }
      for(const name of Object.keys(SHEETS)){
        await GoogleSync.apiFetch(`/values/${encodeURIComponent(name)}!A1?valueInputOption=RAW`, {
          method:'PUT',
          body: JSON.stringify({ range: `${name}!A1`, majorDimension:'ROWS', values:[SHEETS[name]] })
        });
      }
      App.google.status = 'ok'; App.google.lastSyncAt = Date.now(); App.google.error = null;
      toast('Sheet structure ready', 'ok');
    }catch(e){
      App.google.status = 'error'; App.google.error = e.message;
      toast('Could not set up sheet structure: ' + e.message, 'err', 4500);
    }
    render();
  },
  rowsFor(sheetName){
    const d = App.data;
    if(sheetName === 'Categories') return d.categories.map(c => [c.id,c.name,c.mTime,c.rTime,c.dTime,c.mToR,c.mToD,c.autoCalc,'']);
    if(sheetName === 'Products') return d.products.map(p => [p.id,p.categoryId,p.name,p.sortOrder,p.active]);
    if(sheetName === 'Labels') return d.labels.map(l => [l.id,l.productId||'',l.categoryId,l.productName,l.mTime,l.mDate,l.rTime,l.rDate,l.dTime,l.dDate,l.name,l.templateId,JSON.stringify(l.customFields||[]),l.createdAt,l.updatedAt]);
    if(sheetName === 'Settings') return Object.entries(d.settings||{}).map(([k,v]) => [k, JSON.stringify(v)]);
    return [];
  },
  // Push the full local state to Sheets (overwrite the data rows below headers).
  async pushAll(){
    if(!App.google.connected){ toast('Connect to Google first', 'err'); return; }
    if(!navigator.onLine){ App.google.status='offline'; render(); return; }
    App.google.status = 'syncing'; render();
    try{
      for(const name of Object.keys(SHEETS)){
        const rows = GoogleSync.rowsFor(name);
        await GoogleSync.apiFetch(`/values/${encodeURIComponent(name)}!A2:Z?valueInputOption=RAW`, {
          method:'PUT',
          body: JSON.stringify({ range: `${name}!A2`, majorDimension:'ROWS', values: rows.length ? rows : [[]] })
        });
      }
      App.google.status = 'ok'; App.google.lastSyncAt = Date.now(); App.google.error = null;
      toast('Synced to Google Sheets', 'ok');
    }catch(e){
      App.google.status = 'error'; App.google.error = e.message;
      toast('Sync failed — your data is safe locally, we\'ll retry: ' + e.message, 'err', 5000);
    }
    render();
  },
  async pullAll(){
    if(!App.google.connected){ toast('Connect to Google first', 'err'); return; }
    App.google.status = 'syncing'; render();
    try{
      const [cats, prods, labs] = await Promise.all([
        GoogleSync.apiFetch(`/values/Categories!A2:Z1000`),
        GoogleSync.apiFetch(`/values/Products!A2:Z1000`),
        GoogleSync.apiFetch(`/values/Labels!A2:Z1000`),
      ]);
      const c = (cats.values||[]).filter(r=>r[0]).map(r => ({ id:r[0], name:r[1], mTime:r[2]||'10:00', rTime:r[3]||'10:00', dTime:r[4]||'10:00', mToR:Number(r[5]||0), mToD:Number(r[6]||0), autoCalc: r[7]!=='false' }));
      const p = (prods.values||[]).filter(r=>r[0]).map(r => ({ id:r[0], categoryId:r[1], name:r[2], sortOrder:Number(r[3]||0), active: r[4]!=='false' }));
      const l = (labs.values||[]).filter(r=>r[0]).map(r => ({ id:r[0], productId:r[1], categoryId:r[2], productName:r[3], mTime:r[4], mDate:r[5], rTime:r[6], rDate:r[7], dTime:r[8], dDate:r[9], name:r[10], templateId:r[11]||'tpl_standard', customFields: safeParse(r[12],[]), createdAt:r[13], updatedAt:r[14] }));
      if(c.length) App.data.categories = c;
      if(p.length) App.data.products = p;
      if(l.length) App.data.labels = l;
      persist();
      App.google.status = 'ok'; App.google.lastSyncAt = Date.now(); App.google.error = null;
      toast('Loaded latest data from Google Sheets', 'ok');
    }catch(e){
      App.google.status = 'error'; App.google.error = e.message;
      toast('Could not load from Google Sheets: ' + e.message, 'err', 4500);
    }
    render();
  },
  pushDirtyDebounced: debounce(() => {
    if(App.google.connected && navigator.onLine) GoogleSync.pushAll();
  }, 2500),
};
function safeParse(s, fallback){ try{ return JSON.parse(s); }catch(e){ return fallback; } }
function sanitizeGoogleCfg(){
  return { clientId: App.google.clientId, apiKey: App.google.apiKey, spreadsheetId: App.google.spreadsheetId };
}

window.addEventListener('offline', () => { App.google.status = App.google.connected ? 'offline' : 'idle'; render(); });
window.addEventListener('online', () => { if(App.google.connected){ App.google.status='ok'; GoogleSync.pushDirtyDebounced(); render(); } });

/* =========================================================================
   DATE / LABEL LOGIC
   ========================================================================= */
function categoryDefaults(catId){
  return byId(App.data.categories, catId) || App.data.categories[0];
}
function newDraftForProduct(product){
  const cat = categoryDefaults(product ? product.categoryId : App.ui.activeCategoryId);
  const mDate = todayISO();
  return {
    id: null,
    productId: product ? product.id : null,
    categoryId: cat.id,
    productName: product ? product.name : '',
    mTime: cat.mTime, mDate,
    rTime: cat.rTime, rDate: addDaysISO(mDate, cat.mToR),
    dTime: cat.dTime, dDate: addDaysISO(mDate, cat.mToD),
    name: '',
    autoCalc: cat.autoCalc !== false,
    templateId: App.data.settings.defaultTemplateId || 'tpl_standard',
    customFields: [], // [{id,name,value,show}]
  };
}
function recalcDraftDates(){
  const d = App.ui.draft;
  if(!d || !d.autoCalc) return;
  const cat = categoryDefaults(d.categoryId);
  d.rDate = addDaysISO(d.mDate, cat.mToR);
  d.dDate = addDaysISO(d.mDate, cat.mToD);
}
function openEditor(product){
  App.ui.draft = newDraftForProduct(product || null);
  App.ui.editingLabelId = null;
  if(product) App.ui.activeCategoryId = product.categoryId;
  App.ui.route = 'editor';
  render();
}
function openEditorForLabel(label){
  App.ui.draft = JSON.parse(JSON.stringify(label));
  if(App.ui.draft.autoCalc === undefined) App.ui.draft.autoCalc = true;
  App.ui.editingLabelId = label.id;
  App.ui.activeCategoryId = label.categoryId;
  App.ui.route = 'editor';
  render();
}
function saveDraft(silent){
  const d = App.ui.draft;
  if(!d) return null;
  if(!d.productName || !d.productName.trim()){
    if(!silent) toast('Add a product name before saving', 'err');
    return null;
  }
  const now = new Date().toISOString();
  if(App.ui.editingLabelId){
    const existing = byId(App.data.labels, App.ui.editingLabelId);
    if(existing){
      Object.assign(existing, d, { updatedAt: now });
    } else {
      App.ui.editingLabelId = null;
    }
  }
  if(!App.ui.editingLabelId){
    const rec = { ...d, id: uid('lbl'), createdAt: now, updatedAt: now };
    App.data.labels.unshift(rec);
    App.ui.editingLabelId = rec.id;
  }
  persistDebounced();
  return byId(App.data.labels, App.ui.editingLabelId);
}

/* =========================================================================
   PRINT
   ========================================================================= */
function templateFor(id){ return byId(App.data.templates, id) || App.data.templates[0]; }

let printInProgress = false;

function labelInnerHTML(label, forPrint){
  const tpl = templateFor(label.templateId);
  const rowsHTML = `
    <div class="${forPrint?'p-rows':'label-rows'}">
      <div class="${forPrint?'p-row':'label-row'}"><span class="k">M:</span><span class="v">${esc(label.mTime)} &nbsp; ${esc(fmtDMY(label.mDate))}</span></div>
      <div class="${forPrint?'p-row':'label-row'}"><span class="k">R:</span><span class="v">${esc(label.rTime)} &nbsp; ${esc(fmtDMY(label.rDate))}</span></div>
      <div class="${forPrint?'p-row':'label-row'}"><span class="k">D:</span><span class="v">${esc(label.dTime)} &nbsp; ${esc(fmtDMY(label.dDate))}</span></div>
    </div>`;
  const customHTML = (label.customFields||[]).filter(f => f.show !== false && f.name).map(f =>
    `<div class="${forPrint?'p-custom':'label-custom'}"><span>${esc(f.name)}</span><span>${esc(f.value||'')}</span></div>`
  ).join('');
  const nameHTML = `<div class="${forPrint?'p-name':'label-name'}">Name: ${esc(label.name||'—')}</div>`;
  const productHTML = `<div class="${forPrint?'p-product':'label-product'}" style="text-align:${tpl.align==='center'?'center':'left'}">${esc(label.productName||'Untitled product')}</div>`;

  const blocks = { product: productHTML, mrd: rowsHTML, custom: customHTML, name: nameHTML };
  return (tpl.fieldOrder||['product','mrd','custom','name']).map(k => blocks[k]||'').join('');
}

function doPrintLabels(labels){
  const printableLabels = (labels||[]).filter(Boolean);
  if(!printableLabels.length){ toast('Nothing to print', 'err'); return; }
  if(printInProgress){ return; }
  const root = document.getElementById('printRoot');
  printInProgress = true;
  root.innerHTML = printableLabels.map(l => `<div class="print-label">${labelInnerHTML(l, true)}</div>`).join('');
  document.body.classList.add('is-printing');

  // Fonts and layout must be ready before print preview snapshots the page.
  const waitForLayout = async () => {
    if(document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.print();
    // Some browser/driver combinations do not dispatch afterprint on cancel.
    setTimeout(() => { if(printInProgress) finishPrint(); }, 1500);
  };
  waitForLayout().catch(() => window.print());
}
function finishPrint(){
  document.getElementById('printRoot').innerHTML = '';
  document.body.classList.remove('is-printing');
  printInProgress = false;
}
window.addEventListener('afterprint', finishPrint);

/* =========================================================================
   EXCEL IMPORT / EXPORT (SheetJS)
   ========================================================================= */
function exportExcel(){
  const wb = XLSX.utils.book_new();
  App.data.categories.forEach(cat => {
    const labels = App.data.labels.filter(l => l.categoryId === cat.id);
    const rows = labels.length ? labels.map(l => ({
      Product: l.productName, 'M Time': l.mTime, 'M Date': fmtDMY(l.mDate),
      'R Time': l.rTime, 'R Date': fmtDMY(l.rDate), 'D Time': l.dTime, 'D Date': fmtDMY(l.dDate),
      Name: l.name,
    })) : [{ Product:'', 'M Time':'', 'M Date':'', 'R Time':'', 'R Date':'', 'D Time':'', 'D Date':'', Name:'' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `${cat.name}`.slice(0,31));
  });
  const prodWs = XLSX.utils.json_to_sheet(App.data.products.map(p => ({
    Category: (byId(App.data.categories,p.categoryId)||{}).name || '', Product: p.name, Order:p.sortOrder, Active:p.active
  })));
  XLSX.utils.book_append_sheet(wb, prodWs, 'Products');
  XLSX.writeFile(wb, `label-manager-export-${todayISO()}.xlsx`);
  toast('Excel file exported', 'ok');
}

function importExcel(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const wb = XLSX.read(e.target.result, { type:'array', cellDates:false });
      let importedCats = 0, importedProducts = 0;
      wb.SheetNames.forEach(sheetName => {
        const clean = sheetName.replace(/^Data\s*/i,'').replace(/\s*Print\s*$/i,'').trim();
        if(!clean || /^Print/i.test(sheetName)) return;
        let cat = App.data.categories.find(c => c.name.toLowerCase() === clean.toLowerCase());
        if(!cat){
          cat = { id: uid('cat'), name: clean, mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:1, mToD:3, autoCalc:true };
          App.data.categories.push(cat);
          importedCats++;
        }
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:'' });
        // Heuristic: scan every cell; any non-empty string that isn't a known
        // label ("M:","R:","D:","Name:","Time","Date","INPUT") and isn't purely
        // numeric becomes a candidate product name.
        const skip = new Set(['m:','r:','d:','name:','time','date','input','']);
        const seen = new Set(App.data.products.filter(p=>p.categoryId===cat.id).map(p=>p.name.toLowerCase()));
        rows.forEach(row => row.forEach(cell => {
          const v = String(cell||'').trim();
          if(!v) return;
          const key = v.toLowerCase();
          if(skip.has(key)) return;
          if(/^\d+(\.\d+)?$/.test(v)) return;
          if(/^\d{1,2}:\d{2}/.test(v)) return;
          if(/^\d{4}-\d{2}-\d{2}/.test(v)) return;
          if(seen.has(key)) return;
          seen.add(key);
          App.data.products.push({ id: uid('prod'), categoryId: cat.id, name: v, sortOrder: App.data.products.length, active:true });
          importedProducts++;
        }));
      });
      persist();
      toast(`Imported ${importedCats} categories and ${importedProducts} products`, 'ok', 4000);
      render();
    }catch(err){
      toast('Import failed: ' + err.message, 'err', 4500);
    }
  };
  reader.readAsArrayBuffer(file);
}

/* =========================================================================
   RENDERING
   ========================================================================= */
function render(){
  document.getElementById('app').innerHTML = Shell();
  wireEvents();
}

function NAV_ITEMS(){
  return [
    ['dashboard','◇','Dashboard'],
    ['editor','▤','Labels'],
    ['products','●','Products'],
    ['categories','▦','Categories'],
    ['templates','◧','Templates'],
    ['queue',`🖶`,'Print Queue'],
    ['sheets','⇅','Google Sheets'],
    ['settings','⚙','Settings'],
  ];
}

function Shell(){
  return `
    <div class="rail">
      <div class="rail-brand">
        <div class="rail-brand-mark">LM</div>
        <div class="rail-brand-text"><b>Label Manager</b><span>PREP · PRINT · TRACE</span></div>
      </div>
      <div class="rail-nav">
        ${NAV_ITEMS().map(([route,ic,label]) => `
          <button class="rail-link ${App.ui.route===route?'active':''}" data-action="nav" data-route="${route}">
            <span class="ico">${ic}</span>${label}
            ${route==='queue' && App.data.queue.length ? `<span class="badge" style="margin-left:auto">${App.data.queue.length}</span>`:''}
          </button>`).join('')}
      </div>
      <div class="rail-foot">${App.data.labels.length} labels · ${App.data.products.length} products</div>
    </div>
    <div class="main">
      ${Topbar()}
      <div class="content">${Content()}</div>
    </div>
    ${App.ui.modal ? Modal() : ''}
    ${App.ui.printJob ? PrintPreview() : ''}
    <div class="toast-wrap">${App.ui.toasts.map(t => `<div class="toast ${t.kind==='err'?'err':t.kind==='ok'?'ok':''}">${esc(t.msg)}</div>`).join('')}</div>
  `;
}

function syncPillLabel(){
  const g = App.google;
  if(!g.clientId || !g.spreadsheetId) return { cls:'', txt:'Sheets not configured' };
  if(!g.connected) return { cls:'', txt:'Not connected' };
  if(g.status==='syncing') return { cls:'syncing', txt:'Syncing…' };
  if(g.status==='error') return { cls:'error', txt:'Sync error' };
  if(g.status==='offline') return { cls:'error', txt:'Offline' };
  return { cls:'ok', txt:'Synced' };
}

function Topbar(){
  const titles = { dashboard:'Dashboard', editor: App.ui.editingLabelId ? 'Edit Label':'New Label', products:'Products', categories:'Categories', templates:'Templates', queue:'Print Queue', sheets:'Google Sheets', settings:'Settings' };
  const pill = syncPillLabel();
  return `
    <div class="topbar">
      <div class="topbar-title">${titles[App.ui.route]||''}</div>
      <div class="search-box">
        <span>🔍</span>
        <input type="text" placeholder="Search products, labels, names..." value="${esc(App.ui.search)}" data-bind="search" />
      </div>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <span class="sync-pill ${pill.cls}"><span class="dot"></span>${pill.txt}</span>
        <button class="btn primary" data-action="new-label">+ New Label</button>
      </div>
    </div>
  `;
}

function Content(){
  if(App.ui.search && App.ui.search.trim().length > 0) return SearchResults();
  switch(App.ui.route){
    case 'dashboard': return Dashboard();
    case 'editor': return Editor();
    case 'products': return Products();
    case 'categories': return Categories();
    case 'templates': return Templates();
    case 'queue': return Queue();
    case 'sheets': return SheetsView();
    case 'settings': return Settings();
    default: return Dashboard();
  }
}

/* ------------------------------ search ---------------------------------- */
function SearchResults(){
  const q = App.ui.search.trim().toLowerCase();
  const results = App.data.labels.filter(l =>
    (l.productName||'').toLowerCase().includes(q) ||
    (l.name||'').toLowerCase().includes(q) ||
    fmtDMY(l.mDate).includes(q) || fmtDMY(l.dDate).includes(q)
  ).slice(0, 40);
  return `
    <span class="eyebrow">Search results</span>
    <h1 class="section-title">"${esc(App.ui.search)}"</h1>
    <p class="section-sub">${results.length} matching label${results.length===1?'':'s'}</p>
    ${results.length ? `<div class="grid cols-3">${results.map(RecentCard).join('')}</div>` : EmptyState('No labels match that search', 'Try a product name, staff name, or a date like 26/08/2026.')}
  `;
}

/* ----------------------------- dashboard --------------------------------- */
function Dashboard(){
  const cats = App.data.categories;
  const recent = [...App.data.labels].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,9);
  return `
    <span class="eyebrow">Label Manager</span>
    <h1 class="section-title">Good to go</h1>
    <p class="section-sub">Select a category, pick a product, and print — the whole flow takes a few seconds.</p>

    <div class="tabs" style="margin-bottom:22px">
      ${cats.map(c => `<button class="tab ${App.ui.activeCategoryId===c.id?'active':''}" data-action="set-category" data-id="${c.id}">${esc(c.name)} <span class="count">${App.data.products.filter(p=>p.categoryId===c.id).length}</span></button>`).join('')}
      <button class="tab" data-action="open-modal" data-modal="add-category">+ Add Category</button>
    </div>

    <div class="grid cols-4" style="margin-bottom:26px">
      ${App.data.products.filter(p => p.categoryId===App.ui.activeCategoryId && p.active!==false).slice(0,8).map(p => `
        <button class="card card-tight" style="text-align:left;cursor:pointer" data-action="pick-product" data-id="${p.id}">
          <div style="font-weight:600;font-size:13.5px">${esc(p.name)}</div>
          <div style="color:var(--muted);font-size:11.5px;margin-top:3px;font-family:var(--font-mono)">Tap to create label</div>
        </button>
      `).join('') || `<div class="card" style="grid-column:1/-1"><div class="empty-state" style="padding:20px"><div class="big">No products yet</div>Add one from the Products screen.</div></div>`}
    </div>

    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">
      <h2 style="font-family:var(--font-display);font-size:16px;margin:0">Recent labels</h2>
      <span class="badge">${App.data.labels.length} total</span>
    </div>
    ${recent.length ? `<div class="grid cols-3">${recent.map(RecentCard).join('')}</div>` : EmptyState('No labels yet', 'Pick a product above to create your first label.')}
  `;
}

function RecentCard(l){
  return `
    <div class="recent-card">
      <div class="name">${esc(l.productName)}</div>
      <div class="meta">${esc(fmtDMY(l.mDate))} · ${esc(l.name || 'unassigned')}</div>
      <div class="row-actions">
        <button class="btn sm" data-action="edit-label" data-id="${l.id}">Edit</button>
        <button class="btn sm primary" data-action="print-one" data-id="${l.id}">Print</button>
        <button class="btn sm ghost" data-action="queue-add" data-id="${l.id}" title="Add to print queue">+ Queue</button>
      </div>
    </div>`;
}

function EmptyState(big, small){
  return `<div class="card"><div class="empty-state"><div class="big">${esc(big)}</div>${esc(small)}</div></div>`;
}

/* ------------------------------- editor ---------------------------------- */
function Editor(){
  if(!App.ui.draft) App.ui.draft = newDraftForProduct(null);
  const d = App.ui.draft;
  const cats = App.data.categories;
  const catProducts = App.data.products.filter(p => p.categoryId===d.categoryId && p.active!==false);

  return `
    <div class="tabs" style="margin-bottom:18px">
      ${cats.map(c => `<button class="tab ${d.categoryId===c.id?'active':''}" data-action="editor-set-category" data-id="${c.id}">${esc(c.name)}</button>`).join('')}
    </div>
    <div class="editor-grid">
      <div class="card">
        <div class="field">
          <label>Product</label>
          <select class="input" data-bind="draft.productSelect">
            <option value="">— Custom / type below —</option>
            ${catProducts.map(p => `<option value="${p.id}" ${d.productId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Product name (on label)</label>
          <input class="input" data-bind="draft.productName" value="${esc(d.productName)}" placeholder="e.g. Seafood mix" />
        </div>

        <label class="checkline" style="margin-bottom:14px">
          <input type="checkbox" data-bind="draft.autoCalc" ${d.autoCalc?'checked':''}/>
          Automatically calculate R / D dates from M
        </label>

        <div class="row2">
          <div class="field"><label>M Time</label><input type="time" class="input" data-bind="draft.mTime" value="${esc(d.mTime)}"></div>
          <div class="field"><label>M Date</label><input type="date" class="input" data-bind="draft.mDate" value="${esc(d.mDate)}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>R Time</label><input type="time" class="input" data-bind="draft.rTime" value="${esc(d.rTime)}"></div>
          <div class="field"><label>R Date</label><input type="date" class="input" data-bind="draft.rDate" value="${esc(d.rDate)}" ${d.autoCalc?'disabled':''}></div>
        </div>
        <div class="row2">
          <div class="field"><label>D Time</label><input type="time" class="input" data-bind="draft.dTime" value="${esc(d.dTime)}"></div>
          <div class="field"><label>D Date</label><input type="date" class="input" data-bind="draft.dDate" value="${esc(d.dDate)}" ${d.autoCalc?'disabled':''}></div>
        </div>

        <div class="field">
          <label>Name (staff)</label>
          <input class="input" data-bind="draft.name" value="${esc(d.name)}" placeholder="e.g. Vong" />
        </div>

        <div class="field">
          <label>Template</label>
          <select class="input" data-bind="draft.templateId">
            ${App.data.templates.map(t => `<option value="${t.id}" ${d.templateId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label>Custom fields</label>
          <div id="customFieldList">${CustomFieldRows(d.customFields)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${App.data.customFieldCatalog.map(name => `<button class="btn sm ghost" data-action="add-custom-catalog" data-name="${esc(name)}">+ ${esc(name)}</button>`).join('')}
            <button class="btn sm ghost" data-action="add-custom-blank">+ Custom field</button>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:18px">
          <button class="btn primary" data-action="save-label">Save</button>
          <button class="btn" data-action="print-draft">Print</button>
          <button class="btn ghost" data-action="queue-draft">+ Queue</button>
        </div>
      </div>

      <div>
        <div class="mat">${LabelCard(d)}</div>
        <p class="section-sub" style="text-align:center;margin-top:14px">Preview shown at label proportions (30 × 20 cm) — actual print uses the exact physical size.</p>
      </div>
    </div>
  `;
}

function CustomFieldRows(fields){
  if(!fields || !fields.length) return `<div style="color:var(--muted);font-size:12.5px;padding:4px 2px">No custom fields — add one below (Batch No, Storage, Expiry…)</div>`;
  return fields.map((f,i) => `
    <div class="custom-field-row" draggable="true" data-drag-index="${i}">
      <span class="drag">⠿</span>
      <input placeholder="Field name" value="${esc(f.name)}" data-cf-field="name" data-cf-index="${i}">
      <input placeholder="Value" value="${esc(f.value)}" data-cf-field="value" data-cf-index="${i}">
      <label class="checkline" style="gap:4px"><input type="checkbox" class="toggle" data-cf-field="show" data-cf-index="${i}" ${f.show!==false?'checked':''}> show</label>
      <button class="btn-icon" data-action="remove-custom" data-index="${i}" title="Remove">✕</button>
    </div>
  `).join('');
}

function LabelCard(label){
  const tpl = templateFor(label.templateId);
  return `
    <div class="label-card" style="${tpl.scale==='lg'?'max-width:640px':''}; ${tpl.border===false?'border-style:solid;border-color:var(--border)':''}" >
      <span class="label-chip">30 × 20 CM</span>
      ${labelInnerHTML(label, false)}
    </div>
  `;
}

/* ------------------------------- products --------------------------------- */
function Products(){
  const cat = byId(App.data.categories, App.ui.activeCategoryId) || App.data.categories[0];
  const q = (App.ui.productSearch||'').toLowerCase();
  const list = App.data.products
    .filter(p => p.categoryId === cat.id)
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .sort((a,b) => a.sortOrder - b.sortOrder);

  return `
    <span class="eyebrow">Products</span>
    <h1 class="section-title">${esc(cat.name)}</h1>
    <p class="section-sub">Drag to reorder. Click a product to start a label with it pre-filled.</p>

    <div class="tabs" style="margin-bottom:16px">
      ${App.data.categories.map(c => `<button class="tab ${cat.id===c.id?'active':''}" data-action="set-category" data-id="${c.id}">${esc(c.name)}</button>`).join('')}
    </div>

    <div class="card">
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <input class="input" placeholder="Search products in ${esc(cat.name)}…" value="${esc(App.ui.productSearch||'')}" data-bind="productSearch" style="max-width:280px">
        <button class="btn primary" style="margin-left:auto" data-action="open-modal" data-modal="add-product">+ Add Product</button>
      </div>
      <div id="productList">
        ${list.length ? list.map((p,i) => `
          <div class="list-row" draggable="true" data-drag-product="${p.id}">
            <span class="drag">⠿</span>
            <span class="name" data-action="pick-product" data-id="${p.id}" style="cursor:pointer">${esc(p.name)}</span>
            <span class="meta">${p.active===false?'inactive':'active'}</span>
            <button class="btn-icon" data-action="edit-product" data-id="${p.id}" title="Rename">✎</button>
            <button class="btn-icon" data-action="delete-product" data-id="${p.id}" title="Delete">✕</button>
          </div>
        `).join('') : `<div class="empty-state"><div class="big">No products in ${esc(cat.name)}</div>Add your first one above.</div>`}
      </div>
    </div>
  `;
}

/* ------------------------------ categories --------------------------------- */
function Categories(){
  return `
    <span class="eyebrow">Setup</span>
    <h1 class="section-title">Categories</h1>
    <p class="section-sub">Each category has its own default times and date offsets (M → R, M → D).</p>
    <div class="grid cols-2">
      ${App.data.categories.map(c => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <input class="input" style="font-weight:700;border:none;background:none;padding-left:0;font-size:16px;font-family:var(--font-display)" data-cat-field="name" data-cat-id="${c.id}" value="${esc(c.name)}">
            <button class="btn-icon" data-action="delete-category" data-id="${c.id}" title="Delete category">✕</button>
          </div>
          <div class="row2">
            <div class="field"><label>M time</label><input type="time" class="input" data-cat-field="mTime" data-cat-id="${c.id}" value="${esc(c.mTime)}"></div>
            <div class="field"><label>R time</label><input type="time" class="input" data-cat-field="rTime" data-cat-id="${c.id}" value="${esc(c.rTime)}"></div>
          </div>
          <div class="row2">
            <div class="field"><label>D time</label><input type="time" class="input" data-cat-field="dTime" data-cat-id="${c.id}" value="${esc(c.dTime)}"></div>
            <div class="field"><label>&nbsp;</label></div>
          </div>
          <div class="row2">
            <div class="field"><label>M → R (days)</label><input type="number" min="0" class="input" data-cat-field="mToR" data-cat-id="${c.id}" value="${c.mToR}"></div>
            <div class="field"><label>M → D (days)</label><input type="number" min="0" class="input" data-cat-field="mToD" data-cat-id="${c.id}" value="${c.mToD}"></div>
          </div>
          <label class="checkline"><input type="checkbox" data-cat-field="autoCalc" data-cat-id="${c.id}" ${c.autoCalc?'checked':''}> Auto-calculate by default</label>
          <div class="meta" style="margin-top:10px;color:var(--muted);font-size:12px">${App.data.products.filter(p=>p.categoryId===c.id).length} products</div>
        </div>
      `).join('')}
      <button class="card" style="display:flex;align-items:center;justify-content:center;min-height:120px;cursor:pointer;color:var(--muted);font-weight:600" data-action="open-modal" data-modal="add-category">+ Add Category</button>
    </div>
  `;
}

/* ------------------------------ templates ----------------------------------- */
function Templates(){
  return `
    <span class="eyebrow">Design</span>
    <h1 class="section-title">Templates</h1>
    <p class="section-sub">Control typography, field order and borders. Assign a template per label in the editor.</p>
    <div class="grid cols-3">
      ${App.data.templates.map(t => `
        <div class="card">
          <input class="input" style="font-weight:700;border:none;background:none;padding-left:0;font-family:var(--font-display);margin-bottom:10px" data-tpl-field="name" data-tpl-id="${t.id}" value="${esc(t.name)}">
          <div class="mat" style="min-height:200px;padding:16px">
            <div class="label-card" style="transform:scale(0.8)">${labelInnerHTML({productName:'Seafood mix', mTime:'10:00', mDate: todayISO(), rTime:'10:00', rDate: addDaysISO(todayISO(),1), dTime:'10:00', dDate: addDaysISO(todayISO(),3), name:'Vong', customFields:[], templateId: t.id}, false)}</div>
          </div>
          <div class="field" style="margin-top:12px"><label>Font</label>
            <select class="input" data-tpl-field="font" data-tpl-id="${t.id}">
              <option value="display" ${t.font==='display'?'selected':''}>Display (bold)</option>
              <option value="ui" ${t.font==='ui'?'selected':''}>Simple sans</option>
            </select>
          </div>
          <div class="field"><label>Alignment</label>
            <select class="input" data-tpl-field="align" data-tpl-id="${t.id}">
              <option value="left" ${t.align==='left'?'selected':''}>Left</option>
              <option value="center" ${t.align==='center'?'selected':''}>Center</option>
            </select>
          </div>
          <div class="field"><label>Size</label>
            <select class="input" data-tpl-field="scale" data-tpl-id="${t.id}">
              <option value="md" ${t.scale==='md'?'selected':''}>Standard</option>
              <option value="lg" ${t.scale==='lg'?'selected':''}>Large</option>
            </select>
          </div>
          <label class="checkline"><input type="checkbox" data-tpl-field="border" data-tpl-id="${t.id}" ${t.border?'checked':''}> Show border</label>
          <button class="btn danger sm" style="margin-top:12px" data-action="delete-template" data-id="${t.id}">Delete template</button>
        </div>
      `).join('')}
      <button class="card" style="display:flex;align-items:center;justify-content:center;min-height:200px;cursor:pointer;color:var(--muted);font-weight:600" data-action="add-template">+ Create Template</button>
    </div>
  `;
}

/* -------------------------------- queue ------------------------------------- */
function Queue(){
  const items = App.data.queue.map(q => ({...q, label: byId(App.data.labels, q.labelId)})).filter(x=>x.label);
  return `
    <span class="eyebrow">Print Queue</span>
    <h1 class="section-title">${items.length} label${items.length===1?'':'s'} queued</h1>
    <p class="section-sub">Each label prints at exactly 30 × 20 cm with a page break between labels.</p>
    <div class="card">
      ${items.length ? items.map((it,i) => `
        <div class="list-row" draggable="true" data-drag-queue="${i}">
          <span class="drag">⠿</span>
          <span class="name">${esc(it.label.productName)}</span>
          <span class="meta">${esc(it.label.name||'—')} · ${esc(fmtDMY(it.label.mDate))}</span>
          <input type="number" min="1" value="${it.copies||1}" data-action="queue-copies" data-index="${i}" class="input" style="width:64px;padding:6px 8px">
          <button class="btn-icon" data-action="queue-remove" data-index="${i}" title="Remove">✕</button>
        </div>
      `).join('') : `<div class="empty-state"><div class="big">Queue is empty</div>Add labels from the Dashboard or the Editor.</div>`}
    </div>
    ${items.length ? `
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn danger" data-action="queue-clear">Clear</button>
        <button class="btn primary" data-action="queue-print-all">Print All (${items.reduce((s,i)=>s+(i.copies||1),0)} labels)</button>
        <button class="btn" data-action="queue-preview">Preview</button>
      </div>` : ''}
  `;
}

/* ---------------------------- google sheets view ------------------------------ */
function SheetsView(){
  const g = App.google;
  const pill = syncPillLabel();
  return `
    <span class="eyebrow">Storage</span>
    <h1 class="section-title">Google Sheets</h1>
    <p class="section-sub">Google Sheets is the source of truth. Data also lives in this browser so nothing is lost if the connection drops.</p>

    <div class="grid cols-2">
      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display)">Connection</h3>
        <div class="field"><label>Google OAuth Client ID</label>
          <input class="input" data-g-field="clientId" value="${esc(g.clientId)}" placeholder="xxxxx.apps.googleusercontent.com"></div>
        <div class="field"><label>Google API Key</label>
          <input class="input" data-g-field="apiKey" value="${esc(g.apiKey)}" placeholder="AIza…"></div>
        <div class="field"><label>Spreadsheet ID</label>
          <input class="input" data-g-field="spreadsheetId" value="${esc(g.spreadsheetId)}" placeholder="From the sheet's URL">
          <div class="hint">The long ID in the sheet URL: docs.google.com/spreadsheets/d/<b>THIS_PART</b>/edit</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          ${g.connected ? `<button class="btn" data-action="google-disconnect">Disconnect</button>` : `<button class="btn primary" data-action="google-connect">Sign in with Google</button>`}
          <button class="btn" data-action="google-structure" ${g.connected?'':'disabled'}>Create Sheet Structure</button>
        </div>
        <div style="margin-top:14px"><span class="sync-pill ${pill.cls}"><span class="dot"></span>${pill.txt}</span></div>
        ${g.error ? `<div class="offline-banner" style="margin-top:12px">⚠ ${esc(g.error)}</div>` : ''}
        ${g.lastSyncAt ? `<div class="hint" style="margin-top:8px">Last synced ${new Date(g.lastSyncAt).toLocaleString()}</div>` : ''}
      </div>

      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display)">Sync</h3>
        <p class="section-sub">Push writes everything from this browser to the sheet. Pull loads the sheet's data into this browser (overwrites local).</p>
        <div style="display:flex;gap:8px">
          <button class="btn primary" data-action="google-push" ${g.connected?'':'disabled'}>Push to Sheets</button>
          <button class="btn" data-action="google-pull" ${g.connected?'':'disabled'}>Pull from Sheets</button>
        </div>
        <h4 style="margin:20px 0 8px;font-family:var(--font-display);font-size:13px">Sheet layout created</h4>
        ${Object.keys(SHEETS).map(name => `<div class="meta" style="margin-bottom:4px">📄 <b>${name}</b> — ${SHEETS[name].join(', ')}</div>`).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <h3 style="margin-top:0;font-family:var(--font-display)">Setup (once per organization)</h3>
      <ol style="line-height:1.9;font-size:13px;color:var(--ink-soft)">
        <li>In <b>Google Cloud Console</b>, create a project and enable the <b>Google Sheets API</b>.</li>
        <li>Create an <b>OAuth client ID</b> (type: Web application). Add this page's URL under "Authorized JavaScript origins".</li>
        <li>Create an <b>API key</b> and restrict it to the Sheets API.</li>
        <li>Create a blank Google Sheet, share it with the staff who'll use this app, and copy its ID from the URL.</li>
        <li>Paste all three values above, click <b>Sign in with Google</b>, then <b>Create Sheet Structure</b>.</li>
      </ol>
      <p class="hint">Because this is a browser-only app there is no server to hold a secret — the Client ID and API key are meant to be public and are restricted by domain in Cloud Console, exactly as Google's own docs recommend for client-side apps.</p>
    </div>
  `;
}

/* -------------------------------- settings ------------------------------------ */
function Settings(){
  return `
    <span class="eyebrow">Configuration</span>
    <h1 class="section-title">Settings</h1>

    <div class="grid cols-2">
      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display)">Label size &amp; printing</h3>
        <div class="field"><label>Label size</label><input class="input" value="30 cm × 20 cm" disabled></div>
        <div class="field"><label>Orientation</label><input class="input" value="Landscape" disabled></div>
        <div class="field"><label>Margins</label><input class="input" value="0" disabled></div>
        <div class="field"><label>Scale</label><input class="input" value="100%" disabled></div>
        <p class="hint">The label keeps its 3:2 proportion and uses up to 30 × 20 cm. It scales down to fit smaller paper such as Letter. Set the print dialog to <b>100% / Actual size</b>.</p>
      </div>

      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display)">Excel</h3>
        <p class="section-sub">Import your existing Print Label1.xlsx, or export current data as a fresh workbook.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn primary" style="cursor:pointer">Import Excel<input type="file" accept=".xlsx,.xls" id="excelInput" style="display:none"></label>
          <button class="btn" data-action="export-excel">Export Excel</button>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display)">Backup</h3>
        <p class="section-sub">A full JSON snapshot of categories, products, labels and templates.</p>
        <div style="display:flex;gap:8px">
          <button class="btn" data-action="export-json">Download backup</button>
          <label class="btn" style="cursor:pointer">Restore backup<input type="file" accept=".json" id="jsonInput" style="display:none"></label>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-top:0;font-family:var(--font-display);color:var(--danger)">Danger zone</h3>
        <p class="section-sub">Wipes everything stored in this browser. Cannot be undone locally (Google Sheets, if connected, is untouched until you push).</p>
        <button class="btn danger" data-action="reset-all">Erase all local data</button>
      </div>
    </div>
  `;
}

/* -------------------------------- modal --------------------------------------- */
function Modal(){
  const m = App.ui.modal;
  if(m.type === 'add-category'){
    return ModalWrap('New category', `
      <div class="field"><label>Name</label><input class="input" id="modalCatName" placeholder="e.g. Bakery" autofocus></div>
    `, `<button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-add-category">Add category</button>`);
  }
  if(m.type === 'add-product'){
    const cat = byId(App.data.categories, App.ui.activeCategoryId);
    return ModalWrap(`New product in ${esc(cat?cat.name:'')}`, `
      <div class="field"><label>Product name</label><input class="input" id="modalProdName" placeholder="e.g. Shrimp" autofocus></div>
    `, `<button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-add-product">Add product</button>`);
  }
  if(m.type === 'edit-product'){
    const p = byId(App.data.products, m.id);
    return ModalWrap('Rename product', `
      <div class="field"><label>Product name</label><input class="input" id="modalProdName" value="${esc(p.name)}" autofocus></div>
      <label class="checkline"><input type="checkbox" id="modalProdActive" ${p.active!==false?'checked':''}> Active</label>
    `, `<button class="btn ghost" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-edit-product" data-id="${p.id}">Save</button>`);
  }
  return '';
}
function ModalWrap(title, body, foot){
  return `<div class="modal-backdrop" data-action="modal-backdrop">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-head"><h3>${esc(title)}</h3><button class="btn-icon" data-action="close-modal">✕</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot">${foot}</div>
    </div>
  </div>`;
}

/* ---------------------------- print preview overlay ---------------------------- */
function PrintPreview(){
  const job = App.ui.printJob;
  const label = job.labels[job.index];
  return `
    <div class="pp-backdrop">
      <div class="pp-top">
        <div class="title">Print preview</div>
        <button class="btn-icon" data-action="pp-close" style="background:#fff">✕</button>
      </div>
      <div class="pp-body">
        <div style="width:min(70vw,720px)">
          <div style="color:#fff;text-align:center;margin-bottom:14px;font-family:var(--font-mono);font-size:12px">LABEL ${job.index+1} / ${job.labels.length}</div>
          <div class="mat"><div class="label-card">${labelInnerHTML(label,false)}</div></div>
        </div>
      </div>
      <div class="pp-controls">
        <button class="btn" data-action="pp-prev" ${job.index===0?'disabled':''}>‹ Previous</button>
        <div class="pp-page-dots grow" style="justify-content:center;display:flex">${job.labels.map((_,i)=>`<span class="pp-dot ${i===job.index?'active':''}"></span>`).join('')}</div>
        <button class="btn" data-action="pp-next" ${job.index===job.labels.length-1?'disabled':''}>Next ›</button>
        <button class="btn primary" data-action="pp-print">Print</button>
        <button class="btn ghost" data-action="pp-close" style="color:#fff">Cancel</button>
      </div>
    </div>
  `;
}

/* =========================================================================
   EVENTS
   ========================================================================= */
function wireEvents(){
  const app = document.getElementById('app');

  app.addEventListener('click', onClick);
  app.addEventListener('input', onInput);
  app.addEventListener('change', onChange);
  app.addEventListener('dragstart', onDragStart);
  app.addEventListener('dragover', onDragOver);
  app.addEventListener('drop', onDrop);

  const excelInput = document.getElementById('excelInput');
  if(excelInput) excelInput.addEventListener('change', (e) => { if(e.target.files[0]) importExcel(e.target.files[0]); });
  const jsonInput = document.getElementById('jsonInput');
  if(jsonInput) jsonInput.addEventListener('change', (e) => { if(e.target.files[0]) restoreBackup(e.target.files[0]); });
}

let dragCtx = null;
function onDragStart(e){
  const cfRow = e.target.closest('[data-drag-index]');
  const pRow = e.target.closest('[data-drag-product]');
  const qRow = e.target.closest('[data-drag-queue]');
  if(cfRow) dragCtx = { type:'custom', index: Number(cfRow.dataset.dragIndex) };
  else if(pRow) dragCtx = { type:'product', id: pRow.dataset.dragProduct };
  else if(qRow) dragCtx = { type:'queue', index: Number(qRow.dataset.dragQueue) };
}
function onDragOver(e){
  if(e.target.closest('[data-drag-index],[data-drag-product],[data-drag-queue]')) e.preventDefault();
}
function onDrop(e){
  if(!dragCtx) return;
  if(dragCtx.type === 'custom'){
    const row = e.target.closest('[data-drag-index]');
    if(!row) return;
    const to = Number(row.dataset.dragIndex);
    const arr = App.ui.draft.customFields;
    const [item] = arr.splice(dragCtx.index,1);
    arr.splice(to,0,item);
    persistDebounced(); render();
  } else if(dragCtx.type === 'product'){
    const row = e.target.closest('[data-drag-product]');
    if(!row) return;
    const toId = row.dataset.dragProduct;
    const cat = App.ui.activeCategoryId;
    const list = App.data.products.filter(p=>p.categoryId===cat).sort((a,b)=>a.sortOrder-b.sortOrder);
    const fromIdx = list.findIndex(p=>p.id===dragCtx.id);
    const toIdx = list.findIndex(p=>p.id===toId);
    const [item] = list.splice(fromIdx,1);
    list.splice(toIdx,0,item);
    list.forEach((p,i)=>p.sortOrder=i);
    persistDebounced(); render();
  } else if(dragCtx.type === 'queue'){
    const row = e.target.closest('[data-drag-queue]');
    if(!row) return;
    const to = Number(row.dataset.dragQueue);
    const [item] = App.data.queue.splice(dragCtx.index,1);
    App.data.queue.splice(to,0,item);
    persistDebounced(); render();
  }
  dragCtx = null;
}

function onClick(e){
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.dataset.action;

  if(action === 'nav'){ App.ui.route = el.dataset.route; App.ui.search=''; render(); return; }
  if(action === 'set-category'){ App.ui.activeCategoryId = el.dataset.id; render(); return; }
  if(action === 'new-label'){ openEditor(null); return; }

  if(action === 'pick-product'){ openEditor(byId(App.data.products, el.dataset.id)); return; }

  if(action === 'edit-label'){ openEditorForLabel(byId(App.data.labels, el.dataset.id)); return; }
  if(action === 'print-one'){ doPrintLabels([byId(App.data.labels, el.dataset.id)]); return; }
  if(action === 'queue-add'){ App.data.queue.push({ labelId: el.dataset.id, copies:1 }); persistDebounced(); toast('Added to queue','ok',1500); render(); return; }

  if(action === 'editor-set-category'){
    App.ui.draft.categoryId = el.dataset.id;
    const cat = categoryDefaults(el.dataset.id);
    App.ui.draft.mTime = cat.mTime; App.ui.draft.rTime = cat.rTime; App.ui.draft.dTime = cat.dTime;
    App.ui.draft.productId = null; App.ui.draft.productName='';
    recalcDraftDates();
    render(); return;
  }
  if(action === 'save-label'){ if(saveDraft()) toast('Label saved','ok',1500); render(); return; }
  if(action === 'print-draft'){ const l = saveDraft(true) || App.ui.draft; doPrintLabels([l]); return; }
  if(action === 'queue-draft'){ const l = saveDraft(); if(l){ App.data.queue.push({labelId:l.id, copies:1}); persistDebounced(); toast('Added to queue','ok',1500); render(); } return; }
  if(action === 'add-custom-catalog'){ App.ui.draft.customFields.push({id:uid('cf'), name: el.dataset.name, value:'', show:true}); render(); return; }
  if(action === 'add-custom-blank'){ App.ui.draft.customFields.push({id:uid('cf'), name:'', value:'', show:true}); render(); return; }
  if(action === 'remove-custom'){ App.ui.draft.customFields.splice(Number(el.dataset.index),1); persistDebounced(); render(); return; }

  if(action === 'open-modal'){ App.ui.modal = { type: el.dataset.modal, id: el.dataset.id }; render(); return; }
  if(action === 'close-modal' || action === 'modal-backdrop'){ App.ui.modal = null; render(); return; }
  if(action === 'confirm-add-category'){
    const name = document.getElementById('modalCatName').value.trim();
    if(!name) return;
    const c = { id: uid('cat'), name, mTime:'10:00', rTime:'10:00', dTime:'10:00', mToR:1, mToD:3, autoCalc:true };
    App.data.categories.push(c); App.ui.activeCategoryId = c.id; App.ui.modal=null;
    persistDebounced(); render(); return;
  }
  if(action === 'confirm-add-product'){
    const name = document.getElementById('modalProdName').value.trim();
    if(!name) return;
    const catId = App.ui.activeCategoryId;
    const count = App.data.products.filter(p=>p.categoryId===catId).length;
    App.data.products.push({ id: uid('prod'), categoryId: catId, name, sortOrder: count, active:true });
    App.ui.modal=null; persistDebounced(); render(); return;
  }
  if(action === 'confirm-edit-product'){
    const p = byId(App.data.products, el.dataset.id);
    p.name = document.getElementById('modalProdName').value.trim() || p.name;
    p.active = document.getElementById('modalProdActive').checked;
    App.ui.modal=null; persistDebounced(); render(); return;
  }
  if(action === 'edit-product'){ App.ui.modal = {type:'edit-product', id: el.dataset.id}; render(); return; }
  if(action === 'delete-product'){
    if(confirm('Delete this product? Existing labels keep their saved data.')){
      App.data.products = App.data.products.filter(p=>p.id!==el.dataset.id);
      persistDebounced(); render();
    }
    return;
  }
  if(action === 'delete-category'){
    if(App.data.categories.length<=1){ toast('You need at least one category','err'); return; }
    if(confirm('Delete this category and its products?')){
      const id = el.dataset.id;
      App.data.categories = App.data.categories.filter(c=>c.id!==id);
      App.data.products = App.data.products.filter(p=>p.categoryId!==id);
      if(App.ui.activeCategoryId===id) App.ui.activeCategoryId = App.data.categories[0].id;
      persistDebounced(); render();
    }
    return;
  }
  if(action === 'add-template'){
    App.data.templates.push({ id: uid('tpl'), name:'New Template', font:'display', align:'left', border:true, scale:'md', fieldOrder:['product','mrd','custom','name'] });
    persistDebounced(); render(); return;
  }
  if(action === 'delete-template'){
    if(App.data.templates.length<=1){ toast('You need at least one template','err'); return; }
    App.data.templates = App.data.templates.filter(t=>t.id!==el.dataset.id);
    persistDebounced(); render(); return;
  }

  if(action === 'queue-remove'){ App.data.queue.splice(Number(el.dataset.index),1); persistDebounced(); render(); return; }
  if(action === 'queue-clear'){ if(confirm('Clear the print queue?')){ App.data.queue = []; persistDebounced(); render(); } return; }
  if(action === 'queue-print-all'){
    const labels = [];
    App.data.queue.forEach(q => { const l = byId(App.data.labels,q.labelId); if(l) for(let i=0;i<(q.copies||1);i++) labels.push(l); });
    doPrintLabels(labels); return;
  }
  if(action === 'queue-preview'){
    const labels = App.data.queue.map(q=>byId(App.data.labels,q.labelId)).filter(Boolean);
    App.ui.printJob = { labels, index:0 }; render(); return;
  }

  if(action === 'pp-close'){ App.ui.printJob = null; render(); return; }
  if(action === 'pp-prev'){ App.ui.printJob.index = clamp(App.ui.printJob.index-1,0,App.ui.printJob.labels.length-1); render(); return; }
  if(action === 'pp-next'){ App.ui.printJob.index = clamp(App.ui.printJob.index+1,0,App.ui.printJob.labels.length-1); render(); return; }
  if(action === 'pp-print'){ doPrintLabels(App.ui.printJob.labels); App.ui.printJob=null; render(); return; }

  if(action === 'google-connect'){ GoogleSync.connect(); return; }
  if(action === 'google-disconnect'){ GoogleSync.disconnect(); return; }
  if(action === 'google-structure'){ GoogleSync.ensureStructure(); return; }
  if(action === 'google-push'){ GoogleSync.pushAll(); return; }
  if(action === 'google-pull'){ if(confirm('This replaces local categories, products and labels with what is in the sheet. Continue?')) GoogleSync.pullAll(); return; }

  if(action === 'export-excel'){ exportExcel(); return; }
  if(action === 'export-json'){ exportJSON(); return; }
  if(action === 'reset-all'){
    if(confirm('This erases all locally stored categories, products and labels. Continue?')){
      App.data = buildSeedState();
      App.ui.activeCategoryId = App.data.categories[0].id;
      persist(); render();
    }
    return;
  }
}

function onInput(e){
  const t = e.target;
  if(t.dataset.bind === 'search'){ App.ui.search = t.value; render(); refocus(t); return; }
  if(t.dataset.bind === 'productSearch'){ App.ui.productSearch = t.value; render(); refocus(t); return; }
  if(t.dataset.bind && t.dataset.bind.startsWith('draft.')){
    const field = t.dataset.bind.split('.')[1];
    if(field === 'productSelect') return; // handled on change
    App.ui.draft[field] = t.type==='checkbox' ? t.checked : t.value;
    if(field==='mDate' || field==='autoCalc') recalcDraftDates();
    if(field !== 'templateId') persistDebounced();
    renderPreviewOnly();
    return;
  }
  if(t.dataset.cfField !== undefined){
    const i = Number(t.dataset.cfIndex);
    const f = t.dataset.cfField;
    App.ui.draft.customFields[i][f] = t.type==='checkbox' ? t.checked : t.value;
    persistDebounced();
    renderPreviewOnly();
    return;
  }
  if(t.dataset.catField !== undefined){
    const c = byId(App.data.categories, t.dataset.catId);
    const f = t.dataset.catField;
    c[f] = t.type==='checkbox' ? t.checked : (t.type==='number'? Number(t.value): t.value);
    persistDebounced();
    return;
  }
  if(t.dataset.tplField !== undefined){
    const tpl = byId(App.data.templates, t.dataset.tplId);
    tpl[t.dataset.tplField] = t.type==='checkbox' ? t.checked : t.value;
    persistDebounced(); render();
    return;
  }
  if(t.dataset.gField !== undefined){
    App.google[t.dataset.gField] = t.value;
    Storage.saveGoogle(sanitizeGoogleCfg());
    return;
  }
}

// Cheap optimization: while typing in the editor, only re-render the live
// preview + relevant disabled states, not the whole page (keeps focus + caret).
function renderPreviewOnly(){
  if(App.ui.route !== 'editor') return;
  const mat = document.querySelector('.mat');
  if(mat) mat.innerHTML = LabelCard(App.ui.draft);
  const rDate = document.querySelector('[data-bind="draft.rDate"]');
  const dDate = document.querySelector('[data-bind="draft.dDate"]');
  if(rDate){ rDate.value = App.ui.draft.rDate; rDate.disabled = !!App.ui.draft.autoCalc; }
  if(dDate){ dDate.value = App.ui.draft.dDate; dDate.disabled = !!App.ui.draft.autoCalc; }
  const list = document.getElementById('customFieldList');
  if(list) list.innerHTML = CustomFieldRows(App.ui.draft.customFields);
}
function refocus(el){
  const sel = el.dataset.bind === 'search' ? '[data-bind="search"]' : '[data-bind="productSearch"]';
  const fresh = document.querySelector(sel);
  if(fresh){ fresh.focus(); const v = fresh.value; fresh.setSelectionRange(v.length, v.length); }
}

function onChange(e){
  const t = e.target;
  if(t.dataset.bind === 'draft.productSelect'){
    const p = byId(App.data.products, t.value);
    if(p){
      App.ui.draft.productId = p.id;
      App.ui.draft.productName = p.name;
    } else {
      App.ui.draft.productId = null;
    }
    persistDebounced(); render();
    return;
  }
  if(t.dataset.bind === 'draft.templateId'){ App.ui.draft.templateId = t.value; persistDebounced(); render(); return; }
}

/* ------------------------------ backup json ------------------------------- */
function exportJSON(){
  const blob = new Blob([JSON.stringify(App.data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `label-manager-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded', 'ok');
}
function restoreBackup(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(!parsed.categories || !parsed.products) throw new Error('Not a valid backup file');
      App.data = parsed;
      App.ui.activeCategoryId = App.data.categories[0] ? App.data.categories[0].id : null;
      persist(); render();
      toast('Backup restored', 'ok');
    }catch(err){ toast('Restore failed: ' + err.message, 'err', 4000); }
  };
  reader.readAsText(file);
}

/* --------------------------------- boot ------------------------------------ */
GoogleSync.init();
render();

})();
