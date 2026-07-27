import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { PurchasesService } from "./purchases.service";
import { logger } from "../../config/logger";
import { getStringParam } from "../../utils/helpers";

export class PurchasesController {
  private purchasesService: PurchasesService;

  constructor() {
    this.purchasesService = new PurchasesService();
  }

  getAllPurchaseOrders = async (req: AuthRequest, res: Response) => {
    try {
      const { status, supplierId, startDate, endDate, stationId } = req.query;

      // If user is station manager, only show their station's orders
      // let filterStationId = stationId as string;
      // if (req.user?.role === 'SUPERVISOR') {
      //   filterStationId = req.user.stationId!;
      // }

      // const orders = await this.purchasesService.getAllPurchaseOrders({
      //   status: status as any,
      //   supplierId: supplierId as string,
      //   startDate: startDate ? new Date(startDate as string) : undefined,
      //   endDate: endDate ? new Date(endDate as string) : undefined,
      //   stationId: filterStationId,
      // });
      const orders = await this.purchasesService.getAllPurchaseOrders({
        status: status as any,
        supplierId: supplierId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        // Remove stationId or add it to the service method signature
      });

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error: any) {
      logger.error("Get purchase orders error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get purchase orders",
      });
    }
  };

  getPurchaseOrderById = async (req: AuthRequest, res: Response) => {
    try {
      const order = await this.purchasesService.getPurchaseOrderById(
        getStringParam(req.params.id)
      );
      res.json({
        success: true,
        data: order,
      });
    } catch (error: any) {
      logger.error("Get purchase order error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get purchase order",
      });
    }
  };

  createPurchaseOrder = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        createdById: req.user!.id,
        stationId: req.body.stationId || req.user?.stationId,
      };

      const order = await this.purchasesService.createPurchaseOrder(data);
      res.status(201).json({
        success: true,
        message: "Purchase order created successfully",
        data: order,
      });
    } catch (error: any) {
      logger.error("Create purchase order error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to create purchase order",
      });
    }
  };

  approvePurchaseOrder = async (req: AuthRequest, res: Response) => {
    try {
      const order = await this.purchasesService.approvePurchaseOrder(
        getStringParam(req.params.id),
        req.user!.id,
      );
      res.json({
        success: true,
        message: "Purchase order approved successfully",
        data: order,
      });
    } catch (error: any) {
      logger.error("Approve purchase order error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to approve purchase order",
      });
    }
  };

  updatePurchaseOrderStatus = async (req: AuthRequest, res: Response) => {
    try {
      const { status } = req.body;
      const order = await this.purchasesService.updatePurchaseOrderStatus(
        getStringParam(req.params.id),
        status,
      );
      res.json({
        success: true,
        message: "Purchase order status updated successfully",
        data: order,
      });
    } catch (error: any) {
      logger.error("Update purchase order status error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to update purchase order status",
      });
    }
  };

  cancelPurchaseOrder = async (req: AuthRequest, res: Response) => {
    try {
      const order = await this.purchasesService.cancelPurchaseOrder(
        getStringParam(req.params.id)
      );
      res.json({
        success: true,
        message: "Purchase order cancelled successfully",
        data: order,
      });
    } catch (error: any) {
      logger.error("Cancel purchase order error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to cancel purchase order",
      });
    }
  };

  getPurchaseOrderSummary = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, startDate, endDate } = req.query;
      const summary = await this.purchasesService.getPurchaseOrderSummary(
        (stationId as string) || req.user?.stationId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
      );
      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error("Get purchase order summary error:", error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to get purchase order summary",
      });
    }
  };
}
