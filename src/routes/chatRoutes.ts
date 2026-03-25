import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import { validateChatRequest } from '../utils/validation';

const router = Router();

/**
 * POST /api/v1/chat
 * Send a chat message and receive AI response
 */
router.post('/', validateChatRequest, chatController.sendMessage);

/**
 * GET /api/v1/chat/providers
 * Get available AI providers for a user
 */
router.get('/providers', chatController.getProviders);

export default router;
