import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, Tenant, Wallet } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  wallet: Wallet | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshWallet: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.ok ? res.json() : Promise.reject())
        .then((data) => {
          setUser(data.user);
          setTenant(data.tenant);
          setWallet(data.wallet);
        })
        .catch(() => {
          localStorage.removeItem("authToken");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Login failed");
    }
    const data = await res.json();
    localStorage.setItem("authToken", data.token);
    setUser(data.user);
    setTenant(data.tenant);
    setWallet(data.wallet);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    setUser(null);
    setTenant(null);
    setWallet(null);
  };

  const refreshWallet = async () => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const res = await fetch("/api/wallet", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setWallet(data);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        wallet,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshWallet,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
