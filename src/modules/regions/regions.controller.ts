import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { RegionsService } from './regions.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class RegionsController {
  private regionsService: RegionsService;

  constructor() {
    this.regionsService = new RegionsService();
  }

  getAllRegions = async (req: AuthRequest, res: Response) => {
    try {
      const regions = await this.regionsService.getAllRegions();
      res.json({
        success: true,
        data: regions,
        count: regions.length,
      });
    } catch (error: any) {
      logger.error('Get regions error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get regions',
      });
    }
  };

  getRegionById = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Region ID is required',
        });
      }
      const region = await this.regionsService.getRegionById(id);
      res.json({
        success: true,
        data: region,
      });
    } catch (error: any) {
      logger.error('Get region error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get region',
      });
    }
  };

  createRegion = async (req: AuthRequest, res: Response) => {
    try {
      const region = await this.regionsService.createRegion(req.body);
      res.status(201).json({
        success: true,
        message: 'Region created successfully',
        data: region,
      });
    } catch (error: any) {
      logger.error('Create region error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create region',
      });
    }
  };

  updateRegion = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Region ID is required',
        });
      }
      const region = await this.regionsService.updateRegion(id, req.body);
      res.json({
        success: true,
        message: 'Region updated successfully',
        data: region,
      });
    } catch (error: any) {
      logger.error('Update region error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update region',
      });
    }
  };

  deleteRegion = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Region ID is required',
        });
      }
      await this.regionsService.deleteRegion(id);
      res.json({
        success: true,
        message: 'Region deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete region error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete region',
      });
    }
  };
}