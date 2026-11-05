import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthUserDto, LoginResponse } from "../../shared/types/api";
import { ApiError, setCsrfToken } from "../lib/api";
import { authService } from "../services/auth.service";
import type { LoginFormValues } from "../types/forms";

const AUTH_QUERY_KEY = ["auth", "me"] as const;

interface AuthContextValue {
  user: AuthUserDto | null;
  isLoading: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  login: (input: LoginFormValues) => Promise<AuthUserDto>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: AuthUserDto) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery<AuthUserDto | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        const result = await authService.me();
        setCsrfToken(result.csrfToken);
        return result.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw error;
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginFormValues) => authService.login(input),
    onSuccess: (result: LoginResponse) => {
      setCsrfToken(result.csrfToken);
      queryClient.setQueryData(AUTH_QUERY_KEY, result.user);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      setCsrfToken(null);
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== "auth",
      });
    },
  });

  const login = useCallback(
    async (input: LoginFormValues) => {
      const result = await loginMutation.mutateAsync(input);
      return result.user;
    },
    [loginMutation],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const refresh = useCallback(async () => {
    await meQuery.refetch();
  }, [meQuery]);

  const setUser = useCallback(
    (user: AuthUserDto) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
    [queryClient],
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      setCsrfToken(null);
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    };

    window.addEventListener("crm:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("crm:unauthorized", handleUnauthorized);
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isLoggingIn: loginMutation.isPending,
      isLoggingOut: logoutMutation.isPending,
      error: meQuery.error,
      isAuthenticated: Boolean(meQuery.data),
      login,
      logout,
      refresh,
      setUser,
    }),
    [
      meQuery.data,
      meQuery.isLoading,
      meQuery.error,
      loginMutation.isPending,
      logoutMutation.isPending,
      login,
      logout,
      refresh,
      setUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return context;
}
