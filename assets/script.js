/**
 * Dashboard Pengawasan LJK — OJK Kalsel 2026
 * Real-time data from Google Sheets via server endpoint
 */

let DATA = null;
let charts = {};

const BULAN_ORDER = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const KUARTAL_ORDER = ['Q1','Q2','Q3','Q4'];
const BULAN_SHORT   = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

const COLOR_MAROON = '#A91024';
const COLOR_GREEN  = '#22c55e';
const COLOR_YELLOW = '#f59e0b';
const COLOR_BLUE   = '#3b82f6';
const COLOR_RED    = '#ef4444';

// ═══════════════════════════════════════════════════════════
// LOAD & SYNC DATA FROM SERVER (which fetches Google Sheets)
// ═══════════════════════════════════════════════════════════
let isInitialized = false;
let autoRefreshTimer = null;

async function loadData(isManual = false) {
  const btnSync = document.getElementById('btnRefresh');
  if (isManual && btnSync) {
    btnSync.classList.add('spinning');
  }

  if (!isInitialized) {
    showLoading(true);
  }

  const failsafe = setTimeout(() => {
    showLoading(false);
    if (btnSync) btnSync.classList.remove('spinning');
    console.warn("Failsafe triggered: Loading overlay hidden automatically after 15s");
  }, 15000);

  try {
    const res = await fetch('data/data.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DATA = await res.json();
    clearTimeout(failsafe);
    showLoading(false);
    if (btnSync) btnSync.classList.remove('spinning');

    if (!isInitialized) {
      isInitialized = true;
      initDashboard();
      // Auto refresh every 30 seconds
      if (!autoRefreshTimer) {
        autoRefreshTimer = setInterval(() => {
          loadData(false);
        }, 30000);
      }
    } else {
      // Refresh charts and filters while saving state
      const currentFilters = saveFilterState();
      populateFilters();
      restoreFilterState(currentFilters);
      updateDashboard();
    }
  } catch(err) {
    clearTimeout(failsafe);
    if (btnSync) btnSync.classList.remove('spinning');
    console.error("Gagal load data:", err);
    showLoading(false);
    if (!isInitialized) {
      showError("Gagal memuat data dari Google Sheets. Pastikan server lokal (python3 server.py) berjalan di background.");
    }
  }
}

function manualRefresh() {
  loadData(true);
}

function saveFilterState() {
  const filterIds = ['filterKuartal','filterBulan','filterSupervisor','filterStatus','filterBidang','filterJenisLJK','filterJenisKegiatan','filterKotaKab','filterAnggota'];
  const state = {};
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  return state;
}

function restoreFilterState(state) {
  Object.keys(state).forEach(id => {
    const el = document.getElementById(id);
    if (el && Array.from(el.options).some(opt => opt.value === state[id])) {
      el.value = state[id];
    }
  });
}

function showLoading(on) {
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function showError(msg) {
  const main = document.querySelector('.metrics-grid') || document.body;
  main.insertAdjacentHTML('beforebegin', `
    <div style="text-align:center;padding:1.5rem;background:#fee2e2;color:#991b1b;border-radius:12px;margin:1rem 0;font-weight:600;font-size:13px;">
      ⚠️ ${msg}
    </div>
  `);
}

// ═══════════════════════════════════════════════════════════
// INIT & DASHBOARD SETUP
// ═══════════════════════════════════════════════════════════
function initDashboard() {
  if (typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#6e6e73';
  if (Chart.defaults.plugins.datalabels) {
    Chart.defaults.plugins.datalabels.color = '#fff';
    Chart.defaults.plugins.datalabels.font = { size: 9, weight: 'bold' };
  }

  populateFilters();
  updateDashboard();

  document.querySelectorAll('.filter-bar select').forEach(sel => {
    sel.addEventListener('change', updateDashboard);
  });
}

function getFilteredData() {
  const fKuartal      = document.getElementById('filterKuartal')?.value || '';
  const fBulan        = document.getElementById('filterBulan')?.value || '';
  const fSupervisor   = document.getElementById('filterSupervisor')?.value || '';
  const fStatus       = document.getElementById('filterStatus')?.value || '';
  const fBidang       = document.getElementById('filterBidang')?.value || '';
  const fJenisLJK     = document.getElementById('filterJenisLJK')?.value || '';
  const fJenisKeg     = document.getElementById('filterJenisKegiatan')?.value || '';
  const fKota         = document.getElementById('filterKotaKab')?.value || '';
  const fAnggota      = document.getElementById('filterAnggota')?.value || '';

  return DATA.kegiatan.filter(k => {
    if (fKuartal    && k.kuartal        !== fKuartal)    return false;
    if (fBulan      && k.bulan          !== fBulan)      return false;
    if (fSupervisor && k.supervisor     !== fSupervisor) return false;
    if (fStatus     && k.statusKegiatan  !== fStatus)    return false;
    if (fBidang     && k.bidang         !== fBidang)     return false;
    if (fJenisLJK   && k.jenisLJK      !== fJenisLJK)   return false;
    if (fJenisKeg   && k.jenisKegiatan  !== fJenisKeg)   return false;
    if (fKota       && k.kotaKab        !== fKota)       return false;
    if (fAnggota    && (!k.anggota || !k.anggota.includes(fAnggota))) return false;
    return true;
  });
}

function updateDashboard() {
  const filtered = getFilteredData();

  const tglStr = DATA.metadata?.tanggalGenerate;
  let genDate;
  if (tglStr) {
    // If the string has no timezone indicator (from old server.py), treat as WIB (UTC+7)
    // If it ends with Z or +, it's already timezone-aware
    const hasTimezone = tglStr.endsWith('Z') || tglStr.includes('+') || tglStr.includes(' UTC');
    genDate = hasTimezone ? new Date(tglStr) : new Date(tglStr + '+07:00');
  } else {
    genDate = new Date();
  }
  const dateFormatted = genDate.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Jakarta' });
  const timeFormatted = genDate.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'Asia/Jakarta' });
  document.getElementById('metaDate').textContent = `${dateFormatted}, ${timeFormatted} WIB`;

  const total    = filtered.length;
  const selesai  = filtered.filter(k => k.statusKegiatan === 'Selesai').length;
  const progress = filtered.filter(k => k.statusKegiatan === 'On Progress').length;
  const belum    = filtered.filter(k => k.statusKegiatan === 'Belum Mulai').length;

  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = filtered.filter(k =>
    k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length;

  document.getElementById('valTotal').textContent    = total;
  document.getElementById('valSelesai').textContent  = selesai;
  document.getElementById('valProgress').textContent = progress;
  document.getElementById('valBelum').textContent    = belum;
  document.getElementById('valOverdue').textContent  = overdue;

  const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
  document.getElementById('valCompletion').textContent = pct + '%';
  document.getElementById('statusNote').textContent =
    `Terdapat ${overdue} kegiatan overdue (melewati tanggal selesai namun belum selesai)`;

  renderCompletionDonut(pct);
  renderTrend(filtered);
  renderStatus(selesai, progress, belum);
  renderProgressKuartal(filtered);
  renderSupervisor(filtered);
  renderHorizontalBar('chartJenisKegiatan', filtered, 'jenisKegiatan');
  renderHorizontalBar('chartBidang',        filtered, 'bidang');
  renderHorizontalBar('chartJenisLJK',      filtered, 'jenisLJK');
  renderKota(filtered);
  renderTop10(filtered);
  renderAnggota(filtered);
  renderBebanAnggota(filtered);
  renderAnggotaTable(filtered);
  renderGantt(filtered);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); charts[id] = null; }
}

// ═══════════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════════
function renderCompletionDonut(pct) {
  destroyChart('chartCompletion');
  charts['chartCompletion'] = new Chart(document.getElementById('chartCompletion'), {
    type: 'doughnut',
    data: { datasets: [{ data: [pct, 100-pct], backgroundColor: [COLOR_MAROON,'#e5e7eb'], borderWidth: 0 }] },
    options: { cutout:'75%', plugins:{ tooltip:{enabled:false}, datalabels:{display:false} }, animation:{duration:600} }
  });
}

function renderTrend(data) {
  destroyChart('chartTrend');
  const counts = BULAN_ORDER.map(b => data.filter(k => k.bulan === b).length);
  charts['chartTrend'] = new Chart(document.getElementById('chartTrend'), {
    type: 'bar',
    data: { labels: BULAN_SHORT, datasets: [{ data: counts, backgroundColor: COLOR_MAROON, barPercentage: 0.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor:'end', align:'top', color:'#1d1d1f', formatter: v => v > 0 ? v : '' }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...counts, 1) + 5 },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderStatus(selesai, progress, belum) {
  destroyChart('chartStatus');
  const total = selesai + progress + belum;
  charts['chartStatus'] = new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: {
      labels: ['Selesai','On Progress','Belum Mulai'],
      datasets: [{ data:[selesai,progress,belum], backgroundColor:[COLOR_GREEN,COLOR_YELLOW,COLOR_BLUE], borderWidth:2, borderColor:'#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '40%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12, font: { size: 10 },
            generateLabels: chart => chart.data.labels.map((l,i) => ({
              text: l + '\n' + chart.data.datasets[0].data[i] + ' Kegiatan',
              fillStyle: chart.data.datasets[0].backgroundColor[i],
              strokeStyle: chart.data.datasets[0].backgroundColor[i]
            }))
          }
        },
        datalabels: {
          formatter: (val) => total > 0 && val > 0 ? Math.round((val/total)*100)+'%' : '',
          color: '#fff', font: { weight:'bold', size:10 }
        }
      }
    }
  });
}

function renderProgressKuartal(data) {
  destroyChart('chartKuartal');
  const counts  = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q).length);
  const selesais = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q && k.statusKegiatan === 'Selesai').length);
  const pcts    = counts.map((c,i) => c > 0 ? Math.round((selesais[i]/c)*100) : 0);
  const labels  = ['Q1\n(Jan-Mar)','Q2\n(Apr-Jun)','Q3\n(Jul-Sep)','Q4\n(Okt-Des)'];

  charts['chartKuartal'] = new Chart(document.getElementById('chartKuartal'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type:'line', label:'Persentase Selesai', data:pcts, borderColor:COLOR_YELLOW, backgroundColor:COLOR_YELLOW, yAxisID:'y1',
          datalabels:{ align:'top', anchor:'end', formatter: v=>v+'%', color:'#1d1d1f' } },
        { type:'bar',  label:'Total Kegiatan', data:counts, backgroundColor:COLOR_MAROON, barPercentage:0.4, yAxisID:'y',
          datalabels:{ align:'top', anchor:'end', color:'#1d1d1f', formatter: v=> v>0?v:'' } }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ position:'bottom', labels:{ boxWidth:12 } } },
      scales: {
        y:  { type:'linear', position:'left',  beginAtZero:true, suggestedMax: Math.max(...counts,1)+5 },
        y1: { type:'linear', position:'right', min:0, max:120, grid:{display:false}, ticks:{ callback: v=>v+'%' } },
        x:  { grid:{ display:false } }
      }
    }
  });
}

function renderSupervisor(data) {
  destroyChart('chartSupervisor');
  const sups = [...new Set(DATA.kegiatan.map(k => k.supervisor || 'Lainnya').filter(Boolean))].sort();
  const ds = (status) => sups.map(s => data.filter(k => (k.supervisor||'Lainnya') === s && k.statusKegiatan === status).length);
  const today = new Date(); today.setHours(0,0,0,0);
  const dOverdue = sups.map(s => data.filter(k =>
    (k.supervisor||'Lainnya') === s && k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length);

  charts['chartSupervisor'] = new Chart(document.getElementById('chartSupervisor'), {
    type: 'bar',
    data: {
      labels: sups,
      datasets: [
        { label:'Selesai',    data: ds('Selesai'),    backgroundColor: COLOR_GREEN  },
        { label:'On Progress',data: ds('On Progress'),backgroundColor: COLOR_YELLOW },
        { label:'Belum Mulai',data: ds('Belum Mulai'),backgroundColor: COLOR_BLUE  },
        { label:'Overdue',    data: dOverdue,          backgroundColor: COLOR_RED   },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { position:'top', labels:{ boxWidth:8, font:{size:9} } },
        datalabels: { formatter: v => v > 0 ? v : '' }
      },
      scales: { x:{stacked:true}, y:{stacked:true, grid:{display:false}, ticks:{autoSkip:false}} }
    }
  });
}

function renderHorizontalBar(id, data, field) {
  destroyChart(id);
  const counts = {};
  data.forEach(k => { const v = k[field]||'Lainnya'; counts[v]=(counts[v]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const labels = sorted.map(i=>i[0]);
  const vals   = sorted.map(i=>i[1]);

  charts[id] = new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets:[{ data:vals, backgroundColor:COLOR_MAROON, barPercentage:0.6 }] },
    options: {
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins: {
        legend:{display:false},
        datalabels:{ anchor:'end', align:'right', color:'#1d1d1f' }
      },
      scales: {
        x:{ beginAtZero:true, suggestedMax: Math.max(...vals,1)*1.2, grid:{drawBorder:false} },
        y:{ grid:{display:false} }
      }
    }
  });
}

function renderKota(data) {
  destroyChart('chartKota');
  const counts = {};
  data.forEach(k => {
    let v = k.kotaKab || 'Lainnya';
    v = v.replace(/^(Kab\.|Kota)\s+/i, '');
    counts[v] = (counts[v]||0)+1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const labels = sorted.map(i=>i[0]);
  const vals   = sorted.map(i=>i[1]);

  charts['chartKota'] = new Chart(document.getElementById('chartKota'), {
    type: 'bar',
    data: { labels, datasets:[{ data:vals, backgroundColor:COLOR_MAROON, barPercentage:0.5 }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{display:false},
        datalabels:{ anchor:'end', align:'top', color:'#1d1d1f' }
      },
      scales: {
        y:{ beginAtZero:true, suggestedMax: Math.max(...vals,1)*1.2 },
        x:{ grid:{display:false}, ticks:{font:{size:9}} }
      }
    }
  });
}

function renderTop10(data) {
  const pujkCount = {};
  data.forEach(k => {
    if (k.namaPUJK) {
      if (!pujkCount[k.namaPUJK]) pujkCount[k.namaPUJK] = { c:0, s:k.bidang, l:k.jenisLJK };
      pujkCount[k.namaPUJK].c++;
    }
  });
  const sorted = Object.entries(pujkCount).sort((a,b)=>b[1].c-a[1].c).slice(0,10);
  document.getElementById('tbodyTop10').innerHTML = sorted.map((item,i) => `
    <tr>
      <td>${i+1}</td>
      <td>${item[0]}</td>
      <td>${item[1].l}</td>
      <td>${item[1].s}</td>
      <td style="text-align:center">${item[1].c}</td>
    </tr>
  `).join('');
}

function renderAnggota(data) {
  destroyChart('chartAnggota');
  
  // Get unique anggota list from FULL data so all pegawai always show up
  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) {
      k.anggota.forEach(a => anggotaSet.add(a));
    }
  });
  const angs = [...anggotaSet].sort();
  
  if (angs.length === 0) {
    document.getElementById('chartAnggota').parentElement.innerHTML = '<div style="text-align:center;margin-top:20px;color:#999;font-size:12px;">Tidak ada data anggota pada filter ini</div>';
    return;
  }

  // Helper to count by status
  const ds = (status) => angs.map(a => 
    data.filter(k => k.anggota && k.anggota.includes(a) && k.statusKegiatan === status).length
  );
  
  const today = new Date(); today.setHours(0,0,0,0);
  const dOverdue = angs.map(a => data.filter(k =>
    k.anggota && k.anggota.includes(a) && k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today
  ).length);

  charts['chartAnggota'] = new Chart(document.getElementById('chartAnggota'), {
    type: 'bar',
    data: {
      labels: angs,
      datasets: [
        { label:'Selesai',    data: ds('Selesai'),    backgroundColor: COLOR_GREEN  },
        { label:'On Progress',data: ds('On Progress'),backgroundColor: COLOR_YELLOW },
        { label:'Belum Mulai',data: ds('Belum Mulai'),backgroundColor: COLOR_BLUE  },
        { label:'Overdue',    data: dOverdue,         backgroundColor: COLOR_RED   },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { position:'top', labels:{ boxWidth:8, font:{size:9} } },
        datalabels: { formatter: v => v > 0 ? v : '' }
      },
      scales: { x:{stacked:true}, y:{stacked:true, grid:{display:false}, ticks:{autoSkip:false}} }
    }
  });
}

function renderBebanAnggota(data) {
  destroyChart('chartBebanAnggota');
  
  // Get unique anggota list from FULL data to show all
  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) {
      k.anggota.forEach(a => anggotaSet.add(a));
    }
  });
  const angs = [...anggotaSet].sort();
  
  if (angs.length === 0) {
    document.getElementById('chartBebanAnggota').parentElement.innerHTML = '<div style="text-align:center;margin-top:20px;color:#999;font-size:12px;">Tidak ada data anggota pada filter ini</div>';
    return;
  }

  // Count total tasks per anggota based on FILTERED data
  const counts = angs.map(a => 
    data.filter(k => k.anggota && k.anggota.includes(a)).length
  );

  charts['chartBebanAnggota'] = new Chart(document.getElementById('chartBebanAnggota'), {
    type: 'bar',
    data: { 
      labels: angs, 
      datasets: [{ data: counts, backgroundColor: COLOR_MAROON, barPercentage: 0.6 }] 
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'right', color: '#1d1d1f', formatter: v => v > 0 ? v : '' }
      },
      scales: {
        x: { beginAtZero: true, suggestedMax: Math.max(...counts, 1) * 1.2, grid: { drawBorder: false } },
        y: { grid: { display: false }, ticks: { font: { size: 9 }, autoSkip: false } }
      }
    }
  });
}

function renderAnggotaTable(data) {
  const filtered = data.filter(k => k.anggota && k.anggota.length > 0);
  const tbody = document.getElementById('tbodyAnggota');
  if (!tbody) return;

  const statusColors = {
    'Selesai': '#dcfce7',
    'On Progress': '#fef9c3',
    'Belum Mulai': '#dbeafe'
  };
  const statusTextColors = {
    'Selesai': '#166534',
    'On Progress': '#854d0e',
    'Belum Mulai': '#1e40af'
  };

  tbody.innerHTML = filtered.map((k, i) => {
    const bg = statusColors[k.statusKegiatan] || '#f3f4f6';
    const fg = statusTextColors[k.statusKegiatan] || '#374151';
    return `
    <tr>
      <td>${i + 1}</td>
      <td>${k.namaKegiatan}</td>
      <td>${k.supervisor}</td>
      <td>${k.anggota.join(', ')}</td>
      <td><span style="background:${bg};color:${fg};padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;white-space:nowrap;">${k.statusKegiatan}</span></td>
    </tr>`;
  }).join('');
}

function renderGantt(data) {
  const sorted = [...data].filter(k=>k.tanggalMulai).sort((a,b)=>new Date(a.tanggalMulai)-new Date(b.tanggalMulai));
  document.getElementById('tbodyGantt').innerHTML = sorted.map(k => {
    const start = new Date(k.tanggalMulai);
    const end   = k.tanggalSelesai ? new Date(k.tanggalSelesai) : start;
    let cells = '';
    for (let i=0; i<12; i++) {
      const mStart = new Date(2026, i, 1);
      const mEnd   = new Date(2026, i+1, 0);
      if (start <= mEnd && end >= mStart) {
        const mDays    = mEnd.getDate();
        const startDay = new Date(Math.max(start, mStart)).getDate();
        const endDay   = new Date(Math.min(end, mEnd)).getDate();
        const left  = ((startDay-1)/mDays*100).toFixed(1);
        const width = ((endDay-startDay+1)/mDays*100).toFixed(1);
        cells += `<td class="month-cell"><div class="gantt-bar" style="left:${left}%;width:${width}%"></div></td>`;
      } else {
        cells += `<td class="month-cell bg-gray"></td>`;
      }
    }
    return `<tr><td>${k.namaKegiatan}</td><td>${k.supervisor}</td>${cells}</tr>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
// FILTER POPULATION
// ═══════════════════════════════════════════════════════════
function populateFilters() {
  const addOpts = (id, vals) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    vals.forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
  };
  const getUniq = field => [...new Set(DATA.kegiatan.map(k=>k[field]).filter(Boolean))].sort();

  addOpts('filterKuartal',       KUARTAL_ORDER);
  addOpts('filterBulan',         BULAN_ORDER);
  addOpts('filterSupervisor',    getUniq('supervisor'));
  addOpts('filterStatus',        getUniq('statusKegiatan'));
  addOpts('filterBidang',        getUniq('bidang'));
  addOpts('filterJenisLJK',      getUniq('jenisLJK'));
  addOpts('filterJenisKegiatan', getUniq('jenisKegiatan'));
  addOpts('filterKotaKab',       getUniq('kotaKab'));

  const anggotaSet = new Set();
  DATA.kegiatan.forEach(k => {
    if (k.anggota && k.anggota.length > 0) k.anggota.forEach(a => anggotaSet.add(a));
  });
  addOpts('filterAnggota', [...anggotaSet].sort());
}

document.addEventListener('DOMContentLoaded', () => loadData(false));
