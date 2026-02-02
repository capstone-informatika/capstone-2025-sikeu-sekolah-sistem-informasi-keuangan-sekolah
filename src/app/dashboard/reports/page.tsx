"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Eye,
  RotateCcw,
  FileSpreadsheet
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Sample transaction data
const sampleTransactions = [
  {
    id: "1",
    date: "2025-12-18",
    type: "INCOME",
    category: "SPP Siswa",
    description: "Budi Santoso (10A)",
    amount: 1500000,
    method: "Tunai",
    status: "PAID",
  },
  {
    id: "2",
    date: "2025-12-17",
    type: "EXPENSE",
    category: "Operasional",
    description: "Beli ATK",
    amount: 750000,
    method: "Tunai",
    status: "PAID",
  },
  {
    id: "3",
    date: "2025-12-16",
    type: "INCOME",
    category: "Donasi",
    description: "Alumni 2010",
    amount: 5000000,
    method: "Transfer Bank",
    status: "PAID",
  },
  {
    id: "4",
    date: "2025-12-15",
    type: "EXPENSE",
    category: "Fasilitas",
    description: "Perbaikan AC",
    amount: 1200000,
    method: "Transfer Bank",
    status: "PAID",
  },
  {
    id: "5",
    date: "2025-12-14",
    type: "INCOME",
    category: "Uang Pangkal",
    description: "Siti Aminah (11B)",
    amount: 1500000,
    method: "Tunai",
    status: "PENDING",
  },
]

// Chart data for 6 months
const chartData = [
  { month: "Jul 2025", income: 100, expense: 50 },
  { month: "Agu 2025", income: 150, expense: 80 },
  { month: "Sep 2025", income: 200, expense: 100 },
  { month: "Okt 2025", income: 280, expense: 120 },
  { month: "Nov 2025", income: 350, expense: 100 },
  { month: "Des 2025", income: 450, expense: 80 },
]

// Category composition data
const categoryData = [
  { name: "Gaji Guru & Staf", percentage: 45, color: "#3B82F6" },
  { name: "Fasilitas Sekolah", percentage: 25, color: "#10B981" },
  { name: "Operasional Harian", percentage: 15, color: "#F59E0B" },
  { name: "Kegiatan Siswa", percentage: 10, color: "#8B5CF6" },
  { name: "Lainnya", percentage: 5, color: "#EC4899" },
]

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [schoolProfile, setSchoolProfile] = useState<any>(null)
  const [schools, setSchools] = useState<any[]>([])
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("")
  
  // Filter states
  const [dateRange, setDateRange] = useState("6-bulan-terakhir")
  const [filterType, setFilterType] = useState("semua")
  const [filterCategory, setFilterCategory] = useState("semua")
  const [filterMethod, setFilterMethod] = useState("semua")
  const [filterStatus, setFilterStatus] = useState("semua")
  
  // Export dialog states
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<'excel' | 'pdf'>('excel')
  
  // Initialize with first day of current month and today
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [exportStartDate, setExportStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [exportEndDate, setExportEndDate] = useState(today.toISOString().split('T')[0])

  // Role-based access control
  const userRole = session?.user?.role
  const isTreasurer = userRole === 'TREASURER'
  const isSuperAdmin = userRole === 'SUPER_ADMIN'
  
  // Date range restrictions for Treasurer (3 months max)
  const maxDateRangeMonths = isTreasurer ? 3 : null
  const treasurerMaxStartDate = isTreasurer 
    ? new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()).toISOString().split('T')[0]
    : null

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    fetchReportData()
    fetchSchools()
  }, [session, status, router])

  // Refetch data when dateRange changes
  useEffect(() => {
    if (session) {
      fetchReportData()
    }
  }, [dateRange])

  const fetchSchools = async () => {
    try {
      const response = await fetch('/api/schools', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        if (data.schools && data.schools.length > 0) {
          setSchools(data.schools)
          // Set default selected school to first one
          setSelectedSchoolId(data.schools[0].id)
          setSchoolProfile(data.schools[0])
          console.log("🏫 Schools loaded:", data.schools.length)
        }
      }
    } catch (error) {
      console.error("Failed to fetch schools:", error)
    }
  }

  // Update schoolProfile when selectedSchoolId changes
  useEffect(() => {
    if (selectedSchoolId && schools.length > 0) {
      const selected = schools.find(s => s.id === selectedSchoolId)
      if (selected) {
        setSchoolProfile(selected)
      }
    }
  }, [selectedSchoolId, schools])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      // Map dateRange to API period parameter
      const periodMap: Record<string, string> = {
        'hari-ini': 'today',
        'minggu-ini': 'thisWeek',
        'bulan-ini': 'thisMonth',
        'bulan-lalu': 'lastMonth',
        '3-bulan-terakhir': 'last3Months',
        '6-bulan-terakhir': 'last6Months',
        'tahun-ini': 'thisYear',
        'semua-data': 'allTime'
      }
      
      const period = periodMap[dateRange] || 'last6Months'
      const url = `/api/reports?period=${period}&_t=${Date.now()}`
      
      console.log("📊 Fetching report data:", url)
      const response = await fetch(url, { cache: 'no-store' })
      const data = await response.json()
      
      console.log("📈 Report data received:", {
        totalIncome: data.summary?.totalIncome,
        totalExpense: data.summary?.totalExpense,
        balance: data.summary?.balance
      })
      
      if (response.ok) {
        setReportData(data)
      } else {
        console.error("Failed to fetch report data:", data.error)
        toast.error(data.error || "Gagal memuat data laporan")
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error)
      toast.error("Gagal memuat data laporan")
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    // Sync export dates with current report period
    if (reportData?.period) {
      const startDate = new Date(reportData.period.start)
      const endDate = new Date(reportData.period.end)
      setExportStartDate(startDate.toISOString().split('T')[0])
      setExportEndDate(endDate.toISOString().split('T')[0])
    }
    setExportType('pdf')
    setIsExportDialogOpen(true)
  }

  const handleExportExcel = () => {
    // Sync export dates with current report period
    if (reportData?.period) {
      const startDate = new Date(reportData.period.start)
      const endDate = new Date(reportData.period.end)
      setExportStartDate(startDate.toISOString().split('T')[0])
      setExportEndDate(endDate.toISOString().split('T')[0])
    }
    setExportType('excel')
    setIsExportDialogOpen(true)
  }
  
  const executeExport = async () => {
    try {
      // Validate school selection
      if (!selectedSchoolId) {
        toast.error('Pilih sekolah terlebih dahulu')
        return
      }
      
      // Validate date range
      const startDate = new Date(exportStartDate)
      const endDate = new Date(exportEndDate)
      
      // Check if start date is after end date
      if (startDate > endDate) {
        toast.error('Tanggal mulai tidak boleh lebih besar dari tanggal akhir')
        return
      }
      
      // Fetch data for the selected date range AND school
      const response = await fetch(`/api/reports?startDate=${exportStartDate}&endDate=${exportEndDate}&schoolId=${selectedSchoolId}&_t=${Date.now()}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        toast.error('Gagal mengambil data untuk export')
        return
      }
      
      const data = await response.json()
      
      if (exportType === 'excel') {
        exportToExcel(data)
      } else {
        await exportToPDF(data)
      }
      
      setIsExportDialogOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Gagal melakukan export')
    }
  }
  
  const exportToExcel = (data: any) => {
    try {
      // Get school name for header
      const schoolName = schoolProfile?.name || 'Nama Sekolah'
      
      // Prepare summary data
      const summaryData = [
        [schoolName.toUpperCase()],
        ['LAPORAN KEUANGAN'],
        [`Periode: ${new Date(exportStartDate).toLocaleDateString('id-ID')} - ${new Date(exportEndDate).toLocaleDateString('id-ID')}`],
        [],
        ['RINGKASAN'],
        ['Total Pemasukan', formatCurrency(data.summary?.totalIncome || 0)],
        ['Total Pengeluaran', formatCurrency(data.summary?.totalExpense || 0)],
        ['Saldo (Surplus/Defisit)', formatCurrency(data.summary?.balance || 0)],
        [],
        ['DETAIL TRANSAKSI'],
        ['Tanggal', 'Tipe', 'Kategori', 'Akun COA', 'Nama/Pihak', 'Catatan', 'Nominal', 'Metode Pembayaran', 'Status']
      ]
      
      // Add transaction details
      const transactionRows = (data.transactions || []).map((t: any) => [
        new Date(t.date).toLocaleDateString('id-ID'),
        t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
        t.category?.name || 'N/A',
        t.coaAccount?.name || t.description || 'N/A',
        t.fromTo || t.payerName || t.recipientName || 'N/A',
        t.notes || '-',
        Number(t.amount),
        t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : t.paymentMethod === 'QRIS' ? 'QRIS' : 'N/A',
        t.status === 'PAID' ? 'Lunas' : t.status === 'PENDING' ? 'Menunggu' : 'Void'
      ])
      
      const allData = [...summaryData, ...transactionRows]
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(allData)
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Tanggal
        { wch: 12 }, // Tipe
        { wch: 20 }, // Kategori
        { wch: 25 }, // Akun COA
        { wch: 25 }, // Nama/Pihak
        { wch: 35 }, // Catatan
        { wch: 18 }, // Nominal
        { wch: 18 }, // Metode
        { wch: 12 }  // Status
      ]
      
      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Laporan Keuangan')
      
      // Generate filename
      const filename = `Laporan_Keuangan_${exportStartDate}_${exportEndDate}.xlsx`
      
      // Save file
      XLSX.writeFile(wb, filename)
      
      toast.success('Laporan Excel berhasil diunduh')
    } catch (error) {
      console.error('Excel export error:', error)
      toast.error('Gagal membuat file Excel')
    }
  }
  
  // Helper function to convert image URL to base64
  const getImageBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.warn('Failed to load image:', error)
      return null
    }
  }
  
  const exportToPDF = async (data: any) => {
    try {
      console.log('📄 PDF Export - Data received:', {
        summary: data.summary,
        transactionCount: data.transactions?.length,
        exportPeriod: { start: exportStartDate, end: exportEndDate }
      })
      
      // Use landscape orientation for better table layout
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      const pageWidth = doc.internal.pageSize.width
      const pageHeight = doc.internal.pageSize.height
      let yPos = 15
      
      // ========== HEADER SECTION ==========
      // School logo from database or placeholder
      const logoUrl = schoolProfile?.logoUrl
      let logoAdded = false
      
      if (logoUrl) {
        try {
          // Convert logo URL to base64 first
          const logoBase64 = await getImageBase64(logoUrl)
          if (logoBase64) {
            // Detect image type from base64
            const imageType = logoBase64.includes('image/png') ? 'PNG' : 
                             logoBase64.includes('image/jpeg') ? 'JPEG' : 
                             logoBase64.includes('image/jpg') ? 'JPEG' : 'PNG'
            doc.addImage(logoBase64, imageType, 14, yPos, 12, 12)
            logoAdded = true
          }
        } catch (logoError) {
          console.warn('Failed to add logo to PDF:', logoError)
          logoAdded = false
        }
      }
      
      // Fallback: Show placeholder if no logo or failed to load
      if (!logoAdded) {
        doc.setFillColor(37, 99, 235) // Blue color for logo placeholder
        doc.rect(14, yPos, 12, 12, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(10)
        doc.text('S', 20, yPos + 8, { align: 'center' } as any)
      }
      
      // School name and info (left side) - Use actual school data
      const schoolName = schoolProfile?.name || 'Nama Sekolah'
      const schoolAddress = schoolProfile?.address || 'Alamat Sekolah'
      const schoolPhone = schoolProfile?.phone || '-'
      const schoolEmail = schoolProfile?.email || '-'
      
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(schoolName.toUpperCase(), 30, yPos + 3)
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(schoolAddress, 30, yPos + 8)
      doc.text(`Telp: ${schoolPhone} | Email: ${schoolEmail}`, 30, yPos + 12)
      
      // Document title (right side)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('LAPORAN KEUANGAN', pageWidth - 14, yPos + 3, { align: 'right' } as any)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      const periodText = `Periode: ${new Date(exportStartDate).toLocaleDateString('id-ID')} - ${new Date(exportEndDate).toLocaleDateString('id-ID')}`
      doc.text(periodText, pageWidth - 14, yPos + 9, { align: 'right' } as any)
      
      // Metadata row
      yPos += 17
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      const now = new Date()
      const printDate = `Dicetak pada: ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
      const printBy = `Dicetak oleh: ${session?.user?.name || 'Bendahara'}`
      doc.text(printDate, pageWidth - 14, yPos, { align: 'right' } as any)
      doc.text(`| ${printBy}`, pageWidth - 14, yPos + 3, { align: 'right' } as any)
      
      // Divider line
      yPos += 5
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.5)
      doc.line(14, yPos, pageWidth - 14, yPos)
      
      yPos += 8
      
      // ========== SUMMARY CARDS ==========
      const cardWidth = (pageWidth - 28 - 9) / 4 // 4 cards with 3px spacing
      const cardHeight = 18
      const cardY = yPos
      
      // Card 1: Total Pemasukan
      doc.setFillColor(240, 249, 255)
      doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'F')
      doc.setDrawColor(191, 219, 254)
      doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'S')
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text('Total Pemasukan:', 17, cardY + 5)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(37, 99, 235)
      doc.text(formatCurrency(data.summary?.totalIncome || 0).replace('Rp', 'Rp '), 17, cardY + 12)
      
      // Card 2: Total Pengeluaran
      const card2X = 14 + cardWidth + 3
      doc.setFillColor(254, 242, 242)
      doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'F')
      doc.setDrawColor(254, 202, 202)
      doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 2, 2, 'S')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Total Pengeluaran:', card2X + 3, cardY + 5)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(220, 38, 38)
      doc.text(formatCurrency(data.summary?.totalExpense || 0).replace('Rp', 'Rp '), card2X + 3, cardY + 12)
      
      // Card 3: Saldo
      const card3X = card2X + cardWidth + 3
      const balance = (data.summary?.totalIncome || 0) - (data.summary?.totalExpense || 0)
      const isPositive = balance >= 0
      
      // Set fill color based on balance
      if (isPositive) {
        doc.setFillColor(240, 253, 244)
      } else {
        doc.setFillColor(254, 242, 242)
      }
      doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'F')
      
      // Set draw color based on balance
      if (isPositive) {
        doc.setDrawColor(187, 247, 208)
      } else {
        doc.setDrawColor(254, 202, 202)
      }
      doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 2, 2, 'S')
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Saldo (Surplus/Defisit):', card3X + 3, cardY + 5)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      
      // Set text color based on balance
      if (isPositive) {
        doc.setTextColor(22, 163, 74)
      } else {
        doc.setTextColor(220, 38, 38)
      }
      doc.text(formatCurrency(balance).replace('Rp', 'Rp '), card3X + 3, cardY + 12)
      
      // Card 4: Jumlah Transaksi
      const card4X = card3X + cardWidth + 3
      doc.setFillColor(250, 245, 255)
      doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, 'F')
      doc.setDrawColor(233, 213, 255)
      doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 2, 2, 'S')
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text('Jumlah Transaksi:', card4X + 3, cardY + 5)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(126, 34, 206)
      doc.text(String(data.transactions?.length || 0), card4X + 3, cardY + 13)
      
      yPos = cardY + cardHeight + 10
      
      // ========== RINGKASAN PER KATEGORI COA ==========
      if (data.incomeByCOA?.length > 0 || data.expenseByCOA?.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text('Ringkasan per Kategori COA', 14, yPos)
        yPos += 5
        
        // Prepare COA summary data
        const coaCategories: Record<string, { masuk: number, keluar: number }> = {}
        
        // Aggregate income
        data.incomeByCOA?.forEach((item: any) => {
          const categoryName = item.name.split(' - ')[0] // Get category part
          if (!coaCategories[categoryName]) {
            coaCategories[categoryName] = { masuk: 0, keluar: 0 }
          }
          coaCategories[categoryName].masuk += item.amount
        })
        
        // Aggregate expense
        data.expenseByCOA?.forEach((item: any) => {
          const categoryName = item.name.split(' - ')[0]
          if (!coaCategories[categoryName]) {
            coaCategories[categoryName] = { masuk: 0, keluar: 0 }
          }
          coaCategories[categoryName].keluar += item.amount
        })
        
        const coaSummaryData = Object.entries(coaCategories).map(([name, amounts]) => [
          name,
          formatCurrency(amounts.masuk),
          formatCurrency(amounts.keluar),
          formatCurrency(amounts.masuk - amounts.keluar)
        ])
        
        autoTable(doc, {
          startY: yPos,
          head: [['Kategori', 'Masuk', 'Keluar', 'Net']],
          body: coaSummaryData,
          theme: 'striped',
          headStyles: { 
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
          },
          styles: { 
            fontSize: 8.5,
            cellPadding: 3.5,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
            valign: 'middle'
          },
          columnStyles: {
            0: { cellWidth: 120, halign: 'left' },
            1: { cellWidth: 40, halign: 'right', fontStyle: 'normal' },
            2: { cellWidth: 40, halign: 'right', fontStyle: 'normal' },
            3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 },
          alternateRowStyles: { fillColor: [249, 250, 251] }
        })
        
        yPos = (doc as any).lastAutoTable.finalY + 8
      }
      
      // ========== DETAIL TRANSAKSI TABLE ==========
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Detail Transaksi', 14, yPos)
      yPos += 5
      
      const transactionData = (data.transactions || []).map((t: any) => {
        const statusColor = t.status === 'PAID' ? '✓ Lunas' : t.status === 'PENDING' ? '◷ Menunggu' : '✗ Void'
        return [
          new Date(t.date).toLocaleDateString('id-ID'),
          t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
          t.coaAccount?.code || 'N/A',
          t.coaAccount?.name || t.description || 'N/A',
          t.fromTo || t.payerName || t.recipientName || '-',
          t.notes || '-',
          formatCurrency(Number(t.amount)),
          statusColor
        ]
      })
      
      autoTable(doc, {
        startY: yPos,
        head: [['Tanggal', 'Tipe', 'Kode COA', 'Nama Akun', 'Nama/Pihak', 'Catatan', 'Nominal', 'Status']],
        body: transactionData,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle'
        },
        styles: { 
          fontSize: 7.5,
          cellPadding: 2.5,
          lineColor: [229, 231, 235],
          lineWidth: 0.1,
          valign: 'middle',
          overflow: 'linebreak'
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 18, halign: 'center' },
          3: { cellWidth: 50, halign: 'left' },
          4: { cellWidth: 35, halign: 'left' },
          5: { cellWidth: 55, halign: 'left' },
          6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
          7: { cellWidth: 22, halign: 'center' }
        },
        margin: { left: 14, right: 14, bottom: 35 },
        alternateRowStyles: { fillColor: [249, 250, 251] }
      })
      
      // ========== FOOTER ==========
      const footerY = pageHeight - 25
      
      // Footer line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(14, footerY, pageWidth - 14, footerY)
      
      // Left: Auto-generated text
      doc.setFontSize(7)
      doc.setTextColor(120, 120, 120)
      doc.setFont('helvetica', 'normal')
      doc.text('Dokumen ini dihasilkan otomatis oleh sistem.', 14, footerY + 5)
      
      // Center: Page number
      const totalPages = (doc.internal as any).getNumberOfPages()
      doc.text(`Halaman 1 dari ${totalPages}`, pageWidth / 2, footerY + 5, { align: 'center' } as any)
      
      // Right: Signature placeholders
      const sig1X = pageWidth - 90
      const sig2X = pageWidth - 40
      const sigY = footerY + 3
      
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
      doc.text('Bendahara', sig1X, sigY, { align: 'center' } as any)
      doc.text('Kepala Sekolah', sig2X, sigY, { align: 'center' } as any)
      
      // Signature lines
      doc.setDrawColor(180, 180, 180)
      doc.line(sig1X - 15, sigY + 10, sig1X + 15, sigY + 10)
      doc.line(sig2X - 18, sigY + 10, sig2X + 18, sigY + 10)
      
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text('(Nama Bendahara)', sig1X, sigY + 14, { align: 'center' } as any)
      doc.text('(Nama Kepala Sekolah)', sig2X, sigY + 14, { align: 'center' } as any)
      
      // Generate filename
      const filename = `Laporan_Keuangan_${exportStartDate}_${exportEndDate}.pdf`
      
      // Save file
      doc.save(filename)
      
      toast.success('Laporan PDF berhasil diunduh')
    } catch (error) {
      console.error('PDF export error:', error)
      toast.error('Gagal membuat file PDF')
    }
  }

  const handleApplyFilters = async () => {
    await fetchReportData()
    toast.success("Filter berhasil diterapkan")
  }

  const handleResetFilters = async () => {
    setDateRange("bulan-ini")
    setFilterType("semua")
    setFilterCategory("semua")
    setFilterMethod("semua")
    setFilterStatus("semua")
    await fetchReportData()
    toast.success("Filter berhasil direset")
  }

  const formatCurrency = (amount: number) => {
    if (!amount || isNaN(amount) || amount === null || amount === undefined) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusBadge = (status: string) => {
    if (status === "PAID") {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Lunas</Badge>
    }
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">Menunggu</Badge>
  }

  // Summary data with safe number conversion to prevent NaN
  const summaryData = {
    totalIncome: Number(reportData?.summary?.totalIncome || 0) || 0,
    totalExpense: Number(reportData?.summary?.totalExpense || 0) || 0,
    balance: Number(reportData?.summary?.balance || 0) || 0,
    finalBalance: Number(reportData?.summary?.balance || 0) || 0, // Use balance as final balance
  }
  
  // Calculate balance if not provided by API
  if (!summaryData.balance && summaryData.totalIncome && summaryData.totalExpense) {
    summaryData.balance = summaryData.totalIncome - summaryData.totalExpense
    summaryData.finalBalance = summaryData.balance
  }
  
  console.log("💰 Summary data for display:", summaryData)

  // Get monthly trend data from API
  const monthlyData = reportData?.monthlyTrend || []
  
  // Get expense by category data from API and convert to chart format
  const expenseByCategory = reportData?.expenseByCategory || {}
  const expenseByCOA = reportData?.expenseByCOA || []
  const transactions = reportData?.transactions || []
  
  // Log for debugging
  console.log("📊 Raw report data:", reportData)
  console.log("📊 expenseByCategory:", expenseByCategory)
  console.log("📊 expenseByCOA:", expenseByCOA)
  console.log("📊 transactions count:", transactions.length)
  console.log("📊 transactions sample:", transactions.slice(0, 3))
  
  let categoryChartData: any[] = []
  
  // PRIORITIZE: Generate from transactions directly for most accurate data
  if (transactions.length > 0) {
    console.log("📊 Processing transactions directly for category chart")
    const expenseTransactions = transactions.filter((t: any) => 
      t.type === 'EXPENSE' && t.status === 'PAID'
    )
    console.log("📊 Paid expense transactions:", expenseTransactions.length)
    
    if (expenseTransactions.length > 0) {
      // Group by category name or COA name
      const categoryMap: Record<string, number> = {}
      expenseTransactions.forEach((t: any) => {
        const categoryName = t.category?.name || t.coaAccount?.name || 'Lainnya'
        categoryMap[categoryName] = (categoryMap[categoryName] || 0) + Number(t.amount)
      })
      
      const totalExpenseForChart = Object.values(categoryMap).reduce((sum, val) => sum + val, 0)
      console.log("📊 Category map from transactions:", categoryMap)
      console.log("📊 Total expense for chart:", totalExpenseForChart)
      
      if (totalExpenseForChart > 0) {
        categoryChartData = Object.entries(categoryMap)
          .map(([name, amount], index) => ({
            name,
            value: Number(amount),
            percentage: Math.round((Number(amount) / totalExpenseForChart) * 100),
            color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'][index % 6]
          }))
          .filter((item: any) => item.value > 0)
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5)
      }
    }
  }
  
  // Fallback 1: Try to use expenseByCategory from API
  if (categoryChartData.length === 0 && Object.keys(expenseByCategory).length > 0) {
    const totalExpenseForChart = Object.values(expenseByCategory).reduce((sum: number, val: any) => sum + Number(val), 0)
    console.log("📊 Using expenseByCategory from API, total:", totalExpenseForChart)
    
    categoryChartData = Object.entries(expenseByCategory)
      .map(([name, amount], index) => ({
        name,
        value: Number(amount),
        percentage: totalExpenseForChart > 0 ? Math.round((Number(amount) / totalExpenseForChart) * 100) : 0,
        color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'][index % 6]
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5)
  } 
  
  // Fallback 2: Try expenseByCOA
  if (categoryChartData.length === 0 && expenseByCOA.length > 0) {
    const totalExpenseForChart = expenseByCOA.reduce((sum: number, item: any) => sum + Number(item.amount), 0)
    console.log("📊 Using expenseByCOA, total:", totalExpenseForChart)
    
    categoryChartData = expenseByCOA
      .map((item: any, index: number) => ({
        name: item.name,
        value: Number(item.amount),
        percentage: totalExpenseForChart > 0 ? Math.round((Number(item.amount) / totalExpenseForChart) * 100) : 0,
        color: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6B7280'][index % 6]
      }))
      .filter((item: any) => item.value > 0)
      .sort((a: any, b: any) => b.value - a.value)
      .slice(0, 5)
  }

  // Use real data if available, otherwise empty array to show "no data" message
  const displayCategoryData = categoryChartData
  const hasRealExpenseData = categoryChartData.length > 0
  
  console.log("📈 Final category chart data:", categoryChartData)
  console.log("📈 Has real expense data:", hasRealExpenseData)
  console.log("📊 Chart data summary:", { 
    monthlyDataCount: monthlyData.length, 
    categoryChartDataCount: categoryChartData.length,
    transactionsCount: transactions.length,
    expenseTransactionsCount: transactions.filter((t: any) => t.type === 'EXPENSE').length
  })

  if (loading && !reportData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 bg-gray-50/80 min-h-screen -m-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Laporan Keuangan</h1>
            {isTreasurer && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                📅 Akses 3 Bulan
              </Badge>
            )}
            {isSuperAdmin && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                👑 Akses Penuh
              </Badge>
            )}
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={handleExportPDF}
              className="bg-red-500 hover:bg-red-600 text-white rounded-lg h-10 px-4"
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button 
              onClick={handleExportExcel}
              className="bg-green-500 hover:bg-green-600 text-white rounded-lg h-10 px-4"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Date Range */}
              <div className="space-y-1.5 min-w-[200px]">
                <label className="text-xs font-medium text-gray-500">Rentang Tanggal</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hari-ini">Hari Ini</SelectItem>
                    <SelectItem value="minggu-ini">Minggu Ini</SelectItem>
                    <SelectItem value="bulan-ini">Bulan Ini</SelectItem>
                    <SelectItem value="bulan-lalu">Bulan Lalu</SelectItem>
                    <SelectItem value="3-bulan-terakhir">3 Bulan Terakhir</SelectItem>
                    <SelectItem value="6-bulan-terakhir">6 Bulan Terakhir</SelectItem>
                    <SelectItem value="tahun-ini">Tahun Ini</SelectItem>
                    <SelectItem value="semua-data">Semua Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="space-y-1.5 min-w-[130px]">
                <label className="text-xs font-medium text-gray-500">Tipe</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua</SelectItem>
                    <SelectItem value="pemasukan">Pemasukan</SelectItem>
                    <SelectItem value="pengeluaran">Pengeluaran</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-1.5 min-w-[150px]">
                <label className="text-xs font-medium text-gray-500">Kategori</label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Kategori</SelectItem>
                    <SelectItem value="spp">SPP Siswa</SelectItem>
                    <SelectItem value="donasi">Donasi</SelectItem>
                    <SelectItem value="operasional">Operasional</SelectItem>
                    <SelectItem value="gaji">Gaji Guru & Staf</SelectItem>
                    <SelectItem value="fasilitas">Fasilitas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method Filter */}
              <div className="space-y-1.5 min-w-[150px]">
                <label className="text-xs font-medium text-gray-500">Metode Pembayaran</label>
                <Select value={filterMethod} onValueChange={setFilterMethod}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Metode</SelectItem>
                    <SelectItem value="tunai">Tunai</SelectItem>
                    <SelectItem value="transfer">Transfer Bank</SelectItem>
                    <SelectItem value="ewallet">E-Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 rounded-lg border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua">Semua Status</SelectItem>
                    <SelectItem value="lunas">Lunas</SelectItem>
                    <SelectItem value="menunggu">Menunggu</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleApplyFilters}
                  className="h-10 px-5 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Terapkan
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleResetFilters}
                  className="h-10 px-4 rounded-lg border-gray-200"
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Pemasukan */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-100 rounded-xl flex-shrink-0">
                  <ArrowUpRight className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Pemasukan</p>
                  <p className="text-lg font-bold text-blue-600 break-words leading-tight">
                    Rp{summaryData.totalIncome.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Pengeluaran */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-red-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-red-100 rounded-xl flex-shrink-0">
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Pengeluaran</p>
                  <p className="text-lg font-bold text-red-600 break-words leading-tight">
                    Rp{summaryData.totalExpense.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Surplus/Defisit */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-green-100 rounded-xl flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Surplus/Defisit</p>
                  <p className={`text-lg font-bold break-words leading-tight ${summaryData.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summaryData.balance >= 0 ? '+' : ''}Rp{Math.abs(summaryData.balance).toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Bulan Ini</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saldo Akhir */}
          <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-purple-100 rounded-xl flex-shrink-0">
                  <Wallet className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500 mb-1">Saldo Akhir</p>
                  <p className="text-lg font-bold text-purple-600 break-words leading-tight">
                    Rp{summaryData.finalBalance.toLocaleString('id-ID')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Per {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Line Chart - Pemasukan vs Pengeluaran */}
          <Card className="rounded-2xl border-0 shadow-sm lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold">
                  Pemasukan vs Pengeluaran (6 Bulan)
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span className="text-gray-600">Pemasukan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                    <span className="text-gray-600">Pengeluaran</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Simple SVG Line Chart */}
              <div className="h-[280px] relative overflow-hidden">
                {monthlyData.length > 0 ? (
                  <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                    {/* Grid lines */}
                    <g className="text-gray-200">
                      {[0, 40, 80, 120, 160].map((y, i) => (
                        <line key={i} x1="50" y1={180 - y} x2="580" y2={180 - y} stroke="currentColor" strokeDasharray="4" />
                      ))}
                    </g>
                    
                    {/* Calculate max value for scaling */}
                    {(() => {
                      const maxValue = Math.max(
                        ...monthlyData.map((d: any) => Math.max(Number(d.income) || 0, Number(d.expense) || 0))
                      )
                      const scale = maxValue > 0 ? 150 / maxValue : 1
                      const yAxisMax = Math.ceil(maxValue / 100000000) * 100 // Round to nearest 100M
                      
                      const dataCount = monthlyData.length
                      const chartWidth = 520 // 580 - 60 margin
                      const spacing = dataCount > 1 ? chartWidth / (dataCount - 1) : chartWidth
                      
                      const incomePoints = monthlyData.map((d: any, i: number) => {
                        const x = 60 + (i * spacing)
                        const y = 170 - (Number(d.income) * scale)
                        return { x, y, value: Number(d.income) }
                      })
                      
                      const expensePoints = monthlyData.map((d: any, i: number) => {
                        const x = 60 + (i * spacing)
                        const y = 170 - (Number(d.expense) * scale)
                        return { x, y, value: Number(d.expense) }
                      })
                      
                      return (
                        <>
                          {/* Y-axis labels */}
                          <g className="text-xs fill-gray-400">
                            <text x="45" y="175" textAnchor="end">0</text>
                            <text x="45" y="135" textAnchor="end">{(yAxisMax * 0.25).toFixed(0)}M</text>
                            <text x="45" y="95" textAnchor="end">{(yAxisMax * 0.5).toFixed(0)}M</text>
                            <text x="45" y="55" textAnchor="end">{(yAxisMax * 0.75).toFixed(0)}M</text>
                            <text x="45" y="20" textAnchor="end">{yAxisMax}M</text>
                          </g>
                          
                          {/* Income line (green) */}
                          {incomePoints.length > 1 && (
                            <path
                              d={`M ${incomePoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')}`}
                              fill="none"
                              stroke="#10B981"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          
                          {/* Expense line (red) */}
                          {expensePoints.length > 1 && (
                            <path
                              d={`M ${expensePoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')}`}
                              fill="none"
                              stroke="#F87171"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                          
                          {/* Income area fill */}
                          {incomePoints.length > 1 && (
                            <path
                              d={`M ${incomePoints.map((p: any) => `${p.x} ${p.y}`).join(' L ')} L ${incomePoints[incomePoints.length - 1].x} 170 L ${incomePoints[0].x} 170 Z`}
                              fill="url(#incomeGradient)"
                              opacity="0.2"
                            />
                          )}
                          
                          {/* Data points - Income */}
                          {incomePoints.map((point: any, i: number) => (
                            <circle key={`income-${i}`} cx={point.x} cy={point.y} r="4" fill="#10B981" />
                          ))}
                          
                          {/* Data points - Expense */}
                          {expensePoints.map((point: any, i: number) => (
                            <circle key={`expense-${i}`} cx={point.x} cy={point.y} r="4" fill="#F87171" />
                          ))}
                          
                          {/* X-axis labels */}
                          <g className="text-xs fill-gray-500">
                            {monthlyData.map((d: any, i: number) => (
                              <text key={i} x={60 + (i * spacing)} y="205" textAnchor="middle" fontSize="11">
                                {d.month}
                              </text>
                            ))}
                          </g>
                        </>
                      )
                    })()}
                    
                    {/* Gradient definitions */}
                    <defs>
                      <linearGradient id="incomeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p>Belum ada data transaksi</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Donut Chart - Komposisi Kategori */}
          <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">Komposisi Kategori Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {hasRealExpenseData ? (
                <div className="flex flex-col items-center gap-5 min-h-[260px]">
                  {/* Donut Chart SVG */}
                  <div className="relative w-[140px] h-[140px] flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      {/* Background circle */}
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#f3f4f6" strokeWidth="16" />
                      
                      {/* Segments */}
                      {(() => {
                        let cumulativeOffset = 0;
                        return displayCategoryData.map((item, index) => {
                          const circumference = 2 * Math.PI * 38;
                          const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -cumulativeOffset * circumference / 100;
                          cumulativeOffset += item.percentage;
                          
                          return (
                            <circle
                              key={index}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="none"
                              stroke={item.color}
                              strokeWidth="16"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                            />
                          );
                        });
                      })()}
                    </svg>
                    
                    {/* Center label */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-2xl font-bold text-gray-800">
                          {displayCategoryData.length}
                        </span>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Kategori
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="w-full space-y-2">
                    {displayCategoryData.map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 py-1.5 px-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <span 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className="text-gray-700 text-sm font-medium truncate">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-gray-600 text-sm font-semibold flex-shrink-0">
                          {item.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[260px] text-gray-400">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                      <TrendingDown className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Belum ada transaksi pengeluaran</p>
                    <p className="text-xs mt-1 text-gray-400">Kategori akan muncul setelah ada transaksi pengeluaran</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COA Breakdown Section */}
        {reportData && (reportData.incomeByCOA?.length > 0 || reportData.expenseByCOA?.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income by COA */}
            {reportData.incomeByCOA?.length > 0 && (
              <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl border-b border-green-100">
                  <CardTitle className="text-base font-semibold text-green-800 flex items-center gap-2">
                    <ArrowUpRight className="h-5 w-5" />
                    Breakdown Pemasukan per Akun COA
                  </CardTitle>
                  <p className="text-xs text-green-600 mt-1">
                    Total: Rp {reportData.summary.totalIncome?.toLocaleString('id-ID') || 0} ({reportData.incomeByCOA.length} akun)
                  </p>
                </CardHeader>
                <CardContent className="pt-4 pb-5">
                  <div className="space-y-4">
                    {reportData.incomeByCOA.map((item: any, index: number) => {
                      const percentage = reportData.summary.totalIncome > 0 
                        ? ((item.amount / reportData.summary.totalIncome) * 100).toFixed(1)
                        : 0
                      return (
                        <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-xl hover:bg-green-50/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-800 font-semibold block truncate">
                                {item.code} - {item.name}
                              </span>
                            </div>
                            <span className="text-green-600 font-bold text-sm ml-2 whitespace-nowrap">
                              Rp {item.amount.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-green-600 w-14 text-right">{percentage}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expense by COA */}
            {reportData.expenseByCOA?.length > 0 && (
              <Card className="rounded-2xl border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 bg-gradient-to-r from-red-50 to-rose-50 rounded-t-2xl border-b border-red-100">
                  <CardTitle className="text-base font-semibold text-red-800 flex items-center gap-2">
                    <ArrowDownRight className="h-5 w-5" />
                    Breakdown Pengeluaran per Akun COA
                  </CardTitle>
                  <p className="text-xs text-red-600 mt-1">
                    Total: Rp {reportData.summary.totalExpense?.toLocaleString('id-ID') || 0} ({reportData.expenseByCOA.length} akun)
                  </p>
                </CardHeader>
                <CardContent className="pt-4 pb-5">
                  <div className="space-y-4">
                    {reportData.expenseByCOA.map((item: any, index: number) => {
                      const percentage = reportData.summary.totalExpense > 0 
                        ? ((item.amount / reportData.summary.totalExpense) * 100).toFixed(1)
                        : 0
                      return (
                        <div key={index} className="space-y-2 p-3 bg-gray-50 rounded-xl hover:bg-red-50/50 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-800 font-semibold block truncate">
                                {item.code} - {item.name}
                              </span>
                            </div>
                            <span className="text-red-600 font-bold text-sm ml-2 whitespace-nowrap">
                              Rp {item.amount.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-red-400 to-rose-500 transition-all duration-500 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-red-600 w-14 text-right">{percentage}%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Transaction Table */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Detail Laporan Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-xs text-gray-600 py-3">Tanggal</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Tipe</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Kategori</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Akun COA</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Deskripsi/Nama</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Nominal</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Metode</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-gray-600 text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.transactions && reportData.transactions.length > 0 ? (
                    reportData.transactions
                      .slice((currentPage - 1) * 5, currentPage * 5)
                      .map((transaction: any) => (
                      <TableRow key={transaction.id} className="hover:bg-gray-50/50">
                        <TableCell className="text-sm py-3">
                          {formatDate(transaction.date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge 
                            variant="outline"
                            className={`text-xs border-0 ${
                              transaction.type === "INCOME" 
                                ? "bg-green-100 text-green-700" 
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {transaction.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{transaction.category?.name || 'N/A'}</TableCell>
                        <TableCell className="text-sm">
                          {transaction.coaAccount?.code ? `${transaction.coaAccount.code} - ${transaction.coaAccount.name}` : transaction.description || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transaction.payerName || transaction.recipientName || transaction.description || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCurrency(Number(transaction.amount))}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transaction.paymentMethod === 'CASH' ? 'Tunai' : 
                           transaction.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' : 
                           transaction.paymentMethod === 'QRIS' ? 'QRIS' : 'N/A'}
                        </TableCell>
                        <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                        <TableCell className="text-center">
                          <button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs font-medium">
                            <Eye className="h-3 w-3" />
                            Lihat
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-400">
                        Belum ada transaksi dalam periode ini
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-500">
                Menampilkan {((currentPage - 1) * 5) + 1}-{Math.min(currentPage * 5, reportData?.transactions?.length || 0)} dari {reportData?.transactions?.length || 0} transaksi
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Previous
                </Button>
                {(() => {
                  const totalPages = Math.ceil((reportData?.transactions?.length || 0) / 5)
                  const pages = []
                  
                  // Show first 3 pages or current page vicinity
                  for (let i = 1; i <= Math.min(3, totalPages); i++) {
                    pages.push(i)
                  }
                  
                  // Show current page if beyond first 3
                  if (currentPage > 3 && currentPage < totalPages - 2) {
                    pages.push(currentPage)
                  }
                  
                  return pages.map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "ghost"}
                      size="sm"
                      className={`w-8 h-8 p-0 text-xs ${
                        currentPage === page
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))
                })()}
                {Math.ceil((reportData?.transactions?.length || 0) / 5) > 3 && (
                  <>
                    <span className="px-2 text-gray-400">...</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 p-0 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() => setCurrentPage(Math.ceil((reportData?.transactions?.length || 0) / 5))}
                    >
                      {Math.ceil((reportData?.transactions?.length || 0) / 5)}
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentPage >= Math.ceil((reportData?.transactions?.length || 0) / 5)}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-semibold">
              Export Laporan ke {exportType === 'excel' ? 'Excel' : 'PDF'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600 pt-1">
              Pilih sekolah dan rentang tanggal untuk laporan yang akan di-export
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            {/* School Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="school-select" className="text-xs font-medium">Nama Sekolah</Label>
              <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Pilih Sekolah" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schoolProfile && (
                <div className="p-2 bg-gray-50 rounded-md border text-[10px] text-gray-600 space-y-0.5">
                  <p><strong>📍 Alamat:</strong> {schoolProfile.address || '-'}</p>
                  <p><strong>📞 Telepon:</strong> {schoolProfile.phone || '-'}</p>
                  <p><strong>📧 Email:</strong> {schoolProfile.email || '-'}</p>
                </div>
              )}
            </div>
            
            {/* Current Period Info */}
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-[10px] text-blue-800 dark:text-blue-200">
                <strong>📊 Periode saat ini:</strong> {new Date(exportStartDate).toLocaleDateString('id-ID')} - {new Date(exportEndDate).toLocaleDateString('id-ID')}
              </p>
            </div>
            
            {/* Date Inputs in Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start-date" className="text-xs font-medium">Tanggal Mulai</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value
                    if (isTreasurer && treasurerMaxStartDate && selectedDate < treasurerMaxStartDate) {
                      toast.error(`Bendahara hanya dapat mengakses data maksimal 3 bulan terakhir`)
                      setExportStartDate(treasurerMaxStartDate)
                    } else {
                      setExportStartDate(selectedDate)
                    }
                  }}
                  min={treasurerMaxStartDate || undefined}
                  className="w-full h-9 text-xs"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="end-date" className="text-xs font-medium">Tanggal Akhir</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full h-9 text-xs"
                />
              </div>
            </div>
            
            {isTreasurer && (
              <p className="text-[10px] text-amber-600 -mt-1">
                ⚠️ Akses dibatasi maksimal 3 bulan terakhir
              </p>
            )}
            
            <div className="p-2.5 bg-blue-50 rounded-md border border-blue-100">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-900">Rentang Tanggal Terpilih</p>
                  <p className="text-[11px] text-blue-700 mt-0.5">
                    {new Date(exportStartDate).toLocaleDateString('id-ID', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })} 
                    {' - '}
                    {new Date(exportEndDate).toLocaleDateString('id-ID', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    {(() => {
                      const start = new Date(exportStartDate)
                      const end = new Date(exportEndDate)
                      const diffTime = Math.abs(end.getTime() - start.getTime())
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                      return `${diffDays} hari`
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsExportDialogOpen(false)}
            >
              Batal
            </Button>
            <Button 
              onClick={executeExport}
              className={exportType === 'excel' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {exportType === 'excel' ? (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export Excel
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
