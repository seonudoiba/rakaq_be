import { prisma } from "../../config/database";
import { redis } from "../../config/redis";
import { AppError } from "../../middleware/errorHandler";
import { ExpenseCategory } from "@prisma/client";
import { logger } from "../../config/logger";

export class ExpensesService {
  private readonly cacheTTL = 300;
  async createExpense(data: any) {
    // Generate voucher number
    const voucherNumber = `VCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Handle receiptUrl - if it's a base64 string, store it as is or save to file system
    // For now, we'll store it as a string (you might want to save to S3 or local storage)
    let receiptUrl = data.receiptUrl || null;

    // If receiptUrl is a base64 string, you might want to save it to a file
    // and store the file path instead. For now, we'll store the string.
    // In production, you should save the file to S3 or local storage.

    const expense = await prisma.expense.create({
      data: {
        stationId: data.stationId,
        category: data.category,
        description: data.description,
        amount: data.amount,
        voucherNumber,
        receiptUrl: receiptUrl, // Store as is (could be base64)
        createdById: data.createdById,
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    await this.invalidateCache(data.stationId);
    logger.info(`Expense created: ${expense.id} for station ${data.stationId}`);
    return expense;
  }

async getStationExpenses(
  stationId: string,
  filters?: {
    category?: ExpenseCategory;
    startDate?: Date;
    endDate?: Date;
  },
) {
  try {
    logger.info(`Fetching expenses for station: ${stationId}`, { filters });

    // Build where clause
    const where: any = {
      stationId: stationId,
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      
      if (filters?.startDate) {
        // Start from the beginning of the day
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      
      if (filters?.endDate) {
        // IMPORTANT: End at the end of the day (23:59:59.999)
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    logger.info(`Found ${expenses.length} expenses for station ${stationId}`);
    return expenses;
  } catch (error) {
    logger.error("Error fetching expenses:", error);
    throw error;
  }
}
  async getAllExpenses(filters?: {
    category?: ExpenseCategory;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters?.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters?.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return expenses;
  }
  async getExpenseById(id: string) {
    const expense = await prisma.expense.findUnique({
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!expense) {
      throw new AppError("Expense not found", 404);
    }

    return expense;
  }

  async approveExpense(id: string, approvedById: string) {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        approvedById,
        approvedAt: new Date(),
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    await this.invalidateCache(expense.stationId);
    logger.info(`Expense approved: ${id} by ${approvedById}`);
    return expense;
  }

  async getExpenseSummary(stationId: string, startDate: Date, endDate: Date) {
    const summary = await prisma.expense.groupBy({
      by: ["category"],
      where: {
        stationId,
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

    const total = summary.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0,
    );

    return {
      total,
      breakdown: summary.map((item) => ({
        category: item.category,
        amount: item._sum.amount || 0,
        count: item._count,
        percentage: total > 0 ? ((item._sum.amount || 0) / total) * 100 : 0,
      })),
    };
  }

  async getPendingApprovals(stationId: string) {
    const expenses = await prisma.expense.findMany({
      where: {
        stationId,
        approvedById: null,
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
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return expenses;
  }

  async deleteExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new AppError("Expense not found", 404);
    }

    await prisma.expense.delete({
      where: { id },
    });

    await this.invalidateCache(expense.stationId);
    logger.info(`Expense deleted: ${id}`);
  }

  private async invalidateCache(stationId?: string) {
    if (stationId) {
      const keys = await redis.keys(`expenses:station:${stationId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    // Also clear the summary cache
    const summaryKeys = await redis.keys(`expenses:summary:*`);
    if (summaryKeys.length > 0) {
      await redis.del(...summaryKeys);
    }
  }
}
