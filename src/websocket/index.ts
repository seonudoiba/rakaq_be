import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { env } from '../config/environment';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { redis } from '../config/redis';

// ============= TYPES =============
interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  stationId?: string;
  regionId?: string;
}

interface SubscriptionData {
  userId: string;
  stationId?: string;
  regionId?: string;
}

// ============= WEBSOCKET SERVER =============
export class WebSocketServer {
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map();
  private stationSubscribers: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer) {
    this.io = new Server(server, {
      cors: {
        origin: env.FRONTEND_URL,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = verify(token, env.JWT_SECRET) as any;
        
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            role: true,
            stationId: true,
            regionId: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.stationId = user.stationId || undefined;
        socket.regionId = user.regionId || undefined;

        next();
      } catch (error) {
        logger.error('WebSocket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.userId!;
      logger.info(`User ${userId} connected to WebSocket`);

      this.addUserSocket(userId, socket.id);
      this.sendInitialData(socket);

      socket.on('join:station', (stationId: string) => {
        this.joinStation(socket, stationId);
      });

      socket.on('leave:station', (stationId: string) => {
        this.leaveStation(socket, stationId);
      });

      socket.on('join:region', (regionId: string) => {
        if (socket.userRole === 'REGIONAL_MANAGER' && socket.regionId === regionId) {
          this.joinRegion(socket, regionId);
        }
      });

      socket.on('subscribe:updates', (data: SubscriptionData) => {
        this.handleSubscription(socket, data);
      });

      socket.on('disconnect', () => {
        logger.info(`User ${userId} disconnected`);
        this.removeUserSocket(userId, socket.id);
        this.cleanupSubscriptions(socket.id);
      });
    });
  }

  private setupErrorHandling(): void {
    this.io.on('error', (error) => {
      logger.error('WebSocket server error:', error);
    });
  }

  // ============= USER SOCKET MANAGEMENT =============
  private addUserSocket(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
  }

  private removeUserSocket(userId: string, socketId: string): void {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  private getSocketIds(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  // ============= STATION SUBSCRIPTION MANAGEMENT =============
  private joinStation(socket: AuthenticatedSocket, stationId: string): void {
    if (!this.stationSubscribers.has(stationId)) {
      this.stationSubscribers.set(stationId, new Set());
    }
    this.stationSubscribers.get(stationId)!.add(socket.id);
    socket.join(`station:${stationId}`);
    logger.info(`Socket ${socket.id} joined station ${stationId}`);
  }

  private leaveStation(socket: AuthenticatedSocket, stationId: string): void {
    const subscribers = this.stationSubscribers.get(stationId);
    if (subscribers) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        this.stationSubscribers.delete(stationId);
      }
    }
    socket.leave(`station:${stationId}`);
    logger.info(`Socket ${socket.id} left station ${stationId}`);
  }

  private joinRegion(socket: AuthenticatedSocket, regionId: string): void {
    socket.join(`region:${regionId}`);
    logger.info(`Socket ${socket.id} joined region ${regionId}`);
  }

  private handleSubscription(socket: AuthenticatedSocket, data: SubscriptionData): void {
    if (data.stationId) {
      this.joinStation(socket, data.stationId);
    }
    if (data.regionId) {
      this.joinRegion(socket, data.regionId);
    }
  }

  private cleanupSubscriptions(socketId: string): void {
    for (const [stationId, subscribers] of this.stationSubscribers) {
      if (subscribers.has(socketId)) {
        subscribers.delete(socketId);
        if (subscribers.size === 0) {
          this.stationSubscribers.delete(stationId);
        }
      }
    }
  }

  // ============= SEND INITIAL DATA =============
  private async sendInitialData(socket: AuthenticatedSocket): Promise<void> {
    try {
      const userId = socket.userId!;
      
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      socket.emit('initial:notifications', notifications);

      if (socket.stationId) {
        const alerts = await this.getStationAlerts(socket.stationId);
        socket.emit('initial:alerts', alerts);
      }

    } catch (error) {
      logger.error('Error sending initial data:', error);
    }
  }

  private async getStationAlerts(stationId: string): Promise<any[]> {
    const alerts: any[] = [];

    const tanks = await prisma.tank.findMany({
      where: { stationId },
    });

    for (const tank of tanks) {
      if (tank.percentage < 20) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: 'CRITICAL',
          message: `${tank.name} is at ${tank.percentage}% capacity`,
          data: tank,
          timestamp: new Date().toISOString(),
        });
      } else if (tank.percentage < 35) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: 'WARNING',
          message: `${tank.name} is at ${tank.percentage}% capacity`,
          data: tank,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  // ============= BROADCAST METHODS =============
  sendToUser(userId: string, event: string, data: any): void {
    const socketIds = this.getSocketIds(userId);
    for (const socketId of socketIds) {
      this.io.to(socketId).emit(event, data);
    }
  }

  sendToStation(stationId: string, event: string, data: any): void {
    this.io.to(`station:${stationId}`).emit(event, data);
  }

  sendToRegion(regionId: string, event: string, data: any): void {
    this.io.to(`region:${regionId}`).emit(event, data);
  }

  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
  }

  // ============= REAL-TIME UPDATE METHODS =============
  sendTankUpdate(stationId: string, tankData: any): void {
    this.sendToStation(stationId, 'tank:update', {
      ...tankData,
      timestamp: new Date().toISOString(),
    });

    this.broadcast('tank:global', {
      stationId,
      ...tankData,
      timestamp: new Date().toISOString(),
    });
  }

  async sendSaleUpdate(stationId: string, saleData: any): Promise<void> {
    this.sendToStation(stationId, 'sale:new', {
      ...saleData,
      timestamp: new Date().toISOString(),
    });

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { regionId: true },
    });

    if (station?.regionId) {
      this.sendToRegion(station.regionId, 'sale:regional', {
        stationId,
        ...saleData,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async sendDeliveryUpdate(deliveryId: string, data: any): Promise<void> {
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      select: { stationId: true },
    });

    if (delivery?.stationId) {
      this.sendToStation(delivery.stationId, 'delivery:update', {
        deliveryId,
        ...data,
        timestamp: new Date().toISOString(),
      });
    }
  }

  sendNotification(userId: string, notification: any): void {
    this.sendToUser(userId, 'notification:new', notification);
  }

  sendAlert(userId: string, alert: any): void {
    this.sendToUser(userId, 'alert:new', alert);
  }

  sendSystemStatus(status: any): void {
    this.broadcast('system:status', {
      ...status,
      timestamp: new Date().toISOString(),
    });
  }

  // ============= CLEANUP =============
  public close(): void {
    this.io.close(() => {
      logger.info('WebSocket server closed');
    });
  }

  // ============= GET STATUS =============
  public getStatus(): any {
    return {
      connections: this.io.engine.clientsCount,
      userSockets: this.userSockets.size,
      stationSubscriptions: this.stationSubscribers.size,
      rooms: this.io.sockets.adapter.rooms.size,
    };
  }
}

// ============= SINGLETON INSTANCE =============
let wsInstance: WebSocketServer | null = null;

export const initializeWebSocket = (server: HTTPServer): WebSocketServer => {
  if (!wsInstance) {
    wsInstance = new WebSocketServer(server);
  }
  return wsInstance;
};

export const getWebSocketServer = (): WebSocketServer | null => {
  return wsInstance;
};

export default WebSocketServer;