import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDateRangeForRole } from '@/lib/permissions'
import { z } from 'zod'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  date: z.string(),
  amount: z.number().positive(),
  categoryId: z.string(), // Category ID (required)
  coaAccountId: z.string().optional(), // COA Account ID (optional for now)
  description: z.string(),
  fromTo: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'QRIS']).optional(),
  status: z.enum(['PAID', 'PENDING', 'VOID']).optional(),
  receiptFileUrl: z.string().optional(),
  notes: z.string().optional(), // Catatan transaksi
  schoolId: z.string().optional(), // For Super Admin
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("GET transactions - Session user:", {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      schoolId: session.user.schoolId
    })

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const month = searchParams.get('month')
    const period = searchParams.get('period')

    // CRITICAL FIX: Handle case where schoolId might be null/undefined
    let schoolId: string | null = session.user.schoolId || null
    
    if (!schoolId) {
      console.log("⚠️  No schoolId in session, looking up user in database...")
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { schoolProfileId: true }
      })
      schoolId = user?.schoolProfileId || null
      console.log("📍 Found schoolId from database:", schoolId)
    }
    
    // For SUPER_ADMIN without schoolId, get first available school or return all transactions
    const isSuperAdmin = session.user.role === 'SUPER_ADMIN'
    
    if (!schoolId && !isSuperAdmin) {
      console.error("❌ No school ID found for non-admin user")
      return NextResponse.json({ transactions: [] })
    }

    const where: any = {}
    
    // Only filter by schoolId if user has one (Super Admin might not have)
    if (schoolId) {
      where.schoolProfileId = schoolId
    } else if (isSuperAdmin) {
      // Super Admin without schoolId can see all transactions
      // Or get first school's transactions
      const firstSchool = await prisma.schoolProfile.findFirst()
      if (firstSchool) {
        where.schoolProfileId = firstSchool.id
        console.log("📍 Super Admin using first school:", firstSchool.id)
      }
    }

    // Apply role-based date restrictions for TREASURER
    const roleBasedDateRange = getDateRangeForRole(session.user.role)
    if (session.user.role === 'TREASURER' && roleBasedDateRange) {
      where.date = {
        gte: roleBasedDateRange.startDate,
        lte: roleBasedDateRange.endDate
      }
      console.log(`🔒 TREASURER access limited to last 3 months: ${roleBasedDateRange.startDate.toISOString()} to ${roleBasedDateRange.endDate.toISOString()}`)
    }

    console.log("🔍 Querying transactions with schoolId:", schoolId)

    // Apply date range restrictions based on role
    const dateRange = getDateRangeForRole(session.user.role)
    if (dateRange) {
      where.date = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      }
    }

    if (type) {
      where.type = type
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { fromTo: { contains: search, mode: 'insensitive' } },
        { 
          coaAccount: { 
            name: { contains: search, mode: 'insensitive' } 
          } 
        },
      ]
    }

    // Handle period parameter for date filtering
    if (period && !month) {
      const now = new Date()
      let startDate: Date
      let endDate: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
          break
        case 'thisWeek':
          const dayOfWeek = now.getDay()
          startDate = new Date(now)
          startDate.setDate(now.getDate() - dayOfWeek)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
          break
        case 'last3Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
          break
        case 'last6Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
          break
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1)
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
          break
        case 'allTime':
          startDate = new Date(2020, 0, 1)
          break
        default:
          // Default to last 6 months
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      }
      
      // Don't override TREASURER restrictions
      if (session.user.role !== 'TREASURER') {
        where.date = {
          gte: startDate,
          lte: endDate,
        }
      }
    } else if (month) {
      const startDate = new Date(`${month}-01`)
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        category: {
          select: {
            name: true,
            type: true
          }
        },
        createdBy: {
          select: { name: true, email: true }
        }
      }
    })
    
    // Transform data untuk memastikan struktur yang konsisten
    const formattedTransactions = transactions.map(transaction => ({
      ...transaction,
      categoryName: transaction.category?.name || 'Tidak ada kategori',
      name: transaction.fromTo || transaction.description || 'Tidak ada nama',
      // Pastikan amount dalam format yang benar
      amount: Number(transaction.amount)
    }))

    console.log(`✅ Returning ${formattedTransactions.length} transactions for school ${schoolId}`)
    if (formattedTransactions.length > 0) {
      console.log("📄 Sample transaction:", {
        id: formattedTransactions[0].id,
        type: formattedTransactions[0].type,
        amount: formattedTransactions[0].amount,
        description: formattedTransactions[0].description,
        categoryName: formattedTransactions[0].categoryName
      })
    }

    const response = NextResponse.json({ transactions: formattedTransactions })
    // Disable caching untuk memastikan data selalu fresh dari database
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log("Transaction POST body:", body)
    
    // Get schoolId from body first, then session, then database lookup
    let schoolId: string | null = body.schoolId || session.user.schoolId || null
    
    if (!schoolId) {
      console.log("⚠️  No schoolId in body or session, looking up user in database...")
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { schoolProfileId: true }
      })
      schoolId = user?.schoolProfileId || null
      console.log("📍 Found schoolId from database:", schoolId)
    }
    
    if (!schoolId) {
      return NextResponse.json(
        { error: 'School ID is required' },
        { status: 400 }
      )
    }
    
    // Handle category mapping for COA codes or category names
    let categoryId = body.categoryId;
    
    // Check if categoryId is a COA code (numeric string starting with 1-5)
    if (/^[1-5]\d{3}$/.test(categoryId)) {
      // Determine category name based on the first digit
      const firstDigit = categoryId[0];
      let categoryName: string;
      
      switch (firstDigit) {
        case '1':
          categoryName = 'Aktiva';
          break;
        case '2':
          categoryName = 'Kewajiban';
          break;
        case '3':
          categoryName = 'Modal';
          break;
        case '4':
          categoryName = 'Pendapatan';
          break;
        case '5':
          categoryName = 'Beban';
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid COA code' },
            { status: 400 }
          )
      }
      
      console.log("🏷️  Mapping COA code:", categoryId, "->", categoryName, "for school:", schoolId)
      
      // Find or create category in database
      let category = await prisma.category.findFirst({
        where: {
          name: categoryName,
          type: body.type,
          schoolProfileId: schoolId
        }
      });
      
      if (!category) {
        // Create new category
        console.log("🆕 Creating new category:", categoryName)
        category = await prisma.category.create({
          data: {
            name: categoryName,
            type: body.type,
            schoolProfileId: schoolId
          }
        });
        console.log("✅ Created category with ID:", category.id)
      } else {
        console.log("♻️  Using existing category with ID:", category.id)
      }
      
      categoryId = category.id;
    } else if (typeof categoryId === 'string' && categoryId.length > 0) {
      // If categoryId is a string name (not a valid UUID), create or find category
      if (!categoryId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.log("🏷️  Finding/creating category by name:", categoryId, "for school:", schoolId)
        
        let category = await prisma.category.findFirst({
          where: {
            name: categoryId,
            type: body.type,
            schoolProfileId: schoolId
          }
        });
        
        if (!category) {
          console.log("🆕 Creating new category:", categoryId)
          category = await prisma.category.create({
            data: {
              name: categoryId,
              type: body.type,
              description: `Auto-created from transaction`,
              schoolProfileId: schoolId
            }
          });
          console.log("✅ Created category with ID:", category.id)
        } else {
          console.log("♻️  Using existing category with ID:", category.id)
        }
        
        categoryId = category.id;
      }
    }
    
    const validatedData = transactionSchema.parse({
      ...body,
      categoryId: categoryId
    });

    console.log("✅ Validated transaction data for school:", schoolId)

    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Generate receipt number
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    
    // Get the last receipt number for this month
    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        schoolProfileId: schoolId,
        receiptNumber: {
          startsWith: `KW-${year}${month}`
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    let counter = 1
    if (lastTransaction) {
      const lastNumber = parseInt(lastTransaction.receiptNumber.split('-')[2])
      counter = lastNumber + 1
    }

    const receiptNumber = `KW-${year}${month}-${String(counter).padStart(3, '0')}`

    const { coaAccountId, schoolId: __, date, ...transactionData } = validatedData
    
    // Verify COA account if provided
    if (coaAccountId) {
      const coaAccount = await prisma.coaAccount.findUnique({
        where: { id: coaAccountId }
      })

      if (!coaAccount || !coaAccount.isActive) {
        return NextResponse.json(
          { error: 'Invalid or inactive COA Account' },
          { status: 400 }
        )
      }
    }
    
    console.log("Creating transaction with:", {
      schoolId,
      userId: user.id,
      categoryId: categoryId,
      coaAccountId,
      receiptNumber
    })

    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        date: new Date(date),
        receiptNumber,
        schoolProfileId: schoolId,
        createdById: user.id,
        categoryId: categoryId, // Use the resolved categoryId
        coaAccountId: coaAccountId || null,
        fromTo: transactionData.fromTo || transactionData.description || 'N/A',
        paymentMethod: transactionData.paymentMethod || 'CASH',
        status: transactionData.status || 'PAID',
        notes: transactionData.notes || null, // Include notes field
      },
      include: {
        category: true,
        coaAccount: true,
        createdBy: {
          select: { name: true, email: true }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'Transaction',
        entityId: transaction.id,
        details: `Created transaction: ${transaction.receiptNumber}`,
        userId: user.id,
        schoolProfileId: schoolId,
      }
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues)
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}