import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getChatService } from '../container';
import { ChatRequest } from '../types/chat.types';

/**
 * Chat Controller with Dependency Injection
 * Handles HTTP requests for chat endpoints
 */
class ChatController {
  /**
   * POST /chat
   * Process chat message and return AI response
   */
  public sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const chatService = getChatService();
    
    const chatRequest: ChatRequest = {
      message: req.body.message,
      userId: req.body.userId,
      provider: req.body.provider || 'auto', // Default to auto if not specified
    };

    const response = await chatService.processMessage(chatRequest);

    res.status(200).json(response);
  });

  /**
   * GET /chat/providers
   * Get available AI providers for a user
   */
  public getProviders = asyncHandler(async (req: Request, res: Response) => {
    const chatService = getChatService();
    const userId = req.query['userId'] as string;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'userId query parameter is required',
      });
      return;
    }

    const providers = await chatService.getAvailableProviders(userId);

    res.status(200).json({
      providers,
      count: providers.length,
    });
  });
}

export const chatController = new ChatController();
