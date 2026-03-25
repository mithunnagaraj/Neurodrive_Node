# Refactoring Documentation

## Overview
This document outlines the major refactoring improvements made to the NeuroDrive backend for enhanced **scalability**, **clean architecture**, **performance**, and **security**.

## Architecture Changes

### 1. Dependency Injection (DI) Pattern

**What Changed:**
- Introduced a centralized DI container (`src/container.ts`)
- Removed singleton exports from services
- Services now receive dependencies via constructor injection

**Benefits:**
- **Testability**: Easy to mock dependencies in unit tests
- **Flexibility**: Simple to swap implementations (e.g., different cache backends)
- **Separation of Concerns**: Services don't manage their own dependencies
- **Lifecycle Management**: Centralized control over service instantiation

**Example:**
```typescript
// Before (Singleton)
export const chatService = new ChatService();

// After (DI Container)
export class ChatService {
  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly cache: Cache
  ) {}
}

// Usage in controllers
const chatService = getChatService();
```

### 2. Caching Layer

**Implementation:**
- Added `Cache` class with TTL support (`src/utils/cache.ts`)
- Integrated caching in:
  - Provider availability checks
  - Auto-provider selection
  - Chat responses (optional, for identical queries)

**Benefits:**
- **Performance**: Reduced redundant API calls and computations
- **Scalability**: Lower load on external AI providers
- **Cost Efficiency**: Fewer billable API requests

**Features:**
- Automatic cleanup of expired entries
- Cache statistics for monitoring
- Configurable TTL per cache entry
- Manual cache invalidation support

### 3. Enhanced Security Middleware

**New Middleware Added:**

#### Request ID Tracking (`src/middleware/requestId.ts`)
- Assigns unique UUID to each request
- Enables distributed tracing
- Helpful for debugging and log correlation

#### Rate Limiting (`src/middleware/rateLimit.ts`)
- In-memory rate limiter
- Configurable window and max requests
- User-based limiting (by IP or user ID)
- 429 responses when limits exceeded

#### Input Sanitization (`src/middleware/sanitizeInput.ts`)
- XSS prevention via HTML entity encoding
- SQL injection protection (strips dangerous characters)
- Sanitizes query params, body, and route params
- Preserves data structure (arrays, objects)

#### Additional Security Headers (`src/middleware/securityHeaders.ts`)
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: Restricts browser features

### 4. Configuration Validation

**Improvements to `src/config/index.ts`:**
- Type-safe environment variable access
- Required field validation at startup
- Default values with explicit typing
- Frozen configuration object (immutable)
- Custom validation error class

**Benefits:**
- **Fail Fast**: Errors caught at startup, not runtime
- **Type Safety**: Full TypeScript support for config
- **Security**: Prevents accidental config mutations
- **Developer Experience**: Clear error messages

### 5. Provider Factory Refactoring

**Changes:**
- No longer exports singleton instance
- Accepts `Cache` instance via constructor
- Methods use caching for availability checks
- Dynamic provider registration support
- Cache clearing methods for invalidation

**Benefits:**
- **Performance**: Cached availability checks
- **Extensibility**: Easy to add new providers at runtime
- **Testability**: Can inject mock cache

### 6. Service Layer Improvements

**ChatService Refactoring:**
- Constructor-based dependency injection
- Response caching for identical queries
- User-specific cache clearing
- Better error context in logs

**HealthService Refactoring:**
- Removed singleton export
- Synchronous health checks (no async overhead)
- Proper DI integration

### 7. Application Structure

**App Class (`src/app.ts`):**
- Organized middleware initialization into logical sections:
  1. Security (Helmet, CSP, HSTS)
  2. Performance (Compression)
  3. Parsing (CORS, Body parsing)
  4. Logging (Request ID, Request logging)
  5. Routes
  6. Error handling
- Graceful shutdown support with cleanup
- Conditional middleware (e.g., rate limiting based on config)

**Server (`src/server.ts`):**
- Instantiates App class
- Calls cleanup on shutdown
- Better error handling for startup failures

## Performance Optimizations

### Response Compression
- Gzip compression for responses > 1KB
- Configurable compression level (balanced)
- Opt-out via `x-no-compression` header

### Request Size Limits
- Configurable body size limits
- Parameter limit protection (max 1000 params)
- Prevents DoS via large payloads

### Caching Strategy
- Provider availability: 60s TTL
- Auto-provider selection: 60s TTL per user
- Chat responses: 300s TTL (optional)

## Scalability Patterns

### 1. Stateless Design
- No session state stored in-memory (except cache)
- Can scale horizontally with shared cache backend

### 2. Resource Pooling
- Singleton services reduce memory footprint
- Shared cache across all requests

### 3. Graceful Degradation
- Rate limiting prevents overload
- Cache misses don't break functionality
- Health checks for monitoring

### 4. Future-Ready Architecture
- Easy to add Redis/Memcached for distributed caching
- DI container supports database connection pooling
- Provider factory allows runtime provider addition

## Security Hardening

### Defense in Depth
1. **Transport**: HTTPS enforcement (via Helmet HSTS)
2. **Headers**: CSP, X-Frame-Options, etc.
3. **Input**: Sanitization middleware
4. **Rate Limiting**: Prevents abuse
5. **Configuration**: Validated at startup

### Security Headers
```
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

### Attack Surface Reduction
- Disabled `X-Powered-By` header
- Strict body parsing
- Parameter limit enforcement
- Request size limits

## Migration Guide

### Updating Controllers
Controllers should use helper functions to get services:

```typescript
// Before
import { chatService } from '../services/chatService';

// After
import { getChatService } from '../container';

// In handler
const chatService = getChatService();
```

### Adding New Services
1. Create service class with dependencies in constructor
2. Register in `src/container.ts`
3. Add to `SERVICE_NAMES` enum
4. Export getter function

Example:
```typescript
// 1. Create service
export class MyService {
  constructor(private readonly cache: Cache) {}
}

// 2. Register in container.ts
container.registerSingleton(SERVICE_NAMES.MY_SERVICE, () => {
  const cache = container.resolve<Cache>(SERVICE_NAMES.CACHE);
  return new MyService(cache);
});

// 3. Export getter
export const getMyService = (): MyService => {
  return container.resolve<MyService>(SERVICE_NAMES.MY_SERVICE);
};
```

### Environment Variables
New environment variables (add to `.env`):
```
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_REQUEST_SIZE=10mb
ENCRYPTION_KEY=your_32_character_encryption_key
```

## Testing Recommendations

### Unit Testing
DI makes unit testing easy:
```typescript
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockProviderFactory = {
  getProvider: jest.fn(),
};

const chatService = new ChatService(mockProviderFactory, mockCache);
```

### Integration Testing
Test with real container:
```typescript
import { getChatService } from '../container';

const chatService = getChatService();
// Test with actual dependencies
```

## Performance Monitoring

### Cache Statistics
```typescript
const cache = getCache();
const stats = cache.getStats();
console.log(stats); // { size, hits, misses, hitRate, keys }
```

### Health Checks
Monitor `/health` endpoint for uptime and service status.

### Request Tracing
All requests now have `X-Request-ID` header for correlation.

## Future Improvements

### Recommended Next Steps
1. **Redis Integration**: Replace in-memory cache with Redis for distributed systems
2. **Metrics**: Add Prometheus metrics for monitoring
3. **Database**: Add database layer with connection pooling
4. **Queue System**: Add message queue for async processing
5. **API Gateway**: Add rate limiting at gateway level
6. **Circuit Breaker**: Add circuit breaker for AI provider calls
7. **Load Balancing**: Deploy multiple instances behind load balancer

### Scalability Milestones
- **Current**: Single-instance, in-memory cache
- **Phase 2**: Multi-instance with Redis
- **Phase 3**: Microservices architecture
- **Phase 4**: Kubernetes deployment with auto-scaling

## Conclusion

The refactoring provides a solid foundation for scaling the NeuroDrive platform. The architecture now supports:
- Easy testing and maintenance
- Horizontal scaling with minimal changes
- Enhanced security posture
- Better performance through caching
- Clear separation of concerns

All changes maintain backward compatibility with existing API contracts.
