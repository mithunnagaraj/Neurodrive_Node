import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getHealthService } from '../container';

/**
 * Health Controller with Dependency Injection
 * Handles health check endpoint
 */
class HealthController {
  /**
   * GET /health
   * Returns health status of the service
   */
  public getHealth = asyncHandler(async (_req: Request, res: Response) => {
    const healthService = getHealthService();
    const healthStatus = healthService.getHealthStatus();
    res.status(200).json(healthStatus);
  });
}

export const healthController = new HealthController();
