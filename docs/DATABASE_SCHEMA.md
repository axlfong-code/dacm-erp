# DACM ERP 2.0

## Database Schema

Database menggunakan Google Spreadsheet.

---

# 01_USERS

Master pengguna sistem.

| Field | Type | Keterangan |
|------|------|------------|
| UserID | Text | U0001 |
| Username | Text | Login |
| Password | Text | (sementara plain, nanti di-hash) |
| FullName | Text | Nama lengkap |
| Role | Text | OWNER, ADMIN, SERVICE, KASIR |
| Branch | Text | D, C, M |
| Status | Boolean | Aktif / Nonaktif |
| CreatedAt | Datetime | Timestamp |

---

# 02_CUSTOMERS

| Field | Type |
|------|------|
| CustomerID |
| CustomerName |
| Phone |
| WhatsApp |
| Address |
| CreatedAt |

---

# 03_VEHICLES

| Field | Type |
|------|------|
| VehicleID |
| CustomerID |
| PlateNumber |
| Brand |
| Model |
| Year |
| Color |
| ChassisNo |
| EngineNo |
| LastKM |
| CreatedAt |

---

# 04_REGISTER

| Field | Type |
|------|------|
| RegisterID |
| RegisterDate |
| Branch |
| CustomerID |
| VehicleID |
| Complaint |
| Status |
| PIC |
| CreatedAt |

---

# 05_DIAGNOSIS

| Field | Type |
|------|------|
| DiagnosisID |
| RegisterID |
| Technician |
| Result |
| Recommendation |
| EstimatedCost |
| Status |

---

# 06_WORKORDER

| Field | Type |
|------|------|
| WorkOrderID |
| RegisterID |
| Technician |
| StartTime |
| FinishTime |
| Status |

---

# 07_INVOICE

| Field | Type |
|------|------|
| InvoiceID |
| RegisterID |
| TotalService |
| TotalParts |
| Discount |
| GrandTotal |
| PaymentStatus |

---

# 08_PAYMENT

| Field | Type |
|------|------|
| PaymentID |
| InvoiceID |
| PaymentMethod |
| Amount |
| PaymentDate |

---

# 09_BRANCH

| Field | Type |
|------|------|
| BranchCode |
| BranchName |
| Address |
| Phone |

---

# 10_SETTINGS

Pengaturan aplikasi.

---

# 11_LOGS

Semua aktivitas user disimpan di sini.