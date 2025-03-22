// src/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;  // 256 bits
const IV_LENGTH = 12;   // Recommended length for GCM

export function generateKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

export function generateIV(): Buffer {
  return crypto.randomBytes(IV_LENGTH);
}

export function encryptBuffer(buffer: Buffer, key: Buffer, iv: Buffer): { encryptedData: Buffer; authTag: Buffer } {
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encryptedData: encrypted, authTag };
}

export function decryptBuffer(encryptedData: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}
