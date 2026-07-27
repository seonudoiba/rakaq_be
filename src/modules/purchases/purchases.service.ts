import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { PurchaseOrderStatus } from '@prisma/client';

export class PurchasesService {
  private readonly cacheTTL = 300;

  async getAllPurchaseOrders(filters?: {
    status?: PurchaseOrderStatus;
    supplierId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const cacheKey = `purchases:all:${JSON.stringify(filters)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.supplierId && { supplierId: filters.supplierId }),
        ...(filters?.startDate && {
          createdAt: { gte: filters.startDate },
        }),
        ...(filters?.endDate && {
          createdAt: { lte: filters.endDate },
        }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        deliveries: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(orders));
    return orders;
  }

  async getPurchaseOrderById(id: string) {
    const cacheKey = `purchase:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        deliveries: {
          include: {
            locationLogs: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError('Purchase order not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(order));
    return order;
  }

  async createPurchaseOrder(data: any) {
    // Generate order number
    const orderNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierName: data.supplierName,
        supplierId: data.supplierId,
        supplierEmail: data.supplierEmail,
        supplierPhone: data.supplierPhone,
        productType: data.productType,
        volume: data.volume,
        unitCost: data.unitCost,
        totalCost: data.volume * data.unitCost,
        expectedDelivery: data.expectedDelivery,
        status: 'PENDING_APPROVAL',
        createdById: data.createdById,
        notes: data.notes,
      },
    });

    await this.invalidateCache();
    return order;
  }

  async approvePurchaseOrder(id: string, approvedById: string) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById,
        approvedAt: new Date(),
      },
    });

    await this.invalidateCache(id);
    return order;
  }

  async updatePurchaseOrderStatus(id: string, status: PurchaseOrderStatus) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status },
    });

    await this.invalidateCache(id);
    return order;
  }

  async cancelPurchaseOrder(id: string) {
    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.invalidateCache(id);
    return order;
  }

  private async invalidateCache(orderId?: string) {
    if (orderId) {
      await redis.del(`purchase:${orderId}`);
    }
    const keys = await redis.keys('purchases:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async getPurchaseOrderSummary(stationId: string, startDate?: Date, endDate?: Date) {
  const orders = await prisma.purchaseOrder.findMany({
    where: {
      ...(stationId && { stationId }),
      ...(startDate && { createdAt: { gte: startDate } }),
      ...(endDate && { createdAt: { lte: endDate } }),
    },
  });
  
  return {
    totalOrders: orders.length,
    totalCost: orders.reduce((sum, o) => sum + o.totalCost, 0),
    byStatus: [
      { status: 'DRAFT', count: orders.filter(o => o.status === 'DRAFT').length },
      { status: 'PENDING_APPROVAL', count: orders.filter(o => o.status === 'PENDING_APPROVAL').length },
      { status: 'APPROVED', count: orders.filter(o => o.status === 'APPROVED').length },
      { status: 'IN_TRANSIT', count: orders.filter(o => o.status === 'IN_TRANSIT').length },
      { status: 'DELIVERED', count: orders.filter(o => o.status === 'DELIVERED').length },
    ],
  };
}
}