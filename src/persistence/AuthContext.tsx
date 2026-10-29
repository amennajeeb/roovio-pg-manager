import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { isValidUUID } from '../services/cloudDataService';
import {
  getStoredAuthUsers,
  saveStoredAuthUser,
  getStoredItem,
  setStoredItem,
} from './storage';

const ACTIVE_USER_SESSION_KEY = 'greenview_active_user_session_v1';

export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isSupabaseActive: boolean;
  storageMode: 'cloud' | 'demo';
  cloudError: string | null;
  clearCloudError: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    propertyName: string,
    name: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loginAsDemo: (demoType: 'default' | 'alpha' | 'beta') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Built-in demo accounts for instant evaluation & testing
export const BUILT_IN_DEMO_ACCOUNTS: Record<string, { user: AuthUser; password: string }> = {
  default: {
    user: {
      id: 'owner-gv-default',
      email: 'owner@greenview.in',
      name: 'P. K. Narayanan',
      propertyName: 'ROOVIO Malabar Residency PG',
    },
    password: 'GreenView@2026',
  },
  alpha: {
    user: {
      id: 'owner-alpha-123',
      email: 'alpha.owner@greenview.in',
      name: 'Abdul Rasheed K',
      propertyName: 'Thavakkara Comfort PG, Kannur',
    },
    password: 'AlphaOwner@2026',
  },
  beta: {
    user: {
      id: 'owner-beta-456',
      email: 'beta.owner@greenview.in',
      name: 'Mathew Varghese',
      propertyName: 'Nadakkavu Urban Stay, Kozhikode',
    },
    password: 'BetaOwner@2026',
  },
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const isSupabaseActive = isSupabaseConfigured();

  // Storage mode is 'cloud' if user ID is a valid Supabase Auth UUID; otherwise 'demo'
  const storageMode: 'cloud' | 'demo' = user?.id && isValidUUID(user.id) ? 'cloud' : 'demo';

  const clearCloudError = () => setCloudError(null);

  // Restore session on mount
  useEffect(() => {
    async function initSession() {
      try {
        if (isSupabaseActive && supabase) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            const suUser = data.session.user;
            setUser({
              id: suUser.id,
              email: suUser.email || '',
              name: suUser.user_metadata?.name || 'PG Owner',
              propertyName: suUser.user_metadata?.property_name || 'My PG',
            });
            setIsLoading(false);
            return;
          }
        }

        // Fallback to local session
        const storedSession = getStoredItem(ACTIVE_USER_SESSION_KEY);
        if (storedSession) {
          const parsed = JSON.parse(storedSession);
          if (parsed && parsed.id && parsed.email) {
            setUser(parsed);
          }
        } else {
          // Default to GreenView demo owner for first-time visitors
          const def = BUILT_IN_DEMO_ACCOUNTS.default.user;
          setUser(def);
          setStoredItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(def));
        }
      } catch (err) {
        console.error('Session restoration error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initSession();

    if (isSupabaseActive && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || 'PG Owner',
            propertyName: session.user.user_metadata?.property_name || 'My PG',
          });
        }
      });
      return () => {
        authListener?.subscription.unsubscribe();
      };
    }
  }, [isSupabaseActive]);

  const persistLocalUser = (usr: AuthUser | null) => {
    setUser(usr);
    if (usr) {
      setStoredItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(usr));
    } else {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
        }
      } catch {
        // ignore
      }
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, error: 'Please enter your email address' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password' };
    }

    // 1. Try Supabase Auth if online & configured
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setCloudError(error.message);
          return { success: false, error: error.message };
        }

        if (data.user) {
          setCloudError(null);
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: data.user.user_metadata?.name || 'PG Owner',
            propertyName: data.user.user_metadata?.property_name || 'My PG',
          };
          persistLocalUser(authUser);
          return { success: true };
        }
      } catch (err: any) {
        const msg = err?.message || 'Authentication failed';
        setCloudError(msg);
        return { success: false, error: msg };
      }
    }

    // 2. Check built-in demo accounts
    for (const key of Object.keys(BUILT_IN_DEMO_ACCOUNTS)) {
      const acc = BUILT_IN_DEMO_ACCOUNTS[key];
      if (acc.user.email.toLowerCase() === cleanEmail) {
        if (acc.password === password || password === 'Demo@123' || password === 'password123') {
          persistLocalUser(acc.user);
          return { success: true };
        } else {
          return { success: false, error: 'Incorrect password for this demo account' };
        }
      }
    }

    // 3. Check registered local accounts
    const registered = getStoredAuthUsers();
    const found = registered.find((u) => u.email.toLowerCase() === cleanEmail);
    if (found) {
      // In local mode, simple verification (plain or base64)
      if (found.passwordHash === btoa(password) || found.passwordHash === password) {
        const authUser: AuthUser = {
          id: found.id,
          email: found.email,
          name: found.name,
          propertyName: found.propertyName,
        };
        persistLocalUser(authUser);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid password' };
      }
    }

    return {
      success: false,
      error: 'No account found with this email. Please register to create your PG dashboard.',
    };
  };

  const register = async (
    email: string,
    password: string,
    propertyName: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Please enter a valid email address' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long' };
    }
    if (!propertyName.trim()) {
      return { success: false, error: 'Please provide your PG / Hostel property name' };
    }

    // 1. Try Supabase Auth if configured
    if (isSupabaseActive && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: name.trim() || 'PG Owner',
              property_name: propertyName.trim(),
            },
          },
        });

        if (error) {
          setCloudError(error.message);
          return { success: false, error: error.message };
        }

        if (data.user) {
          setCloudError(null);
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            name: name.trim() || 'PG Owner',
            propertyName: propertyName.trim(),
          };
          persistLocalUser(authUser);
          return { success: true };
        }
      } catch (err: any) {
        const msg = err?.message || 'Registration failed';
        setCloudError(msg);
        return { success: false, error: msg };
      }
    }

    // 2. Local fallback registration
    const existingUsers = getStoredAuthUsers();
    if (existingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    const newId = `owner-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    saveStoredAuthUser({
      id: newId,
      email: cleanEmail,
      passwordHash: btoa(password),
      name: name.trim() || 'PG Owner',
      propertyName: propertyName.trim(),
      createdAt: new Date().toISOString(),
    });

    const authUser: AuthUser = {
      id: newId,
      email: cleanEmail,
      name: name.trim() || 'PG Owner',
      propertyName: propertyName.trim(),
    };
    persistLocalUser(authUser);
    return { success: true };
  };

  const logout = async () => {
    if (isSupabaseActive && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign out error:', err);
      }
    }
    persistLocalUser(null);
  };

  const loginAsDemo = (demoType: 'default' | 'alpha' | 'beta') => {
    setCloudError(null);
    const acc = BUILT_IN_DEMO_ACCOUNTS[demoType] || BUILT_IN_DEMO_ACCOUNTS.default;
    persistLocalUser(acc.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSupabaseActive,
        storageMode,
        cloudError,
        clearCloudError,
        login,
        register,
        logout,
        loginAsDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

