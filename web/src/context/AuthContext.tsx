import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { PropsWithChildren } from "react";

import { api } from "../lib/api";
import { authStorage } from "../lib/auth";
import type { AuthResponse, User } from "../types/api";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const persistAuth = (token: string): void => {
  authStorage.setToken(token);
};

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [token, setToken] = useState<string | null>(() => authStorage.getToken());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    authStorage.clearToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const activeToken = authStorage.getToken();
    if (!activeToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get<{ user: User }>("/auth/me");
      setUser(response.data.user);
      setToken(activeToken);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });

    persistAuth(response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
  }, []);

  const register = useCallback(
    async (payload: { email: string; password: string; firstName?: string; lastName?: string }) => {
      const response = await api.post<AuthResponse>("/auth/register", payload);
      persistAuth(response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
};

