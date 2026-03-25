interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  service: string;
}

/**
 * Health Service
 * Handles health check logic and system status
 */
export class HealthService {
  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'neurodrive-backend',
    };
  }
}
