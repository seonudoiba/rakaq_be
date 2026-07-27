import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';

export class StationsService {
  private readonly cacheTTL = 600;

  async getAllStations(filters?: { regionId?: string; userId?: string }) {
    try {
      console.log('🔍 [getAllStations] Starting with filters:', filters);
      
      const cacheKey = `stations:all:${JSON.stringify(filters)}`;
      console.log('🔍 [getAllStations] Cache key:', cacheKey);
      
      // Try to get from cache with error handling
      let cached = null;
      try {
        console.log('🔍 [getAllStations] Attempting Redis get...');
        cached = await redis.get(cacheKey);
        if (cached) {
          console.log('✅ [getAllStations] Cache hit');
          return JSON.parse(cached);
        }
        console.log('ℹ️ [getAllStations] Cache miss');
      } catch (redisError) {
        console.warn('⚠️ [getAllStations] Redis error:', redisError);
      }

      // Build where clause
      const where: any = {};
      if (filters?.regionId) {
        where.regionId = filters.regionId;
      }
      console.log('🔍 [getAllStations] Where clause:', where);

      console.log('🔍 [getAllStations] Querying database...');
      const stations = await prisma.station.findMany({
        where,
        include: {
          region: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          tanks: {
            select: {
              id: true,
              name: true,
              productType: true,
              capacity: true,
              currentLevel: true,
              percentage: true,
              status: true,
            },
          },
          pumps: {
            select: {
              id: true,
              pumpNumber: true,
              productType: true,
              isActive: true,
            },
          },
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      console.log(`✅ [getAllStations] Found ${stations.length} stations`);

      // Try to cache the result
      try {
        console.log('🔍 [getAllStations] Attempting Redis set...');
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(stations));
        console.log('✅ [getAllStations] Cache set successful');
      } catch (cacheError) {
        console.warn('⚠️ [getAllStations] Failed to cache:', cacheError);
      }

      return stations;
    } catch (error) {
      console.error('❌ [getAllStations] Error:', error);
      console.error('❌ [getAllStations] Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  }

  async getStationById(id: string) {
    try {
      console.log(`🔍 [getStationById] Getting station ${id}`);
      
      const cacheKey = `station:${id}`;
      
      // Try to get from cache with error handling
      let cached = null;
      try {
        cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`✅ [getStationById] Cache hit for ${id}`);
          return JSON.parse(cached);
        }
        console.log(`ℹ️ [getStationById] Cache miss for ${id}`);
      } catch (redisError) {
        console.warn(`⚠️ [getStationById] Redis error for ${id}:`, redisError);
      }

      console.log(`🔍 [getStationById] Querying database for ${id}...`);
      const station = await prisma.station.findUnique({
        where: { id },
        include: {
          region: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          tanks: {
            select: {
              id: true,
              name: true,
              productType: true,
              capacity: true,
              currentLevel: true,
              percentage: true,
              status: true,
              lastReadingAt: true,
            },
          },
          pumps: {
            select: {
              id: true,
              pumpNumber: true,
              productType: true,
              openingMeter: true,
              closingMeter: true,
              isActive: true,
            },
          },
          users: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      });

      if (!station) {
        console.log(`❌ [getStationById] Station ${id} not found`);
        throw new AppError('Station not found', 404);
      }
      console.log(`✅ [getStationById] Found station ${id}`);

      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(station));
        console.log(`✅ [getStationById] Cache set for ${id}`);
      } catch (cacheError) {
        console.warn(`⚠️ [getStationById] Failed to cache ${id}:`, cacheError);
      }

      return station;
    } catch (error) {
      console.error(`❌ [getStationById] Error for ID ${id}:`, error);
      throw error;
    }
  }

  async createStation(data: any) {
    try {
      console.log('🔍 [createStation] Creating station with data:', data);
      
      // Check if station code already exists
      const existingStation = await prisma.station.findUnique({
        where: { code: data.code },
      });

      if (existingStation) {
        throw new AppError('Station with this code already exists', 409);
      }

      const station = await prisma.station.create({
        data: {
          name: data.name,
          code: data.code,
          address: data.address,
          city: data.city,
          state: data.state,
          regionId: data.regionId,
          phone: data.phone || null,
          email: data.email || null,
          openingTime: data.openingTime || '08:00',
          closingTime: data.closingTime || '18:00',
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
        },
      });
      console.log(`✅ [createStation] Created station ${station.id}`);

      // If managerId is provided, update the user to be the manager
      if (data.managerId) {
        console.log(`🔍 [createStation] Assigning manager ${data.managerId}`);
        await prisma.user.update({
          where: { id: data.managerId },
          data: { 
            managedStationId: station.id,
          },
        });
        console.log(`✅ [createStation] Manager ${data.managerId} assigned`);
      }

      await this.invalidateCache();
      return station;
    } catch (error) {
      console.error('❌ [createStation] Error:', error);
      throw error;
    }
  }

  async updateStation(id: string, data: any) {
    try {
      console.log(`🔍 [updateStation] Updating station ${id} with:`, data);
      
      // Check if station exists
      const existingStation = await prisma.station.findUnique({
        where: { id },
        include: { manager: true },
      });

      if (!existingStation) {
        throw new AppError('Station not found', 404);
      }

      // Check if code is being changed and already exists
      if (data.code && data.code !== existingStation.code) {
        const codeExists = await prisma.station.findUnique({
          where: { code: data.code },
        });
        if (codeExists) {
          throw new AppError('Station with this code already exists', 409);
        }
      }

      // Update station
      const station = await prisma.station.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          address: data.address,
          city: data.city,
          state: data.state,
          regionId: data.regionId,
          phone: data.phone || null,
          email: data.email || null,
          openingTime: data.openingTime || '08:00',
          closingTime: data.closingTime || '18:00',
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
        },
      });
      console.log(`✅ [updateStation] Updated station ${id}`);

      // Handle manager change
      if (data.managerId !== existingStation.manager?.id) {
        // Remove old manager if exists
        if (existingStation.manager) {
          console.log(`🔍 [updateStation] Removing manager ${existingStation.manager.id}`);
          await prisma.user.update({
            where: { id: existingStation.manager.id },
            data: { managedStationId: null },
          });
        }

        // Assign new manager if provided
        if (data.managerId) {
          console.log(`🔍 [updateStation] Assigning manager ${data.managerId}`);
          await prisma.user.update({
            where: { id: data.managerId },
            data: { 
              managedStationId: station.id,
            },
          });
        }
      }

      await this.invalidateCache(id);
      return station;
    } catch (error) {
      console.error(`❌ [updateStation] Error for ID ${id}:`, error);
      throw error;
    }
  }

  async deleteStation(id: string) {
    try {
      console.log(`🔍 [deleteStation] Deleting station ${id}`);
      
      const station = await prisma.station.findUnique({
        where: { id },
        include: {
          tanks: true,
          pumps: true,
          users: true,
        },
      });

      if (!station) {
        throw new AppError('Station not found', 404);
      }

      // Remove station from all users
      if (station.users.length > 0) {
        console.log(`🔍 [deleteStation] Removing station from ${station.users.length} users`);
        await prisma.user.updateMany({
          where: { stationId: id },
          data: { stationId: null },
        });
      }

      // Delete station
      await prisma.station.delete({
        where: { id },
      });
      console.log(`✅ [deleteStation] Deleted station ${id}`);

      await this.invalidateCache(id);
    } catch (error) {
      console.error(`❌ [deleteStation] Error for ID ${id}:`, error);
      throw error;
    }
  }

  private async invalidateCache(stationId?: string) {
    try {
      if (stationId) {
        await redis.del(`station:${stationId}`);
      }
      const keys = await redis.keys('stations:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      console.log('✅ [invalidateCache] Cache invalidated');
    } catch (error) {
      console.warn('⚠️ [invalidateCache] Failed to invalidate cache:', error);
    }
  }
}