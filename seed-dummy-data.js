const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function untuk generate receipt number
function generateReceiptNumber(type, index) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = type === 'INCOME' ? 'IN' : 'OUT';
  return `${prefix}-${year}${month}-${String(index).padStart(4, '0')}`;
}

// Helper untuk random date dalam range
function randomDate(startMonth, endMonth) {
  const now = new Date();
  const year = now.getFullYear();
  const month = Math.floor(Math.random() * (endMonth - startMonth + 1)) + startMonth;
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month - 1, day);
}

// Helper untuk random date dalam bulan tertentu
function randomDateInMonth(year, month) {
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month - 1, day);
}

async function main() {
  console.log('🚀 Starting dummy data seeding...\n');

  // Get school
  const school = await prisma.schoolProfile.findFirst();
  if (!school) {
    console.log('❌ No school found! Please run seed first.');
    return;
  }
  console.log('✅ School found:', school.name);

  // Get user
  const user = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  if (!user) {
    console.log('❌ No user found!');
    return;
  }
  console.log('✅ User found:', user.name);

  // Get all categories
  const categories = await prisma.category.findMany({
    where: { schoolProfileId: school.id }
  });
  console.log('✅ Categories found:', categories.length);

  // Separate income and expense categories
  const incomeCategories = categories.filter(c => c.type === 'INCOME');
  const expenseCategories = categories.filter(c => c.type === 'EXPENSE');

  console.log('\n📊 Income categories:', incomeCategories.length);
  console.log('📊 Expense categories:', expenseCategories.length);

  // Transactions data to create
  const transactions = [];
  let incomeIndex = 1;
  let expenseIndex = 1;

  // ========== DATA PEMASUKAN ==========
  console.log('\n💰 Creating INCOME transactions...');

  // SPP Siswa - Berbagai bulan
  const sppStudents = [
    'Ahmad Fauzi', 'Budi Santoso', 'Citra Dewi', 'Diana Putri', 'Eko Prasetyo',
    'Fitri Handayani', 'Gilang Ramadhan', 'Hana Safira', 'Irfan Maulana', 'Julia Pertiwi',
    'Kurniawan Setiawan', 'Linda Sari', 'Mira Lestari', 'Nanda Pratama', 'Oscar Wijaya',
    'Putri Anggraini', 'Rizki Fahreza', 'Sinta Maharani', 'Taufik Hidayat', 'Umi Kulsum'
  ];

  // Ambil kategori dan COA yang relevan
  const pendapatanCategory = incomeCategories.find(c => c.name.toLowerCase().includes('pendapatan'));
  const aktivaLancarCategory = incomeCategories.find(c => c.name.toLowerCase().includes('aktiva lancar'));

  // SPP untuk bulan Agustus 2025 - Januari 2026
  for (let monthOffset = -6; monthOffset <= 0; monthOffset++) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 5-10 siswa per bulan bayar SPP
    const studentsCount = Math.floor(Math.random() * 6) + 5;
    for (let i = 0; i < studentsCount; i++) {
      const student = sppStudents[Math.floor(Math.random() * sppStudents.length)];
      const amount = [500000, 750000, 850000, 1000000, 1200000][Math.floor(Math.random() * 5)];
      
      transactions.push({
        receiptNumber: generateReceiptNumber('INCOME', incomeIndex++),
        type: 'INCOME',
        date: new Date(year, month, Math.floor(Math.random() * 25) + 1),
        amount: amount,
        categoryId: pendapatanCategory?.id || incomeCategories[0]?.id,
        description: `Pembayaran SPP ${student}`,
        fromTo: student,
        paymentMethod: ['CASH', 'BANK_TRANSFER', 'QRIS'][Math.floor(Math.random() * 3)],
        status: 'PAID',
        notes: `SPP Bulan ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][month]} ${year}`,
        createdById: user.id,
        schoolProfileId: school.id,
      });
    }
  }

  // Donasi dari berbagai pihak
  const donors = [
    { name: 'PT. Sumber Jaya Abadi', amount: 15000000, desc: 'Donasi CSR untuk pengembangan laboratorium' },
    { name: 'CV. Maju Bersama', amount: 7500000, desc: 'Bantuan sarana olahraga' },
    { name: 'Yayasan Pendidikan Cemerlang', amount: 25000000, desc: 'Beasiswa untuk siswa berprestasi' },
    { name: 'Alumni Angkatan 2010', amount: 10000000, desc: 'Sumbangan pembangunan perpustakaan' },
    { name: 'Bapak H. Sulaiman', amount: 5000000, desc: 'Donasi pribadi untuk kegiatan keagamaan' },
    { name: 'Bank BRI Cabang Jakarta', amount: 20000000, desc: 'Program CSR literasi keuangan' },
    { name: 'Komunitas Peduli Pendidikan', amount: 8000000, desc: 'Bantuan alat tulis siswa kurang mampu' },
  ];

  for (const donor of donors) {
    const monthOffset = Math.floor(Math.random() * 6) - 5;
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    
    transactions.push({
      receiptNumber: generateReceiptNumber('INCOME', incomeIndex++),
      type: 'INCOME',
      date: new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1),
      amount: donor.amount,
      categoryId: pendapatanCategory?.id || incomeCategories[0]?.id,
      description: donor.desc,
      fromTo: donor.name,
      paymentMethod: 'BANK_TRANSFER',
      status: 'PAID',
      notes: 'Donasi diterima dengan terima kasih',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // Pendapatan lainnya
  const otherIncomes = [
    { desc: 'Sewa Lapangan Olahraga - Turnamen Futsal', from: 'Panitia Turnamen RT 05', amount: 2500000 },
    { desc: 'Sewa Aula untuk Resepsi Pernikahan', from: 'Keluarga Bapak Hendro', amount: 5000000 },
    { desc: 'Penjualan Hasil Kebun Sekolah', from: 'Pedagang Pasar Tradisional', amount: 1500000 },
    { desc: 'Pendapatan Kantin Sekolah', from: 'Pengelola Kantin', amount: 3500000 },
    { desc: 'Biaya Pendaftaran Siswa Baru', from: 'Orang Tua Siswa Baru', amount: 45000000 },
    { desc: 'Uang Pangkal Siswa Baru', from: 'Wali Murid Kelas 7', amount: 75000000 },
    { desc: 'Biaya Seragam dan Buku Paket', from: 'Orang Tua Siswa', amount: 28000000 },
    { desc: 'Dana BOS Triwulan III', from: 'Kementerian Pendidikan', amount: 150000000 },
    { desc: 'Hibah Pemerintah Daerah', from: 'Dinas Pendidikan Kota', amount: 50000000 },
  ];

  for (const income of otherIncomes) {
    const monthOffset = Math.floor(Math.random() * 6) - 5;
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    
    transactions.push({
      receiptNumber: generateReceiptNumber('INCOME', incomeIndex++),
      type: 'INCOME',
      date: new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1),
      amount: income.amount,
      categoryId: incomeCategories[Math.floor(Math.random() * incomeCategories.length)]?.id,
      description: income.desc,
      fromTo: income.from,
      paymentMethod: ['CASH', 'BANK_TRANSFER'][Math.floor(Math.random() * 2)],
      status: 'PAID',
      notes: '',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // ========== DATA PENGELUARAN ==========
  console.log('💸 Creating EXPENSE transactions...');

  // Gaji Guru dan Staff
  const staffPayments = [
    { name: 'Gaji Guru PNS', amount: 45000000 },
    { name: 'Gaji Guru Honorer', amount: 28000000 },
    { name: 'Gaji Staff Administrasi', amount: 12000000 },
    { name: 'Gaji Petugas Kebersihan', amount: 6000000 },
    { name: 'Gaji Satpam', amount: 8000000 },
    { name: 'Honor Guru Ekstrakurikuler', amount: 5000000 },
    { name: 'Tunjangan Kinerja Guru', amount: 15000000 },
  ];

  const kewajibanCategory = expenseCategories.find(c => c.name.toLowerCase().includes('kewajiban'));
  const bebanCategory = expenseCategories.find(c => c.name.toLowerCase().includes('beban'));

  // Gaji bulanan dari Agustus 2025 - Januari 2026
  for (let monthOffset = -5; monthOffset <= 0; monthOffset++) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    for (const payment of staffPayments) {
      transactions.push({
        receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
        type: 'EXPENSE',
        date: new Date(year, month, 25 + Math.floor(Math.random() * 3)), // Tanggal 25-27
        amount: payment.amount + Math.floor(Math.random() * 2000000),
        categoryId: kewajibanCategory?.id || expenseCategories[0]?.id,
        description: `${payment.name} Bulan ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][month]} ${year}`,
        fromTo: 'Pegawai Sekolah',
        paymentMethod: 'BANK_TRANSFER',
        status: 'PAID',
        notes: 'Transfer via rekening bank',
        createdById: user.id,
        schoolProfileId: school.id,
      });
    }
  }

  // Operasional Sekolah
  const operationalExpenses = [
    { desc: 'Pembayaran Listrik PLN', to: 'PLN', amount: 8500000 },
    { desc: 'Pembayaran Air PDAM', to: 'PDAM', amount: 2500000 },
    { desc: 'Pembayaran Internet dan Telepon', to: 'Telkom', amount: 3500000 },
    { desc: 'Pembelian ATK Kantor', to: 'Toko Sumber ATK', amount: 2500000 },
    { desc: 'Pembelian Alat Kebersihan', to: 'Toko Bersih Sejahtera', amount: 1500000 },
    { desc: 'Biaya Fotokopi dan Print', to: 'Fotokopi Cepat', amount: 850000 },
    { desc: 'Pembelian Tinta Printer', to: 'Toko Komputer Jaya', amount: 1200000 },
    { desc: 'Langganan Software Sekolah', to: 'PT. Edu Software', amount: 5000000 },
  ];

  // Operasional bulanan
  for (let monthOffset = -5; monthOffset <= 0; monthOffset++) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    for (const expense of operationalExpenses) {
      transactions.push({
        receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
        type: 'EXPENSE',
        date: new Date(year, month, Math.floor(Math.random() * 20) + 5),
        amount: expense.amount + Math.floor(Math.random() * 500000),
        categoryId: bebanCategory?.id || expenseCategories[0]?.id,
        description: expense.desc,
        fromTo: expense.to,
        paymentMethod: ['CASH', 'BANK_TRANSFER'][Math.floor(Math.random() * 2)],
        status: 'PAID',
        notes: '',
        createdById: user.id,
        schoolProfileId: school.id,
      });
    }
  }

  // Pemeliharaan dan Perbaikan
  const maintenanceExpenses = [
    { desc: 'Perbaikan AC Ruang Guru', to: 'Teknisi Indah AC', amount: 1500000 },
    { desc: 'Service Komputer Lab', to: 'CV. Tech Solution', amount: 3500000 },
    { desc: 'Pengecatan Ulang Gedung', to: 'Tukang Cat Pak Joko', amount: 12000000 },
    { desc: 'Perbaikan Atap Bocor', to: 'Tukang Bangunan', amount: 5500000 },
    { desc: 'Service Genset Sekolah', to: 'Bengkel Mesin Jaya', amount: 2500000 },
    { desc: 'Perbaikan Pagar Sekolah', to: 'Las Karya', amount: 4500000 },
    { desc: 'Perbaikan Instalasi Listrik', to: 'Teknisi Listrik', amount: 3000000 },
    { desc: 'Perbaikan Toilet Siswa', to: 'Tukang Ledeng', amount: 2000000 },
    { desc: 'Service Proyektor Kelas', to: 'Service Center Epson', amount: 1800000 },
    { desc: 'Perbaikan Meja dan Kursi', to: 'Tukang Kayu', amount: 2500000 },
  ];

  for (const expense of maintenanceExpenses) {
    const monthOffset = Math.floor(Math.random() * 6) - 5;
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    
    transactions.push({
      receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
      type: 'EXPENSE',
      date: new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1),
      amount: expense.amount,
      categoryId: expenseCategories[Math.floor(Math.random() * expenseCategories.length)]?.id,
      description: expense.desc,
      fromTo: expense.to,
      paymentMethod: 'CASH',
      status: 'PAID',
      notes: 'Pekerjaan selesai dengan baik',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // Kegiatan Siswa
  const studentActivities = [
    { desc: 'Biaya Study Tour Kelas 9', to: 'Biro Perjalanan Wisata', amount: 35000000 },
    { desc: 'Perlengkapan OSIS', to: 'Toko Alat Tulis', amount: 2500000 },
    { desc: 'Lomba Cerdas Cermat Tingkat Kota', to: 'Panitia LCC', amount: 1500000 },
    { desc: 'Biaya Olimpiade Sains', to: 'Panitia OSN', amount: 3500000 },
    { desc: 'Kegiatan Pramuka Kemah', to: 'Pembina Pramuka', amount: 8500000 },
    { desc: 'Biaya Pentas Seni', to: 'Sanggar Seni', amount: 12000000 },
    { desc: 'Peringatan Hari Kemerdekaan', to: 'Panitia 17 Agustus', amount: 5000000 },
    { desc: 'Class Meeting Akhir Semester', to: 'OSIS', amount: 4500000 },
    { desc: 'Biaya PMR dan UKS', to: 'PMI Cabang', amount: 2000000 },
    { desc: 'Ekstrakurikuler Basket', to: 'Pelatih Basket', amount: 3000000 },
  ];

  for (const activity of studentActivities) {
    const monthOffset = Math.floor(Math.random() * 6) - 5;
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    
    transactions.push({
      receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
      type: 'EXPENSE',
      date: new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1),
      amount: activity.amount,
      categoryId: expenseCategories[Math.floor(Math.random() * expenseCategories.length)]?.id,
      description: activity.desc,
      fromTo: activity.to,
      paymentMethod: ['CASH', 'BANK_TRANSFER'][Math.floor(Math.random() * 2)],
      status: 'PAID',
      notes: '',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // Pembelian Aset
  const assetPurchases = [
    { desc: 'Pembelian Komputer Lab Baru', to: 'PT. Computer Indonesia', amount: 45000000 },
    { desc: 'Pembelian Proyektor', to: 'Toko Elektronik', amount: 12000000 },
    { desc: 'Pembelian Buku Perpustakaan', to: 'Penerbit Erlangga', amount: 25000000 },
    { desc: 'Pembelian Alat Laboratorium IPA', to: 'Supplier Alat Lab', amount: 35000000 },
    { desc: 'Pembelian Meja Kursi Baru', to: 'Mebel Jaya Abadi', amount: 28000000 },
    { desc: 'Pembelian Papan Tulis Interaktif', to: 'Toko Smart Board', amount: 18000000 },
    { desc: 'Pembelian Alat Musik', to: 'Toko Musik Harmoni', amount: 15000000 },
    { desc: 'Pembelian Peralatan Olahraga', to: 'Toko Sport', amount: 8000000 },
  ];

  for (const purchase of assetPurchases) {
    const monthOffset = Math.floor(Math.random() * 6) - 5;
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    
    transactions.push({
      receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
      type: 'EXPENSE',
      date: new Date(date.getFullYear(), date.getMonth(), Math.floor(Math.random() * 28) + 1),
      amount: purchase.amount,
      categoryId: expenseCategories[Math.floor(Math.random() * expenseCategories.length)]?.id,
      description: purchase.desc,
      fromTo: purchase.to,
      paymentMethod: 'BANK_TRANSFER',
      status: 'PAID',
      notes: 'Pembelian aset tetap sekolah',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // Tambah beberapa transaksi untuk bulan ini (Februari 2026)
  console.log('📅 Adding current month (February 2026) transactions...');

  const currentMonthIncome = [
    { desc: 'SPP Siswa Adi Nugroho', from: 'Adi Nugroho', amount: 850000 },
    { desc: 'SPP Siswa Bella Safitri', from: 'Bella Safitri', amount: 850000 },
    { desc: 'SPP Siswa Charlie Pratama', from: 'Charlie Pratama', amount: 850000 },
    { desc: 'Donasi Komite Sekolah', from: 'Komite Sekolah', amount: 5000000 },
    { desc: 'Pembayaran Kegiatan Ekskul', from: 'Orang Tua Siswa', amount: 12000000 },
  ];

  for (const income of currentMonthIncome) {
    transactions.push({
      receiptNumber: generateReceiptNumber('INCOME', incomeIndex++),
      type: 'INCOME',
      date: new Date(2026, 1, Math.floor(Math.random() * 2) + 1), // Feb 1-2, 2026
      amount: income.amount,
      categoryId: pendapatanCategory?.id || incomeCategories[0]?.id,
      description: income.desc,
      fromTo: income.from,
      paymentMethod: ['CASH', 'BANK_TRANSFER', 'QRIS'][Math.floor(Math.random() * 3)],
      status: 'PAID',
      notes: 'Transaksi bulan Februari 2026',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  const currentMonthExpense = [
    { desc: 'Pembayaran Listrik Februari', to: 'PLN', amount: 8500000 },
    { desc: 'Pembelian ATK Awal Bulan', to: 'Toko ATK', amount: 1500000 },
    { desc: 'Biaya Rapat Komite', to: 'Katering', amount: 2500000 },
  ];

  for (const expense of currentMonthExpense) {
    transactions.push({
      receiptNumber: generateReceiptNumber('EXPENSE', expenseIndex++),
      type: 'EXPENSE',
      date: new Date(2026, 1, Math.floor(Math.random() * 2) + 1), // Feb 1-2, 2026
      amount: expense.amount,
      categoryId: bebanCategory?.id || expenseCategories[0]?.id,
      description: expense.desc,
      fromTo: expense.to,
      paymentMethod: ['CASH', 'BANK_TRANSFER'][Math.floor(Math.random() * 2)],
      status: 'PAID',
      notes: 'Transaksi bulan Februari 2026',
      createdById: user.id,
      schoolProfileId: school.id,
    });
  }

  // Filter out transactions with null categoryId
  const validTransactions = transactions.filter(t => t.categoryId != null);

  console.log(`\n📝 Total transactions to create: ${validTransactions.length}`);
  console.log(`   - Income: ${validTransactions.filter(t => t.type === 'INCOME').length}`);
  console.log(`   - Expense: ${validTransactions.filter(t => t.type === 'EXPENSE').length}`);

  // Create all transactions
  console.log('\n💾 Inserting transactions into database...');
  
  let created = 0;
  for (const tx of validTransactions) {
    try {
      await prisma.transaction.create({ data: tx });
      created++;
    } catch (error) {
      console.log(`⚠️ Error creating transaction: ${tx.description}`, error.message);
    }
  }

  console.log(`\n✅ Successfully created ${created} transactions!`);

  // Summary
  const summary = await prisma.transaction.aggregate({
    where: { schoolProfileId: school.id },
    _sum: { amount: true },
    _count: true
  });

  const incomeTotal = await prisma.transaction.aggregate({
    where: { schoolProfileId: school.id, type: 'INCOME', status: 'PAID' },
    _sum: { amount: true },
    _count: true
  });

  const expenseTotal = await prisma.transaction.aggregate({
    where: { schoolProfileId: school.id, type: 'EXPENSE', status: 'PAID' },
    _sum: { amount: true },
    _count: true
  });

  console.log('\n📊 DATABASE SUMMARY:');
  console.log('═══════════════════════════════════════');
  console.log(`Total Transactions: ${summary._count}`);
  console.log(`Total Income: Rp ${Number(incomeTotal._sum.amount || 0).toLocaleString('id-ID')} (${incomeTotal._count} transaksi)`);
  console.log(`Total Expense: Rp ${Number(expenseTotal._sum.amount || 0).toLocaleString('id-ID')} (${expenseTotal._count} transaksi)`);
  console.log(`Balance: Rp ${(Number(incomeTotal._sum.amount || 0) - Number(expenseTotal._sum.amount || 0)).toLocaleString('id-ID')}`);
  console.log('═══════════════════════════════════════');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
