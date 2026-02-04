import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from './auth.types';

const JWT_EXPIRES_IN = '1h';

export function verifyCredentials(email: string, password: string): boolean {
  const envEmail = process.env.OPERATOR_EMAIL;
  const envHash = process.env.OPERATOR_PASSWORD_HASH;
  if (!envEmail || !envHash) {
    throw new Error('OPERATOR_EMAIL and OPERATOR_PASSWORD_HASH must be set');
  }
  if (email !== envEmail) return false;
  return bcrypt.compareSync(password, envHash);
}

export function issueToken(email: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set');
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { sub: email, email };
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set');
  const decoded = jwt.verify(token, secret) as JwtPayload;
  return decoded;
}
