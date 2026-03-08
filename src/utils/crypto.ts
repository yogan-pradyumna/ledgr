const KEY_B64 = import.meta.env.VITE_ENCRYPTION_KEY as string | undefined;

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey | null> {
  if (!KEY_B64) return null;
  if (cachedKey) return cachedKey;
  const raw = Uint8Array.from(atob(KEY_B64), (c) => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return cachedKey;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** Encrypt a plaintext string. Returns base64(iv + ciphertext).
 *  If VITE_ENCRYPTION_KEY is not set, returns plaintext unchanged. */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), 12);
  return toBase64(combined);
}

/** Decrypt a base64(iv + ciphertext) string back to plaintext.
 *  If decryption fails (e.g. legacy unencrypted row), returns the original value unchanged. */
export async function decrypt(data: string): Promise<string> {
  const key = await getKey();
  if (!key) return data;

  try {
    const combined = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: combined.slice(0, 12) },
      key,
      combined.slice(12)
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Decryption failed — likely a legacy unencrypted row; pass through as-is
    return data;
  }
}
