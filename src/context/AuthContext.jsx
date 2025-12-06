import React, { createContext, useContext, useEffect, useState } from "react";

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

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("authToken");
      const storedUser = localStorage.getItem("authUser");

      if (storedToken) {
        setToken(storedToken);
        // If we have stored user profile, restore it
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // Fallback: extract from JWT token if no stored profile
          const decoded = decodeJWT(storedToken);
          if (decoded) {
            setUser({
              playerId: decoded.playerId,
              walletAddress: decoded.walletAddress,
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed to restore auth state:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist token to localStorage whenever it changes
  useEffect(() => {
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

  // Persist user profile to localStorage whenever it changes
  useEffect(() => {
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
