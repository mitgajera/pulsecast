"use client";

import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { createContext, useContext } from "react";

type AuthState = {
  address: string | null;
  authenticated: boolean;
  configured: boolean;
  login: () => void;
  logout: () => Promise<void>;
  ready: boolean;
};

const unavailableAuth: AuthState = {
  address: null,
  authenticated: false,
  configured: false,
  login: () => undefined,
  logout: async () => undefined,
  ready: true,
};

const AuthContext = createContext<AuthState>(unavailableAuth);

export function PulseCastAuthProvider({ children, appId }: { children: React.ReactNode; appId: string | undefined }) {
  if (!appId) return <AuthContext.Provider value={unavailableAuth}>{children}</AuthContext.Provider>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          accentColor: "#5B8BB8",
          landingHeader: "Sign in to PulseCast",
          loginMessage: "Your prediction stays private until the round resolves.",
          theme: "dark",
          walletChainType: "solana-only",
        },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" } },
        loginMethods: ["email", "google", "passkey", "wallet"],
      }}
    >
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  );
}

function PrivyAuthBridge({ children }: { children: React.ReactNode }) {
  const { authenticated, login, logout, ready: authReady } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();

  return (
    <AuthContext.Provider
      value={{
        address: wallets[0]?.address ?? null,
        authenticated,
        configured: true,
        login,
        logout,
        ready: authReady && walletsReady,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function usePulseCastAuth() {
  return useContext(AuthContext);
}
