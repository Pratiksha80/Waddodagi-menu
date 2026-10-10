import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types/database';

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => setUser(result?.user || null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    let result: any = null;
    const text = await response.text();
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = null;
      }
    }

    if (!response.ok) {
      return { success: false, error: result?.error || 'Sign in failed.' };
    }

    if (!result?.user) {
      return { success: false, error: 'Sign in failed.' };
    }

    setUser(result.user as AdminUser);
    return { success: true };
  };

  const logout = () => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
