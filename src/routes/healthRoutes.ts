import { Router } from 'express';
import { healthController } from '../controllers/healthController';

const router = Router();

/**
 * GET /health
 * Health check endpoint
 */
router.get('/health', healthController.getHealth);

export default router;
