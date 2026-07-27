import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { EmployeesService } from './employees.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class EmployeesController {
  private employeesService: EmployeesService;

  constructor() {
    this.employeesService = new EmployeesService();
  }

  getAllEmployees = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId, department, position } = req.query;
      
      let filterStationId = stationId as string;
      if (req.user?.role === 'SUPERVISOR') {
        filterStationId = req.user.stationId!;
      }

      const employees = await this.employeesService.getAllEmployees({
        stationId: filterStationId,
        department: department as string,
        position: position as string,
      });

      res.json({
        success: true,
        data: employees,
        count: employees.length,
      });
    } catch (error: any) {
      logger.error('Get employees error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get employees',
      });
    }
  };

  getEmployeeById = async (req: AuthRequest, res: Response) => {
    try {
      const employee = await this.employeesService.getEmployeeById(getStringParam(req.params.id));
      res.json({
        success: true,
        data: employee,
      });
    } catch (error: any) {
      logger.error('Get employee error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get employee',
      });
    }
  };

  createEmployee = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        stationId: req.body.stationId || req.user?.stationId,
      };

      const employee = await this.employeesService.createEmployee(data);
      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: employee,
      });
    } catch (error: any) {
      logger.error('Create employee error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create employee',
      });
    }
  };

  updateEmployee = async (req: AuthRequest, res: Response) => {
    try {
      const employee = await this.employeesService.updateEmployee(getStringParam(req.params.id), req.body);
      res.json({
        success: true,
        message: 'Employee updated successfully',
        data: employee,
      });
    } catch (error: any) {
      logger.error('Update employee error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update employee',
      });
    }
  };

  deleteEmployee = async (req: AuthRequest, res: Response) => {
    try {
      await this.employeesService.deleteEmployee(getStringParam(req.params.id));
      res.json({
        success: true,
        message: 'Employee deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete employee error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete employee',
      });
    }
  };

  getEmployeeByUserId = async (req: AuthRequest, res: Response) => {
    try {
      const employee = await this.employeesService.getEmployeeByUserId(getStringParam(req.params.userId));
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found for this user',
        });
      }
      res.json({
        success: true,
        data: employee,
      });
    } catch (error: any) {
      logger.error('Get employee by user ID error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get employee',
      });
    }
  };

  getEmployeeStatistics = async (req: AuthRequest, res: Response) => {
    try {
      const { stationId } = req.query;
      const stats = await this.employeesService.getEmployeeStatistics(
        (stationId as string) || req.user?.stationId
      );
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get employee statistics error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get employee statistics',
      });
    }
  };
}