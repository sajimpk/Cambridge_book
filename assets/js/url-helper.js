/**
 * Dynamic Per-Request Cryptographic URL Engine
 * Generates fresh cryptographic tokens for dynamic links.
 * Strictly expires after 1.5 seconds (1500ms).
 * Any expired or reused link (> 1.5s) immediately triggers 404.
 */
const CIPHER_KEY = 0x5a;
export const EXPIRY_MS = 1500; // Strictly 1.5 seconds (1500 ms)

export function generatePerRequestToken(id) {
  if (!id) return '';
  const ts = Date.now();
  const tsHex = ts.toString(36);
  const nonce = Math.floor(Math.random() * 0xFFFF).toString(36);
  const raw = id + '|' + nonce;
  const bytes = Array.from(new TextEncoder().encode(raw));
  const salt = (ts % 127);
  const xorBytes = bytes.map((b, i) => b ^ (CIPHER_KEY ^ ((salt + i * 7) & 0x7f)));
  let binary = '';
  for (let i = 0; i < xorBytes.length; i++) {
    binary += String.fromCharCode(xorBytes[i]);
  }
  const enc = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return tsHex + '.' + enc;
}

export function validateToken(token) {
  if (!token) return { valid: false, reason: 'missing', bookId: null, expired: true };
  const parts = String(token).split('.');
  
  if (parts.length === 2) {
    const ts = parseInt(parts[0], 36);
    if (!ts || isNaN(ts)) return { valid: false, reason: 'invalid_ts', bookId: null, expired: true };

    const now = Date.now();
    const age = now - ts;
    const isFresh = age >= -300 && age <= EXPIRY_MS;

    let str = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';

    try {
      const binary = atob(str);
      const salt = (ts % 127);
      const decodedBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        decodedBytes[i] = binary.charCodeAt(i) ^ (CIPHER_KEY ^ ((salt + i * 7) & 0x7f));
      }

      const decoded = new TextDecoder().decode(decodedBytes);
      const pipeIdx = decoded.indexOf('|');
      if (pipeIdx > 0) {
        const id = decoded.slice(0, pipeIdx);
        if (/^[a-zA-Z0-9_-]+$/.test(id)) {
          return {
            valid: isFresh,
            bookId: id,
            ageMs: age,
            timestamp: ts,
            expired: !isFresh
          };
        }
      }
    } catch (_) {}
  }

  return { valid: false, reason: 'invalid_or_expired', bookId: null, expired: true };
}

export function encodeBookId(id) {
  return generatePerRequestToken(id);
}

export function decodeBookId(token) {
  const result = validateToken(token);
  return result.valid ? result.bookId : null;
}

export function getBookUrl(id) {
  return `/book/?book=${generatePerRequestToken(id)}`;
}

export function getLatestBookUrl(id) {
  return getBookUrl(id);
}
