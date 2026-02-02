import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDateRangeForRole } from '@/lib/permissions'

// Disable caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log("📊 Reports API - Session user:", {
      id: session.user.id,
      role: session.user.role,
      schoolId: session.user.schoolId
    })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'thisMonth'
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')
    const requestedSchoolId = searchParams.get('schoolId')

    console.log("📅 Reports API - Period requested:", period)
    console.log("🏫 Reports API - Requested schoolId:", requestedSchoolId)

    // Get schoolId from request param, session, or database
    let schoolId: string | null = requestedSchoolId || session.user.schoolId || null
    
    if (!schoolId && !requestedSchoolId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { schoolProfileId: true }
      })
      schoolId = user?.schoolProfileId || null
    }

    // For Super Admin without schoolId, show all data (unless specific school requested)
    const schoolFilter = schoolId ? { schoolProfileId: schoolId } : {}
    
    console.log("🏫 Reports API - School filter:", schoolFilter)

    // Apply role-based date restrictions
    const roleBasedDateRange = getDateRangeForRole(session.user.role)
    
    let startDate: Date
    let endDate: Date
    
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      endDate = new Date(customEndDate)
      
      // ENFORCE role-based restrictions even for custom dates
      if (session.user.role === 'TREASURER' && roleBasedDateRange) {
        const maxStartDate = roleBasedDateRange.startDate
        if (startDate < maxStartDate) {
          console.log(`⚠️ TREASURER date restricted: requested ${startDate.toISOString()}, maximum allowed ${maxStartDate.toISOString()}`)
          startDate = maxStartDate
        }
      }
    } else {
      // Use predefined periods with role restrictions
      if (roleBasedDateRange && session.user.role === 'TREASURER') {
        // For TREASURER, always use role-based range regardless of period
        startDate = roleBasedDateRange.startDate
        endDate = roleBasedDateRange.endDate
        console.log(`🔒 TREASURER access limited to last 3 months: ${startDate.toISOString()} to ${endDate.toISOString()}`)
      } else {
        // Original period logic for SUPER_ADMIN and others
        const now = new Date()
        
        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
            break
          case 'thisWeek':
            const today = now.getDay()
            const mondayOffset = today === 0 ? 6 : today - 1 // Adjust for Sunday = 0
            startDate = new Date(now)
            startDate.setDate(now.getDate() - mondayOffset)
            startDate.setHours(0, 0, 0, 0)
            endDate = new Date(startDate)
            endDate.setDate(startDate.getDate() + 6)
            endDate.setHours(23, 59, 59, 999)
            break
          case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
            break
          case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1)
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
            break
          case 'last30days':
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999)
            startDate = new Date(endDate)
            startDate.setDate(startDate.getDate() - 30)
            startDate.setHours(0, 0, 0, 0)
            break
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
        }
      }
    }

    // Handle custom date range from export
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(customEndDate)
      endDate.setHours(23, 59, 59, 999)
      console.log("📅 Using custom date range:", { startDate, endDate })
    } else if (roleBasedDateRange) {
      startDate = roleBasedDateRange.startDate
      endDate = roleBasedDateRange.endDate
    } else {
      const now = new Date()
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
          endDate = new Date(now)
          endDate.setHours(23, 59, 59, 999)
          break
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          break
        case 'lastMonth':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
          break
        case 'last3Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          break
        case 'last6Months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          break
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1)
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
          break
        case 'lastYear':
          startDate = new Date(now.getFullYear() - 1, 0, 1)
          endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
          break
        case 'allTime':
          // Set to a very old date to get all data
          startDate = new Date(2020, 0, 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
          break
        default:
          // Default to last 6 months
          startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      }
    }

    console.log("📆 Reports API - Date range:", {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    })

    const where: any = {
      ...schoolFilter,
      date: {
        gte: startDate,
        lte: endDate,
      }
    }

    console.log("🔍 Reports API - Query where:", where)

    // Get aggregated income and expense
    const [incomeAgg, expenseAgg, transactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, type: 'INCOME', status: 'PAID' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'EXPENSE', status: 'PAID' },
        _sum: { amount: true },
        _count: true
      }),
      prisma.transaction.findMany({
        where,
        include: { 
          category: true,
          coaAccount: true,
          createdBy: {
            select: { name: true, email: true }
          }
        },
        orderBy: { date: 'desc' },
        take: 100 // Limit to recent 100 transactions
      })
    ])

    const totalIncome = Number(incomeAgg._sum.amount || 0)
    const totalExpense = Number(expenseAgg._sum.amount || 0)
    const balance = totalIncome - totalExpense

    console.log("💰 Reports API - Calculated totals:", {
      totalIncome,
      totalExpense,
      balance,
      incomeCount: incomeAgg._count,
      expenseCount: expenseAgg._count
    })

    // Group transactions by category
    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}
    
    // Group transactions by COA Account
    const incomeByCOA: Record<string, { name: string; code: string; amount: number }> = {}
    const expenseByCOA: Record<string, { name: string; code: string; amount: number }> = {}

    transactions.forEach(transaction => {
      const categoryName = transaction.category?.name || 'Uncategorized'
      const amount = Number(transaction.amount)
      
      if (transaction.type === 'INCOME') {
        incomeByCategory[categoryName] = (incomeByCategory[categoryName] || 0) + amount
        
        // Group by COA Account
        if (transaction.coaAccount) {
          const coaKey = transaction.coaAccount.id
          if (!incomeByCOA[coaKey]) {
            incomeByCOA[coaKey] = {
              name: transaction.coaAccount.name,
              code: transaction.coaAccount.code,
              amount: 0
            }
          }
          incomeByCOA[coaKey].amount += amount
        }
      } else {
        expenseByCategory[categoryName] = (expenseByCategory[categoryName] || 0) + amount
        
        // Group by COA Account
        if (transaction.coaAccount) {
          const coaKey = transaction.coaAccount.id
          if (!expenseByCOA[coaKey]) {
            expenseByCOA[coaKey] = {
              name: transaction.coaAccount.name,
              code: transaction.coaAccount.code,
              amount: 0
            }
          }
          expenseByCOA[coaKey].amount += amount
        }
      }
    })

    // Get monthly trend (last 6 months)
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1)
      const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 0, 23, 59, 59, 999)

      const monthWhere = {
        ...schoolFilter,
        date: { gte: monthStart, lte: monthEnd }
      }

      const [monthIncome, monthExpense] = await Promise.all([
        prisma.transaction.aggregate({
          where: { ...monthWhere, type: 'INCOME', status: 'PAID' },
          _sum: { amount: true }
        }),
        prisma.transaction.aggregate({
          where: { ...monthWhere, type: 'EXPENSE', status: 'PAID' },
          _sum: { amount: true }
        })
      ])

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        income: Number(monthIncome._sum.amount || 0),
        expense: Number(monthExpense._sum.amount || 0)
      })
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalIncome,
        totalExpense,
        balance,
        transactionCount: incomeAgg._count + expenseAgg._count,
        incomeCount: incomeAgg._count,
        expenseCount: expenseAgg._count
      },
      incomeByCategory,
      expenseByCategory,
      incomeByCOA: Object.values(incomeByCOA).sort((a, b) => b.amount - a.amount),
      expenseByCOA: Object.values(expenseByCOA).sort((a, b) => b.amount - a.amount),
      monthlyTrend,
      transactions,
      period: {
        start: startDate,
        end: endDate
      },
      dateRestrictions: roleBasedDateRange ? {
        hasRestrictions: true,
        maxMonths: 3,
        role: session.user.role
      } : {
        hasRestrictions: false,
        role: session.user.role
      }
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
