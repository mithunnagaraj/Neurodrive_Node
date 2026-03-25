import { Router } from 'express';
import healthRoutes from './healthRoutes';
import chatRoutes from './chatRoutes';

const router = Router();

/**
 * Central route configuration
 * All API routes are registered here
 */

// Health check route (not versioned)
router.use('/', healthRoutes);

// API v1 routes
router.use('/api/v1/chat', chatRoutes);

// Future versioned API routes can be added here
// router.use('/api/v1/users', userRoutes);
// router.use('/api/v1/auth', authRoutes);

export default router;
