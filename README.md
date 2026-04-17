# 🏫 SiKeu Sekolah - Sistem Keuangan Sekolah

Sistem manajemen keuangan sekolah yang komprehensif dengan fitur Chart of Accounts (COA), manajemen transaksi, pelaporan, dan import Excel.

## ✨ Fitur Utama

### 💰 Manajemen Transaksi
- Input transaksi pemasukan dan pengeluaran
- Generate kwitansi otomatis dengan QR code
- **🆕 Import massal dari Excel** - Upload ratusan transaksi sekaligus
- Kategorisasi transaksi
- Multi metode pembayaran (Cash, Transfer, QRIS)

### 📊 Import Excel (NEW!)
- Import data transaksi dalam jumlah besar dari file Excel
- **Auto-detect** tipe transaksi (pemasukan/pengeluaran)
- **Generate kwitansi PDF otomatis** untuk setiap transaksi
- **Buat kategori otomatis** jika belum ada
- Template Excel dengan contoh data
- Preview hasil import dengan statistik lengkap

👉 **[Panduan Import Excel](./IMPORT_EXCEL_GUIDE.md)**  
👉 **[Quick Reference Import](./IMPORT_EXCEL_QUICK_REF.md)**  
👉 **[Diagram Alur Import](./IMPORT_EXCEL_DIAGRAMS.md)**

### 📈 Chart of Accounts (COA)
- Struktur COA lengkap sesuai standar akuntansi
- Kategori: Aktiva, Kewajiban, Modal, Pendapatan, Beban
- Sub-kategori dan akun detail
- Integrasi dengan transaksi

### 📑 Laporan Keuangan
- Laporan pemasukan dan pengeluaran
- Filter berdasarkan periode
- Export ke PDF
- Visualisasi data dengan chart

### 👥 Manajemen User & Role
- Role-based access control (RBAC)
- Super Admin, Treasurer, User
- Permission management
- Multi-school support

### 🧾 Kwitansi Digital
- Generate PDF kwitansi otomatis
- QR code untuk verifikasi
- Template kwitansi custom per sekolah
- Watermark dan logo sekolah

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm atau yarn

### Installation

```bash
# Clone repository
git clone https://github.com/MFikriHaikalAyatullah12/SiKeu-Sekolah.git
cd SiKeu-Sekolah

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env dengan konfigurasi database Anda

# Setup database
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Default Login
- **Super Admin**: admin@example.com / password123
- **Treasurer**: bendahara@example.com / password123

## 📖 Documentation

### Import Excel
- **[IMPORT_EXCEL_FEATURE.md](./IMPORT_EXCEL_FEATURE.md)** - Overview fitur import
- **[IMPORT_EXCEL_GUIDE.md](./IMPORT_EXCEL_GUIDE.md)** - Panduan lengkap penggunaan
- **[IMPORT_EXCEL_QUICK_REF.md](./IMPORT_EXCEL_QUICK_REF.md)** - Quick reference
- **[IMPORT_EXCEL_DIAGRAMS.md](./IMPORT_EXCEL_DIAGRAMS.md)** - Diagram alur & arsitektur

### General
- **[ROLE_SYSTEM.md](./ROLE_SYSTEM.md)** - Dokumentasi sistem role & permissions
- **[TESTING.md](./TESTING.md)** - Testing guide
- **[ERROR_FIXES_SUMMARY.md](./ERROR_FIXES_SUMMARY.md)** - Error fixes log

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: TailwindCSS + Radix UI + shadcn/ui
- **PDF**: jsPDF + jsPDF-AutoTable
- **Excel**: xlsx
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── transactions/
│   │   │   ├── route.ts       # CRUD transaksi
│   │   │   └── import/        # 🆕 Import Excel endpoint
│   │   ├── coa/               # Chart of Accounts API
│   │   ├── reports/           # Laporan API
│   │   └── ...
│   ├── dashboard/             # Dashboard pages
│   │   ├── transactions/      # Halaman transaksi
│   │   ├── import/            # 🆕 Halaman import Excel
│   │   ├── reports/           # Halaman laporan
│   │   └── ...
│   └── auth/                  # Authentication pages
├── components/
│   ├── dashboard/
│   │   ├── import-excel.tsx   # 🆕 Komponen import Excel
│   │   ├── transaction-*.tsx  # Komponen transaksi
│   │   └── ...
│   ├── layout/                # Layout components
│   └── ui/                    # UI components (shadcn)
├── lib/
│   ├── auth.ts                # NextAuth config
│   ├── prisma.ts              # Prisma client
│   ├── receipt-generator.ts  # PDF generator
│   └── permissions.ts         # RBAC logic
└── types/                     # TypeScript types

prisma/
├── schema.prisma              # Database schema
├── seed.ts                    # Database seeder
└── migrations/                # Database migrations

public/
└── template-import-transaksi.csv  # 🆕 Template Excel
```

## 🔑 Key Features Explained

### Import Excel Workflow
1. User upload file Excel (.xlsx, .xls, .csv)
2. System parse file menggunakan library `xlsx`
3. Validasi setiap baris data
4. Determine tipe transaksi otomatis (keyword matching + COA type)
5. Find atau create category
6. Generate receipt number
7. Create transaction di database
8. Generate PDF kwitansi
9. Return hasil import dengan statistik lengkap

### Auto-Detection Logic
System menentukan tipe transaksi berdasarkan:
1. **COA Type** (prioritas tertinggi) - REVENUE = Income, EXPENSE = Expense
2. **Keyword Matching** - Deteksi kata kunci di nama akun/kategori/keterangan
3. **Default** - Jika tidak dapat ditentukan, default ke Expense

### Receipt Generation
- Format nomor: Configurable (default: KW-{YYYY}{MM}-{000})
- Auto increment counter
- Reset per bulan (configurable)
- Include QR code untuk verifikasi
- School branding (logo, header)

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

## 📦 Available Scripts

```bash
npm run dev          # Run development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Jest tests
npm run test:e2e     # Run Playwright E2E tests
npm run seed:coa     # Seed Chart of Accounts
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Developer

**M Fikri Haikal Ayatullah**
- GitHub: [@MFikriHaikalAyatullah12](https://github.com/MFikriHaikalAyatullah12)

**Muh. Ilham Akbar**
- GitHub: .[@ilham1421](https://github.com/ilham1421)
---

**Version**: 1.0.0  
**Last Updated**: January 2026
