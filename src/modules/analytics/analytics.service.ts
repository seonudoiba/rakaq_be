import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';

export class AnalyticsService {
  private readonly cacheTTL = 600; // 10 minutes

  async getStationAnalytics(stationId: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    const cacheKey = `analytics:station:${stationId}:${period}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const [salesData, expenseData, pumpData, tankData] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          stationId,
          createdAt: { gte: startDate },
        },
        _sum: { totalAmount: true, quantity: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: {
          stationId,
          createdAt: { gte: startDate },
          approvedAt: { not: null },
        },
        _sum: { amount: true },
      }),
      prisma.pumpReading.aggregate({
        where: {
          stationId,
          readingDate: { gte: startDate },
        },
        _sum: { litresSold: true, expectedRevenue: true },
      }),
      prisma.tank.findMany({
        where: { stationId },
        select: {
          productType: true,
          currentLevel: true,
          capacity: true,
          percentage: true,
        },
      }),
    ]);

    // Sales by product
    const salesByProduct = await prisma.sale.groupBy({
      by: ['productType'],
      where: {
        stationId,
        createdAt: { gte: startDate },
      },
      _sum: { totalAmount: true, quantity: true },
    });

    // Sales by payment method
    const salesByPayment = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        stationId,
        createdAt: { gte: startDate },
      },
      _sum: { totalAmount: true },
    });

    // Daily trends
    const dailyTrends = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as sales,
        COUNT(*) as transactions
      FROM sales
      WHERE station_id = ${stationId}
        AND created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    const result = {
      period,
      startDate,
      endDate: now,
      sales: {
        total: salesData._sum.totalAmount || 0,
        volume: salesData._sum.quantity || 0,
        transactions: salesData._count,
        byProduct: salesByProduct,
        byPayment: salesByPayment,
        dailyTrends,
      },
      expenses: {
        total: expenseData._sum.amount || 0,
      },
      pumps: {
        totalLitres: pumpData._sum.litresSold || 0,
        expectedRevenue: pumpData._sum.expectedRevenue || 0,
      },
      tanks: tankData,
      profit: (salesData._sum.totalAmount || 0) - (expenseData._sum.amount || 0),
      margin: salesData._sum.totalAmount ? 
        ((salesData._sum.totalAmount - expenseData._sum.amount) / salesData._sum.totalAmount) * 100 : 0,
    };

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));
    return result;
  }

  async getRegionalAnalytics(regionId: string, period: 'weekly' | 'monthly' | 'yearly') {
    const stations = await prisma.station.findMany({
      where: { regionId },
      select: { id: true, name: true },
    });

    const stationIds = stations.map(s => s.id);
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const [salesData, expenseData, stationPerformance] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          stationId: { in: stationIds },
          createdAt: { gte: startDate },
        },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          stationId: { in: stationIds },
          createdAt: { gte: startDate },
        },
        _sum: { amount: true },
      }),
      prisma.$queryRaw`
        SELECT 
          s.id,
          s.name,
          SUM(sales.total_amount) as total_sales,
          COUNT(sales.id) as transaction_count
        FROM stations s
        LEFT JOIN sales ON s.id = sales.station_id 
          AND sales.created_at >= ${startDate}
        WHERE s.region_id = ${regionId}
        GROUP BY s.id, s.name
        ORDER BY total_sales DESC
      `,
    ]);

    return {
      period,
      startDate,
      endDate: now,
      totalSales: salesData._sum.totalAmount || 0,
      totalExpenses: expenseData._sum.amount || 0,
      profit: (salesData._sum.totalAmount || 0) - (expenseData._sum.amount || 0),
      stationPerformance,
    };
  }

  async getExecutiveAnalytics(period: 'weekly' | 'monthly' | 'yearly') {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'weekly':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const [totalSales, totalExpenses, stationCount, topStations] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: startDate } },
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: { createdAt: { gte: startDate } },
        _sum: { amount: true },
      }),
      prisma.station.count(),
      prisma.$queryRaw`
        SELECT 
          s.id,
          s.name,
          r.name as region,
          SUM(sales.total_amount) as total_sales,
          COUNT(sales.id) as transaction_count
        FROM stations s
        LEFT JOIN sales ON s.id = sales.station_id 
          AND sales.created_at >= ${startDate}
        LEFT JOIN regions r ON s.region_id = r.id
        GROUP BY s.id, s.name, r.name
        ORDER BY total_sales DESC
        LIMIT 10
      `,
    ]);

    // Sales by region
    const salesByRegion = await prisma.$queryRaw`
      SELECT 
        r.name as region,
        SUM(s.total_amount) as total_sales,
        COUNT(s.id) as transaction_count
      FROM regions r
      LEFT JOIN stations st ON r.id = st.region_id
      LEFT JOIN sales s ON st.id = s.station_id AND s.created_at >= ${startDate}
      GROUP BY r.id, r.name
      ORDER BY total_sales DESC
    `;

    return {
      period,
      startDate,
      endDate: now,
      totalSales: totalSales._sum.totalAmount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      profit: (totalSales._sum.totalAmount || 0) - (totalExpenses._sum.amount || 0),
      stationCount,
      topStations,
      salesByRegion,
    };
  }
  
  async getPerformanceMetrics(params: any) {
  return {
    stationId: params.stationId || 'unknown',
    metrics: {
      totalSales: 0,
      totalVolume: 0,
      transactionCount: 0,
      averageTransactionValue: 0,
    },
    trends: { daily: [], weekly: [], monthly: [] }
  };
}
async getTrendsAnalysis(params: any) {
  return { data: [], forecast: [] };
}

async getStationComparison(params: any) {
  return { stations: [], metric: params.metric || 'sales' };
}

async getPredictiveAnalytics(params: any) {
  return { predictions: [], insights: [] };
}

async getRevenueForecast(params: any) {
  return { forecast: [], summary: { totalPredicted: 0 } };
}
}