import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import loginWithWallet from "../services/walletAuth";
import { BrowserConnectClient } from '@gala-chain/connect';

const WalletContext = createContext(null);

// LocalStorage keys
const STORAGE_KEYS = {
  ACCOUNT: "walletAccount",
  CHAIN_ID: "walletChainId",
  IS_CONNECTED: "walletConnected",
};

// Helper functions for localStorage
function getStoredAccount() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.ACCOUNT);
  } catch (e) {
    return null;
  }
}

function getStoredChainId() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEYS.CHAIN_ID);
  } catch (e) {
    return null;
  }
}

function getStoredConnectionState() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEYS.IS_CONNECTED) === "true";
  } catch (e) {
    return false;
  }
}

function setStoredAccount(account) {
  if (typeof window === "undefined") return;
  try {
    if (account) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNT, account);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
    }
  } catch (e) {
    console.error("Failed to store account:", e);
  }
}

function setStoredChainId(chainId) {
  if (typeof window === "undefined") return;
  try {
    if (chainId) {
      localStorage.setItem(STORAGE_KEYS.CHAIN_ID, chainId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CHAIN_ID);
    }
  } catch (e) {
    console.error("Failed to store chainId:", e);
  }
}

function setStoredConnectionState(isConnected) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, isConnected ? "true" : "false");
  } catch (e) {
    console.error("Failed to store connection state:", e);
  }
}

function clearStoredWallet() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.CHAIN_ID);
    localStorage.removeItem(STORAGE_KEYS.IS_CONNECTED);
  } catch (e) {
    console.error("Failed to clear wallet storage:", e);
  }
}

export function WalletProvider({ children }) {
  // Initialize state from localStorage
  const [account, setAccount] = useState(() => getStoredAccount());
  const [chainId, setChainId] = useState(() => getStoredChainId());
  const [client, setClient] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasInitialized = useRef(false);

  // Mark as hydrated after initial mount
  useEffect(() => {
    setIsHydrated(true);
    Promise.resolve().then(() => {
      hasInitialized.current = true;
    });
  }, []);

  // Persist account to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (!hasInitialized.current) return;
    setStoredAccount(account);
    setStoredConnectionState(!!account);
  }, [account]);

  // Persist chainId to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (!hasInitialized.current) return;
    setStoredChainId(chainId);
  }, [chainId]);

  const detectProvider = useCallback(() => {
    // Use BrowserConnectClient instead of window.ethereum
    try {
      return new BrowserConnectClient();
    } catch (err) {
      console.warn("BrowserConnectClient not available:", err);
      return null;
    }
  }, []);

  const connect = useCallback(async () => {
    const detectedClient = detectProvider();
    if (!detectedClient) {
      console.warn("No BrowserConnectClient available");
      return { error: new Error("no_provider") };
    }

    try {
      // Connect to GalaChain wallet using BrowserConnectClient
      await detectedClient.connect();
      
      // Get Ethereum address from window.ethereum (MetaMask)
      // BrowserConnectClient is for GalaChain, but we need Ethereum address for backend auth
      let acct;
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (accounts && accounts.length > 0) {
            acct = accounts[0];
          }
        } catch (e) {
          console.warn("Could not get account from window.ethereum:", e);
        }
      }
      
      // Fallback: Try to get from BrowserConnectClient directly
      if (!acct) {
        if (detectedClient.getAccountAddress) {
          acct = await detectedClient.getAccountAddress();
        } else if (detectedClient.getAddress) {
          acct = await detectedClient.getAddress();
        } else if (detectedClient.account) {
          acct = detectedClient.account;
        } else if (detectedClient.address) {
          acct = detectedClient.address;
        }
      }

      if (!acct) {
        return { error: new Error("Cannot get account address. Please ensure MetaMask (window.ethereum) is installed and connected.") };
      }

      // Perform wallet-based authentication: sign challenge and login
      // Pass both client (for GalaChain) and window.ethereum (for signing)
      const ethereumProvider = typeof window !== "undefined" ? window.ethereum : null;
      const loginRes = await loginWithWallet(detectedClient, acct, ethereumProvider);
      const { token, profile } = loginRes;

      // Update client/account after successful auth
      setClient(detectedClient);
      setAccount(acct);
      
      // Store connection state in localStorage
      setStoredAccount(acct);
      setStoredConnectionState(true);

      return { success: true, token, profile };
    } catch (err) {
      console.error("Wallet connection failed:", err);
      return { error: err };
    }
  }, [detectProvider]);

  // const disconnect = useCallback(() => {
  //   const currentClient = client || detectProvider();
  //   if (currentClient && currentClient.disconnect) {
  //     try {
  //       currentClient.disconnect();
  //     } catch (e) {
  //       // ignore
  //     }
  //   }
  //   setAccount(null);
  //   setChainId(null);
  //   setClient(null);
  //   // Clear all localStorage data
  //   if (typeof window !== "undefined") {
  //     try {
  //       localStorage.clear();
  //     } catch (e) {
  //       console.error("Failed to clear localStorage:", e);
  //     }
  //   }
  // }, [provider, detectProvider]);

  // Restore wallet connection on mount if account is stored
  useEffect(() => {
    if (!isHydrated) return;
    
    const storedAccount = getStoredAccount();
    const wasConnected = getStoredConnectionState();
    
    if (storedAccount && wasConnected) {
          // Try to restore connection
      (async () => {
        try {
          const detectedClient = detectProvider();
          if (!detectedClient) return;
          
          // Try to reconnect BrowserConnectClient
          try {
            await detectedClient.connect();
          } catch (e) {
            // If connect fails, user might need to reconnect manually
            console.warn("Could not auto-reconnect BrowserConnectClient:", e);
          }
          
          // Verify the account is still available from window.ethereum
          if (typeof window !== "undefined" && window.ethereum) {
            try {
              const accounts = await window.ethereum.request({ method: "eth_accounts" });
              if (accounts && accounts.length > 0 && accounts[0].toLowerCase() === storedAccount.toLowerCase()) {
                // Account matches, restore state
                setAccount(storedAccount);
                setClient(detectedClient);
                
                // Try to get chainId
                try {
                  const id = await window.ethereum.request({ method: "eth_chainId" });
                  setChainId(id);
                } catch (e) {
                  // ignore chainId error
                }
              } else {
                // Account changed or not available, clear storage
                clearStoredWallet();
                setAccount(null);
              }
            } catch (e) {
              console.warn("Could not verify stored account:", e);
              // Clear storage if verification fails
              clearStoredWallet();
              setAccount(null);
            }
          } else {
            // MetaMask not available, but keep stored account for display
            setAccount(storedAccount);
            setClient(detectedClient);
          }
        } catch (e) {
          console.warn("Failed to restore wallet connection:", e);
          clearStoredWallet();
          setAccount(null);
        }
      })();
    }
  }, [isHydrated, detectProvider]);

  const value = {
    client,
    account,
    chainId,
    connect,
  };

  // Only render children after hydration to avoid hydration mismatch
  if (!isHydrated) {
    return null;
  }

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
