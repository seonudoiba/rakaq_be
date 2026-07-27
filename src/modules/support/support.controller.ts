import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { SupportService } from './support.service';
import { logger } from '../../config/logger';
import { getStringParam } from '../../utils/helpers';


export class SupportController {
  private supportService: SupportService;

  constructor() {
    this.supportService = new SupportService();
  }

  getAllTickets = async (req: AuthRequest, res: Response) => {
    try {
      const { status, priority, assignedToId, category } = req.query;
      
      const tickets = await this.supportService.getAllTickets({
        status: status as any,
        priority: priority as any,
        assignedToId: assignedToId as string,
        createdById: req.user?.id,
        category: category as string,
      });

      res.json({
        success: true,
        data: tickets,
        count: tickets.length,
      });
    } catch (error: any) {
      logger.error('Get tickets error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get tickets',
      });
    }
  };

  getTicketById = async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await this.supportService.getTicketById(getStringParam(req.params.id));
      res.json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Get ticket error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get ticket',
      });
    }
  };

  createTicket = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        createdById: req.user!.id,
      };

      const ticket = await this.supportService.createTicket(data);
      res.status(201).json({
        success: true,
        message: 'Ticket created successfully',
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Create ticket error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to create ticket',
      });
    }
  };

  updateTicket = async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await this.supportService.updateTicket(getStringParam(req.params.id), req.body);
      res.json({
        success: true,
        message: 'Ticket updated successfully',
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Update ticket error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to update ticket',
      });
    }
  };

  addComment = async (req: AuthRequest, res: Response) => {
    try {
      const data = {
        ...req.body,
        ticketId: getStringParam(req.params.id),
        userId: req.user!.id,
      };

      const comment = await this.supportService.addComment(data);
      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: comment,
      });
    } catch (error: any) {
      logger.error('Add comment error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to add comment',
      });
    }
  };

  resolveTicket = async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await this.supportService.resolveTicket(getStringParam(req.params.id), req.user!.id);
      res.json({
        success: true,
        message: 'Ticket resolved successfully',
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Resolve ticket error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to resolve ticket',
      });
    }
  };

  closeTicket = async (req: AuthRequest, res: Response) => {
    try {
      const ticket = await this.supportService.closeTicket(getStringParam(req.params.id));
      res.json({
        success: true,
        message: 'Ticket closed successfully',
        data: ticket,
      });
    } catch (error: any) {
      logger.error('Close ticket error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to close ticket',
      });
    }
  };

  getTicketStatistics = async (req: AuthRequest, res: Response) => {
    try {
      const stats = await this.supportService.getTicketStatistics();
      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Get ticket statistics error:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get ticket statistics',
      });
    }
  };
}