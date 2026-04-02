import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export async function getGoogleAccessToken(scopes) {
  const credentials = await loadServiceAccountCredentials();
  const accessToken = await fetchAccessToken(credentials, scopes);
  return {
    accessToken,
    clientEmail: credentials.client_email,
  };
}

async function loadServiceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return normalizeCredentials(JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON));
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8");
    return normalizeCredentials(JSON.parse(raw));
  }

  throw new Error(
    "Missing Google service account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS.",
  );
}

function normalizeCredentials(credentials) {
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error("Google service account credentials must include client_email and private_key.");
  }

  return {
    client_email: credentials.client_email,
    private_key: String(credentials.private_key).replace(/\\n/g, "\n"),
    token_uri: credentials.token_uri || TOKEN_ENDPOINT,
  };
}

async function fetchAccessToken(credentials, scopes) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    scope: scopes.join(" "),
    aud: credentials.token_uri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const assertion = signJwt({
    header: { alg: "RS256", typ: "JWT" },
    payload,
    privateKey: credentials.private_key,
  });

  const response = await fetch(credentials.token_uri, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || !body.access_token) {
    throw new Error(
      `Failed to fetch Google access token: ${response.status} ${JSON.stringify(body)}`,
    );
  }

  return body.access_token;
}

function signJwt({ header, payload, privateKey }) {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${unsignedToken}.${toBase64Url(signature)}`;
}

function base64UrlEncode(value) {
  return toBase64Url(Buffer.from(value, "utf8"));
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
