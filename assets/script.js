let DATA = null;
let charts = {};

const BULAN_ORDER = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const KUARTAL_ORDER = ['Q1', 'Q2', 'Q3', 'Q4'];
const BULAN_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Colors
const COLOR_MAROON = '#A91024';
const COLOR_GREEN = '#22c55e';
const COLOR_YELLOW = '#f59e0b';
const COLOR_BLUE = '#3b82f6';
const COLOR_RED = '#ef4444';

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-Op66milyOkhSOpUjBUTQZPn5o2zzWJVycMN4jjC0CAU8WvFgHLYb2t9FHtOvokF7oJKcgeOV4mHC/pub?output=csv";

const BULAN_MAP = {
  'januari': 0, 'februari': 1, 'maret': 2, 'april': 3,
  'mei': 4, 'juni': 5, 'juli': 6, 'agustus': 7,
  'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
};

function parseIndonesianDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(' ');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = BULAN_MAP[parts[1].toLowerCase()];
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      const m = (month + 1).toString().padStart(2, '0');
      const d = day.toString().padStart(2, '0');
      return `${year}-${m}-${d}`;
    }
  }
  return null;
}

async function loadData() {
  try {
    if (SHEET_CSV_URL === "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-Op66milyOkhSOpUjBUTQZPn5o2zzWJVycMN4jjC0CAU8WvFgHLYb2t9FHtOvokF7oJKcgeOV4mHC/pub?output=csv") {
      // Fallback ke data lokal jika URL belum diganti
      console.log("Menggunakan data statis lokal. Silakan ganti SHEET_CSV_URL untuk menggunakan Google Sheets.");
      const res = await fetch('data/data.json');
      if (!res.ok) throw new Error("HTTP error");
      DATA = await res.json();
      initDashboard();
      return;
    }

    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const rows = results.data;
        const kegiatan = [];

        rows.forEach(row => {
          const namaKegiatan = row["Nama Bank / Kegiatan Pengawasan"];
          if (!namaKegiatan) return;
          if (!row["No"] || !row["Tanggal Mulai"]) return;

          const tglMulai = parseIndonesianDate(row["Tanggal Mulai"]);
          const tglSelesai = parseIndonesianDate(row["Tanggal Selesai"]);
          let bulan = row["Bulan"] || "";

          if (!bulan && tglMulai) {
            const mIndex = parseInt(tglMulai.split('-')[1], 10) - 1;
            const bName = Object.keys(BULAN_MAP).find(key => BULAN_MAP[key] === mIndex);
            if (bName) bulan = bName.charAt(0).toUpperCase() + bName.slice(1);
          }

          kegiatan.push({
            no: parseInt(row["No"], 10),
            namaKegiatan: namaKegiatan,
            namaPUJK: row["Nama PUJK"] || "",
            kotaKab: row["Kota/Kab"] || "",
            sektor: row["Sektor"] || "",
            jenisLJK: row["Jenis LJK"] || "",
            jenisKegiatan: row["Jenis Kegiatan"] || "",
            kuartal: row["Kuartal (Q)"] || "",
            bulan: bulan,
            tanggalMulai: tglMulai,
            tanggalSelesai: tglSelesai,
            supervisor: row["Supervisor"] || "",
            statusKegiatan: row["Status Kegiatan"] || ""
          });
        });

        DATA = {
          kegiatan: kegiatan,
          metadata: { tanggalGenerate: new Date().toISOString() }
        };
        initDashboard();
      },
      error: function (err) {
        console.error("Gagal parse CSV dari Google Sheets", err);
      }
    });
  } catch (e) {
    console.error("Gagal load data", e);
  }
}

function initDashboard() {
  Chart.register(ChartDataLabels);
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#6e6e73';
  Chart.defaults.plugins.datalabels.color = '#fff';
  Chart.defaults.plugins.datalabels.font = { size: 9, weight: 'bold' };
  Chart.defaults.animation.duration = 1000;
  Chart.defaults.animation.easing = 'easeOutQuart';

  populateFilters();
  updateDashboard();

  // Setup event listeners
  document.querySelectorAll('.filter-bar select').forEach(sel => {
    sel.addEventListener('change', updateDashboard);
  });
}

function getFilteredData() {
  const fBulan = document.getElementById('filterBulan').value;
  const fSupervisor = document.getElementById('filterSupervisor').value;
  const fStatus = document.getElementById('filterStatus').value;
  const fSektor = document.getElementById('filterSektor').value;
  const fJenisLJK = document.getElementById('filterJenisLJK').value;
  const fJenisKegiatan = document.getElementById('filterJenisKegiatan').value;
  const fKota = document.getElementById('filterKotaKab').value;

  return DATA.kegiatan.filter(k => {
    // Note: Tahun is hardcoded to 2026 for now or extract from date
    const tgl = k.tanggalMulai ? new Date(k.tanggalMulai) : null;
    const tahun = tgl ? tgl.getFullYear().toString() : '';

    if (fBulan && k.bulan !== fBulan) return false;
    if (fSupervisor && k.supervisor !== fSupervisor) return false;
    if (fStatus && k.statusKegiatan !== fStatus) return false;
    if (fSektor && k.sektor !== fSektor) return false;
    if (fJenisLJK && k.jenisLJK !== fJenisLJK) return false;
    if (fJenisKegiatan && k.jenisKegiatan !== fJenisKegiatan) return false;
    if (fKota && k.kotaKab !== fKota) return false;
    return true;
  });
}

function updateDashboard() {
  const filtered = getFilteredData();

  // Update Date
  const genDate = new Date();
  document.getElementById('metaDate').textContent = genDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  // Update Metrics
  const total = filtered.length;
  const selesai = filtered.filter(k => k.statusKegiatan === 'Selesai').length;
  const progress = filtered.filter(k => k.statusKegiatan === 'On Progress').length;
  const belum = filtered.filter(k => k.statusKegiatan === 'Belum Mulai').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = filtered.filter(k => {
    if (k.statusKegiatan !== 'Belum Mulai') return false;
    if (!k.tanggalSelesai) return false;
    return new Date(k.tanggalSelesai) < today;
  }).length;

  document.getElementById('valTotal').textContent = total;
  document.getElementById('valSelesai').textContent = selesai;
  document.getElementById('valProgress').textContent = progress;
  document.getElementById('valBelum').textContent = belum;
  document.getElementById('valOverdue').textContent = overdue;

  const pct = total > 0 ? Math.round((selesai / total) * 100) : 0;
  document.getElementById('valCompletion').textContent = pct + '%';
  document.getElementById('statusNote').textContent = `Terdapat ${overdue} kegiatan overdue (melewati tanggal selesai namun belum selesai)`;

  renderCompletionDonut(pct);

  // Update Charts
  renderTrend(filtered);
  renderStatus(selesai, progress, belum);
  renderProgressKuartal(filtered);
  renderSupervisor(filtered);
  renderHorizontalBar('chartJenisKegiatan', filtered, 'jenisKegiatan');
  renderHorizontalBar('chartSektor', filtered, 'sektor');
  renderHorizontalBar('chartJenisLJK', filtered, 'jenisLJK');
  renderKota(filtered);

  // Tables
  renderTop10(filtered);
  renderGantt(filtered);
}

function destroyChart(id) {
  if (charts[id]) charts[id].destroy();
}

function renderCompletionDonut(pct) {
  destroyChart('chartCompletion');
  const ctx = document.getElementById('chartCompletion');
  charts['chartCompletion'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: [COLOR_MAROON, '#e5e7eb'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '75%',
      plugins: { tooltip: { enabled: false }, datalabels: { display: false } },
      animation: { duration: 0 }
    }
  });
}

function renderTrend(data) {
  destroyChart('chartTrend');
  const counts = BULAN_ORDER.map(b => data.filter(k => k.bulan === b).length);
  const ctx = document.getElementById('chartTrend');
  charts['chartTrend'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: BULAN_SHORT,
      datasets: [{
        data: counts,
        backgroundColor: COLOR_MAROON,
        barPercentage: 0.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end', align: 'top', color: '#1d1d1f',
          formatter: v => v > 0 ? v : ''
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { drawBorder: false }, suggestedMax: Math.max(...counts) + 5 },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderStatus(selesai, progress, belum) {
  destroyChart('chartStatus');
  const total = selesai + progress + belum;
  const ctx = document.getElementById('chartStatus');
  charts['chartStatus'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Selesai', 'On Progress', 'Belum Mulai'],
      datasets: [{
        data: [selesai, progress, belum],
        backgroundColor: [COLOR_GREEN, COLOR_YELLOW, COLOR_BLUE],
        borderWidth: 2, borderColor: '#fff'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '40%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 }, generateLabels: chart => chart.data.labels.map((l, i) => ({ text: l + '\\n' + chart.data.datasets[0].data[i] + ' Kegiatan', fillStyle: chart.data.datasets[0].backgroundColor[i] })) } },
        datalabels: {
          formatter: (val, ctx) => total > 0 && val > 0 ? Math.round((val / total) * 100) + '%' : '',
          color: '#fff', font: { weight: 'bold', size: 10 }
        }
      }
    }
  });
}

function renderProgressKuartal(data) {
  destroyChart('chartKuartal');
  const counts = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q).length);
  const selesais = KUARTAL_ORDER.map(q => data.filter(k => k.kuartal === q && k.statusKegiatan === 'Selesai').length);
  const pcts = counts.map((c, i) => c > 0 ? Math.round((selesais[i] / c) * 100) : 0);

  const ctx = document.getElementById('chartKuartal');
  charts['chartKuartal'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Q1\\n(Jan-Mar)', 'Q2\\n(Apr-Jun)', 'Q3\\n(Jul-Sep)', 'Q4\\n(Okt-Des)'],
      datasets: [
        {
          type: 'line',
          label: 'Persentase Selesai',
          data: pcts,
          borderColor: COLOR_YELLOW,
          backgroundColor: COLOR_YELLOW,
          yAxisID: 'y1',
          datalabels: { align: 'top', anchor: 'end', formatter: v => v + '%', color: '#1d1d1f' }
        },
        {
          type: 'bar',
          label: 'Total Kegiatan',
          data: counts,
          backgroundColor: COLOR_MAROON,
          barPercentage: 0.4,
          yAxisID: 'y',
          datalabels: { align: 'top', anchor: 'end', color: '#1d1d1f', formatter: v => v > 0 ? v : '' }
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
      scales: {
        y: { type: 'linear', position: 'left', beginAtZero: true, suggestedMax: Math.max(...counts) + 5 },
        y1: { type: 'linear', position: 'right', min: 0, max: 120, grid: { display: false }, ticks: { callback: v => v + '%' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderSupervisor(data) {
  destroyChart('chartSupervisor');
  const sups = [...new Set(data.map(k => k.supervisor || 'Lainnya'))];

  const ds = (status) => sups.map(s => data.filter(k => (k.supervisor || 'Lainnya') === s && k.statusKegiatan === status).length);
  const dOverdue = sups.map(s => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return data.filter(k => (k.supervisor || 'Lainnya') === s && k.statusKegiatan === 'Belum Mulai' && k.tanggalSelesai && new Date(k.tanggalSelesai) < today).length;
  });

  const ctx = document.getElementById('chartSupervisor');
  charts['chartSupervisor'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sups,
      datasets: [
        { label: 'Selesai', data: ds('Selesai'), backgroundColor: COLOR_GREEN },
        { label: 'On Progress', data: ds('On Progress'), backgroundColor: COLOR_YELLOW },
        { label: 'Belum Mulai', data: ds('Belum Mulai'), backgroundColor: COLOR_BLUE },
        { label: 'Overdue', data: dOverdue, backgroundColor: COLOR_RED }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 8, font: { size: 9 } } },
        datalabels: { formatter: v => v > 0 ? v : '' }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, grid: { display: false } }
      }
    }
  });
}

function renderHorizontalBar(id, data, field) {
  destroyChart(id);
  const counts = {};
  data.forEach(k => {
    const v = k[field] || 'Lainnya';
    counts[v] = (counts[v] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const vals = sorted.map(i => i[1]);

  const ctx = document.getElementById(id);
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLOR_MAROON, barPercentage: 0.6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'right', color: '#1d1d1f' }
      },
      scales: {
        x: { beginAtZero: true, suggestedMax: Math.max(...vals) * 1.2, grid: { drawBorder: false } },
        y: { grid: { display: false } }
      }
    }
  });
}

function renderKota(data) {
  destroyChart('chartKota');
  const counts = {};
  data.forEach(k => {
    let v = k.kotaKab || 'Lainnya';
    if (v.startsWith('Kab. ') || v.startsWith('Kota ')) v = v.substring(5);
    counts[v] = (counts[v] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(i => i[0]);
  const vals = sorted.map(i => i[1]);

  const ctx = document.getElementById('chartKota');
  charts['chartKota'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLOR_MAROON, barPercentage: 0.5 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: { anchor: 'end', align: 'top', color: '#1d1d1f' }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax: Math.max(...vals) * 1.2 },
        x: { grid: { display: false }, ticks: { font: { size: 9 } } }
      }
    }
  });
}

function renderTop10(data) {
  const pujkCount = {};
  data.forEach(k => {
    if (k.namaPUJK) {
      if (!pujkCount[k.namaPUJK]) pujkCount[k.namaPUJK] = { c: 0, s: k.sektor, l: k.jenisLJK };
      pujkCount[k.namaPUJK].c++;
    }
  });
  const sorted = Object.entries(pujkCount).sort((a, b) => b[1].c - a[1].c).slice(0, 10);

  const tbody = document.getElementById('tbodyTop10');
  tbody.innerHTML = sorted.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item[0]}</td>
      <td>${item[1].l}</td>
      <td>${item[1].s}</td>
      <td style="text-align:center">${item[1].c}</td>
    </tr>
  `).join('');
}

function renderGantt(data) {
  const tbody = document.getElementById('tbodyGantt');

  // Sort data by start date
  const sorted = [...data].filter(k => k.tanggalMulai).sort((a, b) => new Date(a.tanggalMulai) - new Date(b.tanggalMulai));

  tbody.innerHTML = sorted.map(k => {
    const start = new Date(k.tanggalMulai);
    const end = k.tanggalSelesai ? new Date(k.tanggalSelesai) : start;

    // Draw cells
    let cells = '';
    for (let i = 0; i < 12; i++) {
      let mStart = new Date(2026, i, 1);
      let mEnd = new Date(2026, i + 1, 0);

      let overlaps = (start <= mEnd && end >= mStart);

      if (overlaps) {
        // Calculate left offset and width
        let mTotalDays = mEnd.getDate();
        let overlapStart = new Date(Math.max(start, mStart));
        let overlapEnd = new Date(Math.min(end, mEnd));

        let startDay = overlapStart.getDate();
        let endDay = overlapEnd.getDate();

        let leftPct = ((startDay - 1) / mTotalDays) * 100;
        let widthPct = ((endDay - startDay + 1) / mTotalDays) * 100;

        cells += `<td class="month-cell"><div class="gantt-bar" style="left:${leftPct}%; width:${widthPct}%"></div></td>`;
      } else {
        cells += `<td class="month-cell bg-gray"></td>`;
      }
    }

    return `
      <tr>
        <td>${k.namaKegiatan}</td>
        <td>${k.supervisor}</td>
        ${cells}
      </tr>
    `;
  }).join('');
}

function populateFilters() {
  const addOpts = (id, vals) => {
    const sel = document.getElementById(id);
    vals.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  };

  const getUniq = field => [...new Set(DATA.kegiatan.map(k => k[field]).filter(Boolean))].sort();

  addOpts('filterBulan', BULAN_ORDER);
  addOpts('filterSupervisor', getUniq('supervisor'));
  addOpts('filterStatus', getUniq('statusKegiatan'));
  addOpts('filterSektor', getUniq('sektor'));
  addOpts('filterJenisLJK', getUniq('jenisLJK'));
  addOpts('filterJenisKegiatan', getUniq('jenisKegiatan'));
  addOpts('filterKotaKab', getUniq('kotaKab'));
}

document.addEventListener('DOMContentLoaded', loadData);
