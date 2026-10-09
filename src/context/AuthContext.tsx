import React, { createContext, useContext, useState, useEffect } from 'react';
import { AdminUser } from '../types/database';

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = 'mithai_admin_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default Owner credentials for the application
export const OWNER_DEFAULT_CREDENTIALS = {
  email: 'shakeer@sweetshop.com',
  password: 'password123',
  name: 'Shakeer',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: AdminUser = JSON.parse(stored);
        if (parsed.name === 'Shop Owner' || !parsed.name) {
          parsed.name = 'Shakeer';
        }
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to sync auth session', e);
    }
  }, [user]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (
      cleanEmail !== OWNER_DEFAULT_CREDENTIALS.email.toLowerCase() ||
      password !== OWNER_DEFAULT_CREDENTIALS.password
    ) {
      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    const ownerUser: AdminUser = {
      email: OWNER_DEFAULT_CREDENTIALS.email,
      name: OWNER_DEFAULT_CREDENTIALS.name,
      role: 'owner',
    };
    setUser(ownerUser);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
