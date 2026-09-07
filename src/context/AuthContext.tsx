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

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("user_data", JSON.stringify(data.user));
        }
      } else if (res.status === 401) {
        // Token expired / invalid
        logout();
      }
    } catch {
      // Network error, keep existing cached user
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("user_token");
    const savedUser = localStorage.getItem("user_data");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        // Sync cookie
        document.cookie = `user_token=${encodeURIComponent(savedToken)}; path=/; max-age=2592000; SameSite=Lax`;
        // Verify and refresh latest VIP and profile status from DB
        fetchProfile(savedToken);
      } catch {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_data");
        document.cookie = "user_token=; path=/; max-age=0";
      }
    }
    setIsLoading(false);
  }, []);

  const refreshUser = async () => {
    const currentToken = token || localStorage.getItem("user_token");
    if (currentToken) {
      await fetchProfile(currentToken);
    }
  };

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("user_token", newToken);
    localStorage.setItem("user_data", JSON.stringify(newUser));
    document.cookie = `user_token=${encodeURIComponent(newToken)}; path=/; max-age=2592000; SameSite=Lax`;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_data");
    document.cookie = "user_token=; path=/; max-age=0";
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
