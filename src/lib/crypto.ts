/**
 * E2EE Crypto Library — ECDH P-256 + AES-256-GCM
 *
 * Flow:
 * 1. Each user generates an ECDH key pair on signup/first use
 * 2. When a family is created, a random AES-256 family key is generated
 * 3. The family key is encrypted with each member's ECDH public key → stored in `family_keys`
 * 4. Messages are encrypted with the family AES key
 * 5. Staff have a separate staff key
 */

// ─── Key Pair (ECDH P-256) ──────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(raw);
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBuf(base64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

export async function importPrivateKey(jwkStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkStr);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
}

// ─── Derive shared secret (for encrypting the family key) ──

async function deriveAESKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ─── AES-256-GCM ────────────────────────────────────────

export async function generateFamilyKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportAESKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return bufToBase64(raw);
}

export async function importAESKey(base64: string): Promise<CryptoKey> {
  const raw = base64ToBuf(base64);
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

export async function encryptMessage(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return {
    ciphertext: bufToBase64(cipherBuf),
    iv: bufToBase64(iv.buffer),
  };
}

export async function decryptMessage(
  key: CryptoKey,
  payload: EncryptedPayload
): Promise<string> {
  const iv = base64ToBuf(payload.iv);
  const cipherBuf = base64ToBuf(payload.ciphertext);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBuf
  );
  return new TextDecoder().decode(plainBuf);
}

// ─── Family Key Wrapping ────────────────────────────────
// Encrypt the raw family AES key FOR a specific user using ECDH shared secret

export async function wrapFamilyKey(
  familyKey: CryptoKey,
  myPrivateKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<EncryptedPayload> {
  const sharedKey = await deriveAESKey(myPrivateKey, recipientPublicKey);
  const rawFamily = await crypto.subtle.exportKey("raw", familyKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    rawFamily
  );
  return {
    ciphertext: bufToBase64(wrapped),
    iv: bufToBase64(iv.buffer),
  };
}

export async function unwrapFamilyKey(
  wrapped: EncryptedPayload,
  myPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey
): Promise<CryptoKey> {
  const sharedKey = await deriveAESKey(myPrivateKey, senderPublicKey);
  const iv = base64ToBuf(wrapped.iv);
  const cipherBuf = base64ToBuf(wrapped.ciphertext);
  const rawFamily = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    cipherBuf
  );
  return crypto.subtle.importKey(
    "raw",
    rawFamily,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ─── Local Key Storage (IndexedDB) ─────────────────────
// Private keys never leave the device

const DB_NAME = "3ilti-keys";
const STORE_NAME = "keys";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePrivateKeyLocally(
  userId: string,
  privateKey: CryptoKey
): Promise<void> {
  const db = await openDB();
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(jwk, `private-${userId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPrivateKeyLocally(
  userId: string
): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(`private-${userId}`);
    req.onsuccess = async () => {
      if (!req.result) return resolve(null);
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          req.result,
          { name: "ECDH", namedCurve: "P-256" },
          true,
          ["deriveKey", "deriveBits"]
        );
        resolve(key);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveFamilyKeyLocally(
  familyId: string,
  key: CryptoKey
): Promise<void> {
  const db = await openDB();
  const raw = await crypto.subtle.exportKey("raw", key);
  const b64 = bufToBase64(raw);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(b64, `family-${familyId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFamilyKeyLocally(
  familyId: string
): Promise<CryptoKey | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(`family-${familyId}`);
    req.onsuccess = async () => {
      if (!req.result) return resolve(null);
      try {
        const key = await importAESKey(req.result);
        resolve(key);
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Helpers ────────────────────────────────────────────

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
