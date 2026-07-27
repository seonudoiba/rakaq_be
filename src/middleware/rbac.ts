import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { hasPermission, getPermissionConfig } from '../utils/permissions';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { getStringParam } from '../utils/helpers';

export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      console.log(`🔍 [RBAC] Checking permission: ${permission} for user ${user.id} (${user.role})`);

      // Check if user has permission
      const hasPerm = hasPermission(user.role, permission);
      
      if (!hasPerm) {
        logger.warn(`Access denied: User ${user.id} (${user.role}) tried to access ${permission}`);
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission: ${permission}`,
        });
      }

      // Get permission configuration for scope checking
      const permissionConfig = getPermissionConfig(user.role, permission);

      // Check scope restrictions
      if (permissionConfig && typeof permissionConfig === 'object') {
        const { scope, maxAmount } = permissionConfig;

        console.log(`🔍 [RBAC] Permission config for ${permission}:`, { scope, maxAmount });

        // Station scope: User can only access their station
        if (scope === 'station') {
          const stationId = (req.params?.stationId as string) || (req.params?.id ? getStringParam(req.params.id) : '') || (req.body?.stationId as string);
          
          if (stationId && user.stationId) {
            if (user.stationId !== stationId) {
              logger.warn(`Access denied: User ${user.id} tried to access station ${stationId} but belongs to ${user.stationId}`);
              return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your assigned station.',
              });
            }
          } else if (stationId && !user.stationId) {
            logger.warn(`Access denied: User ${user.id} has no station assigned but tried to access station ${stationId}`);
            return res.status(403).json({
              success: false,
              message: 'Access denied. You have no station assigned.',
            });
          }
        }

        // Region scope: User can only access their region
        if (scope === 'region') {
          const regionIdFromQuery = getStringParam(req.query?.regionId);
          const regionIdFromBody = req.body?.regionId ? getStringParam(req.body.regionId) : '';
          const targetRegionId = regionIdFromQuery || regionIdFromBody;
          
          if (targetRegionId && user.regionId) {
            if (user.regionId !== targetRegionId) {
              logger.warn(`Access denied: User ${user.id} tried to access region ${targetRegionId} but belongs to ${user.regionId}`);
              return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your region.',
              });
            }
          }

          const stationId = (req.params?.stationId as string) || (req.params?.id ? getStringParam(req.params.id) : '') || (req.body?.stationId as string);
          
          if (stationId && user.regionId) {
            try {
              const station = await prisma.station.findUnique({
                where: { id: stationId },
                select: { regionId: true },
              });

              if (station && station.regionId !== user.regionId) {
                logger.warn(`Access denied: User ${user.id} tried to access station in region ${station.regionId} but belongs to ${user.regionId}`);
                return res.status(403).json({
                  success: false,
                  message: 'Access denied. You can only access stations in your region.',
                });
              }
            } catch (dbError) {
              console.error('❌ [RBAC] Database error checking station region:', dbError);
            }
          }
        }

        // Amount restriction
        if (maxAmount) {
          const amountStr = (req.body?.amount || req.query?.amount || '0') as string;
          const amount = parseFloat(amountStr);
          if (amount > maxAmount) {
            return res.status(403).json({
              success: false,
              message: `Access denied. Amount exceeds your approval limit of ${maxAmount}.`,
            });
          }
        }
      }

      next();
    } catch (error) {
      logger.error('RBAC error:', error);
      console.error('❌ [RBAC] Error details:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed.',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }),
      });
    }
  };
};

// Check if user has specific role
export const requireRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required roles: ${roles.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      logger.error('Role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed.',
      });
    }
  };
};