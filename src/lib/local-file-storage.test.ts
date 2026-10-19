import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

describe("local private file storage", () => {
  let directory: string;
  let newStorageKey: typeof import("./local-file-storage").newStorageKey;
  let readPrivateFile: typeof import("./local-file-storage").readPrivateFile;
  let storePrivateFile: typeof import("./local-file-storage").storePrivateFile;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "shamba-private-files-"));
    vi.stubEnv("AUTH_SECRET", "local-test-secret-with-at-least-32-bytes");
    vi.stubEnv("LOCAL_FILE_STORAGE_PATH", directory);
    vi.resetModules();
    ({ newStorageKey, readPrivateFile, storePrivateFile } = await import("./local-file-storage"));
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("encrypts uploaded bytes at rest and decrypts them on read", async () => {
    const key = newStorageKey();
    const original = Buffer.from("private farm document contents");
    await storePrivateFile(key, original);

    const stored = await readFile(path.join(directory, key));
    expect(stored.subarray(0, 7).toString()).toBe("SHAMBA1");
    expect(stored.includes(original)).toBe(false);
    expect(await readPrivateFile(key)).toEqual(original);
  });

  it("rejects storage keys that could escape the private directory", async () => {
    await expect(readPrivateFile("..\\secret.bin")).rejects.toThrow("Invalid private storage key.");
  });
});
