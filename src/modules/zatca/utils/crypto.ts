import crypto from 'crypto';
import { env } from '../../../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypts a sensitive string using AES-256-GCM.
 * Used for storing Private Keys and Secrets in the database.
 */
export function encryptSecret(text: string): string {
  const key = Buffer.from(env.zatca.encryptionKey, 'utf8');
  if (key.length !== 32) {
    throw new Error('ZATCA_ENCRYPTION_KEY must be exactly 32 bytes.');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a previously encrypted sensitive string.
 */
export function decryptSecret(encryptedText: string): string {
  const key = Buffer.from(env.zatca.encryptionKey, 'utf8');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
