#!/usr/bin/env python3
"""
convert.py — Script pembersihan data untuk Dashboard Pengawasan LJK OJK Kalsel 2026.
Membaca DASHBOARD.xlsm secara langsung menggunakan openpyxl.
"""

import openpyxl
import json
import os
import sys
from datetime import datetime, date
from collections import Counter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXCEL_PATH = os.path.join(PROJECT_DIR, "DASHBOARD.xlsm")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "data.json")

# Mapping nama bulan Indonesia
BULAN_INDONESIA = {
    1: "Januari", 2: "Februari", 3: "Maret", 4: "April",
    5: "Mei", 6: "Juni", 7: "Juli", 8: "Agustus",
    9: "September", 10: "Oktober", 11: "November", 12: "Desember",
}
BULAN_KE_ANGKA = {v.lower(): k for k, v in BULAN_INDONESIA.items()}

def log_info(msg):
    print(f"[INFO] {msg}")

def log_warning(msg):
    print(f"[WARNING] ⚠ {msg}", file=sys.stderr)

def clean_str(val):
    if val is None:
        return ""
    return str(val).strip()

def parse_tanggal(value, row_label=""):
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value.date()
    
    if isinstance(value, date):
        return value

    value_str = str(value).strip()
    if not value_str:
        return None

    parts = value_str.split()
    if len(parts) == 3:
        try:
            day = int(parts[0])
            month_name = parts[1].lower()
            year = int(parts[2])
            if month_name in BULAN_KE_ANGKA:
                return date(year, BULAN_KE_ANGKA[month_name], day)
        except (ValueError, KeyError):
            pass

    try:
        return datetime.strptime(value_str, "%Y-%m-%d").date()
    except ValueError:
        pass
    try:
        return datetime.strptime(value_str, "%d/%m/%Y").date()
    except ValueError:
        pass

    try:
        serial = float(value_str)
        if 1 < serial < 200000:
            from datetime import timedelta
            base = date(1899, 12, 30)
            return base + timedelta(days=int(serial))
    except ValueError:
        pass

    log_warning(f"Gagal parse tanggal '{value_str}' pada baris: {row_label}")
    return None

def main():
    log_info(f"Membaca Excel dari: {EXCEL_PATH}")
    if not os.path.exists(EXCEL_PATH):
        log_warning(f"File Excel tidak ditemukan: {EXCEL_PATH}")
        sys.exit(1)

    try:
        wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    except Exception as e:
        log_warning(f"Gagal membuka workbook: {e}")
        sys.exit(1)

    if "DATA" not in wb.sheetnames:
        log_warning("Sheet 'DATA' tidak ditemukan dalam workbook.")
        sys.exit(1)
        
    sheet = wb["DATA"]
    
    # Baca header di baris 4 (berdasarkan prompt)
    headers = []
    for cell in sheet[4]:
        headers.append(clean_str(cell.value))
        
    log_info(f"Ditemukan header: {headers[:15]}...")
    
    # Peta indeks kolom
    col_idx = {}
    for i, h in enumerate(headers):
        if h:
            col_idx[h] = i

    required_cols = [
        "No", "Nama Bank / Kegiatan Pengawasan", "Nama PUJK", "Kota/Kab",
        "Sektor", "Jenis LJK", "Jenis Kegiatan", "Kuartal (Q)",
        "Tanggal Mulai", "Tanggal Selesai", "Supervisor", "Status Kegiatan"
    ]
    
    missing = [c for c in required_cols if c not in col_idx]
    if missing:
        log_warning(f"Kolom wajib tidak ditemukan di Excel: {missing}")
        # Lanjutkan sebisa mungkin
    
    kegiatan = []
    hari_libur = []
    warnings = []
    
    # Data dari baris 5 ke 98
    for row_num in range(5, 99):
        row_cells = sheet[row_num]
        
        # Ekstrak nilai berdasarkan indeks kolom
        row = {}
        for col_name, idx in col_idx.items():
            if idx < len(row_cells):
                row[col_name] = row_cells[idx].value
            else:
                row[col_name] = None
                
        # Cek apakah baris ini sepenuhnya kosong
        if not any(row.values()):
            continue
            
        nama_keg = clean_str(row.get("Nama Bank / Kegiatan Pengawasan"))
        nama_pujk = clean_str(row.get("Nama PUJK"))
        kota = clean_str(row.get("Kota/Kab"))
        tgl_mulai_raw = row.get("Tanggal Mulai")
        no_str = clean_str(row.get("No"))
        
        # Deteksi hari libur
        if nama_keg and not nama_pujk and not kota and tgl_mulai_raw is None:
            hari_libur.append({
                "no": int(no_str) if no_str.isdigit() else None,
                "keterangan": nama_keg
            })
            continue
            
        # Parse tanggal
        row_label = f"No={no_str}, '{nama_keg[:50]}'"
        tgl_mulai = parse_tanggal(tgl_mulai_raw, row_label)
        tgl_selesai = parse_tanggal(row.get("Tanggal Selesai"), row_label)
        
        date_warning = False
        if tgl_mulai and tgl_selesai and tgl_selesai < tgl_mulai:
            msg = f"Baris {row_label}: Tanggal Selesai < Tanggal Mulai"
            log_warning(msg)
            warnings.append(msg)
            date_warning = True
            
        bulan_recalc = ""
        if tgl_mulai:
            bulan_recalc = BULAN_INDONESIA.get(tgl_mulai.month, "")
            
        entry = {
            "no": int(no_str) if no_str.isdigit() else None,
            "namaKegiatan": nama_keg,
            "namaPUJK": nama_pujk,
            "kotaKab": kota,
            "sektor": clean_str(row.get("Sektor")),
            "jenisLJK": clean_str(row.get("Jenis LJK")),
            "jenisKegiatan": clean_str(row.get("Jenis Kegiatan")),
            "kuartal": clean_str(row.get("Kuartal (Q)")),
            "bulan": bulan_recalc,
            "tanggalMulai": tgl_mulai.isoformat() if tgl_mulai else None,
            "tanggalSelesai": tgl_selesai.isoformat() if tgl_selesai else None,
            "supervisor": clean_str(row.get("Supervisor")),
            "statusKegiatan": clean_str(row.get("Status Kegiatan")),
            "dateWarning": date_warning,
        }
        kegiatan.append(entry)

    # Top 10 PUJK
    pujk_counter = Counter()
    for k in kegiatan:
        if k["namaPUJK"]:
            pujk_counter[k["namaPUJK"]] += 1

    top10 = pujk_counter.most_common(10)
    top_pujk = []
    
    # Cari Sektor & Jenis LJK yang sesuai untuk tabel Top 10
    # Ambil data pertama yang cocok dari daftar kegiatan
    for name, count in top10:
        sektor = ""
        jenis_ljk = ""
        for k in kegiatan:
            if k["namaPUJK"] == name:
                sektor = k["sektor"]
                jenis_ljk = k["jenisLJK"]
                break
        top_pujk.append({
            "nama": name,
            "jumlah": count,
            "sektor": sektor,
            "jenisLJK": jenis_ljk
        })

    output = {
        "kegiatan": kegiatan,
        "hariLibur": hari_libur,
        "topPUJK": top_pujk,
        "metadata": {
            "totalKegiatan": len(kegiatan),
            "tanggalGenerate": datetime.now().isoformat(),
            "warnings": warnings,
        },
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    log_info(f"Berhasil ekstrak {len(kegiatan)} kegiatan dan {len(hari_libur)} hari libur.")
    log_info(f"Top 10 PUJK dihitung: {len(top_pujk)} item.")
    
if __name__ == "__main__":
    main()
