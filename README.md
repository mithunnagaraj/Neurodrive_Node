# NeuroDrive Backend

Production-grade backend for AI Co-Driver Platform built with Node.js, Express, and TypeScript.

## 🚀 Features

- **TypeScript** with strict mode enabled
- **Express.js** for robust API routing
- **CORS** with configurable origins
- **Global error handling** middleware
- **Request logging** middleware
- **Health check** endpoint
- **Environment configuration** with dotenv
- **Security** with Helmet
- **Compression** enabled
- **Async/await** pattern throughout
- **Production-ready** structure

## 📁 Project Structure

```
src/
├── config/           # Configuration files and environment setup
├── controllers/      # Request handlers (business logic)
├── middleware/       # Custom middleware (auth, error handling, logging)
├── routes/           # API route definitions
├── services/         # Business logic and external integrations
└── utils/            # Utility functions and helpers
    ├── asyncHandler.ts   # Async error handling wrapper
    ├── errors.ts         # Custom error classes
    └── logger.ts         # Logging utility
```

## 🛠️ Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
NODE_ENV=development
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
API_VERSION=v1
LOG_LEVEL=info
```

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Build TypeScript
npm run build

# Start server
npm start
```

## 📡 API Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-24T10:30:00.000Z",
  "uptime": 123.456,
  "service": "neurodrive-backend"
}
```

### Chat API

#### Send Chat Message
```
POST /api/v1/chat
```

**Request Body:**
```json
{
  "message": "string (required, max 2000 chars)",
  "userId": "string (required)",
  "provider": "auto" | "openai" | "gemini" (optional, default: "auto")
}
```

**Validation Rules:**
- `message`: Required, must be a non-empty string, max 2000 characters
- `userId`: Required, must be a string
- `provider`: Optional, must be one of: "auto", "openai", "gemini"

**Response:**
```json
{
  "reply": "AI generated response",
  "providerUsed": "openai"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how are you?",
    "userId": "user123",
    "provider": "openai"
  }'
```

**Error Responses:**
```json
{
  "status": "error",
  "message": "Message is required"
}
```

#### Get Available Providers
```
GET /api/v1/chat/providers?userId=<userId>
```

**Query Parameters:**
- `userId`: Required - User identifier to check provider availability

**Response:**
```json
{
  "providers": ["openai", "gemini"],
  "count": 2
}
```

**Example Request:**
```bash
curl http://localhost:3000/api/v1/chat/providers?userId=user123
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## 🏗️ Architecture Patterns

### Async Handler
All controllers use the `asyncHandler` wrapper to automatically catch errors:

```typescript
import { asyncHandler } from '../utils/asyncHandler';

export const myController = asyncHandler(async (req, res) => {
  // Your async code here
  // Errors are automatically caught and passed to error handler
});
```

### Error Handling
Custom error classes for different HTTP status codes:

```typescript
import { NotFoundError, BadRequestError } from '../utils/errors';

throw new NotFoundError('Resource not found');
throw new BadRequestError('Invalid input');
```

### Service Layer
Business logic is separated into services:

```typescript
// services/myService.ts
class MyService {
  async getData() {
    // Business logic here
  }
}
```

### Chat API Architecture (3-Layer Pattern)

The Chat API follows a clean three-layer architecture:

**Controller → Service → Provider**

```
┌─────────────────────────────────────────┐
│         chatController.ts               │
│  (HTTP Request/Response Handling)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          chatService.ts                 │
│  (Business Logic & Provider Selection)  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│       ProviderFactory.ts                │
│  (AI Provider Management)               │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌────────────┐   ┌────────────┐
│  OpenAI    │   │  Gemini    │
│  Provider  │   │  Provider  │
└────────────┘   └────────────┘
```

**Layer Responsibilities:**

1. **Controller Layer** ([chatController.ts](src/controllers/chatController.ts))
   - Handles HTTP requests and responses
   - Validates request format
   - Returns appropriate HTTP status codes

2. **Service Layer** ([chatService.ts](src/services/chatService.ts))
   - Contains business logic
   - Manages provider selection (auto/manual)
   - Coordinates between controller and providers
   - Handles error scenarios

3. **Provider Layer** ([providers/](src/providers/))
   - Implements `IAIProvider` interface
   - Manages API integrations (OpenAI, Gemini)
   - Handles BYOK (Bring Your Own Key) logic
   - Isolated, pluggable architecture

**Benefits:**
- ✅ **Separation of Concerns**: Each layer has a single responsibility
- ✅ **Testability**: Easy to mock and test each layer independently
- ✅ **Extensibility**: Add new providers by implementing `IAIProvider`
- ✅ **Maintainability**: Changes to one layer don't affect others

## 🔐 Security

- **Helmet** - Security headers
- **CORS** - Configurable cross-origin resource sharing
- **Body parsing limits** - Prevent payload attacks
- **Strict TypeScript** - Type safety

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | `development` |
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `localhost` |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `API_VERSION` | API version | `v1` |
| `LOG_LEVEL` | Logging level | `info` |

## 🚦 Next Steps

1. **Authentication**: Add JWT middleware
2. **Database**: Integrate MongoDB/PostgreSQL
3. **Validation**: Add request validation (Joi/Zod)
4. **Rate Limiting**: Implement rate limiting
5. **API Versioning**: Create versioned routes
6. **Testing**: Add unit and integration tests
7. **Documentation**: Add Swagger/OpenAPI documentation
8. **Monitoring**: Integrate application monitoring

## 📄 License

MIT
