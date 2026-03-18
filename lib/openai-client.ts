/**
 * OpenAI BYOK (Bring Your Own Key) wrapper.
 *
 * Provides:
 *  - encryptApiKey / decryptApiKey  — AES-256-GCM encryption using ENCRYPTION_KEY env var
 *  - validateKey                    — validates an API key and returns Vision-capable models
 *  - listModels                     — lists Vision-capable models for a given API key
 *  - createClient                   — creates an OpenAI client instance (never stored globally)
 */

import crypto from "crypto";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Encryption helpers
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag (GCM default)

/**
 * Returns a 32-byte Buffer derived from ENCRYPTION_KEY env var.
 * Expects a 64-character hex string (32 bytes).
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set.");
  }
  // Support both 64-char hex (32 bytes) and raw 32-char strings
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  if (key.length === 32) {
    return Buffer.from(key, "utf8");
  }
  throw new Error(
    "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:authTag:ciphertext
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Encode as: base64(iv):base64(authTag):base64(ciphertext)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a string that was encrypted with encryptApiKey.
 * Expects format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted API key format.");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encryptedData = Buffer.from(parts[2], "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ---------------------------------------------------------------------------
// OpenAI client factory
// ---------------------------------------------------------------------------

/**
 * Creates a new OpenAI client for the given API key.
 * Never stores the instance globally — one client per request.
 */
export function createClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Vision-capable model filtering
// ---------------------------------------------------------------------------

/** Model ID patterns that indicate Vision capability */
const VISION_PATTERNS = ["gpt-4o", "gpt-4-turbo", "gpt-4-vision", "o1", "o3"];

/**
 * Returns true if the model ID is considered Vision-capable.
 * Includes gpt-4o*, gpt-4-turbo*, gpt-4-vision*, o1*, o3* series.
 * Excludes instruct-only variants that don't support vision.
 */
export function isVisionCapable(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return VISION_PATTERNS.some((pattern) => id.includes(pattern));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string;
  created: number;
}

/**
 * Validates an OpenAI API key by making a lightweight models.list() call.
 * Returns the list of Vision-capable models on success.
 * Throws an error with a user-friendly message on failure.
 */
export async function validateKey(apiKey: string): Promise<ModelInfo[]> {
  const client = createClient(apiKey);

  try {
    const modelsPage = await client.models.list();
    const visionModels = modelsPage.data
      .filter((m) => isVisionCapable(m.id))
      .sort((a, b) => b.created - a.created)
      .map((m) => ({ id: m.id, created: m.created }));

    return visionModels;
  } catch (err: unknown) {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 401) {
        throw new Error(
          "Invalid API key — please check your OpenAI dashboard"
        );
      }
      throw new Error(`OpenAI API error: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Lists Vision-capable models for a given API key.
 * Alias for validateKey — returns models without treating a valid call as "validation".
 */
export async function listModels(apiKey: string): Promise<ModelInfo[]> {
  return validateKey(apiKey);
}
