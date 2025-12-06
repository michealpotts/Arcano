import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import loginWithWallet from "../services/walletAuth";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);

  const detectProvider = useCallback(() => {
    // Only support Gala wallet (window.gala). Keep logic minimal and explicit.
    if (typeof window === "undefined") return null;
    return window.gala || null;
  }, []);

  const handleAccounts = useCallback((accounts) => {
    if (Array.isArray(accounts) && accounts.length > 0) {
      setAccount(accounts[0]);
    } else {
      setAccount(null);
    }
  }, []);

  const handleChain = useCallback((chain) => {
    setChainId(chain?.toString?.() ?? chain);
  }, []);

  const connect = useCallback(async () => {
    const p = detectProvider();
    if (!p) {
      console.warn("No Gala wallet provider detected");
      return { error: new Error("no_provider") };
    }

    try {
      // Request accounts from wallet
      let accounts;
      if (p.request) {
        accounts = await p.request({ method: "eth_requestAccounts" });
      } else if (p.enable) {
        accounts = await p.enable();
      }

      if (!accounts || accounts.length === 0) {
        return { error: new Error("No accounts returned from wallet") };
      }

      const acct = accounts[0];

      // Perform wallet-based authentication: sign challenge and login
      const loginRes = await loginWithWallet(p, acct);
      const { token, profile } = loginRes;

      // Update provider/account/chain listeners after successful auth
      setProvider(p);
      handleAccounts(accounts);

      try {
        const id = await (p.request ? p.request({ method: "eth_chainId" }) : null);
        handleChain(id);
      } catch (e) {
        // ignore chain id error
      }

      // Setup event listeners
      if (p.on) {
        p.on("accountsChanged", handleAccounts);
        p.on("chainChanged", handleChain);
      }

      return { success: true, token, profile };
    } catch (err) {
      console.error("Wallet connection failed:", err);
      return { error: err };
    }
  }, [detectProvider, handleAccounts, handleChain]);

  const disconnect = useCallback(() => {
    const p = provider || detectProvider();
    if (p && p.removeListener) {
      try {
        p.removeListener("accountsChanged", handleAccounts);
        p.removeListener("chainChanged", handleChain);
      } catch (e) {
        // ignore
      }
    }
    setAccount(null);
    setChainId(null);
    setProvider(null);
  }, [provider, detectProvider, handleAccounts, handleChain]);

  useEffect(() => {
    const p = detectProvider();
    if (!p) return;
    setProvider(p);
    // if the provider exposes current accounts, fetch them
    (async () => {
      try {
        if (p.request) {
          const accounts = await p.request({ method: "eth_accounts" });
          handleAccounts(accounts);
          try {
            const id = await p.request({ method: "eth_chainId" });
            handleChain(id);
          } catch (_) {}
        }
      } catch (e) {
        // ignore
      }
    })();

    if (p.on) {
      p.on("accountsChanged", handleAccounts);
      p.on("chainChanged", handleChain);
    }

    return () => {
      if (p.removeListener) {
        try {
          p.removeListener("accountsChanged", handleAccounts);
          p.removeListener("chainChanged", handleChain);
        } catch (e) {}
      }
    };
  }, [detectProvider, handleAccounts, handleChain]);

  const value = {
    account,
    chainId,
    provider,
    connect,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}

export default WalletContext;
