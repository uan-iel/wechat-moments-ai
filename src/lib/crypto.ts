import crypto from "crypto";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  const secret = process.env.APP_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("APP_ENCRYPTION_KEY is required to encrypt API keys and sensitive settings");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(plainText: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptText(cipherText: string) {
  const [ivValue, authTagValue, encryptedValue] = cipherText.split(".");

  if (!ivValue || !authTagValue || !encryptedValue) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function maskSecret(value: string) {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createSignedState() {
  const payload = {
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: Date.now()
  };
  const payloadValue = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(payloadValue)
    .digest("base64url");

  return `${payloadValue}.${signature}`;
}

export function verifySignedState(state: string, maxAgeMs = 10 * 60 * 1000) {
  const [payloadValue, signature] = state.split(".");

  if (!payloadValue || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(payloadValue)
    .digest("base64url");

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return false;
  }

  const payload = JSON.parse(Buffer.from(payloadValue, "base64url").toString("utf8")) as {
    issuedAt: number;
  };

  return Date.now() - payload.issuedAt <= maxAgeMs;
}
