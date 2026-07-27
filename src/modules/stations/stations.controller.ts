import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { StationsService } from "./stations.service";
import { logger } from "../../config/logger";
import { getStringParam } from "../../utils/helpers";
import { prisma } from '../../config/database';


export class StationsController {
  private stationsService: StationsService;

  constructor() {
    this.stationsService = new StationsService();
  }

  getStationDashboard = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.id);

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "Station ID is required",
        });
      }

      // Get station details
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
          tanks: {
            select: {
              id: true,
              name: true,
              productType: true,
              capacity: true,
              currentLevel: true,
              percentage: true,
              status: true,
              lastUpdated: true,
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
              createdAt: true,
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
        return res.status(404).json({
          success: false,
          message: "Station not found",
        });
      }

      // Get sales summary
      const salesSummary = await prisma.sale.aggregate({
        where: {
          stationId: stationId,
          status: "COMPLETED",
        },
        _sum: {
          totalAmount: true,
          quantity: true,
        },
        _count: true,
      });

      // Get recent sales (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentSales = await prisma.sale.findMany({
        where: {
          stationId: stationId,
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          attendant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get expense summary
      const expenseSummary = await prisma.expense.aggregate({
        where: {
          stationId: stationId,
        },
        _sum: {
          amount: true,
        },
        _count: true,
      });

      // Get recent expenses
      const recentExpenses = await prisma.expense.findMany({
        where: {
          stationId: stationId,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Get pump summary
      const pumpSummary = {
        total: station.pumps.length,
        active: station.pumps.filter((p) => p.isActive).length,
        inactive: station.pumps.filter((p) => !p.isActive).length,
      };

      // Get tank summary
      const tankSummary = {
        total: station.tanks.length,
        normal: station.tanks.filter((t) => t.status === "NORMAL").length,
        warning: station.tanks.filter((t) => t.status === "WARNING").length,
        critical: station.tanks.filter((t) => t.status === "CRITICAL").length,
        totalCapacity: station.tanks.reduce((sum, t) => sum + t.capacity, 0),
        totalCurrentLevel: station.tanks.reduce(
          (sum, t) => sum + t.currentLevel,
          0,
        ),
        averagePercentage:
          station.tanks.length > 0
            ? station.tanks.reduce((sum, t) => sum + t.percentage, 0) /
              station.tanks.length
            : 0,
      };

      // Prepare dashboard data
      const dashboardData = {
        station: {
          id: station.id,
          name: station.name,
          code: station.code,
          address: station.address,
          city: station.city,
          state: station.state,
          phone: station.phone,
          email: station.email,
          manager: station.manager,
          region: station.region,
        },
        sales: {
          totalSales: salesSummary._sum.totalAmount || 0,
          totalVolume: salesSummary._sum.quantity || 0,
          transactionCount: salesSummary._count || 0,
          recent: recentSales,
        },
        expenses: {
          totalExpenses: expenseSummary._sum.amount || 0,
          count: expenseSummary._count || 0,
          recent: recentExpenses,
        },
        pumps: {
          ...pumpSummary,
          list: station.pumps,
        },
        tanks: {
          ...tankSummary,
          list: station.tanks,
        },
        employees: {
          total: station.users.length,
          attendants: station.users.filter((u) => u.role === "ATTENDANT")
            .length,
          supervisors: station.users.filter((u) => u.role === "SUPERVISOR")
            .length,
        },
        summary: {
          totalSales: salesSummary._sum.totalAmount || 0,
          totalVolume: salesSummary._sum.quantity || 0,
          totalExpenses: expenseSummary._sum.amount || 0,
          netProfit:
            (salesSummary._sum.totalAmount || 0) -
            (expenseSummary._sum.amount || 0),
          transactions: salesSummary._count || 0,
        },
      };

      res.json({
        success: true,
        data: dashboardData,
      });
    } catch (error: any) {
      logger.error("Get station dashboard error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get station dashboard",
      });
    }
  };

  getAllStations = async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      const { regionId } = req.query;

      console.log("📊 Fetching stations with filters:", {
        regionId,
        userRole: user?.role,
        userId: user?.id,
      });

      // If user is REGIONAL_MANAGER, they should only see their region
      let filterRegionId = regionId as string;
      if (user?.role === "REGIONAL_MANAGER" && user?.regionId) {
        filterRegionId = user.regionId;
        console.log(
          `🔒 Regional Manager ${user.id} filtered to region: ${filterRegionId}`,
        );
      }

      const stations = await this.stationsService.getAllStations({
        regionId: filterRegionId,
      });

      console.log(`✅ Found ${stations.length} stations`);
      res.json({
        success: true,
        data: stations,
      });
    } catch (error: any) {
      console.error("❌ Get stations error:", error);
      logger.error("Get stations error:", error);

      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get stations",
        ...(process.env.NODE_ENV === "development" && {
          details: error.stack,
        }),
      });
    }
  };

  getStationById = async (req: AuthRequest, res: Response) => {
    try {
      const station = await this.stationsService.getStationById(
        getStringParam(req.params.id),
      );
      res.json({
        success: true,
        data: station,
      });
    } catch (error: any) {
      logger.error("Get station error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get station",
      });
    }
  };

  createStation = async (req: AuthRequest, res: Response) => {
    try {
      const station = await this.stationsService.createStation(req.body);
      res.status(201).json({
        success: true,
        message: "Station created successfully",
        data: station,
      });
    } catch (error: any) {
      logger.error("Create station error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to create station",
      });
    }
  };

  updateStation = async (req: Request, res: Response) => {
    try {
      const station = await this.stationsService.updateStation(
        getStringParam(req.params.id),
        req.body,
      );
      res.json({
        success: true,
        message: "Station updated successfully",
        data: station,
      });
    } catch (error: any) {
      logger.error("Update station error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to update station",
      });
    }
  };

  deleteStation = async (req: Request, res: Response) => {
    try {
      await this.stationsService.deleteStation(getStringParam(req.params.id));
      res.json({
        success: true,
        message: "Station deleted successfully",
      });
    } catch (error: any) {
      logger.error("Delete station error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to delete station",
      });
    }
  };
}
