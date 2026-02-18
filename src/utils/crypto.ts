import crypto from "node:crypto";

import { env } from "../config/env";

const ENCRYPTION_KEY = Buffer.from(env.TOKEN_ENCRYPTION_KEY, "hex");

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes.");
}

export const encryptString = (plaintext: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decryptString = (cipherText: string): string => {
  const [ivHex, authTagHex, payloadHex] = cipherText.split(":");

  if (!ivHex || !authTagHex || !payloadHex) {
    throw new Error("Malformed encrypted token payload.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const payload = Buffer.from(payloadHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
};

