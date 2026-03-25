# Chat API - Implementation Guide

## Overview

The Chat API provides AI-powered conversational capabilities with support for multiple AI providers (OpenAI, Gemini) using a BYOK (Bring Your Own Key) model.

## Architecture

### Three-Layer Design

```
HTTP Request
     ↓
[Controller Layer] - Validates request, handles HTTP
     ↓
[Service Layer] - Business logic, provider selection
     ↓
[Provider Layer] - AI API integrations
     ↓
AI Response
```

### Components

#### 1. Types ([src/types/chat.types.ts](src/types/chat.types.ts))
```typescript
type AIProvider = 'auto' | 'openai' | 'gemini';

interface ChatRequest {
  message: string;
  userId: string;
  provider: AIProvider;
}

interface ChatResponse {
  reply: string;
  providerUsed: string;
}
```

#### 2. Validation ([src/utils/validation.ts](src/utils/validation.ts))
- Message: Required, non-empty, max 2000 chars
- UserId: Required, string
- Provider: auto | openai | gemini

#### 3. Controller ([src/controllers/chatController.ts](src/controllers/chatController.ts))
Handles HTTP request/response:
- `POST /api/v1/chat` - Send chat message
- `GET /api/v1/chat/providers` - Get available providers

#### 4. Service ([src/services/chatService.ts](src/services/chatService.ts))
Business logic:
- Process chat messages
- Auto-select optimal provider
- Check provider availability
- Return formatted response

#### 5. Provider Layer ([src/providers/](src/providers/))

**Interface** ([IAIProvider.ts](src/providers/interfaces/IAIProvider.ts)):
```typescript
interface IAIProvider {
  generateResponse(message: string, userId: string): Promise<ProviderResponse>;
  isAvailable(userId: string): Promise<boolean>;
  getProviderName(): string;
}
```

**Implementations:**
- [OpenAIProvider.ts](src/providers/OpenAIProvider.ts) - OpenAI integration
- [GeminiProvider.ts](src/providers/GeminiProvider.ts) - Gemini integration
- [ProviderFactory.ts](src/providers/ProviderFactory.ts) - Provider management

## API Endpoints

### 1. Send Chat Message

**Endpoint:** `POST /api/v1/chat`

**Request:**
```json
{
  "message": "Hello, what can you help me with?",
  "userId": "user123",
  "provider": "auto"
}
```

**Success Response (200):**
```json
{
  "reply": "I can help you with various tasks...",
  "providerUsed": "openai"
}
```

**Validation Errors (400):**
```json
{
  "status": "error",
  "message": "Message is required"
}
```

```json
{
  "status": "error",
  "message": "Message must not exceed 2000 characters"
}
```

### 2. Get Available Providers

**Endpoint:** `GET /api/v1/chat/providers?userId=user123`

**Success Response (200):**
```json
{
  "providers": ["openai", "gemini"],
  "count": 2
}
```

**Error Response (400):**
```json
{
  "status": "error",
  "message": "userId query parameter is required"
}
```

## Provider Selection Logic

### Auto Provider
When `provider: "auto"` is specified:

1. Check providers in preference order: OpenAI → Gemini
2. For each provider:
   - Check if user has configured API key
   - Check if provider is available
3. Return first available provider
4. If no providers available, return error

### Manual Provider
When specific provider is requested:
- Use the specified provider
- Check availability
- Return error if not available

## Testing

### Example Requests

**1. Chat with OpenAI:**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing",
    "userId": "user123",
    "provider": "openai"
  }'
```

**2. Chat with auto-selection:**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is machine learning?",
    "userId": "user123",
    "provider": "auto"
  }'
```

**3. Chat with Gemini:**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Tell me about AI ethics",
    "userId": "user456",
    "provider": "gemini"
  }'
```

**4. Get available providers:**
```bash
curl "http://localhost:3000/api/v1/chat/providers?userId=user123"
```

**5. Test validation (missing message):**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "provider": "openai"
  }'
# Expected: 400 - "Message is required"
```

**6. Test validation (message too long):**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"$(python3 -c 'print("a" * 2001)')\",
    \"userId\": \"user123\",
    \"provider\": \"openai\"
  }"
# Expected: 400 - "Message must not exceed 2000 characters"
```

## Current Implementation Status

### ✅ Completed
- Three-layer architecture (Controller → Service → Provider)
- Request validation middleware
- OpenAI provider structure (placeholder)
- Gemini provider structure (placeholder)
- Auto provider selection
- Provider factory pattern
- Error handling
- TypeScript types and interfaces
- Request/response logging
- Health checks

### 🚧 TODO: Next Steps

#### 1. Provider Implementation
```typescript
// TODO in OpenAIProvider.ts:
async generateResponse(message: string, userId: string) {
  // 1. Retrieve user's OpenAI API key from database
  const apiKey = await getUserApiKey(userId, 'openai');
  
  // 2. Initialize OpenAI client with user's key
  const openai = new OpenAI({ apiKey });
  
  // 3. Call OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
  });
  
  // 4. Return formatted response
  return {
    text: response.choices[0].message.content,
    provider: 'openai',
    tokensUsed: response.usage.total_tokens,
    model: response.model,
  };
}
```

#### 2. BYOK Implementation
- User API key storage (encrypted in database)
- Key retrieval and validation
- Key management endpoints
- Usage tracking per user/key

#### 3. Database Integration
```typescript
// User API Keys Schema
interface UserApiKey {
  userId: string;
  provider: 'openai' | 'gemini';
  apiKey: string; // encrypted
  isActive: boolean;
  createdAt: Date;
  lastUsed?: Date;
}

// Usage Tracking Schema
interface UsageLog {
  userId: string;
  provider: string;
  tokensUsed: number;
  model: string;
  timestamp: Date;
}
```

#### 4. Rate Limiting
- Per-user rate limits
- Per-provider rate limits
- Global API rate limits

#### 5. Streaming Responses
```typescript
// Streaming endpoint
POST /api/v1/chat/stream
// Uses Server-Sent Events (SSE) or WebSockets
```

#### 6. Conversation History
```typescript
interface ChatRequest {
  message: string;
  userId: string;
  provider: AIProvider;
  conversationId?: string; // Track conversations
  context?: Message[];      // Previous messages
}
```

## Error Handling

All errors are caught and formatted by the global error handler:

**Client Errors (4xx):**
- 400 Bad Request - Validation errors
- 401 Unauthorized - Missing/invalid authentication
- 404 Not Found - Endpoint not found

**Server Errors (5xx):**
- 500 Internal Server Error - Provider failures, unexpected errors

**Example Error Response:**
```json
{
  "status": "error",
  "message": "Provider openai is not available. Please configure your API key."
}
```

## Logging

All chat operations are logged with structured data:

```
[2026-03-25T01:54:31.407Z] [INFO]: Processing chat message for user: user123, provider: openai
[2026-03-25T01:54:31.408Z] [INFO]: OpenAI provider called for user: user123
[2026-03-25T01:54:31.408Z] [INFO]: Chat response generated using openai {
  "userId": "user123",
  "tokensUsed": 0,
  "model": "gpt-4"
}
```

## Adding a New Provider

1. **Create provider class** implementing `IAIProvider`:
```typescript
// src/providers/AnthropicProvider.ts
export class AnthropicProvider implements IAIProvider {
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    // Implementation
  }
  
  async isAvailable(userId: string): Promise<boolean> {
    // Check if user has Anthropic API key
  }
  
  getProviderName(): string {
    return 'anthropic';
  }
}
```

2. **Register in ProviderFactory**:
```typescript
// src/providers/ProviderFactory.ts
private initializeProviders(): void {
  this.providers.set('openai', new OpenAIProvider());
  this.providers.set('gemini', new GeminiProvider());
  this.providers.set('anthropic', new AnthropicProvider()); // Add here
}
```

3. **Update types**:
```typescript
// src/types/chat.types.ts
export type AIProvider = 'auto' | 'openai' | 'gemini' | 'anthropic';
```

That's it! The new provider is now available.

## Best Practices

1. **Always validate input** - Use validation middleware
2. **Log operations** - Use the logger utility for debugging
3. **Handle errors gracefully** - Use custom error classes
4. **Keep layers separate** - Don't mix concerns
5. **Use async/await** - Wrapped with asyncHandler
6. **Type everything** - Strict TypeScript mode enabled

## Performance Considerations

- **Connection pooling** - Reuse HTTP connections to AI providers
- **Caching** - Cache frequent responses (future enhancement)
- **Rate limiting** - Prevent abuse and manage costs
- **Streaming** - For long responses (future enhancement)
- **Timeout handling** - Set reasonable timeouts for provider calls

## Security

- **API Key encryption** - Never store keys in plain text
- **Input sanitization** - Validate and sanitize all inputs
- **Rate limiting** - Prevent abuse
- **CORS** - Configured for specific origins
- **Helmet** - Security headers enabled
- **Request size limits** - 10MB max body size
