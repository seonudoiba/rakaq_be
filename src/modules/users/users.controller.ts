import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { UsersService } from './users.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
      const { role, stationId, regionId } = req.query;
      
      console.log('📊 Fetching users with filters:', { role, stationId, regionId });
      
      const users = await this.usersService.getAllUsers({
        role: role as string, // Cast to string
        stationId: stationId as string,
        regionId: regionId as string,
      });

      console.log(`✅ Found ${users.length} users`);
      res.json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      console.error('❌ Get users error:', error);
      logger.error('Get users error:', error);
      
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get users',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.stack 
        }),
      });
    }
  };
  // getAllUsers = async (req: AuthRequest, res: Response) => {
  //   try {
  //     const { role, stationId, regionId } = req.query;
      
  //     // Log the query parameters
  //     console.log('📊 Fetching users with filters:', { role, stationId, regionId });
      
  //     const users = await this.usersService.getAllUsers({
  //       role: role as string,
  //       stationId: stationId as string,
  //       regionId: regionId as string,
  //     });

  //     console.log(`✅ Found ${users.length} users`);
  //     res.json({
  //       success: true,
  //       data: users,
  //     });
  //   } catch (error: any) {
  //     console.error('❌ Get users error:', error);
  //     logger.error('Get users error:', error);
      
  //     res.status(error.statusCode || 500).json({
  //       success: false,
  //       message: error.message || 'Failed to get users',
  //       ...(process.env.NODE_ENV === 'development' && { 
  //         details: error.stack 
  //       }),
  //     });
  //   }
  // };

  getUserById = async (req: AuthRequest, res: Response) => {
    try {
      const user = await this.usersService.getUserById(getStringParam(req.params.id));
      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      logger.error('Get user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get user',
      });
    }
  };

  createUser = async (req: Request, res: Response) => {
    try {
      const user = await this.usersService.createUser(req.body);
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user,
      });
    } catch (error: any) {
      logger.error('Create user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create user',
      });
    }
  };

  updateUser = async (req: Request, res: Response) => {
    try {
      const user = await this.usersService.updateUser(getStringParam(req.params.id), req.body);
      res.json({
        success: true,
        message: 'User updated successfully',
        data: user,
      });
    } catch (error: any) {
      logger.error('Update user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update user',
      });
    }
  };

  deleteUser = async (req: Request, res: Response) => {
    try {
      await this.usersService.deleteUser(getStringParam(req.params.id));
      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error: any) {
      logger.error('Delete user error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to delete user',
      });
    }
  };

  changePassword = async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await this.usersService.changePassword(req.user!.id, currentPassword, newPassword);
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      logger.error('Change password error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to change password',
      });
    }
  };
}