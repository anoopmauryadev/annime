"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  is_vip?: number;
  vip_expires_at?: string | null;
  key_expires_at?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          setToken("cookie-session");
        }
      } else if (res.status === 401) {
        setToken(null);
        setUser(null);
      }
    } catch {
      // Network error, keep existing cached user
    }
  };

  useEffect(() => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_data");
    const timer = window.setTimeout(() => { fetchProfile().finally(() => setIsLoading(false)); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refreshUser = async () => {
    await fetchProfile();
  };

  const login = (_newToken: string, newUser: User) => {
    setToken("cookie-session");
    setUser(newUser);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
