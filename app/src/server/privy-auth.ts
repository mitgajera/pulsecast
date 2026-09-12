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
    readonly status: 401 | 403 | 500,
    readonly code: "authentication_required" | "invalid_access_token" | "auth_not_configured" | "wallet_not_authorized",
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
const walletAuthorizations = new Map<string, { addresses: Set<string>; expiresAt: number }>();

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

export async function verifyPrivyWalletRequest(request: Request, wallet: string) {
  const session = await verifyPrivyRequest(request);
  let authorization = walletAuthorizations.get(session.userId);
  if (!authorization || authorization.expiresAt <= Date.now()) {
    const user = await getPrivyClient().users()._get(session.userId);
    const addresses = user.linked_accounts
      .filter((account) => account.type === "wallet" && "chain_type" in account && account.chain_type === "solana")
      .map((account) => account.address);
    authorization = { addresses: new Set(addresses), expiresAt: Date.now() + 5 * 60_000 };
    walletAuthorizations.set(session.userId, authorization);
  }
  if (!authorization.addresses.has(wallet)) {
    throw new ApiAuthError("This Solana wallet is not linked to your Privy account.", 403, "wallet_not_authorized");
  }
  return session;
}
