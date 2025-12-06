import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { loginWithWallet } from "../services/walletAuth";

export default function Login() {
  const { account, connect, provider } = useWallet();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Use the shared helper to run the challenge+sign+login flow

  const handleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      // Ensure wallet is connected
      if (!provider || !account) {
        const res = await connect();
        if (res?.error) {
          throw new Error(res.error?.message || "Failed to connect wallet");
        }
      }

      // Now we have provider and account, do the auth flow
      const loginRes = await loginWithWallet(provider, account);
      const { token, profile } = loginRes;
      if (!token) throw new Error("No token returned");

      // Persist into AuthContext
      login({ token, profile });

      // Navigate to profile or home
      navigate("/profile");
    } catch (err) {
      console.error(err);
      if (err && (err.code === "USER_REJECTED" || /user rejected/i.test(err.message || ""))) {
        setError("You rejected the request in your wallet. Please approve the signature to sign in.");
      } else {
        setError(err.message || String(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-24 px-6">
      <h1 className="text-3xl font-bold mb-4">Sign in with your Wallet</h1>
      <p className="mb-6">Use your Gala or Ethereum wallet to sign a message and authenticate.</p>

      {error && (
        <div className="mb-4 text-red-400">
          {error}
          {error && error.toLowerCase().includes("rejected") && (
            <div className="mt-2">
              <button
                onClick={handleLogin}
                disabled={busy}
                className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm ml-2"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleLogin}
          disabled={busy}
          className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
        >
          {busy ? "Signing…" : account ? `Sign in as ${account.slice(0,6)}...${account.slice(-4)}` : "Connect & Sign with Wallet"}
        </button>
      </div>
    </div>
  );
}
