import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/** CO_CREATE_ENC_KEY must be 32 bytes, base64-encoded. Returns null when missing or malformed. */
export function loadKey(b64: string | undefined): Buffer | null {
  if (!b64) return null;
  const key = Buffer.from(b64, 'base64');
  return key.length === 32 ? key : null;
}

/** AES-256-GCM. Output: v1:<base64 iv>:<base64 tag>:<base64 ciphertext> */
export function encrypt(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

export function decrypt(payload: string, key: Buffer): string {
  const [v, iv, tag, data] = payload.split(':');
  if (v !== 'v1' || !iv || !tag || !data)
    throw new Error('Unsupported ciphertext format');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    d.update(Buffer.from(data, 'base64')),
    d.final(),
  ]).toString('utf8');
}
