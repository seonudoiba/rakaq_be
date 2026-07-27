import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';

export class RegionsService {
  private readonly cacheTTL = 600;

  async getAllRegions() {
    const cacheKey = 'regions:all';
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const regions = await prisma.region.findMany({
      include: {
        stations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(regions));
    return regions;
  }

  async getRegionById(id: string) {
    const cacheKey = `regions:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        stations: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            city: true,
            state: true,
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

    if (!region) {
      throw new AppError('Region not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(region));
    return region;
  }

  async createRegion(data: { name: string; code: string; description?: string }) {
    const existingRegion = await prisma.region.findUnique({
      where: { code: data.code },
    });

    if (existingRegion) {
      throw new AppError('Region with this code already exists', 409);
    }

    const region = await prisma.region.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
      },
    });

    await this.invalidateCache();
    return region;
  }

  async updateRegion(id: string, data: { name?: string; code?: string; description?: string }) {
    const region = await prisma.region.update({
      where: { id },
      data,
    });

    await this.invalidateCache(id);
    return region;
  }

  async deleteRegion(id: string) {
    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        stations: {
          select: { id: true },
        },
        users: {
          select: { id: true },
        },
      },
    });

    if (!region) {
      throw new AppError('Region not found', 404);
    }

    if (region.stations.length > 0) {
      throw new AppError('Cannot delete region with existing stations. Remove stations first.', 400);
    }

    if (region.users.length > 0) {
      throw new AppError('Cannot delete region with existing users. Remove users first.', 400);
    }

    await prisma.region.delete({ where: { id } });
    await this.invalidateCache(id);
  }

  private async invalidateCache(regionId?: string) {
    if (regionId) {
      await redis.del(`regions:${regionId}`);
    }
    await redis.del('regions:all');
  }
}