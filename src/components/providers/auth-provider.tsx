"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  anonymousId: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdentifier: () => { userId?: string; anonymousId?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            created_at: session.user.created_at || "",
          });
          setAnonymousId(null);
        } else {
          // Generate or retrieve anonymous ID from cookie
          const stored = getCookie("anonymous_id");
          if (stored) {
            setAnonymousId(stored);
          } else {
            const newId = uuidv4();
            setCookie("anonymous_id", newId, 365);
            setAnonymousId(newId);
          }
        }
      } catch {
        // No session - use anonymous
        const stored = getCookie("anonymous_id");
        if (stored) {
          setAnonymousId(stored);
        } else {
          const newId = uuidv4();
          setCookie("anonymous_id", newId, 365);
          setAnonymousId(newId);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          created_at: session.user.created_at || "",
        });
        setAnonymousId(null);
      } else {
        setUser(null);
        const stored = getCookie("anonymous_id");
        if (stored) {
          setAnonymousId(stored);
        } else {
          const newId = uuidv4();
          setCookie("anonymous_id", newId, 365);
          setAnonymousId(newId);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Set session cookies via API so SSR can use them
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        action: "login",
      }),
    });

    setUser({
      id: data.user.id,
      email: data.user.email || "",
      created_at: data.user.created_at || "",
    });
    setAnonymousId(null);
  };

  const register = async (email: string, password: string) => {
    // Create user via API
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, action: "register" }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    // Then login
    await login(email, password);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    const stored = getCookie("anonymous_id");
    if (stored) {
      setAnonymousId(stored);
    } else {
      const newId = uuidv4();
      setCookie("anonymous_id", newId, 365);
      setAnonymousId(newId);
    }
  };

  const getIdentifier = () => {
    if (user) return { userId: user.id };
    if (anonymousId) return { anonymousId };
    return {};
  };

  return (
    <AuthContext.Provider
      value={{ user, anonymousId, isLoading, login, register, logout, getIdentifier }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
