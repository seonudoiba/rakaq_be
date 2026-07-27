import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

export class UsersService {
  private readonly cacheTTL = 600;

  async getAllUsers(filters?: { role?: string; stationId?: string; regionId?: string }) {
    try {
      const cacheKey = `users:all:${JSON.stringify(filters)}`;
      
      // Try to get from cache with error handling
      let cached = null;
      try {
        cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (redisError) {
        console.warn('Redis cache miss or error:', redisError);
      }

      // Build where clause safely
      const where: any = {};
      
      // Only add role filter if it's a valid enum value
      if (filters?.role) {
        // Get all valid role values from the enum
        const validRoles = Object.values(UserRole) as string[];
        
        // Check if the role exists in the UserRole enum
        if (validRoles.includes(filters.role)) {
          // Use type assertion to tell TypeScript this is a valid UserRole
          where.role = filters.role as UserRole;
        } else {
          console.warn(`Invalid role filter: ${filters.role}. Ignoring.`);
          // Don't filter by invalid role
        }
      }

      if (filters?.stationId) {
        where.stationId = filters.stationId;
      }

      if (filters?.regionId) {
        where.regionId = filters.regionId;
      }

      console.log('📊 Fetching users with where clause:', where);

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          station: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          region: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Try to cache the result
      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(users));
      } catch (cacheError) {
        console.warn('Failed to cache users:', cacheError);
      }

      return users;
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  async getUserById(id: string) {
    try {
      const cacheKey = `user:${id}`;
      
      // Try to get from cache with error handling
      let cached = null;
      try {
        cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (redisError) {
        console.warn('Redis cache miss or error:', redisError);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          station: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          region: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(user));
      } catch (cacheError) {
        console.warn('Failed to cache user:', cacheError);
      }

      return user;
    } catch (error) {
      console.error(`Error in getUserById for ID ${id}:`, error);
      throw error;
    }
  }

  async createUser(data: any) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Validate role if provided
    let role = data.role;
    if (role) {
      const validRoles = Object.values(UserRole) as string[];
      if (!validRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}`, 400);
      }
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: role as UserRole,
        stationId: data.stationId,
        regionId: data.regionId,
      },
    });

    // Create settings for user
    await prisma.settings.create({
      data: {
        userId: user.id,
      },
    });

    await this.invalidateCache();
    return user;
  }

  async updateUser(id: string, data: any) {
    // Validate role if provided
    let role = data.role;
    if (role) {
      const validRoles = Object.values(UserRole) as string[];
      if (!validRoles.includes(role)) {
        throw new AppError(`Invalid role: ${role}`, 400);
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: role as UserRole | undefined,
        stationId: data.stationId,
        regionId: data.regionId,
        isActive: data.isActive,
      },
    });

    await this.invalidateCache(id);
    return user;
  }

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        station: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // If user is a station manager, remove them from station
    if (user.role === UserRole.SUPERVISOR && user.station) {
      await prisma.station.update({
        where: { id: user.station.id },
        data: { manager: { disconnect: true } },
      });
    }

    await prisma.user.delete({ where: { id } });
    await this.invalidateCache(id);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  private async invalidateCache(userId?: string) {
    try {
      if (userId) {
        await redis.del(`user:${userId}`);
      }
      const keys = await redis.keys('users:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
      // Don't throw, this is not critical
    }
  }
}