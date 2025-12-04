import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-black/40 backdrop-blur-xl border-b border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center">

        {/* LEFT: LOGO + TITLE */}
        <div className="flex items-center gap-3">
          <img
            src="https://res.cloudinary.com/dtv3mleyc/image/upload/v1764728076/logo-icon_qk57vk.png"
            alt="Arcano Icon"
            className="w-14 h-14 md:w-16 md:h-16 object-contain drop-shadow-[0_0_8px_rgba(150,0,255,0.4)] select-none"
          />
          <Link
            to="/"
            className="text-2xl md:text-3xl font-extrabold text-purple-300 tracking-wide drop-shadow-[0_0_8px_rgba(150,0,255,0.6)]"
          >
            ARCANO
          </Link>
        </div>

        {/* CENTER: NAV LINKS (desktop only) */}
        <div className="flex-1 hidden md:flex items-center justify-center gap-8 text-sm md:text-base font-semibold">
          <Link to="/" className="hover:text-purple-300 tracking-[0.18em] uppercase transition">
            Home
          </Link>

          <Link to="/shop" className="hover:text-purple-300 tracking-[0.18em] uppercase transition">
            Shop
          </Link>

          <Link to="/marketplace" className="hover:text-purple-300 tracking-[0.18em] uppercase transition">
            Marketplace
          </Link>

          {/* NEW — BATTLE */}
          <Link to="/battle" className="hover:text-purple-300 tracking-[0.18em] uppercase transition">
            Battle
          </Link>

          <Link to="/profile" className="hover:text-purple-300 tracking-[0.18em] uppercase transition">
            Profile
          </Link>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3 ml-4">

          {/* WALLET BUTTON DESKTOP */}
          <WalletConnectButton />

          {/* MOBILE MENU BUTTON */}
          <button
            className="md:hidden text-3xl text-white"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && (
        <div className="md:hidden bg-black/90 border-t border-white/10 px-6 py-4 flex flex-col gap-4 text-base">

          <Link to="/" onClick={() => setMenuOpen(false)} className="hover:text-purple-300">
            Home
          </Link>

          <Link to="/shop" onClick={() => setMenuOpen(false)} className="hover:text-purple-300">
            Shop
          </Link>

          <Link to="/marketplace" onClick={() => setMenuOpen(false)} className="hover:text-purple-300">
            Marketplace
          </Link>

          {/* NEW — BATTLE (mobile) */}
          <Link to="/battle" onClick={() => setMenuOpen(false)} className="hover:text-purple-300">
            Battle
          </Link>

          <Link to="/profile" onClick={() => setMenuOpen(false)} className="hover:text-purple-300">
            Profile
          </Link>

          <WalletConnectButton className="mt-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-900/40 transition md:hidden" />
        </div>
      )}
    </nav>
  );
}

function WalletConnectButton({ className = "hidden md:inline-flex px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm md:text-base font-bold shadow-lg shadow-purple-900/40 transition" }) {
  const { account, connect, disconnect, isConnected, provider } = useWallet();
  const [noProviderVisible, setNoProviderVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const short = account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null;

  const handleConnect = async () => {
    setBusy(true);
    try {
      const res = await connect();
      if (res && res.error === "no_provider") {
        // Show install instructions inline
        setNoProviderVisible(true);
      } else {
        setNoProviderVisible(false);
      }
    } catch (e) {
      // keep UI simple; show install instructions as fallback
      setNoProviderVisible(true);
    } finally {
      setBusy(false);
    }
  };

  // If a provider becomes available (e.g., user installed an extension and refreshed), hide the notice
  React.useEffect(() => {
    if (provider) setNoProviderVisible(false);
  }, [provider]);

  return isConnected ? (
    <div className={className + " flex items-center gap-3"}>
      <span className="text-sm text-white/90 font-mono">{short}</span>
      <button
        onClick={disconnect}
        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white"
      >
        Disconnect
      </button>
    </div>
  ) : (
    <div className="flex flex-col">
      <button onClick={handleConnect} className={className} disabled={busy}>
        {busy ? "Connecting…" : "Connect Wallet"}
      </button>
      {noProviderVisible && (
        <div className="mt-2 p-3 bg-black/70 border border-white/10 rounded-lg text-sm text-gray-300 max-w-xs">
          <div className="font-semibold text-white">No wallet detected</div>
          <div className="mt-1">Install a GalaChain or Ethereum-compatible wallet extension and try again.</div>
          <ul className="mt-2 list-disc list-inside">
            <li>
              MetaMask: <a className="text-purple-300" href="https://metamask.io/download/" target="_blank" rel="noreferrer">metamask.io/download</a>
            </li>
            <li>
              Gala: visit <a className="text-purple-300" href="https://gala.games" target="_blank" rel="noreferrer">gala.games</a>
            </li>
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setNoProviderVisible(false)}
              className="px-3 py-1 rounded bg-white/10 text-xs text-white"
            >
              Dismiss
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded bg-purple-600 text-xs text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
