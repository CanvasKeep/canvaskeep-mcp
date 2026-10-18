import { webcrypto } from "node:crypto";

const subtle = webcrypto.subtle;
const ALGO = "AES-GCM";
const KEY_BITS = 128;
const IV_BYTES = 12;
const VERSION_BYTE = 0x01;

async function importKey(
  base64url: string,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const raw = base64UrlToBuffer(base64url);
  return subtle.importKey("raw", raw, { name: ALGO, length: KEY_BITS }, true, usages);
}

export async function decryptScene(
  blob: ArrayBuffer,
  keyBase64Url: string,
): Promise<string> {
  const bytes = new Uint8Array(blob);

  const version = bytes[0];
  if (version !== VERSION_BYTE) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const iv = bytes.slice(1, 1 + IV_BYTES);
  const ciphertext = bytes.slice(1 + IV_BYTES);

  const key = await importKey(keyBase64Url, ["decrypt"]);
  const plaintext = await subtle.decrypt({ name: ALGO, iv }, key, ciphertext);

  return new TextDecoder().decode(plaintext);
}

export async function encryptScene(
  jsonString: string,
  keyBase64Url: string,
): Promise<ArrayBuffer> {
  const key = await importKey(keyBase64Url, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(jsonString);

  const ciphertext = await subtle.encrypt({ name: ALGO, iv }, key, plaintext);

  const out = new Uint8Array(1 + IV_BYTES + ciphertext.byteLength);
  out[0] = VERSION_BYTE;
  out.set(iv, 1);
  out.set(new Uint8Array(ciphertext), 1 + IV_BYTES);
  return out.buffer;
}

export async function unwrapDiagramKey(
  wrappedBase64: string,
  masterKeyBase64Url: string,
): Promise<string> {
  const masterKey = await importKey(masterKeyBase64Url, ["decrypt"]);
  const bytes = new Uint8Array(base64ToBuffer(wrappedBase64));

  const iv = bytes.slice(0, IV_BYTES);
  const wrapped = bytes.slice(IV_BYTES);

  const raw = await subtle.decrypt({ name: ALGO, iv }, masterKey, wrapped);
  return bufferToBase64Url(raw);
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const buf = Buffer.from(base64url, "base64url");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}
