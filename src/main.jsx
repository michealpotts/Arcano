// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { WalletProvider } from "./context/WalletContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";


try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
} catch (err) {
  console.error("Render failed:", err);
  try {
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `<div style="padding:20px;color:#fff;background:#111;font-family:monospace;
        "><h2>App failed to render</h2><pre style=\"white-space:pre-wrap;\">${String(err)}</pre></div>`;
    }
  } catch (e) {}
}
