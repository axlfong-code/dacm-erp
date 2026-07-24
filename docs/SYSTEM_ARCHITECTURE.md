# DACM ERP
## System Architecture

Version : 1.0
Author : Alexander & ChatGPT
Platform : Google Apps Script + Google Sheets
Frontend : HTML + Bootstrap 5
Backend : Google Apps Script
Repository : GitHub

---

# 1. Overview

DACM ERP adalah sistem ERP internal Dokter AC Mobil yang digunakan untuk mengelola seluruh proses operasional bengkel mulai dari pelanggan datang hingga pembayaran selesai.

---

# 2. System Layers

┌──────────────────────────────┐
│ Browser                      │
│ HTML + Bootstrap + JS        │
└──────────────┬───────────────┘
               │
google.script.run
               │
┌──────────────▼───────────────┐
│ Google Apps Script           │
│ Business Logic               │
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│ Google Spreadsheet           │
│ Database                     │
└──────────────────────────────┘

---

# 3. Modules

Core

- Authentication
- Session
- Permission
- Dashboard

Master

- Branch
- User
- Customer
- Vehicle

Transaction

- Register
- Diagnosis
- Work Order
- Invoice
- Payment

Report

- Dashboard
- Daily Report
- Monthly Report
- Customer History

Setting

- User
- Branch
- System

---

# 4. Folder Structure

docs/

database/

src/

assets/

---

# 5. Database

Google Spreadsheet

One Sheet = One Table

No Merge Cell

No Formula pada tabel transaksi

Semua validasi dilakukan oleh aplikasi.

---

# 6. Coding Standard

camelCase

PascalCase

Upper Snake Case untuk Constant

---

# 7. Git Flow

main

develop

feature/*

hotfix/*

---

# 8. Deployment

VS Code

↓

Git Commit

↓

GitHub

↓

clasp push

↓

Apps Script

↓

Production