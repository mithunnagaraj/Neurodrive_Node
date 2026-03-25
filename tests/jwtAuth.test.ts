import { JWTService } from '../src/middleware/jwtAuth';
import { UnauthorizedError } from '../src/utils/errors';
import jwt from 'jsonwebtoken';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = new JWTService();
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
      };

      const token = jwtService.generateToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should include payload in token', () => {
      const payload = {
        userId: 'user-456',
        email: 'admin@example.com',
        role: 'admin',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwt.decode(token) as any;

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const payload = {
        userId: 'user-789',
        email: 'verify@example.com',
        role: 'user',
      };

      const token = jwtService.generateToken(payload);
      const verified = jwtService.verifyToken(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
    });

    it('should throw UnauthorizedError for invalid token', () => {
      expect(() => {
        jwtService.verifyToken('invalid-token');
      }).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for expired token', () => {
      // Create token that expires immediately
      const token = jwt.sign(
        { userId: 'user-expired', email: 'expired@example.com' },
        process.env['JWT_SECRET'] || 'test-secret',
        { expiresIn: '-1s' }
      );

      expect(() => {
        jwtService.verifyToken(token);
      }).toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError for tampered token', () => {
      const payload = { userId: 'user-tamper', email: 'tamper@example.com' };
      const token = jwtService.generateToken(payload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => {
        jwtService.verifyToken(tamperedToken);
      }).toThrow(UnauthorizedError);
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await jwtService.hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'SamePassword';
      const hash1 = await jwtService.hashPassword(password);
      const hash2 = await jwtService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'CorrectPassword123';
      const hash = await jwtService.hashPassword(password);
      const isMatch = await jwtService.comparePassword(password, hash);

      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'CorrectPassword';
      const wrongPassword = 'WrongPassword';
      const hash = await jwtService.hashPassword(password);
      const isMatch = await jwtService.comparePassword(wrongPassword, hash);

      expect(isMatch).toBe(false);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const payload = {
        userId: 'user-decode',
        email: 'decode@example.com',
      };

      const token = jwtService.generateToken(payload);
      const decoded = jwtService.decodeToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeToken('completely-invalid');
      expect(decoded).toBeNull();
    });
  });
});
