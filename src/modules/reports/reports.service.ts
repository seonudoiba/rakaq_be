import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';

export class ReportsService {
  private readonly cacheTTL = 600;

  async generateSalesReport(params: {
    stationId?: string;
    startDate: Date;
    endDate: Date;
    groupBy?: 'daily' | 'weekly' | 'monthly';
    productType?: string;
  }) {
    const { stationId, startDate, endDate, groupBy = 'daily', productType } = params;

    const salesData = await prisma.sale.groupBy({
      by: [groupBy === 'daily' ? 'createdAt' : 'createdAt'],
      where: {
        ...(stationId && { stationId }),
        ...(productType && { productType }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
      _count: true,
    });

    // Get payment method breakdown
    const paymentBreakdown = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        ...(stationId && { stationId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // Get product breakdown
    const productBreakdown = await prisma.sale.groupBy({
      by: ['productType', 'productName'],
      where: {
        ...(stationId && { stationId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
    });

    const total = salesData.reduce((sum, item) => sum + (item._sum.totalAmount || 0), 0);

    return {
      summary: {
        totalSales: total,
        totalVolume: salesData.reduce((sum, item) => sum + (item._sum.quantity || 0), 0),
        transactionCount: salesData.reduce((sum, item) => sum + item._count, 0),
        averageTransactionValue: salesData.length > 0 ? total / salesData.length : 0,
      },
      paymentBreakdown,
      productBreakdown,
      dailyBreakdown: salesData,
      dateRange: { startDate, endDate },
    };
  }

  async generateFinancialReport(params: {
    stationId?: string;
    startDate: Date;
    endDate: Date;
  }) {
    const { stationId, startDate, endDate } = params;

    // Get sales data
    const sales = await prisma.sale.aggregate({
      where: {
        ...(stationId && { stationId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // Get expenses data
    const expenses = await prisma.expense.aggregate({
      where: {
        ...(stationId && { stationId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...(stationId && { stationId }),
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    // Get profit/loss
    const totalRevenue = sales._sum.totalAmount || 0;
    const totalExpenses = expenses._sum.amount || 0;
    const profit = totalRevenue - totalExpenses;

    return {
      summary: {
        totalRevenue,
        totalExpenses,
        profit,
        profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
        transactionCount: sales._count,
        expenseCount: expenses._count,
      },
      expensesByCategory,
      dateRange: { startDate, endDate },
    };
  }

  async generateInventoryReport(params: {
    stationId?: string;
    productType?: string;
  }) {
    const { stationId, productType } = params;

    const tanks = await prisma.tank.findMany({
      where: {
        ...(stationId && { stationId }),
        ...(productType && { productType }),
      },
      include: {
        station: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    // Get inventory movement
    const movement = await prisma.inventoryLog.groupBy({
      by: ['productType', 'reason'],
      where: {
        ...(stationId && { stationId }),
        ...(productType && { productType }),
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      _sum: {
        adjustment: true,
      },
    });

    // Get low stock alerts
    const lowStock = tanks.filter(tank => tank.percentage < 20);

    return {
      tanks: tanks.map(tank => ({
        ...tank,
        status: tank.percentage > 60 ? 'HEALTHY' :
                tank.percentage > 30 ? 'WARNING' : 'CRITICAL',
      })),
      summary: {
        totalTanks: tanks.length,
        totalCapacity: tanks.reduce((sum, t) => sum + t.capacity, 0),
        totalCurrentLevel: tanks.reduce((sum, t) => sum + t.currentLevel, 0),
        averagePercentage: tanks.reduce((sum, t) => sum + t.percentage, 0) / (tanks.length || 1),
        lowStockCount: lowStock.length,
      },
      movement,
      lowStock,
    };
  }

  async generateStationReport(params: {
    stationId: string;
    startDate: Date;
    endDate: Date;
  }) {
    const { stationId, startDate, endDate } = params;

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      include: {
        region: true,
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        tanks: true,
        pumps: true,
      },
    });

    if (!station) {
      throw new AppError('Station not found', 404);
    }

    // Get sales performance
    const sales = await prisma.sale.aggregate({
      where: {
        stationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalAmount: true,
        quantity: true,
      },
      _count: true,
    });

    // Get daily sales trend
    const dailyTrend = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(total_amount) as total_sales,
        SUM(quantity) as total_volume
      FROM sales
      WHERE station_id = ${stationId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Get top products
    const topProducts = await prisma.sale.groupBy({
      by: ['productType', 'productName'],
      where: {
        stationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        totalAmount: true,
      },
      orderBy: {
        _sum: {
          totalAmount: 'desc',
        },
      },
      take: 5,
    });

    return {
      station,
      performance: {
        totalSales: sales._sum.totalAmount || 0,
        totalVolume: sales._sum.quantity || 0,
        transactionCount: sales._count,
        averageDailySales: (sales._sum.totalAmount || 0) / 30, // Assuming monthly report
      },
      dailyTrend,
      topProducts,
      dateRange: { startDate, endDate },
    };
  }

  async exportReport(reportType: string, data: any, format: string) {
    // Implementation for PDF, Excel, CSV export
    // This would use libraries like pdfkit, exceljs, etc.
    return {
      data,
      format,
      generatedAt: new Date(),
      reportType,
    };
  }
}