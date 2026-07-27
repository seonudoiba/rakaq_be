import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

export class SupportService {
  private readonly cacheTTL = 300;

  async getAllTickets(filters?: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    assignedToId?: string;
    createdById?: string;
    category?: string;
  }) {
    const cacheKey = `support:tickets:${JSON.stringify(filters)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tickets = await prisma.supportTicket.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.priority && { priority: filters.priority }),
        ...(filters?.assignedToId && { assignedToId: filters.assignedToId }),
        ...(filters?.createdById && { createdById: filters.createdById }),
        ...(filters?.category && { category: filters.category }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(tickets));
    return tickets;
  }

  async getTicketById(id: string) {
    const cacheKey = `support:ticket:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(ticket));
    return ticket;
  }

  async createTicket(data: any) {
    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || 'MEDIUM',
        createdById: data.createdById,
        assignedToId: data.assignedToId,
        status: 'OPEN',
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
      },
    });

    await this.invalidateCache();
    return ticket;
  }

  async updateTicket(id: string, data: any) {
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        assignedToId: data.assignedToId,
        status: data.status,
      },
    });

    await this.invalidateCache(id);
    return ticket;
  }

  async addComment(data: any) {
    const comment = await prisma.supportTicketComment.create({
      data: {
        ticketId: data.ticketId,
        userId: data.userId,
        message: data.message,
        isInternal: data.isInternal || false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    // Update ticket updated_at
    await prisma.supportTicket.update({
      where: { id: data.ticketId },
      data: { updatedAt: new Date() },
    });

    await this.invalidateCache(data.ticketId);
    return comment;
  }

  async resolveTicket(id: string, resolvedById: string) {
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    // Add resolution comment
    await prisma.supportTicketComment.create({
      data: {
        ticketId: id,
        userId: resolvedById,
        message: 'Ticket resolved',
        isInternal: false,
      },
    });

    await this.invalidateCache(id);
    return ticket;
  }

  async closeTicket(id: string) {
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: 'CLOSED',
      },
    });

    await this.invalidateCache(id);
    return ticket;
  }

  async getTicketStatistics() {
    const [total, byStatus, byPriority, byCategory] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['priority'],
        _count: true,
      }),
      prisma.supportTicket.groupBy({
        by: ['category'],
        _count: true,
      }),
    ]);

    const openTickets = await prisma.supportTicket.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    const avgResolutionTime = await prisma.$queryRaw`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
      FROM support_tickets
      WHERE resolved_at IS NOT NULL
    `;

    return {
      total,
      open: openTickets,
      byStatus,
      byPriority,
      byCategory,
      averageResolutionHours: avgResolutionTime[0]?.avg_hours || 0,
    };
  }

  private async invalidateCache(ticketId?: string) {
    if (ticketId) {
      await redis.del(`support:ticket:${ticketId}`);
    }
    const keys = await redis.keys('support:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}