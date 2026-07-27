import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';

export class EmployeesService {
  private readonly cacheTTL = 600;

  async getAllEmployees(filters?: {
    stationId?: string;
    department?: string;
    position?: string;
  }) {
    const cacheKey = `employees:all:${JSON.stringify(filters)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const employees = await prisma.employee.findMany({
      where: {
        ...(filters?.stationId && { stationId: filters.stationId }),
        ...(filters?.department && { department: filters.department }),
        ...(filters?.position && { position: filters.position }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            isActive: true,
            profileImage: true,
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
      orderBy: { createdAt: 'desc' },
    });

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(employees));
    return employees;
  }

  async getEmployeeById(id: string) {
    const cacheKey = `employee:${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
            isActive: true,
            profileImage: true,
            createdAt: true,
          },
        },
        station: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
          },
        },
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(employee));
    return employee;
  }

  async createEmployee(data: any) {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if employee already exists for this user
    const existingEmployee = await prisma.employee.findFirst({
      where: { userId: data.userId },
    });

    if (existingEmployee) {
      throw new AppError('Employee already exists for this user', 409);
    }

    // Generate employee ID
    const employeeId = `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const employee = await prisma.employee.create({
      data: {
        userId: data.userId,
        stationId: data.stationId,
        employeeId,
        position: data.position,
        department: data.department,
        hireDate: new Date(data.hireDate),
        salary: data.salary,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
      },
    });

    // Update user role if needed
    if (data.role) {
      await prisma.user.update({
        where: { id: data.userId },
        data: { role: data.role },
      });
    }

    await this.invalidateCache();
    return employee;
  }

  async updateEmployee(id: string, data: any) {
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        position: data.position,
        department: data.department,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
        salary: data.salary,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        stationId: data.stationId,
      },
    });

    await this.invalidateCache(id);
    return employee;
  }

  async deleteEmployee(id: string) {
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404);
    }

    await prisma.employee.delete({ where: { id } });

    // Optionally deactivate user
    if (employee.user) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: { isActive: false },
      });
    }

    await this.invalidateCache(id);
  }

  async getEmployeeByUserId(userId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId },
      include: {
        station: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return employee;
  }

  async getEmployeeStatistics(stationId?: string) {
    const where = stationId ? { stationId } : {};

    const [total, byDepartment, byPosition, active, inactive] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.groupBy({
        by: ['department'],
        where,
        _count: true,
      }),
      prisma.employee.groupBy({
        by: ['position'],
        where,
        _count: true,
      }),
      prisma.employee.count({
        where: {
          ...where,
          user: { isActive: true },
        },
      }),
      prisma.employee.count({
        where: {
          ...where,
          user: { isActive: false },
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      byDepartment,
      byPosition,
    };
  }

  private async invalidateCache(employeeId?: string) {
    if (employeeId) {
      await redis.del(`employee:${employeeId}`);
    }
    const keys = await redis.keys('employees:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}