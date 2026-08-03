# PROMPT UNTUK ANTIGRAVITY — Dashboard Interaktif Rencana Pemeriksaan LJK

Salin seluruh isi di bawah garis ini dan tempel ke chat Agent Manager di Antigravity (mode Planning).

---

## PERAN & TUJUAN

Kamu adalah agent developer yang akan membangun **website dashboard interaktif** untuk memvisualisasikan jadwal pengawasan Lembaga Jasa Keuangan (LJK) milik Divisi Pengawasan KOBM, Kantor OJK Provinsi Kalimantan Selatan, tahun 2026.

Sumber data ada di file `DASHBOARD.xlsm` yang sudah aku taruh di root folder workspace ini. Baca dan pahami dulu strukturnya secara menyeluruh sebelum menulis kode apa pun.

## STRUKTUR SUMBER DATA (WAJIB DIPAHAMI SEBELUM CODING)

File Excel punya 3 sheet:

1. **Sheet "DATA"** — sheet utama, berisi Excel Table bernama `tblData` di range A4:AE98 (baris 1-3 judul gabungan, baris 4 header kolom). Ada 94 baris data (baris 5-98), tapi **hanya 86 di antaranya benar-benar kegiatan pengawasan** — 8 baris sisanya adalah penanda hari libur/cuti bersama yang nyempil di tabel yang sama (lihat aturan pembersihan di bawah).

   Kolom UTAMA yang dipakai (13 kolom):
   - `No` — nomor urut
   - `Nama Bank / Kegiatan Pengawasan` — nama kegiatan
   - `Nama PUJK` — nama entitas yang diawasi (Pihak yang mendapat Layanan Jasa Keuangan)
   - `Kota/Kab` — lokasi kabupaten/kota
   - `Sektor` — salah satu dari: Perbankan, PVML, PPDP, Lainnya
   - `Jenis LJK` — jenis lembaga: BPR, Bank Umum, BPRS, Dana Pensiun, Jamkrida, Manajer Investasi, Modal Ventura, Pegadaian, Perusahaan Efek, APERD, PPE Ebus, Lainnya
   - `Jenis Kegiatan` — jenis aktivitas: Pemeriksaan Umum, Prudential Meeting, Penyusunan LHP, KYBFI, Pengerjaan TKS, Penyusunan RBBR, Evaluasi Kinerja
   - `Kuartal (Q)` — Q1/Q2/Q3/Q4
   - `Bulan` — nama bulan dalam Bahasa Indonesia (kolom formula, turunan dari Tanggal Mulai — JANGAN dipakai sebagai sumber utama, hitung ulang dari Tanggal Mulai supaya konsisten)
   - `Tanggal Mulai`, `Tanggal Selesai` — rentang tanggal kegiatan
   - `Supervisor` — hanya ada 2 nilai: "Kirbani" dan "Satrio Aji Nugroho"
   - `Status Kegiatan` — hanya ada 3 nilai saat ini: "Selesai", "On Progress", "Belum Mulai"

   Ada 18 kolom tambahan (`Kategori_PUJK`, `Kategori_Kota`, `Kategori_Sektor`, `Kategori_LJK`, `Kategori_JenisKegiatan`, `Kategori_Supervisor`, masing-masing dengan duplikat `...2` dan `...3`) — sisa setup pivot/slicer lama. **PENTING: kolom-kolom ini BUKAN salinan identik dari kolom aslinya** (`Kategori_Kota`, `Kategori_Sektor`, `Kategori_LJK` memang hampir sama tapi punya beberapa sel kosong yang tidak konsisten dengan kolom sumbernya; `Kategori_PUJK` khususnya adalah hasil pengelompokan top-N: sebagian besar barisnya diberi label "Lainnya" dan sisanya nama PUJK spesifik, tapi ada 11 baris kegiatan riil yang kosong di kolom ini — jadi tidak lengkap/tidak bisa diandalkan apa adanya).
   
   **Cara memperlakukannya**: abaikan semua 18 kolom `Kategori_*` ini sebagai sumber data langsung. Untuk fitur "Top PUJK" (lihat bagian FITUR di bawah), hitung ulang sendiri dari kolom `Nama PUJK` yang sudah bersih — jangan pakai `Kategori_PUJK` mentah, supaya hasilnya konsisten dan otomatis ter-update tiap kali data sumber berubah.

2. **Sheet "PIVOT"** — berisi 9 tabel pivot statis (PT1–PT9) yang sudah dihitung manual: total per bulan, frekuensi per PUJK, per kota/kab, per sektor, per jenis LJK, distribusi jenis kegiatan, rekap per kuartal, workload per supervisor, status per bulan. **JANGAN pakai sheet ini sebagai sumber angka untuk dashboard** — angkanya statis (bukan pivot hidup), beberapa Grand Total antar tabel berbeda karena ada baris dengan kolom Sektor/Kota/LJK/PUJK kosong. Semua agregasi/statistik di dashboard harus dihitung ulang langsung dari sheet DATA yang sudah dibersihkan, bukan diimpor dari sheet PIVOT.

3. **Sheet "DASHBOARD"** — kosong total, tidak ada desain referensi. Ini murni dashboard baru yang kamu bangun dari nol.

## ATURAN PEMBERSIHAN DATA (WAJIB)

Buat langkah pembersihan data terpisah (script Python atau Node, jalan sekali di luar browser) sebelum data dipakai front-end, dengan aturan berikut:

1. **Baris penanda hari libur**: baris di mana kolom `Nama PUJK`, `Kota/Kab`, `Tanggal Mulai` semuanya kosong dan hanya kolom `Nama Bank / Kegiatan Pengawasan` berisi teks seperti "16 Januari 2026 - Isra' Miraj" — ini BUKAN kegiatan pengawasan. Pisahkan jadi daftar `hariLibur` sendiri (dipakai untuk anotasi di kalender/timeline), JANGAN dihitung sebagai kegiatan dan JANGAN ditampilkan sebagai kartu kegiatan kosong. Ada 8 baris seperti ini di data saat ini.

2. **Parser tanggal harus defensif**: saat ini semua 86 baris kegiatan sudah punya `Tanggal Mulai`/`Tanggal Selesai` bertipe date Excel yang valid (sudah diverifikasi satu per satu, tidak ada yang tersimpan sebagai teks). Tapi karena file ini akan diperbarui manual tiap kuartal oleh manusia di Excel, tetap buat parser yang bisa menangani DUA kemungkinan format — nilai serial/date Excel maupun string tanggal berbahasa Indonesia ("28 September 2026") — supaya kalau suatu saat ada entri baru yang diketik sebagai teks, baris itu tidak gagal ter-parse dan hilang diam-diam dari dashboard.

3. **Validasi Tanggal Selesai vs Tanggal Mulai**: saat ini tidak ada baris dengan Tanggal Selesai < Tanggal Mulai (sudah dicek semua). Tapi tetap buat validasi ini sebagai pengecekan runtime tiap kali `data.json` di-generate ulang: kalau suatu saat ditemukan baris dengan Tanggal Selesai < Tanggal Mulai, JANGAN diam-diam ditukar/"diperbaiki" otomatis. Tetap tampilkan datanya apa adanya, tapi beri badge/ikon peringatan kecil ("⚠ data tanggal perlu dicek") pada baris ini di tabel dan di timeline, dan cetak peringatannya di log terminal script pembersihan.

4. **Spasi berlebih**: ada 4 sel yang teridentifikasi punya spasi ekstra di awal/akhir saat ini (kolom `Nama Bank / Kegiatan Pengawasan` dan `Nama PUJK`, di antaranya "Dana Pensiun BPD Kalsel " dan " PT BPR Tabalong Bersinar"). Lakukan `.trim()` pada SEMUA nilai string saat parsing (bukan cuma yang 4 sel ini), supaya nilai yang sama tidak dianggap kategori berbeda di filter/dropdown, dan supaya baris baru yang ditambahkan nanti otomatis ikut dibersihkan juga.

5. Field `Bulan` adalah kolom formula turunan — hitung ulang nama bulan dari `Tanggal Mulai` yang sudah bersih (bukan mengambil nilai formula mentah), untuk hindari inkonsistensi.

6. **Hitung ulang "Top PUJK"**: hitung frekuensi kemunculan tiap nilai `Nama PUJK` (yang sudah di-trim) di antara 86 baris kegiatan. Ambil 5 PUJK dengan frekuensi tertinggi, kelompokkan sisanya jadi satu kategori "Lainnya". Simpan hasilnya sebagai bagian dari `data.json` (bukan dihitung ulang di browser), dipakai untuk chart baru (lihat FITUR poin 2).

Setelah dibersihkan, simpan sebagai satu file `data.json` yang jadi satu-satunya sumber data front-end (jangan parsing file Excel langsung di browser saat runtime).

## ARSITEKTUR TEKNIS

- Website statis: HTML + CSS + JavaScript vanilla, tanpa framework backend, tanpa proses build/bundler yang rumit — supaya bisa dibuka langsung dari file `index.html` atau di-hosting di mana saja tanpa server.
- Grafik pakai **Chart.js** (via CDN).
- Struktur folder yang rapi dan **bisa dipakai ulang setiap kali jadwal diperbarui**:
  ```
  /project
    /data
      sumber.xlsm          <- file Excel asli (update di sini tiap kuartal)
      convert.py (atau .js) <- script pembersihan data, tinggal dijalankan ulang
      data.json             <- output bersih, dipakai front-end
    /assets
      style.css
      script.js
    index.html
  ```
- Jangan hardcode data kegiatan langsung di HTML/JS — semua harus baca dari `data.json` supaya kalau jadwal berubah tiap kuartal, aku tinggal ganti file Excel sumber dan jalankan ulang script convert-nya, tanpa perlu kode ulang dashboard-nya.

## FITUR YANG HARUS ADA

1. **Kartu ringkasan (metric cards)** di bagian atas:
   - Total kegiatan (86)
   - Jumlah kegiatan per status (Selesai / On Progress / Belum Mulai) dengan warna
   - Workload per supervisor (Kirbani vs Satrio Aji Nugroho)
   - Kegiatan yang lewat tanggal tapi status masih "Belum Mulai" (highlight sebagai perhatian)

2. **Grafik**:
   - Bar chart jumlah kegiatan per bulan (Januari–November)
   - Pie/donut chart distribusi per Sektor
   - Bar chart distribusi per Jenis LJK
   - Bar chart distribusi per Jenis Kegiatan
   - Bar chart rekap per Kuartal
   - Stacked bar workload per bulan per Supervisor
   - **Pie/donut chart "Top 5 PUJK Paling Sering Diperiksa + Lainnya"** — pakai hasil perhitungan di aturan pembersihan poin 6 (bukan kolom `Kategori_PUJK` mentah)

3. **Tampilan timeline/kalender**: rentang Tanggal Mulai–Selesai tiap kegiatan digambarkan per bulan/kuartal (gaya Gantt sederhana), dengan hari libur dari daftar `hariLibur` ditandai sebagai garis/penanda terpisah, bukan sebagai kegiatan.

4. **Tabel/daftar kegiatan** yang bisa:
   - Dicari (search by nama kegiatan/PUJK)
   - Difilter: Bulan, Kuartal, Sektor, Jenis LJK, Supervisor, Status, Kota/Kab
   - Diurutkan berdasarkan tanggal

5. **Badge warna status**, ikuti konvensi yang sudah ada di file Excel aslinya:
   - Selesai → hijau (latar `#C6EFCE`, teks `#006100`)
   - On Progress → oranye (latar `#FFC000`, teks `#FF6600`)
   - Belum Mulai → abu-abu netral
   - (Sediakan juga slot warna untuk status "Urgent" latar `#FFC7CE` dan "Overdue" latar `#C00000` teks putih tebal — dua status ini sudah didefinisikan sebagai aturan warna di file Excel meski belum dipakai di data saat ini, jaga-jaga kalau ke depan status ini dipakai.)

6. **Desain visual**: warna aksen/header utama merah maroon `#C00000` (sesuai warna header tabel di file Excel aslinya, identitas OJK), tampilan bersih dan profesional, responsive (enak dilihat di laptop maupun HP).

7. **Semua teks di UI dalam Bahasa Indonesia**, tanpa campuran istilah Inggris kecuali istilah yang memang baku dipakai institusi (contoh: LHP, RBBR, KYBFI, dsb — biarkan apa adanya, jangan diterjemahkan paksa).

## LANGKAH KERJA UNTUK KAMU (AGENT)

1. Baca dan parsing sheet DATA dari file Excel yang ada di workspace ini.
2. Terapkan semua aturan pembersihan data di atas, catat/log di terminal setiap anomali yang ditemukan (baris dengan tanggal terbalik, baris dengan tanggal teks, dsb) supaya aku tahu baris mana saja yang perlu dicek manual — meskipun saat ini tidak ada anomali semacam itu, log-nya tetap penting untuk update data di masa depan.
3. Hasilkan `data.json` yang bersih, termasuk hasil perhitungan Top 5 PUJK + Lainnya.
4. Bangun halaman dashboard sesuai fitur di atas.
5. Jalankan preview lokal supaya aku bisa cek hasilnya langsung di browser.
6. Setelah aku review, tunggu instruksi lanjutan untuk revisi (jangan langsung deploy/publish ke mana pun).

## BATASAN

- Jangan mengarang data yang tidak ada di file.
- Kalau ada bagian struktur data yang ambigu saat kamu proses, tanya dulu ke aku, jangan menebak sendiri.
- Jangan menghapus atau menimpa file Excel sumber aslinya.
