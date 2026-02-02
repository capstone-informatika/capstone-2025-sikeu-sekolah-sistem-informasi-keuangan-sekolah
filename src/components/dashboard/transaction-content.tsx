"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar,
  Upload,
  Search,
  ChevronDown,
  Loader2,
  FileText,
  Printer,
  Filter,
  Eye,
  X,
  User,
  Clock,
  Edit3,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TransactionPageSkeleton } from "./transaction-skeleton";

type TransactionType = "INCOME" | "EXPENSE";
type PaymentMethod = "CASH" | "BANK_TRANSFER" | "E_WALLET";
type PaymentStatus = "PAID" | "PENDING" | "VOID";

// COA Categories akan di-fetch dari API
const getIncomeCategories = (coaData: any[]) => {
  return coaData.filter(cat => 
    cat.type === 'ASSET' || cat.type === 'EQUITY' || cat.type === 'REVENUE'
  ).map(cat => ({
    id: cat.id,
    name: `${cat.code} - ${cat.name}`,
    types: cat.subCategories?.flatMap((sub: any) => 
      sub.accounts?.map((acc: any) => ({
        id: acc.id,
        name: `${acc.code} - ${acc.name}`
      })) || []
    ) || []
  }));
};

const getExpenseCategories = (coaData: any[]) => {
  return coaData.filter(cat => 
    cat.type === 'LIABILITY' || cat.type === 'EXPENSE'
  ).map(cat => ({
    id: cat.id,
    name: `${cat.code} - ${cat.name}`,
    types: cat.subCategories?.flatMap((sub: any) => 
      sub.accounts?.map((acc: any) => ({
        id: acc.id,
        name: `${acc.code} - ${acc.name}`
      })) || []
    ) || []
  }));
};

// List of petugas for filter
const petugasList = [
  { id: "semua", name: "Semua Petugas" },
  { id: "bendahara", name: "Bendahara" },
  { id: "admin-tu", name: "Admin TU" },
  { id: "kepala-sekolah", name: "Kepala Sekolah" },
];

export function TransactionContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // States
  const [activeTab, setActiveTab] = useState<TransactionType>("INCOME");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [coaData, setCoaData] = useState<any[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("6-bulan-terakhir");
  const [filterPetugas, setFilterPetugas] = useState("semua");
  const [currentPage, setCurrentPage] = useState(1);
  const [schools, setSchools] = useState<any[]>([]);
  
  // Detect mobile viewport on mount and window resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // State untuk dialog form transaksi seperti di dashboard
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<TransactionType>("INCOME");
  const [dialogFormData, setDialogFormData] = useState({
    categoryId: "",
    typeId: "",
    amount: "",
    description: "",
    date: "",
    status: "PAID" as PaymentStatus,
    schoolId: ""
  });
  
  // Form state
  const [formData, setFormData] = useState({
    date: "",
    amount: "",
    categoryId: "",
    typeId: "",
    namaPembayar: "",
    periode: "",
    paymentMethod: "CASH" as PaymentMethod,
    status: "PAID" as PaymentStatus,
    proof: null as File | null,
    notes: "",
    schoolId: "",
  });
  
  // State untuk preview gambar
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Helper functions untuk format currency input
  const formatCurrencyInput = (value: string): string => {
    // Hapus semua karakter non-digit
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    
    // Format dengan pemisah ribuan (titik)
    return numbers.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  };

  const parseCurrencyInput = (value: string): string => {
    // Hapus semua titik pemisah untuk mendapatkan angka murni
    return value.replace(/\./g, '');
  };

  // Get available types based on selected category
  const currentCategories = activeTab === "INCOME" ? incomeCategories : expenseCategories;
  const selectedCategory = currentCategories.find(cat => cat.id === formData.categoryId);
  const availableTypes = selectedCategory?.types || [];
  
  // Categories for dialog form
  const dialogCategories = useMemo(() => 
    transactionType === "INCOME" ? incomeCategories : expenseCategories,
    [transactionType, incomeCategories, expenseCategories]
  );

  // Memoized fetch functions
  const fetchSchools = useCallback(async () => {
    try {
      const response = await fetch("/api/schools");
      if (response.ok) {
        const data = await response.json();
        setSchools(data.schools || []);
      }
    } catch (error) {
      console.error("Failed to fetch schools:", error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      // Map filterPeriod to API period parameter
      const periodMap: Record<string, string> = {
        'hari-ini': 'today',
        'minggu-ini': 'thisWeek',
        'bulan-ini': 'thisMonth',
        'bulan-lalu': 'lastMonth',
        '3-bulan-terakhir': 'last3Months',
        '6-bulan-terakhir': 'last6Months',
        'tahun-ini': 'thisYear',
        'semua-data': 'allTime'
      };
      
      const period = periodMap[filterPeriod] || 'last6Months';
      const response = await fetch(`/api/transactions?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      } else {
        console.error("Failed to fetch transactions:", response.status);
        setTransactions([]);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
      setTransactions([]);
    }
  }, [filterPeriod]);

  const fetchCategories = useCallback(async () => {
    try {
      const coaResponse = await fetch("/api/coa?format=hierarchy");
      if (coaResponse.ok) {
        const coaData = await coaResponse.json();
        setCoaData(coaData);
        
        const incomeCategories = getIncomeCategories(coaData);
        const expenseCategories = getExpenseCategories(coaData);
        
        setIncomeCategories(incomeCategories);
        setExpenseCategories(expenseCategories);
      } else {
        setIncomeCategories([]);
        setExpenseCategories([]);
      }
      
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setCategories([]);
      setIncomeCategories([]);
      setExpenseCategories([]);
    }
  }, []);

  // Set initial values on client-side only
  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    setFormData(prev => ({
      ...prev,
      date: today,
      periode: currentMonth,
    }));
  }, []);

  // Auto-set schoolId jika hanya ada 1 sekolah
  useEffect(() => {
    if (schools.length === 1 && !formData.schoolId) {
      setFormData(prev => ({ ...prev, schoolId: schools[0].id }));
    }
  }, [schools]);

  // Initial data fetch
  useEffect(() => {
    if (mounted) {
      const loadInitialData = async () => {
        setInitialLoading(true);
        try {
          await Promise.all([
            fetchTransactions(),
            fetchCategories(),
            fetchSchools()
          ]);
        } finally {
          setInitialLoading(false);
        }
      };
      loadInitialData();
    }
  }, [mounted, fetchTransactions, fetchCategories, fetchSchools]);

  // Reset category when tab changes
  useEffect(() => {
    if (mounted && !initialLoading) {
      setFormData(prev => ({
        ...prev,
        categoryId: "",
        typeId: ""
      }));
    }
  }, [activeTab, mounted, initialLoading]);

  // Refetch data when filterPeriod changes
  useEffect(() => {
    if (mounted && !initialLoading) {
      fetchTransactions();
    }
  }, [filterPeriod, mounted, initialLoading, fetchTransactions]);
  
  // Separate effect for periodic refresh
  useEffect(() => {
    if (mounted && !initialLoading) {
      const interval = setInterval(() => {
        fetchTransactions();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [mounted, initialLoading, fetchTransactions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validasi tipe file
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error("Format file harus JPG, PNG, GIF, atau WebP");
        return;
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("Ukuran file maksimal 10MB");
        return;
      }
      
      setFormData({ ...formData, proof: file });
      
      // Buat preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      toast.success("Gambar berhasil dipilih");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validasi tipe file
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error("Format file harus JPG, PNG, GIF, atau WebP");
        return;
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("Ukuran file maksimal 10MB");
        return;
      }
      
      setFormData({ ...formData, proof: file });
      
      // Buat preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      toast.success("Gambar berhasil dipilih");
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      amount: "",
      categoryId: "",
      typeId: "",
      namaPembayar: "",
      periode: "",
      paymentMethod: "CASH",
      status: "PAID",
      proof: null,
      notes: "",
      schoolId: "",
    });
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (printReceipt: boolean = false) => {
    // Validasi school hanya jika ada schools yang tersedia dan belum dipilih
    if (schools.length > 1 && !formData.schoolId) {
      toast.error("Pilih sekolah terlebih dahulu");
      return;
    }

    if (!formData.categoryId || !formData.amount || !formData.namaPembayar) {
      toast.error("Mohon lengkapi semua field yang diperlukan");
      return;
    }

    setLoading(true);
    try {
      const selectedCat = currentCategories.find((c: any) => c.id === formData.categoryId);
      const selectedType = selectedCat?.types.find((t: any) => t.id === formData.typeId);
      
      // Upload gambar terlebih dahulu jika ada
      let receiptFileUrl = null;
      if (formData.proof) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formData.proof);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: uploadFormData,
        });
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          receiptFileUrl = uploadData.url;
        } else {
          toast.error('Gagal mengupload gambar');
          setLoading(false);
          return;
        }
      }
      
      // Prepare request body
      // categoryId di form adalah COA Category ID, typeId adalah COA Account ID
      // Kita perlu create/find proper Category untuk transaction
      const requestBody: any = {
        type: activeTab,
        date: formData.date,
        amount: parseInt(formData.amount) || 0,
        description: `${selectedCat?.name} - ${selectedType?.name || ''} - ${formData.namaPembayar}`,
        fromTo: formData.namaPembayar,
        paymentMethod: formData.paymentMethod,
        status: formData.status,
        schoolId: formData.schoolId || undefined,
        coaAccountId: formData.typeId || undefined, // typeId adalah COA Account ID
        receiptFileUrl: receiptFileUrl || undefined,
        notes: formData.notes || undefined,
      };

      // Gunakan nama kategori sebagai categoryId untuk auto-create di backend
      // Atau kirim simple category name untuk di-handle backend
      const categoryName = selectedCat?.name?.split(' - ')[1] || selectedCat?.name || 'Transaksi Umum';
      requestBody.categoryId = categoryName; // Backend akan create/find category berdasarkan nama
      
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (response.ok) {
        const typeText = activeTab === "INCOME" ? "Pemasukan" : "Pengeluaran";
        toast.success(`${typeText} berhasil ditambahkan`);
        
        if (printReceipt && data.transaction?.id) {
          try {
            const receiptResponse = await fetch(`/api/receipts/${data.transaction.id}/pdf`);
            if (receiptResponse.ok) {
              const blob = await receiptResponse.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `kwitansi-${data.transaction.id}.pdf`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              toast.success("Kwitansi berhasil dibuat dan diunduh");
            }
          } catch (error) {
            console.error("Failed to generate receipt:", error);
            toast.error("Gagal membuat kwitansi");
          }
        }

        resetForm();
        setTimeout(async () => {
          await fetchTransactions();
        }, 500);
      } else {
        console.error("API Error:", data);
        toast.error(data.error || "Gagal menambahkan transaksi");
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      toast.error("Gagal menambahkan transaksi");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!numAmount || isNaN(numAmount) || numAmount === 0) return "Rp 0";
    
    return `Rp ${numAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PAID":
        return "Lunas";
      case "PENDING":
        return "Menunggu";
      case "VOID":
        return "Void";
      default:
        return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-green-100 text-green-700 border-green-200 hover:bg-green-100";
      case "PENDING":
        return "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100";
      case "VOID":
        return "bg-red-100 text-red-700 border-red-200 hover:bg-red-100";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case "CASH":
        return "Tunai";
      case "BANK_TRANSFER":
        return "Transfer";
      case "E_WALLET":
        return "E-Wallet";
      default:
        return method;
    }
  };

  // Memoized filtered transactions untuk menghindari re-computation
  const filteredTransactions = useMemo(() => {
    // Filter transactions berdasarkan activeTab
    const displayTransactions = transactions.filter(transaction => {
      return transaction.type === activeTab;
    });

    return displayTransactions.filter((transaction) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        transaction.fromTo?.toLowerCase().includes(searchLower) ||
        transaction.description?.toLowerCase().includes(searchLower) ||
        transaction.category?.name?.toLowerCase().includes(searchLower);
      
      // Filter by petugas
      const matchesPetugas = filterPetugas === "semua" || 
        transaction.createdBy?.name?.toLowerCase().replace(/\s+/g, '-') === filterPetugas;
      
      return matchesSearch && matchesPetugas;
    });
  }, [transactions, activeTab, searchQuery, filterPetugas]);

  const handleViewTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailModal(true);
  };

  const handleDeleteTransaction = async (transaction: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus transaksi ini?\\n\\nNominal: ${formatCurrency(transaction.amount)}\\nTanggal: ${formatDate(transaction.date)}`)) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Transaksi berhasil dihapus');
        setTransactions(prevTransactions => 
          prevTransactions.filter(t => t.id !== transaction.id)
        );
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Gagal menghapus transaksi');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error('Terjadi kesalahan saat menghapus transaksi');
    }
  };

  // Fungsi untuk membuka dialog form transaksi
  const handleOpenDialog = (type: TransactionType) => {
    setTransactionType(type);
    setDialogFormData({
      categoryId: "",
      typeId: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      status: "PAID",
      schoolId: schools.length > 0 ? schools[0].id : ""
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setDialogFormData({
      categoryId: "",
      typeId: "",
      amount: "",
      description: "",
      date: new Date().toISOString().split("T")[0],
      status: "PAID",
      schoolId: ""
    });
  };

  const handleSubmitDialog = async () => {
    if (!dialogFormData.categoryId || !dialogFormData.amount) {
      toast.error("Mohon lengkapi semua field yang diperlukan");
      return;
    }

    const finalDescription = dialogFormData.description || "Transaksi";

    setLoading(true);
    try {
      const selectedCat = dialogCategories.find((c: any) => c.id === dialogFormData.categoryId);
      const selectedType = selectedCat?.types.find((t: any) => t.id === dialogFormData.typeId);

      const requestBody = {
        type: transactionType,
        amount: parseFloat(dialogFormData.amount),
        description: `${selectedType?.name || selectedCat?.name} - ${finalDescription}`,
        date: dialogFormData.date,
        status: dialogFormData.status,
        fromTo: finalDescription,
        paymentMethod: "CASH",
        schoolId: dialogFormData.schoolId || undefined,
        categoryId: dialogFormData.categoryId
      };

      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${transactionType === "INCOME" ? "Pemasukan" : "Pengeluaran"} berhasil ditambahkan`);
        
        handleCloseDialog();
        setActiveTab(transactionType);
        
        setTimeout(async () => {
          await fetchTransactions();
        }, 500);
      } else {
        console.error("API Error:", data);
        toast.error(data.error || data.message || "Gagal menambahkan transaksi");
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Terjadi kesalahan saat menambahkan transaksi");
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // Memoized pagination
  const itemsPerPage = 10;
  const { totalPages, paginatedTransactions } = useMemo(() => {
    const total = Math.ceil(filteredTransactions.length / itemsPerPage);
    const paginated = filteredTransactions.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    return { totalPages: total, paginatedTransactions: paginated };
  }, [filteredTransactions, currentPage]);

  // Memoized transaction statistics - filter by current month only
  const transactionStats = useMemo(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Filter transactions for current month only
    const currentMonthTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= firstDayOfMonth && transactionDate <= lastDayOfMonth;
    });
    
    const totalIncome = currentMonthTransactions
      .filter(t => t.type === "INCOME" && t.status === "PAID")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpense = currentMonthTransactions
      .filter(t => t.type === "EXPENSE" && t.status === "PAID")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = totalIncome - totalExpense;
    return { totalIncome, totalExpense, balance };
  }, [transactions]);

  // Show skeleton during initial loading
  if (!mounted || initialLoading) {
    return <TransactionPageSkeleton />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50/80 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transaksi</h1>
          <p className="text-gray-500 mt-1">Kelola transaksi pemasukan dan pengeluaran</p>
        </div>
      </div>

      {/* Quick Stats Cards - Fixed height to prevent CLS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="min-h-[100px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pemasukan</p>
                <p className="text-2xl font-bold text-green-600 min-h-[32px]">
                  {formatCurrency(transactionStats.totalIncome)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Bulan Ini</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Plus className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="min-h-[100px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-red-600 min-h-[32px]">
                  {formatCurrency(transactionStats.totalExpense)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Bulan Ini</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="min-h-[100px]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {transactionStats.balance >= 0 ? 'Surplus' : 'Defisit'}
                </p>
                <p className={`text-2xl font-bold min-h-[32px] ${
                  transactionStats.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(Math.abs(transactionStats.balance))}
                </p>
                <p className="text-xs text-gray-500 mt-1">Bulan Ini</p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                transactionStats.balance >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <Eye className={`h-6 w-6 ${transactionStats.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TransactionType)}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="INCOME">Pemasukan</TabsTrigger>
            <TabsTrigger value="EXPENSE">Pengeluaran</TabsTrigger>
          </TabsList>
          
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari transaksi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-full sm:w-48">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="Pilih Periode" />
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
            <Select value={filterPetugas} onValueChange={setFilterPetugas}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {petugasList.map((petugas) => (
                  <SelectItem key={petugas.id} value={petugas.id}>
                    {petugas.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Transaction Form */}
          <Card>
            <CardHeader>
              <CardTitle>
                Tambah {activeTab === "INCOME" ? "Pemasukan" : "Pengeluaran"} Baru
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 overflow-x-auto">
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                {/* School Selection (if schools available) */}
                {schools.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="schoolId">Sekolah {schools.length === 1 && "(Otomatis)"}</Label>
                    <Select
                      value={formData.schoolId}
                      onValueChange={(value) => setFormData({ ...formData, schoolId: value })}
                      disabled={schools.length === 1}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih sekolah" />
                      </SelectTrigger>
                      <SelectContent>
                        {schools.map((school) => (
                          <SelectItem key={school.id} value={school.id}>
                            {school.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Kategori</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value, typeId: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub Category */}
                <div className="space-y-2">
                  <Label htmlFor="typeId">Sub Kategori</Label>
                  <Select
                    value={formData.typeId}
                    onValueChange={(value) => setFormData({ ...formData, typeId: value })}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.categoryId ? "Pilih sub kategori" : "Pilih kategori dulu"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map((type: any) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Nominal (Rp)</Label>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(formData.amount)}
                    onChange={(e) => {
                      const rawValue = parseCurrencyInput(e.target.value);
                      setFormData({ ...formData, amount: rawValue });
                    }}
                    placeholder="Masukkan nominal (contoh: 1.000.000)"
                  />
                </div>

                {/* Payer Name */}
                <div className="space-y-2">
                  <Label htmlFor="namaPembayar">
                    {activeTab === "INCOME" ? "Nama Pembayar" : "Kepada"}
                  </Label>
                  <Input
                    id="namaPembayar"
                    value={formData.namaPembayar}
                    onChange={(e) => setFormData({ ...formData, namaPembayar: e.target.value })}
                    placeholder={activeTab === "INCOME" ? "Nama yang membayar" : "Nama penerima"}
                  />
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date">Tanggal</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData({ ...formData, paymentMethod: value as PaymentMethod })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Tunai</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Transfer Bank</SelectItem>
                      <SelectItem value="E_WALLET">E-Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as PaymentStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAID">Lunas</SelectItem>
                      <SelectItem value="PENDING">Menunggu</SelectItem>
                      <SelectItem value="VOID">Void</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan (Opsional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Tambahkan catatan jika diperlukan"
                  rows={3}
                />
              </div>

              {/* Upload Bukti Transaksi */}
              <div className="space-y-2">
                <Label htmlFor="receipt-upload">Bukti Transaksi (Opsional)</Label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors cursor-pointer"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="receipt-upload"
                  />
                  
                  {imagePreview ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center">
                        <img 
                          src={imagePreview} 
                          alt="Preview bukti transaksi" 
                          className="max-h-48 rounded-lg object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-sm text-gray-600">
                          {formData.proof?.name}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, proof: null });
                            setImagePreview(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-1">
                        Klik untuk upload atau drag & drop
                      </p>
                      <p className="text-xs text-gray-500">
                        Format: JPG, PNG, GIF, WebP (Max 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={() => handleSubmit(false)} 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Transaksi"
                  )}
                </Button>
                <Button 
                  onClick={() => handleSubmit(true)} 
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Simpan & Cetak Kwitansi
                    </>
                  )}
                </Button>
                <Button 
                  onClick={resetForm} 
                  disabled={loading}
                  variant="ghost"
                >
                  Reset Form
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transaction List */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>
                    Daftar {activeTab === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    {filteredTransactions.length} transaksi ditemukan
                  </p>
                </div>
                {filteredTransactions.length > 0 && (
                  <Badge variant="outline">
                    Total: {formatCurrency(filteredTransactions.reduce((sum, t) => sum + Number(t.amount), 0))}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada transaksi {activeTab === "INCOME" ? "pemasukan" : "pengeluaran"}</p>
                </div>
              ) : (
                <>
                  {isMobile ? (
                    // Mobile Card View
                    <div className="space-y-4">
                      {paginatedTransactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4 bg-white space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{transaction.description}</p>
                              <p className="text-xs text-gray-500">{formatDate(transaction.date)}</p>
                            </div>
                            <Badge className={getStatusBadgeClass(transaction.status)}>
                              {getStatusLabel(transaction.status)}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <div>
                              <p className="text-xs text-gray-500">Nominal</p>
                              <p className="font-bold text-lg">{formatCurrency(transaction.amount)}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewTransaction(transaction)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteTransaction(transaction)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Desktop Table View
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Keterangan</TableHead>
                            <TableHead>{activeTab === "INCOME" ? "Dari" : "Kepada"}</TableHead>
                            <TableHead>Nominal</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Metode</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {formatDate(transaction.date)}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <p className="font-medium truncate">{transaction.description}</p>
                                  {transaction.category?.name && (
                                    <p className="text-xs text-gray-500">{transaction.category.name}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{transaction.fromTo}</TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusBadgeClass(transaction.status)}>
                                  {getStatusLabel(transaction.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getPaymentMethodLabel(transaction.paymentMethod)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewTransaction(transaction)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteTransaction(transaction)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Sebelumnya
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Selanjutnya
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Detail Transaksi</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs font-medium text-gray-500">Tanggal</Label>
                  <p className="text-sm mt-1">{formatDateTime(selectedTransaction.date)}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Tipe</Label>
                  <div className="mt-1">
                    <Badge className={selectedTransaction.type === "INCOME" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                      {selectedTransaction.type === "INCOME" ? "Pemasukan" : "Pengeluaran"}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Nominal</Label>
                  <p className="text-base font-bold mt-1">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusBadgeClass(selectedTransaction.status)}>
                      {getStatusLabel(selectedTransaction.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">
                    {selectedTransaction.type === "INCOME" ? "Dari" : "Kepada"}
                  </Label>
                  <p className="text-sm mt-1">{selectedTransaction.fromTo}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-gray-500">Metode Pembayaran</Label>
                  <p className="text-sm mt-1">{getPaymentMethodLabel(selectedTransaction.paymentMethod)}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-xs font-medium text-gray-500">Deskripsi</Label>
                <p className="text-sm mt-1">{selectedTransaction.description}</p>
              </div>

              {selectedTransaction.notes && (
                <div>
                  <Label className="text-xs font-medium text-gray-500">Catatan</Label>
                  <p className="text-sm mt-1">{selectedTransaction.notes}</p>
                </div>
              )}

              {selectedTransaction.receiptFileUrl && (
                <div>
                  <Label className="text-xs font-medium text-gray-500">Bukti Pembayaran</Label>
                  <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                    <img 
                      src={selectedTransaction.receiptFileUrl} 
                      alt="Bukti pembayaran" 
                      className="w-full h-auto max-h-48 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(selectedTransaction.receiptFileUrl, '_blank')}
                      title="Klik untuk melihat ukuran penuh"
                    />
                    <p className="text-xs text-center text-gray-500 mt-2">Klik gambar untuk melihat ukuran penuh</p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 p-3 rounded-lg">
                <Label className="text-xs font-medium text-gray-500">Informasi Sistem</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Dibuat oleh</p>
                    <p className="text-sm">{selectedTransaction.createdBy?.name || 'System'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Dibuat pada</p>
                    <p className="text-sm">{formatDateTime(selectedTransaction.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-shrink-0 mt-4">
            <Button onClick={() => setShowDetailModal(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Form Transaksi Quick Add */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Tambah {transactionType === "INCOME" ? "Pemasukan" : "Pengeluaran"}
            </DialogTitle>
            <DialogDescription>
              Isi form di bawah untuk menambahkan transaksi baru
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {schools.length > 1 && (
              <div className="grid gap-2">
                <Label htmlFor="school">Sekolah</Label>
                <Select
                  value={dialogFormData.schoolId}
                  onValueChange={(value) => setDialogFormData({ ...dialogFormData, schoolId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih sekolah" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="category">Kategori</Label>
              <Select
                value={dialogFormData.categoryId}
                onValueChange={(value) => setDialogFormData({ ...dialogFormData, categoryId: value, typeId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {dialogCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="type">Sub Kategori</Label>
              <Select
                value={dialogFormData.typeId}
                onValueChange={(value) => setDialogFormData({ ...dialogFormData, typeId: value })}
                disabled={!dialogFormData.categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={dialogFormData.categoryId ? "Pilih sub kategori" : "Pilih kategori dulu"} />
                </SelectTrigger>
                <SelectContent>
                  {dialogCategories.find(cat => cat.id === dialogFormData.categoryId)?.types?.map((type: any) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="amount">Nominal (Rp)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                value={formatCurrencyInput(dialogFormData.amount)}
                onChange={(e) => {
                  const rawValue = parseCurrencyInput(e.target.value);
                  setDialogFormData({ ...dialogFormData, amount: rawValue });
                }}
                placeholder="Masukkan nominal (contoh: 1.000.000)"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Input
                id="description"
                value={dialogFormData.description}
                onChange={(e) => setDialogFormData({ ...dialogFormData, description: e.target.value })}
                placeholder="Masukkan deskripsi transaksi"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="date">Tanggal</Label>
              <Input
                id="date"
                type="date"
                value={dialogFormData.date}
                onChange={(e) => setDialogFormData({ ...dialogFormData, date: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={dialogFormData.status}
                onValueChange={(value) => setDialogFormData({ ...dialogFormData, status: value as PaymentStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Lunas</SelectItem>
                  <SelectItem value="PENDING">Tertunda</SelectItem>
                  <SelectItem value="VOID">Void</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={loading}>
              Batal
            </Button>
            <Button onClick={handleSubmitDialog} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}