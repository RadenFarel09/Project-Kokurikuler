/* ================= KONFIGURASI SUPABASE (UBAH 2 BARIS INI SAJA) ================= */
const SUPABASE_URL = 'https://twjqkmqnivpbyanpnjwj.supabase.co';       // <-- GANTI
const SUPABASE_ANON_KEY = 'sb_publishable_HsKB-NaLUcdVxKTiGPVZbw_e7ji0TSd';              // <-- GANTI
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyyfDAwqt9AO_q4c1uGvwmCzBJ4EyL5l75xH_wJRxkLMCfDSYpBWYK4gYO8lDG633NY/exec';

const DEFAULT_RATES = {
  'Plastik': 3000,
  'Kertas/Kardus': 2500,
  'Logam/Besi': 6500,
  'Kaca/Botol': 1500,
  'Minyak Jelantah': 7500,
  'Organik': 1000
};

let currentUser = null;
let wargaAccounts = [];
let rekapData = [];
let APPS_SCRIPT_URL = localStorage.getItem('gopocket_apps_script_url') || DEFAULT_APPS_SCRIPT_URL;

/* ================= HELPER ================= */
function escapeHTML(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

/* ================= MUAT DATA DARI SUPABASE ================= */
async function loadWarga() {
  try {
    const { data, error } = await supabase.from('warga').select('*').order('username');
    if (error) { console.error('loadWarga error:', error); }
    if (data && data.length > 0) wargaAccounts = data;
    else wargaAccounts = [{ username: 'warga1', password: 'warga1' }];
  } catch (e) {
    console.error('loadWarga catch:', e);
    wargaAccounts = [{ username: 'warga1', password: 'warga1' }];
  }
  updateWargaDropdown();
}

async function loadPenimbangan() {
  try {
    const { data, error } = await supabase.from('penimbangan').select('*').order('created_at', { ascending: false });
    if (error) { console.error('loadPenimbangan error:', error); }
    rekapData = (data || []).map(d => ({
      id: d.id,
      waktu: d.waktu || '',
      warga: d.warga || '',
      jenis: d.jenis || '',
      berat: Number(d.berat) || 0,
      totalRp: Number(d.total_rp) || 0
    }));
  } catch (e) {
    console.error('loadPenimbangan catch:', e);
    rekapData = [];
  }
}

async function refreshAllData() {
  await Promise.all([loadWarga(), loadPenimbangan()]);
  if (currentUser) refreshAllViews();
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', async () => {
  await refreshAllData();

  const hargaInput = document.getElementById('inputHarga');
  if (hargaInput) {
    hargaInput.addEventListener('input', () => {
      hargaInput.dataset.userEdited = "true";
      calculateModalTotal();
    });
  }

  const savedUser = sessionStorage.getItem('gopocket_current_user');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      showDashboard();
    } catch (e) { sessionStorage.removeItem('gopocket_current_user'); }
  }
});

/* ================= TOAST ================= */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bgMap = {
    success: 'bg-emerald-900 border-emerald-500 text-white',
    error: 'bg-rose-900 border-rose-500 text-white',
    warning: 'bg-amber-900 border-amber-500 text-white',
    info: 'bg-slate-900 border-slate-700 text-white'
  };
  const iconMap = {
    success: '<i class="fa-solid fa-circle-check text-emerald-400"></i>',
    error: '<i class="fa-solid fa-circle-xmark text-rose-400"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>',
    info: '<i class="fa-solid fa-circle-info text-blue-400"></i>'
  };
  toast.className = `p-4 rounded-2xl border shadow-xl flex items-center justify-between text-xs font-medium backdrop-blur-md pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 ${bgMap[type] || bgMap.info}`;
  toast.innerHTML = `<div class="flex items-center gap-2.5">${iconMap[type] || iconMap.info}<span>${escapeHTML(message)}</span></div>
    <button onclick="this.parentElement.remove()" class="ml-4 text-slate-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
  setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-2'); setTimeout(() => toast.remove(), 300); }, 4000);
}

function fillLogin(u, p) {
  document.getElementById('login-username').value = u;
  document.getElementById('login-password').value = p;
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') { input.type = 'text'; icon.className = 'fa-solid fa-eye-slash text-sm'; }
  else { input.type = 'password'; icon.className = 'fa-solid fa-eye text-sm'; }
}

/* ================= LOGIN ================= */
function handleLogin(event) {
  event.preventDefault();
  const userVal = document.getElementById('login-username').value.trim();
  const passVal = document.getElementById('login-password').value.trim();

  if (userVal === 'admin' && passVal === '123456') {
    currentUser = { username: 'admin', role: 'admin' };
  } else {
    const found = wargaAccounts.find(w =>
      w.username.toLowerCase() === userVal.toLowerCase() &&
      (w.password || '').toLowerCase() === passVal.toLowerCase()
    );
    if (found) currentUser = { username: found.username, role: 'warga' };
  }

  if (currentUser) {
    sessionStorage.setItem('gopocket_current_user', JSON.stringify(currentUser));
    showToast(`Selamat datang, ${currentUser.username}!`);
    showDashboard();
  } else {
    showToast('Username atau password salah!', 'error');
  }
}

function handleLogout() {
  sessionStorage.removeItem('gopocket_current_user');
  currentUser = null;
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('login-section').classList.remove('hidden');
  document.getElementById('login-form').reset();
  showToast('Berhasil keluar sistem.', 'info');
}

function showDashboard() {
  document.getElementById('login-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  document.getElementById('nav-user-name').innerText = currentUser.username;
  document.getElementById('nav-user-sub').innerText = currentUser.role === 'admin' ? 'Pengurus Admin' : 'Warga Bank Sampah';
  document.getElementById('role-badge').innerText = currentUser.role === 'admin' ? 'Portal Admin' : 'Portal Warga';

  const navContainer = document.getElementById('nav-links');
  const mobileMenuContainer = document.getElementById('mobile-menu');

  if (currentUser.role === 'admin') {
    document.getElementById('admin-sync-banner').classList.remove('hidden');
    updateSyncBannerState();
    const navItemsHtml = `
      <button onclick="switchTab('tab-admin-dashboard')" class="nav-tab-btn active-tab px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-admin-dashboard"><i class="fa-solid fa-chart-line text-xs"></i> Rekapitulasi</button>
      <button onclick="switchTab('tab-calculator')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-calculator"><i class="fa-solid fa-calculator text-xs"></i> Kalkulator Sampah</button>
      <button onclick="switchTab('tab-manage-warga')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-manage-warga"><i class="fa-solid fa-users-gear text-xs"></i> Manajemen Warga</button>
      <button onclick="switchTab('tab-education')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-education"><i class="fa-solid fa-circle-play text-xs"></i> Video Edukasi</button>
      <button onclick="switchTab('tab-settings')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-settings"><i class="fa-solid fa-gear text-xs"></i> Integrasi GAS</button>`;
    navContainer.innerHTML = navItemsHtml;
    mobileMenuContainer.innerHTML = navItemsHtml;
    switchTab('tab-admin-dashboard');
  } else {
    document.getElementById('admin-sync-banner').classList.add('hidden');
    const navItemsHtml = `
      <button onclick="switchTab('tab-warga-dashboard')" class="nav-tab-btn active-tab px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-warga-dashboard"><i class="fa-solid fa-wallet text-xs"></i> Tabungan Saya</button>
      <button onclick="switchTab('tab-calculator')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-calculator"><i class="fa-solid fa-calculator text-xs"></i> Kalkulator Sampah</button>
      <button onclick="switchTab('tab-education')" class="nav-tab-btn px-3 py-2 rounded-xl text-emerald-100 hover:bg-emerald-800/50 flex items-center gap-1.5" id="btn-tab-education"><i class="fa-solid fa-circle-play text-xs"></i> Video Edukasi</button>`;
    navContainer.innerHTML = navItemsHtml;
    mobileMenuContainer.innerHTML = navItemsHtml;
    document.getElementById('warga-welcome-name').innerText = currentUser.username;
    switchTab('tab-warga-dashboard');
  }

  document.getElementById('gas-url-input').value = APPS_SCRIPT_URL;
  refreshAllViews();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(tabId);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.nav-tab-btn').forEach(btn => btn.classList.remove('bg-brand-600', 'text-white'));
  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('bg-brand-600', 'text-white');
  document.getElementById('mobile-menu').classList.add('hidden');
  if (tabId === 'tab-calculator') autoFillCalcRate();
}

function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('hidden');
}

function refreshAllViews() {
  if (currentUser && currentUser.role === 'admin') {
    renderAdminDashboardStats();
    renderAdminRecordsTable();
    renderWargaUsersTable();
    updateWargaDropdown();
  } else if (currentUser) {
    renderWargaDashboard();
  }
}

/* ================= FORM PENIMBANGAN ================= */
function autoFillPriceRate() {
  const kat = document.getElementById('inputJenis').value;
  const hargaInput = document.getElementById('inputHarga');
  if (!hargaInput.dataset.userEdited) hargaInput.value = DEFAULT_RATES[kat] || 3000;
  calculateModalTotal();
}

function calculateModalTotal() {
  const berat = parseFloat(document.getElementById('inputBerat').value) || 0;
  const rate = parseFloat(document.getElementById('inputHarga').value) || 0;
  document.getElementById('modal-total-rp').innerText = formatRupiah(berat * rate);
}

function openInputModal() {
  updateWargaDropdown();
  document.getElementById('inputBerat').value = '';
  const hargaInput = document.getElementById('inputHarga');
  delete hargaInput.dataset.userEdited;
  autoFillPriceRate();
  document.getElementById('modal-input').classList.remove('hidden');
}

function closeInputModal() {
  document.getElementById('modal-input').classList.add('hidden');
}

async function submitPenimbangan(event) {
  event.preventDefault();
  const warga = document.getElementById('inputWarga').value;
  const jenis = document.getElementById('inputJenis').value;
  const berat = parseFloat(document.getElementById('inputBerat').value);
  const hargaPerKg = parseFloat(document.getElementById('inputHarga').value);
  const totalRp = berat * hargaPerKg;
  const waktu = new Date().toLocaleString('id-ID');

  if (!warga || !berat || berat <= 0) {
    showToast('Mohon isi data penimbangan dengan benar!', 'error');
    return;
  }

  try {
    showToast('Menyimpan data...', 'info');
    const { error } = await supabase.from('penimbangan').insert([{ waktu, warga, jenis, berat, total_rp: totalRp }]);
    if (error) throw error;

    if (APPS_SCRIPT_URL) {
      fetch(APPS_SCRIPT_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waktu, warga, jenis, berat, totalRp })
      });
    }

    showToast('Data tersimpan!');
    closeInputModal();
    await refreshAllData();
  } catch (err) {
    showToast('Gagal menyimpan: ' + (err.message || err), 'error');
  }
}

/* ================= RENDER ADMIN ================= */
function renderAdminDashboardStats() {
  const totalKg = rekapData.reduce((a, c) => a + Number(c.berat), 0);
  const totalRp = rekapData.reduce((a, c) => a + Number(c.totalRp), 0);
  document.getElementById('stat-total-kg').innerHTML = `${totalKg.toFixed(1)} <span class="text-sm font-normal text-slate-500">Kg</span>`;
  document.getElementById('stat-total-rp').innerText = formatRupiah(totalRp);
  document.getElementById('stat-total-trx').innerText = rekapData.length;
  document.getElementById('stat-total-warga').innerText = wargaAccounts.length;
}

function renderAdminRecordsTable() {
  const tbody = document.getElementById('admin-records-table-body');
  const searchVal = document.getElementById('filter-search').value.toLowerCase();
  const kategoriVal = document.getElementById('filter-kategori').value;
  const wargaVal = document.getElementById('filter-warga').value.toLowerCase();

  let filtered = rekapData.filter(r => {
    const ms = (r.warga || '').toLowerCase().includes(searchVal) || (r.jenis || '').toLowerCase().includes(searchVal);
    const mk = !kategoriVal || r.jenis === kategoriVal;
    const mw = !wargaVal || (r.warga || '').toLowerCase() === wargaVal;
    return ms && mk && mw;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-400"><i class="fa-solid fa-box-open text-3xl mb-2 block"></i>Belum ada data penimbangan.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(r => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3.5 font-medium text-slate-800">${escapeHTML(r.waktu)}</td>
      <td class="p-3.5 font-semibold text-slate-900">${escapeHTML(r.warga)}</td>
      <td class="p-3.5"><span class="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700">${escapeHTML(r.jenis)}</span></td>
      <td class="p-3.5 text-right font-bold text-slate-800">${Number(r.berat).toFixed(1)} Kg</td>
      <td class="p-3.5 text-right font-bold text-brand-700">${formatRupiah(r.totalRp)}</td>
      <td class="p-3.5 text-center no-print"><button onclick="hapusPenimbangan('${r.id}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`).join('');
}

async function hapusPenimbangan(docId) {
  if (!confirm('Hapus data penimbangan ini?')) return;
  try {
    const { error } = await supabase.from('penimbangan').delete().eq('id', docId);
    if (error) throw error;
    showToast('Data terhapus.', 'info');
    await refreshAllData();
  } catch (err) {
    showToast('Gagal hapus: ' + (err.message || err), 'error');
  }
}

/* ================= MANAJEMEN WARGA ================= */
async function handleAddWarga(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('new-warga-username').value.trim();
  const passwordInput = document.getElementById('new-warga-password').value.trim();
  const lowerName = usernameInput.toLowerCase();

  if (lowerName === 'admin' || wargaAccounts.some(w => w.username.toLowerCase() === lowerName)) {
    showToast('Username tidak tersedia!', 'error');
    return;
  }

  try {
    const { error } = await supabase.from('warga').insert([{ username: usernameInput, password: passwordInput }]);
    if (error) throw error;
    showToast(`Akun "${usernameInput}" tersimpan!`);
    document.getElementById('add-warga-form').reset();
    await refreshAllData();
  } catch (err) {
    showToast('Gagal menyimpan akun: ' + (err.message || err), 'error');
  }
}

function renderWargaUsersTable() {
  const tbody = document.getElementById('warga-users-table-body');
  tbody.innerHTML = wargaAccounts.map(w => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3.5 font-mono text-xs font-semibold text-slate-800">${escapeHTML(w.username)}</td>
      <td class="p-3.5"><code class="text-slate-400">••••••••</code></td>
      <td class="p-3.5 text-center">${w.username === 'warga1'
        ? '<span class="px-2 py-0.5 rounded text-[10px] bg-slate-100 font-bold text-slate-500">Default</span>'
        : `<button onclick="hapusWarga('${escapeHTML(w.username)}')" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><i class="fa-solid fa-user-xmark"></i></button>`}</td>
    </tr>`).join('');
}

async function hapusWarga(username) {
  if (!confirm(`Hapus akun "${username}"?`)) return;
  try {
    const { error } = await supabase.from('warga').delete().eq('username', username);
    if (error) throw error;
    showToast(`Akun ${username} dihapus.`);
    await refreshAllData();
  } catch (err) {
    showToast('Gagal hapus: ' + (err.message || err), 'error');
  }
}

function updateWargaDropdown() {
  const select = document.getElementById('inputWarga');
  const filterSelect = document.getElementById('filter-warga');
  if (!select) return;
  const opts = wargaAccounts.map(w => `<option value="${escapeHTML(w.username)}">${escapeHTML(w.username)}</option>`).join('');
  select.innerHTML = '<option value="">-- Pilih Warga --</option>' + opts;
  if (filterSelect) filterSelect.innerHTML = '<option value="">Semua Warga</option>' + opts;
}

/* ================= DASHBOARD WARGA ================= */
function renderWargaDashboard() {
  const myRekap = rekapData.filter(i => (i.warga || '').toLowerCase() === currentUser.username.toLowerCase());
  const totalKg = myRekap.reduce((a, c) => a + Number(c.berat), 0);
  const totalRp = myRekap.reduce((a, c) => a + Number(c.totalRp), 0);
  document.getElementById('warga-stat-kg').innerHTML = `${totalKg.toFixed(1)} <span class="text-sm font-normal text-slate-500">Kg</span>`;
  document.getElementById('warga-stat-rp').innerText = formatRupiah(totalRp);
  document.getElementById('warga-stat-trx').innerHTML = `${myRekap.length} <span class="text-sm font-normal text-slate-500">kali</span>`;
  const tbody = document.getElementById('warga-records-table-body');
  if (myRekap.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-slate-400">Belum ada hasil penimbangan.</td></tr>`;
    return;
  }
  tbody.innerHTML = myRekap.map(r => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="p-3.5 font-medium text-slate-800">${escapeHTML(r.waktu)}</td>
      <td class="p-3.5 font-semibold text-slate-900">${escapeHTML(r.jenis)}</td>
      <td class="p-3.5 text-right font-bold text-slate-800">${Number(r.berat).toFixed(1)} Kg</td>
      <td class="p-3.5 text-right font-bold text-brand-700">${formatRupiah(r.totalRp)}</td>
    </tr>`).join('');
}

/* ================= KALKULATOR ================= */
function autoFillCalcRate() {
  const select = document.getElementById('calc-kategori');
  const selectedOpt = select.options[select.selectedIndex];
  document.getElementById('calc-rate').value = selectedOpt.dataset.harga || 3000;
  calculateLiveEstimate();
}

function calculateLiveEstimate() {
  const kat = document.getElementById('calc-kategori').value;
  const berat = parseFloat(document.getElementById('calc-berat').value) || 0;
  const rate = parseFloat(document.getElementById('calc-rate').value) || 0;
  document.getElementById('calc-result-rp').innerText = formatRupiah(berat * rate);
  document.getElementById('calc-display-kat').innerText = kat;
  document.getElementById('calc-display-kg').innerText = `${berat.toFixed(1)} Kg`;
}

/* ================= GAS & CSV ================= */
function saveGasSettings(e) {
  e.preventDefault();
  const url = document.getElementById('gas-url-input').value.trim();
  APPS_SCRIPT_URL = url || DEFAULT_APPS_SCRIPT_URL;
  localStorage.setItem('gopocket_apps_script_url', APPS_SCRIPT_URL);
  updateSyncBannerState();
  showToast('URL Apps Script disimpan!');
}

function updateSyncBannerState() {
  const syncText = document.getElementById('sync-text');
  const syncDot = document.getElementById('sync-dot');
  if (APPS_SCRIPT_URL) {
    syncText.innerHTML = `Cloud Database &amp; Spreadsheet: <strong class="text-emerald-700">Terhubung</strong>`;
    syncDot.className = "relative inline-flex rounded-full h-3 w-3 bg-emerald-500";
  } else {
    syncText.innerHTML = `Cloud Database &amp; Spreadsheet: <strong class="text-amber-700">Belum Terhubung</strong>`;
    syncDot.className = "relative inline-flex rounded-full h-3 w-3 bg-amber-500";
  }
}

async function syncFromSpreadsheet() {
  if (!APPS_SCRIPT_URL) {
    showToast('Atur URL Apps Script dulu!', 'error');
    switchTab('tab-settings');
    return;
  }
  try {
    showToast('Mengambil data dari Spreadsheet...', 'info');
    const res = await fetch(APPS_SCRIPT_URL);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 1) showToast('Sinkronisasi berhasil!');
  } catch (err) {
    showToast('Gagal sinkronisasi.', 'error');
  }
}

function exportCSV() {
  if (rekapData.length === 0) { showToast('Tidak ada data!', 'warning'); return; }
  let csvContent = "\uFEFFWaktu;Nama Warga;Jenis Sampah;Berat (kg);Total (Rp)\n";
  rekapData.forEach(r => {
    const safeWarga = `"${(r.warga || '').replace(/"/g, '""')}"`;
    const safeJenis = `"${(r.jenis || '').replace(/"/g, '""')}"`;
    csvContent += `"${r.waktu}";${safeWarga};${safeJenis};${r.berat};${r.totalRp}\n`;
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Rekap_GoPocketWaste_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('CSV diunduh!');
}

function formatRupiah(val) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val || 0);
}

window.onbeforeprint = () => {
  document.getElementById('print-date').innerText = 'Tanggal Cetak: ' + new Date().toLocaleString('id-ID');
  document.getElementById('print-user').innerText = 'Dicetak Oleh: ' + (currentUser ? currentUser.username : 'Admin');
};