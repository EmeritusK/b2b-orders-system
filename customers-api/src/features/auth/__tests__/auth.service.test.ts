import * as authService from '../auth.service';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('auth.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyCredentials', () => {
    it('should throw error if env vars are missing', () => {
      delete process.env.OPERATOR_EMAIL;
      delete process.env.OPERATOR_PASSWORD_HASH;
      expect(() => authService.verifyCredentials('test@test.com', 'password')).toThrow(
        'OPERATOR_EMAIL and OPERATOR_PASSWORD_HASH must be set',
      );
    });

    it('should return false if email does not match', () => {
      process.env.OPERATOR_EMAIL = 'admin@example.com';
      process.env.OPERATOR_PASSWORD_HASH = 'hash';
      expect(authService.verifyCredentials('wrong@example.com', 'password')).toBe(false);
    });

    it('should call bcrypt.compareSync if email matches', () => {
      process.env.OPERATOR_EMAIL = 'admin@example.com';
      process.env.OPERATOR_PASSWORD_HASH = 'hash';
      (bcrypt.compareSync as jest.Mock).mockReturnValue(true);

      const result = authService.verifyCredentials('admin@example.com', 'password');

      expect(result).toBe(true);
      expect(bcrypt.compareSync).toHaveBeenCalledWith('password', 'hash');
    });
  });

  describe('issueToken', () => {
    it('should throw error if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;
      expect(() => authService.issueToken('admin@example.com')).toThrow('JWT_SECRET must be set');
    });

    it('should return token', () => {
      process.env.JWT_SECRET = 'secret';
      (jwt.sign as jest.Mock).mockReturnValue('fake-jwt-token');

      const result = authService.issueToken('admin@example.com');

      expect(result).toBe('fake-jwt-token');
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'admin@example.com', email: 'admin@example.com' },
        'secret',
        { expiresIn: '1h' },
      );
    });
  });
});
