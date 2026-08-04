import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { StationsService } from './stations.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class StationsController {
  private stationsService: StationsService;

  constructor() {
    this.stationsService = new StationsService();
  }

  getAllStations = async (req: AuthRequest, res: Response) => {
    try {
      const regionId = getStringParam(req.query.regionId);
      const filters = regionId ? { regionId } : undefined;
      const stations = await this.stationsService.getAllStations(filters);
      res.json({
        success: true,
        data: stations,
      });
    } catch (error: any) {
      logger.error('Get all stations error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch stations',
      });
    }
  };

  getStationById = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      const station = await this.stationsService.getStationById(id);
      res.json({
        success: true,
        data: station,
      });
    } catch (error: any) {
      logger.error('Get station by id error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch station',
      });
    }
  };

  getStationDashboard = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      const station = await this.stationsService.getStationById(id);
      
      const result = {
        station,
        summary: {
          tanksCount: station.tanks?.length || 0,
          pumpsCount: station.pumps?.length || 0,
          usersCount: station.users?.length || 0,
        },
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Get station dashboard error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to fetch station dashboard',
      });
    }
  };

  createStation = async (req: AuthRequest, res: Response) => {
    try {
      const station = await this.stationsService.createStation(req.body);
      res.status(201).json({
        success: true,
        message: 'Station created successfully',
        data: station,
      });
    } catch (error: any) {
      logger.error('Create station error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create station',
      });
    }
  };

  updateStation = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      const station = await this.stationsService.updateStation(id, req.body);
      res.json({
        success: true,
        message: 'Station updated successfully',
        data: station,
      });
    } catch (error: any) {
      logger.error('Update station error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update station',
      });
    }
  };

  deleteStation = async (req: AuthRequest, res: Response) => {
    try {
      const id = getStringParam(req.params.id);
      await this.stationsService.deleteStation(id);
      res.json({
        success: true,
        message: 'Station deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete station error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete station',
      });
    }
  };
}