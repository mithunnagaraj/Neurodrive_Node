# LLM Router

The LLM Router intelligently routes chat requests to different AI providers based on message characteristics.

## How It Works

### Auto-Routing Logic

When `provider: "auto"` is specified, the router decides which provider to use:

1. **Short Messages** (< threshold): → Gemini
   - Fast responses
   - Cost-effective
   - Good for simple queries

2. **Long Messages** (≥ threshold): → OpenAI
   - Better for complex queries
   - More context understanding
   - Suitable for detailed responses

### Configuration

Set these environment variables in `.env`:

```bash
# LLM Router Configuration
ROUTER_LENGTH_THRESHOLD=100          # Character threshold (default: 100)
ROUTER_SHORT_MESSAGE_PROVIDER=gemini # Provider for short messages
ROUTER_LONG_MESSAGE_PROVIDER=openai  # Provider for long messages
```

### Provider Override

You can always override the router by explicitly specifying a provider:

```json
{
  "message": "Your message here",
  "provider": "gemini",  // Forces use of Gemini regardless of length
  "userId": "user123"
}
```

## Examples

### Short Message (Auto-Routed to Gemini)
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi!",
    "provider": "auto",
    "userId": "test123"
  }'
```

**Router Decision:**
- Message length: 3 characters
- Threshold: 100 characters
- Decision: `gemini` (short message)
- Reason: "Short message (3 < 100 chars) → gemini"

### Long Message (Auto-Routed to OpenAI)
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "This is a longer message that exceeds one hundred characters and should be routed to OpenAI for better handling of complex queries",
    "provider": "auto",
    "userId": "test123"
  }'
```

**Router Decision:**
- Message length: 145 characters
- Threshold: 100 characters
- Decision: `openai` (long message)
- Reason: "Long message (145 ≥ 100 chars) → openai"

### Provider Override
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Even though this is a long message exceeding the threshold, I want to force it to use Gemini",
    "provider": "gemini",
    "userId": "test123"
  }'
```

**Router Decision:**
- Message length: 105 characters
- Threshold: 100 characters
- Decision: `gemini` (override)
- Reason: "Explicit provider override in request"

## Logging

The router logs detailed information about each routing decision:

```
[INFO]: LLM Router decision: gemini {
  "messageLength": 3,
  "threshold": 100,
  "selectedProvider": "gemini",
  "reason": "Short message (3 < 100 chars) → gemini"
}

[INFO]: LLM Router decision: {
  "userId": "test123",
  "selectedProvider": "gemini",
  "reason": "Short message (3 < 100 chars) → gemini",
  "messageLength": 3,
  "threshold": 100,
  "wasOverridden": false
}
```

## Customization

### Change Threshold

To route messages differently, adjust the threshold:

```bash
ROUTER_LENGTH_THRESHOLD=200  # Now 200 chars is the cutoff
```

### Change Providers

Route to different providers for short/long messages:

```bash
ROUTER_SHORT_MESSAGE_PROVIDER=anthropic
ROUTER_LONG_MESSAGE_PROVIDER=azure
```

## Architecture

### Components

1. **LLMRouter Service** (`src/services/LLMRouter.ts`)
   - Core routing logic
   - Decision metadata generation
   - Configurable thresholds

2. **ChatService Integration** (`src/services/chatService.ts`)
   - Calls router before provider selection
   - Logs routing decisions
   - Handles fallback scenarios

3. **Configuration** (`src/config/index.ts`)
   - Validates router settings
   - Provides defaults
   - Type-safe configuration

### Flow

```
1. Request arrives with provider: "auto"
2. LLMRouter analyzes message length
3. Router decides: short → gemini, long → openai
4. ChatService uses selected provider
5. Response includes providerUsed field
6. Logs include routing decision details
```

## Benefits

✅ **Cost Optimization**: Use cheaper providers for simple queries  
✅ **Performance**: Fast providers for quick responses  
✅ **Flexibility**: Override when needed  
✅ **Visibility**: Detailed logging of all decisions  
✅ **Configurability**: Adjust thresholds without code changes
