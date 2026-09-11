import { PrivyClient } from "@privy-io/node";

type Environment = Record<string, string | undefined>;

export type AuthenticatedPrivyUser = {
  expiresAt: number;
  sessionId: string;
  userId: string;
};

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 500,
    readonly code: "authentication_required" | "invalid_access_token" | "auth_not_configured",
  ) {
    super(message);
  }
}

export function getBearerToken(authorization: string | null) {
  if (!authorization) throw new ApiAuthError("Sign in to continue.", 401, "authentication_required");
  const match = /^Bearer ([^\s]{1,8192})$/.exec(authorization);
  const token = match?.[1];
  if (!token) throw new ApiAuthError("Use a valid bearer access token.", 401, "invalid_access_token");
  return token;
}

export function readPrivyAuthConfig(environment: Environment = process.env) {
  const appId = environment.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  const appSecret = environment.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new ApiAuthError("Privy server authentication is not configured.", 500, "auth_not_configured");
  }
  return { appId, appSecret };
}

let cachedClient: PrivyClient | undefined;
let cachedConfigKey = "";

function getPrivyClient() {
  const config = readPrivyAuthConfig();
  const configKey = `${config.appId}:${config.appSecret}`;
  if (!cachedClient || cachedConfigKey !== configKey) {
    cachedClient = new PrivyClient(config);
    cachedConfigKey = configKey;
  }
  return cachedClient;
}

export async function verifyPrivyRequest(request: Request): Promise<AuthenticatedPrivyUser> {
  const accessToken = getBearerToken(request.headers.get("authorization"));
  try {
    const claims = await getPrivyClient().utils().auth().verifyAccessToken(accessToken);
    return {
      expiresAt: claims.expiration,
      sessionId: claims.session_id,
      userId: claims.user_id,
    };
  } catch (error) {
    if (error instanceof ApiAuthError) throw error;
    throw new ApiAuthError("Your session is invalid or expired. Sign in again.", 401, "invalid_access_token");
  }
}
