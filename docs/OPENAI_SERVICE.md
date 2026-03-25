# OpenAI Service Implementation

## Overview
Production-ready OpenAI service using the official SDK with comprehensive error handling, retry logic, and logging.

## Features Implemented

### ✅ Official SDK Integration
- Uses `openai` package (v4.28.0)
- Properly typed with TypeScript
- Lazy initialization of client

### ✅ Configurable Model
```typescript
// Environment variables
OPENAI_MODEL=gpt-4           // Default: gpt-4
OPENAI_TIMEOUT=10000         // Default: 10s (10000ms)
OPENAI_MAX_RETRIES=2         // Default: 2 retries
```

### ✅ Timeout: 10 seconds
- Configured via `OPENAI_TIMEOUT` environment variable
- Passed to OpenAI client during initialization
- Prevents hanging requests

### ✅ Retry Logic: 2 times on failure
- Configurable via `OPENAI_MAX_RETRIES` environment variable
- **Exponential backoff**: 1s → 2s → 4s (max 5s)
- **Smart retry**: Doesn't retry on authentication or invalid request errors
- Logs each attempt with detailed context

### ✅ Returns Clean Text
- No metadata in response
- Trimmed whitespace
- Only the AI-generated text content
- Token usage tracked separately for logging

### ✅ User-Friendly Error Messages
Comprehensive error mapping for better UX:

| Error Type | HTTP Status | User Message |
|------------|-------------|--------------|
| Authentication | 401/403 | "OpenAI API key is invalid or missing. Please check your configuration." |
| Rate Limit | 429 | "OpenAI rate limit exceeded. Please try again in a moment." |
| Timeout | - | "OpenAI request timed out. Please try again." |
| Invalid Request | 400 | "Invalid request to OpenAI. Please check your message." |
| Model Overloaded | 503 | "OpenAI is currently overloaded. Please try again shortly." |
| Network | - | "Network error connecting to OpenAI. Please check your connection." |
| Unknown | - | "An unexpected error occurred with OpenAI. Please try again." |

### ✅ Comprehensive Logging

#### Debug Logs
```jsonc
{
  "message": "OpenAI client initialized",
  "model": "gpt-4",
  "timeout": 10000,
  "maxRetries": 2
}

{
  "message": "OpenAI request attempt 1/3",
  "userId": "user-123",
  "model": "gpt-4",
  "messageLength": 24
}
```

#### Success Logs
```jsonc
{
  "message": "OpenAI response generated successfully",
  "userId": "user-123",
  "model": "gpt-4",
  "latency": "1523ms",
  "tokensUsed": 156,
  "promptTokens": 45,
  "completionTokens": 111,
  "attempt": 1
}
```

#### Error Logs
```jsonc
{
  "message": "OpenAI request failed (attempt 2/3)",
  "userId": "user-123",
  "model": "gpt-4",
  "errorType": "rate_limit",
  "error": "Rate limit exceeded",
  "latency": "234ms"
}
```

## Architecture

### Error Handling Flow
```
Request → Initialize Client → Retry Loop
            ↓                      ↓
     Check API Key          Attempt Request
            ↓                      ↓
     Return Error          Success or Error?
                                   ↓
                          Map Error Type
                                   ↓
                      Authentication/Invalid?
                         ↙Yes          No↘
                   Throw Error      Continue
                                      ↓
                               Retry Exhausted?
                                ↙Yes       No↘
                           Throw Error  Backoff & Retry
```

### Retry Strategy
- **Attempt 1**: Immediate (0ms delay)
- **Attempt 2**: After 1000ms backoff
- **Attempt 3**: After 2000ms backoff
- **Attempt 4**: After 4000ms backoff (capped at 5000ms)

### Response Structure
```typescript
{
  text: "Clean AI response text",  // No system metadata
  provider: "openai",
  model: "gpt-4",
  tokensUsed: 156
}
```

## Configuration

### Required Environment Variables
```bash
# Minimum required
OPENAI_API_KEY=sk-...your-api-key...
```

### Optional Environment Variables (with defaults)
```bash
OPENAI_MODEL=gpt-4              # Alternative: gpt-3.5-turbo, gpt-4-turbo-preview
OPENAI_TIMEOUT=10000            # in milliseconds
OPENAI_MAX_RETRIES=2            # 0-5 retries supported
```

## Usage Example

```typescript
import { getChatService } from './container';

const chatService = getChatService();

// Send message to OpenAI
const response = await chatService.processMessage({
  message: "What is the capital of France?",
  userId: "user-123",
  provider: "openai"
});

console.log(response.reply); // "Paris is the capital of France."
```

## Error Handling Example

```typescript
try {
  const response = await chatService.processMessage({
    message: "Hello!",
    userId: "user-123",
    provider: "openai"
  });
  return response;
} catch (error) {
  if (error instanceof BadRequestError) {
    // Authentication or invalid request
    // Don't retry - user action required
    console.error("User error:", error.message);
  } else if (error instanceof InternalServerError) {
    // Rate limit, timeout, or service error
    // Safe to retry from client side
    console.error("Service error:", error.message);
  }
}
```

## Performance Characteristics

### Latency
- **Typical**: 500-2000ms (depends on OpenAI)
- **With retries**: Up to ~15s maximum (10s timeout + 5s backoff)
- **Logged**: Every request logs actual latency

### Reliability
- **Success rate**: Improved through retry logic
- **Transient failures**: Automatically retried
- **Permanent failures**: Fast-fail with clear error messages

### Resource Usage
- **Memory**: Minimal (client cached, reused)
- **Network**: Efficient (built-in SDK connection pooling)
- **Logging**: Structured JSON for easy parsing

## Security

### API Key Management
- Stored in environment variables
- Never logged or exposed in responses
- Validated at startup (for production)

### Request Validation
- Message length checked before sending
- User ID tracked for audit logs
- Timeout prevents resource exhaustion

## Monitoring

### Key Metrics to Track
1. **Request latency** (logged in every response)
2. **Token usage** (logged for cost tracking)
3. **Error rates** (by error type)
4. **Retry frequency** (attempt number logged)
5. **Model usage** (for capacity planning)

### Log Analysis Queries

**Find slow requests:**
```bash
cat logs.json | jq 'select(.latency > "2000ms")'
```

**Calculate average tokens:**
```bash
cat logs.json | jq -s 'map(.tokensUsed) | add / length'
```

**Count errors by type:**
```bash
cat logs.json | jq -r '.errorType' | sort | uniq -c
```

## Testing

### Local Testing (without API key)
```bash
# Will return authentication error with user-friendly message
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "userId": "test-user",
    "provider": "openai"
  }'

# Response:
# {
#   "status": "error",
#   "message": "OpenAI API key is invalid or missing. Please check your configuration."
# }
```

### Production Testing (with API key)
```bash
# Set API key in .env file
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Start server
npm run dev

# Test request
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is 2+2?",
    "userId": "test-user",
    "provider": "openai"
  }'

# Success response:
# {
#   "reply": "2 + 2 equals 4.",
#   "providerUsed": "openai"
# }
```

## Future Enhancements

### Potential Improvements
1. **Streaming responses**: Use `stream: true` for real-time chat
2. **Function calling**: Support OpenAI function/tool calls
3. **Conversation history**: Maintain multi-turn conversations
4. **Custom system prompts**: Per-user or per-app customization
5. **Token budgets**: Per-user token limits
6. **Response caching**: Cache identical queries
7. **A/B testing**: Test different models/prompts
8. **Cost tracking**: Track costs per user/conversation

### BYOK (Bring Your Own Key)
The architecture supports BYOK model:
```typescript
// Future: Per-user API keys
async isAvailable(userId: string): Promise<boolean> {
  const userApiKey = await getUserApiKey(userId);
  return !!userApiKey;
}

async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
  const userApiKey = await getUserApiKey(userId);
  const client = new OpenAI({ apiKey: userApiKey });
  // ... rest of implementation
}
```

## Comparison with Previous Implementation

| Feature | Before | After |
|---------|--------|-------|
| SDK | None (placeholder) | Official OpenAI SDK |
| Error Handling | Generic | User-friendly, typed |
| Retry Logic | None | 2 retries with backoff |
| Timeout | None | 10s configurable |
| Logging | Basic | Comprehensive (latency, tokens) |
| Configuration | Hardcoded | Environment variables |
| Response | Mock echo | Real AI responses |
| Token Tracking | Placeholder (0) | Real usage tracking |

## Conclusion

This implementation provides a **production-ready** OpenAI integration with:
- ✅ All requirements met (SDK, timeout, retry, clean text, errors, logging)
- ✅ Enterprise-grade error handling
- ✅ Comprehensive logging for debugging and monitoring
- ✅ Scalable architecture supporting future enhancements
- ✅ Type-safe implementation with full TypeScript support

Ready for deployment with a valid OpenAI API key!
