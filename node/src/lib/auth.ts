import crypto from 'crypto';
import { NODE_CONFIG } from '@/config/node';

const AUTH_SECRET = () => `sqj_node_${NODE_CONFIG.adminPassword}_${NODE_CONFIG.nodeName}`;

export function generateAuthToken(): string {
  const payload = `${Date.now()}:${NODE_CONFIG.nodeName}`;
  const hmac = crypto.createHmac('sha256', AUTH_SECRET()).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64')}.${hmac}`;
}

export function validateAuthToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return false;
  try {
    const payload = Buffer.from(payloadB64, 'base64').toString();
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET()).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}
