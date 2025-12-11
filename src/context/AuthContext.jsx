import React, { createContext, useContext, useEffect, useState, useRef } from "react";

const AuthContext = createContext(null);

// Helper function to decode JWT and extract payload
function decodeJWT(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return null;
  }
}

// Helper function to safely read from localStorage (client-side only)
function getStoredToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("authToken");
  } catch (e) {
    return null;
  }
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("authUser");
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    return null;
  }
}

// Initialize state from localStorage immediately (client-side only)
function getInitialState() {
  const storedToken = getStoredToken();
  const storedUser = getStoredUser();
  
  let initialUser = storedUser;
  if (storedToken && !initialUser) {
    // Fallback: extract from JWT token if no stored profile
    const decoded = decodeJWT(storedToken);
    if (decoded) {
      initialUser = {
        walletAddress: decoded.walletAddress,
      };
    }
  }
  
  return {
    token: storedToken,
    user: initialUser,
  };
}

export function AuthProvider({ children }) {
  const initialState = getInitialState();
  const [token, setToken] = useState(initialState.token);
  const [user, setUser] = useState(initialState.user);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasInitialized = useRef(false);

  // Mark as hydrated and allow persistence after initial mount
  useEffect(() => {
    setIsHydrated(true);
    // Use a microtask to ensure persistence effects have already run
    Promise.resolve().then(() => {
      hasInitialized.current = true;
    });
  }, []);

  // Persist token to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (!hasInitialized.current) return;
    try {
      if (token) {
        localStorage.setItem("authToken", token);
      } else {
        localStorage.removeItem("authToken");
      }
    } catch (e) {
      console.error("Failed to persist token:", e);
    }
  }, [token]);

  // Persist user profile to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    if (!hasInitialized.current) return;
    try {
      if (user) {
        localStorage.setItem("authUser", JSON.stringify(user));
      } else {
        localStorage.removeItem("authUser");
      }
    } catch (e) {
      console.error("Failed to persist user:", e);
    }
  }, [user]);

  // Login function accepts the response from backend
  // Can be called as login({ token, profile }) or login(token, profile)
  const login = (tokenOrObj, profileArg) => {
    let t, p;
    
    if (typeof tokenOrObj === 'object' && tokenOrObj !== null) {
      // Called as login({ token, profile })
      t = tokenOrObj.token;
      p = tokenOrObj.profile;
    } else {
      // Called as login(token, profile)
      t = tokenOrObj;
      p = profileArg;
    }
    
    if (t) setToken(t);
    if (p) setUser(p);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
    } catch (e) {
      console.error("Failed to clear storage:", e);
    }
  };

  // Only render children after hydration to avoid hydration mismatch
  if (!isHydrated) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default AuthContext;
