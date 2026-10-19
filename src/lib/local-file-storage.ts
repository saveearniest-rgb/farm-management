import "server-only";

import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const storageRoot = path.resolve(/*turbopackIgnore: true*/
  process.env.LOCAL_FILE_STORAGE_PATH ?? path.join(process.cwd(), "private-uploads"),
);
const fileHeader = Buffer.from("SHAMBA1");

function encryptionKey() {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || Buffer.byteLength(authSecret) < 32) {
    throw new Error("AUTH_SECRET must be at least 32 bytes to encrypt private farm files.");
  }
  return createHmac("sha256", authSecret).update("shamba-private-file-storage-v1").digest();
}

function encryptFile(bytes: Uint8Array) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([fileHeader, nonce, cipher.getAuthTag(), ciphertext]);
}

export function newStorageKey() {
  return `${randomUUID()}.bin`;
}

function resolveStoragePath(key: string) {
  if (!/^[0-9a-f-]{36}\.bin$/i.test(key)) {
    throw new Error("Invalid private storage key.");
  }
  const resolved = path.resolve(/*turbopackIgnore: true*/ storageRoot, key);
  if (path.dirname(resolved).toLowerCase() !== storageRoot.toLowerCase()) {
    throw new Error("Invalid private storage path.");
  }
  return resolved;
}

export async function storePrivateFile(key: string, bytes: Uint8Array) {
  await mkdir(/*turbopackIgnore: true*/ storageRoot, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ resolveStoragePath(key), encryptFile(bytes), { flag: "wx", mode: 0o600 });
}

export async function readPrivateFile(key: string) {
  const stored = await readFile(/*turbopackIgnore: true*/ resolveStoragePath(key));
  const headerEnd = fileHeader.length;
  if (!stored.subarray(0, headerEnd).equals(fileHeader)) {
    throw new Error("Private file is not encrypted with the current storage format.");
  }
  const nonceEnd = headerEnd + 12;
  const tagEnd = nonceEnd + 16;
  if (stored.length < tagEnd) throw new Error("Private file is incomplete.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), stored.subarray(headerEnd, nonceEnd));
  decipher.setAuthTag(stored.subarray(nonceEnd, tagEnd));
  return Buffer.concat([decipher.update(stored.subarray(tagEnd)), decipher.final()]);
}

export async function removePrivateFile(key: string) {
  await rm(/*turbopackIgnore: true*/ resolveStoragePath(key), { force: true });
}
