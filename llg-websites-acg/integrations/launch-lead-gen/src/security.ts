const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(
  algorithm: "SHA-1" | "SHA-256",
  secret: string,
  payload: ArrayBuffer,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, payload));
}

export function constantTimeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) {
    mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function secureTokenEqual(actual: string, expected: string): Promise<boolean> {
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return mismatch === 0;
}

export async function verifyCallRailSignature(
  payload: ArrayBuffer,
  suppliedSignature: string | null,
  signingKey: string,
): Promise<boolean> {
  if (!suppliedSignature || !signingKey) return false;
  const expected = bytesToBase64(await hmac("SHA-1", signingKey, payload));
  return constantTimeEqual(suppliedSignature.trim(), expected);
}

export async function verifyCallRailSignatures(
  payload: ArrayBuffer,
  suppliedSignature: string | null,
  signingKeys: Iterable<string>,
): Promise<boolean> {
  const uniqueKeys = Array.from(new Set(
    Array.from(signingKeys, (key) => key.trim()).filter(Boolean),
  ));
  if (!suppliedSignature || !uniqueKeys.length) return false;
  const results = await Promise.all(
    uniqueKeys.map((key) => verifyCallRailSignature(payload, suppliedSignature, key)),
  );
  return results.some(Boolean);
}

export async function verifyMetaSignature(
  payload: ArrayBuffer,
  suppliedSignature: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!suppliedSignature || !appSecret) return false;
  const expected = `sha256=${bytesToHex(await hmac("SHA-256", appSecret, payload))}`;
  return constantTimeEqual(suppliedSignature.trim().toLowerCase(), expected);
}

export async function verifyBlandWebhookSignature(
  payload: ArrayBuffer,
  suppliedSignature: string | null,
  signingSecret: string | undefined,
): Promise<boolean> {
  if (!suppliedSignature || !signingSecret) return false;
  const expected = bytesToHex(await hmac("SHA-256", signingSecret, payload));
  return constantTimeEqual(suppliedSignature.trim().toLowerCase(), expected);
}

export function isFreshTimestamp(value: unknown, now = Date.now(), maxAgeMinutes = 15): boolean {
  if (value === undefined || value === null) return false;
  const numeric = typeof value === "number" ? value : Number(value);
  const parsed = Number.isFinite(numeric)
    ? numeric > 10_000_000_000
      ? numeric
      : numeric * 1000
    : Date.parse(String(value));
  return Number.isFinite(parsed) && Math.abs(now - parsed) <= maxAgeMinutes * 60_000;
}

export async function readBoundedBody(request: Request, maxBytes = 256_000): Promise<ArrayBuffer> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new Error("payload_too_large");
  const body = await request.arrayBuffer();
  if (body.byteLength > maxBytes) throw new Error("payload_too_large");
  return body;
}
