/**
 * The Vaults' encryption. It runs only in the browser (and in the Backup file):
 * the Passphrase never leaves it, and the server stores only what this seals.
 *
 * The Passphrase stretches (PBKDF2-SHA256) into 64 bytes: the first 32 are the
 * AES-GCM key that seals each Secret's text; the last 32 are the proof, which
 * shows the server the Vaults are open before it lets anything in them change.
 * The server keeps only a hash of the proof. See docs/adr/0003.
 */

export const VAULT_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 12;
export const MAX_VAULT_NAME = 80;
export const MAX_SECRET_TITLE = 200;
export const MAX_SECRET_TEXT = 20_000;
/** Minutes without using the Vaults before they lock themselves. */
export const IDLE_LOCK_MIN = 5;
/** Seconds before a copied Secret is cleared from the clipboard. */
export const CLIPBOARD_CLEAR_S = 30;

/** What the check seals: opening it proves the Passphrase is the right one. */
const CHECK_TEXT = "Ivan OS Vault";

/** Encrypted text: base64 of the 12-byte IV and of the AES-GCM ciphertext. */
export type Sealed = { iv: string; ciphertext: string };

/** What the server keeps about the Passphrase. None of it reveals it. */
export type PassphraseRecord = {
  salt: string;
  iterations: number;
  check: Sealed;
};

export type VaultKeys = { key: CryptoKey; proof: string };

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKeys(passphrase: string, salt: string, iterations: number): Promise<VaultKeys> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations }, material, 512),
  );
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, proof: toBase64(bits.slice(32)) };
}

export async function seal(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

/** Throws when the key is not the one that sealed it (or the text was tampered with). */
export async function open(key: CryptoKey, sealed: Sealed): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(sealed.iv) },
    key,
    fromBase64(sealed.ciphertext),
  );
  return new TextDecoder().decode(plain);
}

/** A new Passphrase: a fresh salt, its keys and the check that recognizes it. */
export async function createPassphrase(
  passphrase: string,
  iterations = VAULT_ITERATIONS,
): Promise<{ record: PassphraseRecord; keys: VaultKeys }> {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const keys = await deriveKeys(passphrase, salt, iterations);
  return { record: { salt, iterations, check: await seal(keys.key, CHECK_TEXT) }, keys };
}

/** The keys when the Passphrase is right; null when it is not. */
export async function unlock(passphrase: string, record: PassphraseRecord): Promise<VaultKeys | null> {
  const keys = await deriveKeys(passphrase, record.salt, record.iterations);
  try {
    return (await open(keys.key, record.check)) === CHECK_TEXT ? keys : null;
  } catch {
    return null;
  }
}

/** Why a new Passphrase can't be used yet; null when it can. */
export function passphraseProblem(passphrase: string, repeated: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE) return `Use at least ${MIN_PASSPHRASE} characters.`;
  if (passphrase !== repeated) return "The two don't match.";
  return null;
}
