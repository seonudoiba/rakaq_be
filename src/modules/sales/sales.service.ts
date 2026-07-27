import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { logger } from '../../config/logger';
import { AppError } from '../../middleware/errorHandler';
import { InventoryService } from '../inventory/inventory.service';

export class SalesService {
  private readonly cacheTTL = 300; // 5 minutes
  private inventoryService = new InventoryService();

  async getDailyReport(stationId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const cacheKey = `sales:daily:${stationId}:${startOfDay.toISOString()}`;
    
    // Try cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const [sales, totalVolume, totalAmount, byPaymentMethod] = await Promise.all([
      prisma.sale.findMany({
        where: {
          stationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          attendant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          pump: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.sale.aggregate({
        where: {
          stationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          quantity: true,
        },
      }),
      prisma.sale.aggregate({
        where: {
          stationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          totalAmount: true,
        },
      }),
      prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: {
          stationId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: {
          totalAmount: true,
        },
        _count: true,
      }),
    ]);

    // Calculate payment method percentages
    const total = byPaymentMethod.reduce((sum, item) => sum + item._sum.totalAmount!, 0);
    const paymentBreakdown = byPaymentMethod.map((item) => ({
      method: item.paymentMethod,
      amount: item._sum.totalAmount,
      count: item._count,
      percentage: total > 0 ? (item._sum.totalAmount! / total) * 100 : 0,
    }));

    const result = {
      date: startOfDay,
      totalSales: totalAmount._sum.totalAmount || 0,
      totalVolume: totalVolume._sum.quantity || 0,
      transactionCount: sales.length,
      paymentBreakdown,
      transactions: sales,
    };

    // Cache result
    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(result));

    return result;
  }

  async getMonthlyReport(stationId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        SUM(quantity) as total_volume,
        SUM(total_amount) as total_sales,
        payment_method,
        COUNT(*) FILTER (WHERE payment_method = 'CASH') as cash_count,
        COUNT(*) FILTER (WHERE payment_method = 'POS') as pos_count,
        COUNT(*) FILTER (WHERE payment_method = 'TRANSFER') as transfer_count,
        COUNT(*) FILTER (WHERE payment_method = 'CREDIT') as credit_count
      FROM sales
      WHERE station_id = ${stationId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
      GROUP BY DATE(created_at), payment_method
      ORDER BY date DESC
    `;

    return dailyStats;
  }

  async createSale(data: any, userRole?: string) {
    // Log the incoming data for debugging
    console.log('📝 Creating sale with data:', JSON.stringify(data, null, 2));
    
    // Validate required fields
    if (!data.stationId) {
      console.error('❌ stationId is missing from sale data');
      throw new AppError('stationId is required', 400);
    }

    if (!data.productType) {
      throw new AppError('productType is required', 400);
    }

    if (!data.quantity || data.quantity <= 0) {
      throw new AppError('Quantity must be greater than 0', 400);
    }

    if (!data.attendantId) {
      throw new AppError('attendantId is required', 400);
    }

    // Verify station exists
    const station = await prisma.station.findUnique({
      where: { id: data.stationId },
    });

    if (!station) {
      throw new AppError('Station not found', 404);
    }

    let finalProductName = data.productName;
    let finalUnitPrice = data.unitPrice;

    // Enforce official configured price for non-admin and non-regional manager users
    if (userRole !== 'SUPER_ADMIN' && userRole !== 'REGIONAL_MANAGER') {
      const configuredPrices = await this.inventoryService.getProductPrices(data.stationId);
      const configured = configuredPrices.find((p) => p.productType === data.productType);
      if (configured) {
        finalProductName = configured.productName;
        finalUnitPrice = configured.unitPrice;
      }
    }

    if (!finalUnitPrice || finalUnitPrice <= 0) {
      throw new AppError('Unit price must be greater than 0', 400);
    }

    // Create the sale
    const sale = await prisma.sale.create({
      data: {
        stationId: data.stationId,
        pumpId: data.pumpId || null,
        productType: data.productType,
        productName: finalProductName || data.productType,
        quantity: data.quantity,
        unitPrice: finalUnitPrice,
        totalAmount: data.quantity * finalUnitPrice,
        paymentMethod: data.paymentMethod,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        attendantId: data.attendantId,
        status: data.status || 'COMPLETED',
      },
      include: {
        attendant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Invalidate cache
    await this.invalidateCache(data.stationId);

    logger.info(`✅ Sale created: ${sale.id} for station ${data.stationId}`);
    return sale;
  }

  async verifySale(saleId: string, verifierId: string) {
    const sale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        status: 'VERIFIED',
        verifiedById: verifierId,
        verifiedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: verifierId,
        action: 'SALE_VERIFIED',
        resourceType: 'Sale',
        resourceId: saleId,
      },
    });

    return sale;
  }

  async getStationSales(stationId: string, startDate: Date, endDate: Date) {
    const cacheKey = `sales:station:${stationId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const sales = await prisma.sale.findMany({
      where: {
        stationId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        attendant: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        verifiedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    await redis.setex(cacheKey, 600, JSON.stringify(sales));
    return sales;
  }

  async getSalesByProduct(stationId: string, startDate: Date, endDate: Date) {
    const sales = await prisma.sale.groupBy({
      by: ['productType'],
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
      _count: true,
    });

    return sales;
  }

  async getCreditCustomers(stationId: string) {
    const credits = await prisma.sale.groupBy({
      by: ['customerName', 'customerPhone'],
      where: {
        stationId,
        paymentMethod: 'CREDIT',
        status: 'COMPLETED',
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    });

    // Filter out null customers and sort by outstanding balance
    return credits
      .filter((c) => c.customerName)
      .sort((a, b) => (b._sum.totalAmount || 0) - (a._sum.totalAmount || 0));
  }

  private async invalidateCache(stationId: string) {
    const pattern = `sales:*:${stationId}:*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}