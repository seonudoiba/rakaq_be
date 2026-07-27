import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { ExpensesService } from "./expenses.service";
import { logger } from "../../config/logger";
import { getStringParam, getStringParamOrDefault } from "../../utils/helpers";

export class ExpensesController {
  private expensesService: ExpensesService;

  constructor() {
    this.expensesService = new ExpensesService();
  }

  getStationExpenses = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = getStringParam(req.params.stationId);

      // If no stationId in params, try query or user context
      let effectiveStationId =
        stationId ||
        getStringParam(req.query.stationId) ||
        req.user?.stationId ||
        "";

      if (!effectiveStationId) {
        return res.status(400).json({
          success: false,
          message: "Station ID is required. Please provide a station ID.",
        });
      }

      const { category, startDate, endDate } = req.query;

      logger.info(`Getting expenses for station: ${effectiveStationId}`);

      // Convert string dates to Date objects
      let startDateObj: Date | undefined;
      let endDateObj: Date | undefined;

      if (startDate) {
        startDateObj = new Date(startDate as string);
        // Don't modify the time, let the service handle it
      }

      if (endDate) {
        endDateObj = new Date(endDate as string);
        // Don't modify the time, let the service handle it
      }

      const expenses = await this.expensesService.getStationExpenses(
        effectiveStationId,
        {
          category: category as any,
          startDate: startDateObj,
          endDate: endDateObj,
        },
      );

      res.json({
        success: true,
        data: expenses,
        count: expenses.length,
      });
    } catch (error: any) {
      logger.error("Get station expenses error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get station expenses",
      });
    }
  };

  getAllExpenses = async (req: AuthRequest, res: Response) => {
    try {
      const { category, startDate, endDate } = req.query;

      // Only Super Admin can access all expenses
      if (req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Access denied. Only Super Admin can view all expenses.",
        });
      }

      const expenses = await this.expensesService.getAllExpenses({
        category: category as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: expenses,
        count: expenses.length,
      });
    } catch (error: any) {
      logger.error("Get all expenses error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get expenses",
      });
    }
  };

  getExpenseById = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Expense ID is required",
        });
      }
      const expense = await this.expensesService.getExpenseById(id);
      res.json({
        success: true,
        data: expense,
      });
    } catch (error: any) {
      logger.error("Get expense error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get expense",
      });
    }
  };

  createExpense = async (req: AuthRequest, res: Response) => {
    try {
      const stationId = req.body.stationId || req.user?.stationId;

      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "stationId is required",
        });
      }

      const data = {
        ...req.body,
        createdById: req.user!.id,
        stationId: stationId,
      };

      logger.info("Creating expense:", data);

      const expense = await this.expensesService.createExpense(data);
      res.status(201).json({
        success: true,
        message: "Expense created successfully",
        data: expense,
      });
    } catch (error: any) {
      logger.error("Create expense error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to create expense",
      });
    }
  };

  approveExpense = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Expense ID is required",
        });
      }
      const expense = await this.expensesService.approveExpense(
        id,
        req.user!.id,
      );
      res.json({
        success: true,
        message: "Expense approved successfully",
        data: expense,
      });
    } catch (error: any) {
      logger.error("Approve expense error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to approve expense",
      });
    }
  };

  getExpenseSummary = async (req: AuthRequest, res: Response) => {
    try {
      const stationId =
        getStringParamOrDefault(req.query.stationId) ||
        req.user?.stationId ||
        "";
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "Station ID is required",
        });
      }

      const startDate = getStringParam(req.query.startDate);
      const endDate = getStringParam(req.query.endDate);

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date and end date are required",
        });
      }

      const summary = await this.expensesService.getExpenseSummary(
        stationId,
        new Date(startDate),
        new Date(endDate),
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error("Get expense summary error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get expense summary",
      });
    }
  };

  getPendingApprovals = async (req: AuthRequest, res: Response) => {
    try {
      const stationId =
        getStringParamOrDefault(req.query.stationId) ||
        req.user?.stationId ||
        "";
      if (!stationId) {
        return res.status(400).json({
          success: false,
          message: "Station ID is required",
        });
      }
      const approvals =
        await this.expensesService.getPendingApprovals(stationId);
      res.json({
        success: true,
        data: approvals,
      });
    } catch (error: any) {
      logger.error("Get pending approvals error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get pending approvals",
      });
    }
  };

  deleteExpense = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Expense ID is required",
        });
      }
      await this.expensesService.deleteExpense(id);
      res.json({
        success: true,
        message: "Expense deleted successfully",
      });
    } catch (error: any) {
      logger.error("Delete expense error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to delete expense",
      });
    }
  };
}
