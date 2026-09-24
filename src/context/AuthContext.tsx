import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser, LoginCredentials, SignUpData, SubjectType, DifficultyLevel } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  isConfigured: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signIn: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  signup: (data: SignUpData) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  clearError: () => void;
  demoCredentials: { email: string; password: string };
  loginAsDemo: () => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: () => Promise<{ success: boolean; error?: string }>;
  pendingVerificationEmail: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'gurumitra_auth_session';
const REGISTERED_USERS_KEY = 'gurumitra_registered_users';

export const DEMO_USER: AuthUser = {
  id: 'user-demo-sally-sharma',
  name: 'Sally Sharma',
  email: 'sally.demo@example.com',
  grade: 'Class 10',
  board: 'CBSE',
  stream: 'Not applicable',
  level: 'Intermediate',
  preferredSubjects: ['Mathematics', 'Science', 'English', 'Computer Science', 'Social Science'],
  preferredStyle: 'Simple',
  isDemo: true,
  emailVerified: true,
  createdAt: new Date().toISOString()
};

export const DEMO_PASSWORD = 'Demo@123';

interface StoredAccount {
  user: AuthUser;
  passwordHash: string;
}

// Convert Supabase User to internal AuthUser model
function mapSupabaseUserToAuthUser(sessionUser: any): AuthUser {
  const metadata = sessionUser.user_metadata || {};
  const userEmail = sessionUser.email || '';
  return {
    id: sessionUser.id,
    name: metadata.name || userEmail.split('@')[0],
    email: userEmail,
    grade: metadata.grade || '10th',
    level: (metadata.level as DifficultyLevel) || 'Intermediate',
    preferredSubjects: Array.isArray(metadata.preferredSubjects) && metadata.preferredSubjects.length > 0
      ? (metadata.preferredSubjects as SubjectType[])
      : ['Mathematics', 'Science'],
    preferredStyle: metadata.preferredStyle || 'Simple',
    isDemo: false,
    emailVerified: !!sessionUser.email_confirmed_at,
    createdAt: sessionUser.created_at || new Date().toISOString()
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  // Check if Supabase client is properly initialized
  const isConfigured = Boolean(
    (import.meta as any).env.VITE_SUPABASE_URL &&
    (import.meta as any).env.VITE_SUPABASE_ANON_KEY &&
    supabase
  );

  // Initialize stored accounts and active session on mount
  useEffect(() => {
    let authListener: { subscription: { unsubscribe: () => void } } | null = null;

    const restoreSession = async () => {
      try {
        // 1. Seed demo user into registered users if not present (for fallback local storage)
        const storedUsersRaw = localStorage.getItem(REGISTERED_USERS_KEY);
        let registeredUsers: StoredAccount[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

        const demoExists = registeredUsers.some(
          (acc) => acc.user.email.toLowerCase() === DEMO_USER.email.toLowerCase()
        );

        if (!demoExists) {
          registeredUsers.push({
            user: DEMO_USER,
            passwordHash: DEMO_PASSWORD
          });
          localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));
        }

        // 2. Check active Supabase session if configured
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const authUser = mapSupabaseUserToAuthUser(session.user);
            setUser(authUser);
            setIsAuthenticated(true);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authUser));
            setIsLoading(false);
            return;
          }

          // Listen for auth state changes (e.g., email confirmation redirect, OAuth, token refresh)
          const { data: listener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
              if (session?.user) {
                const authUser = mapSupabaseUserToAuthUser(session.user);
                setUser(authUser);
                setIsAuthenticated(true);
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authUser));
              } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setIsAuthenticated(false);
                localStorage.removeItem(SESSION_STORAGE_KEY);
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
              }
            }
          );
          authListener = listener;
        }

        // 3. Fallback: check localStorage or sessionStorage
        const savedSessionRaw =
          localStorage.getItem(SESSION_STORAGE_KEY) ||
          sessionStorage.getItem(SESSION_STORAGE_KEY);

        if (savedSessionRaw) {
          const parsedSession: AuthUser = JSON.parse(savedSessionRaw);
          if (parsedSession && parsedSession.id && parsedSession.email) {
            setUser(parsedSession);
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.error('Failed to restore authentication session:', err);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  const clearError = () => setAuthError(null);

  const login = async ({
    email,
    password,
    rememberMe = true
  }: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      // Demo login bypass
      if (cleanEmail === DEMO_USER.email.toLowerCase() && cleanPassword === DEMO_PASSWORD) {
        setUser(DEMO_USER);
        setIsAuthenticated(true);
        setIsLoading(false);
        // Persist demo session
        if (rememberMe) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(DEMO_USER));
        } else {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(DEMO_USER));
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
        return { success: true };
      }

      // Supabase login (if configured)
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (error) throw error;

        const sessionUser = data.user;
        if (!sessionUser) throw new Error('No user returned');

        // Check if email is verified
        if (!data.session && !sessionUser.email_confirmed_at) {
          const storedUsersRaw = localStorage.getItem(REGISTERED_USERS_KEY);
          const registeredUsers: StoredAccount[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];
          const matchedFallback = registeredUsers.find(
            (acc) => acc.user.email.toLowerCase() === cleanEmail && acc.passwordHash === cleanPassword
          );

          if (matchedFallback) {
            setUser(matchedFallback.user);
            setIsAuthenticated(true);
            setAuthError(null);
            if (rememberMe) {
              localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchedFallback.user));
            } else {
              sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(matchedFallback.user));
            }
            setIsLoading(false);
            return { success: true };
          }

          setPendingVerificationEmail(cleanEmail);
          const errorMsg = 'Please verify your email before logging in. If no verification email was received due to Supabase free rate limits, toggle "Confirm email" to OFF in Supabase Dashboard > Authentication > Providers > Email.';
          setAuthError(errorMsg);
          setIsLoading(false);
          return { success: false, error: errorMsg };
        }

        const authUser = mapSupabaseUserToAuthUser(sessionUser);

        setUser(authUser);
        setIsAuthenticated(true);
        setAuthError(null);

        // Store session based on rememberMe preference
        if (rememberMe) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authUser));
        } else {
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authUser));
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }

        setIsLoading(false);
        return { success: true };
      } else {
        // Fallback to local storage
        const storedUsersRaw = localStorage.getItem(REGISTERED_USERS_KEY);
        const registeredUsers: StoredAccount[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

        const matchedAccount = registeredUsers.find(
          (acc) =>
            acc.user.email.toLowerCase() === cleanEmail &&
            acc.passwordHash === cleanPassword
        );

        if (matchedAccount) {
          const authenticatedUser = matchedAccount.user;
          setUser(authenticatedUser);
          setIsAuthenticated(true);
          setAuthError(null);

          if (rememberMe) {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authenticatedUser));
          } else {
            sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authenticatedUser));
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }

          setIsLoading(false);
          return { success: true };
        } else {
          const errorMsg = 'Invalid email or password. Please try again.';
          setAuthError(errorMsg);
          setIsLoading(false);
          return { success: false, error: errorMsg };
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMsg = err.message || 'An unexpected error occurred during login. Please try again.';

      if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid_credentials')) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (err.message?.includes('User not found') || err.message?.includes('not found')) {
        errorMsg = 'No account found with this email. Please check your email or sign up.';
      } else if (err.message?.includes('Email not confirmed')) {
        setPendingVerificationEmail(email.trim().toLowerCase());
        errorMsg = 'Please verify your email before logging in. Check your inbox for the verification link.';
      }

      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const signup = async (
    data: SignUpData
  ): Promise<{ success: boolean; error?: string; requiresConfirmation?: boolean }> => {
    setAuthError(null);
    setIsLoading(true);

    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanPassword = data.password.trim();

      // Basic validation
      if (cleanPassword.length < 6) {
        throw new Error('Password should be at least 6 characters long');
      }

      // Supabase signup (if configured)
      if (supabase) {
        // Prepare user metadata
        const metadata = {
          name: data.name.trim(),
          grade: data.grade || '10th',
          level: data.level || 'Intermediate',
          preferredSubjects: data.preferredSubjects,
          preferredStyle: 'Simple'
        };

        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: metadata,
            emailRedirectTo: window.location.origin
          }
        });

        if (error) {
          if (error.message?.includes('User already registered') || error.message?.includes('already been taken')) {
            throw new Error('An account with this email already exists. Please login instead.');
          }
          if (error.message?.includes('rate limit') || error.status === 429) {
            throw new Error('Email sending rate limit reached. Please wait a minute before requesting another confirmation email or try logging in.');
          }
          // Supabase free tier SMTP failure (HTTP 500: Error sending confirmation email)
          if (
            error.message?.includes('Error sending confirmation email') ||
            error.message?.includes('confirmation email') ||
            (error.status === 500 && String(error.message).toLowerCase().includes('email'))
          ) {
            console.warn(
              'Supabase SMTP encountered an issue sending confirmation email (common on Supabase free tier rate limits). ' +
              'Activating resilient local fallback account so student can continue learning immediately. ' +
              'To fix permanently in Supabase: In Dashboard > Authentication > Providers > Email, toggle "Confirm email" to OFF.'
            );

            // Register account locally so the user is immediately authenticated and unblocked
            const storedUsersRaw = localStorage.getItem(REGISTERED_USERS_KEY);
            const registeredUsers: StoredAccount[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

            const newUser: AuthUser = {
              id: `user-${Date.now()}`,
              name: data.name.trim(),
              email: cleanEmail,
              grade: (typeof data.grade === 'string' ? data.grade : '10th'),
              level: data.level || 'Intermediate',
              preferredSubjects:
                data.preferredSubjects && data.preferredSubjects.length > 0
                  ? data.preferredSubjects
                  : ['Mathematics', 'Science'],
              preferredStyle: 'Simple',
              isDemo: false,
              emailVerified: true,
              createdAt: new Date().toISOString()
            };

            const existingIdx = registeredUsers.findIndex(
              (acc) => acc.user.email.toLowerCase() === cleanEmail
            );
            if (existingIdx >= 0) {
              registeredUsers[existingIdx] = { user: newUser, passwordHash: cleanPassword };
            } else {
              registeredUsers.push({ user: newUser, passwordHash: cleanPassword });
            }
            localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));

            setUser(newUser);
            setIsAuthenticated(true);
            setAuthError(null);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));

            setIsLoading(false);
            return {
              success: true,
              requiresConfirmation: false
            };
          }
          throw error;
        }

        // Handle case where user already exists (Supabase returns empty identities array when email confirm is enabled)
        if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
          throw new Error('An account with this email already exists. Please login instead.');
        }

        // If email confirmation is required and session is not immediately established
        const requiresConfirmation = !signUpData?.session;

        if (requiresConfirmation) {
          setPendingVerificationEmail(cleanEmail);
          setIsLoading(false);
          return { success: true, requiresConfirmation: true };
        }

        // If email confirmation is disabled or session returned immediately
        if (signUpData?.user) {
          const authUser = mapSupabaseUserToAuthUser(signUpData.user);
          setUser(authUser);
          setIsAuthenticated(true);
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authUser));
        }

        setIsLoading(false);
        return { success: true, requiresConfirmation: false };
      } else {
        // Fallback to local storage
        const storedUsersRaw = localStorage.getItem(REGISTERED_USERS_KEY);
        const registeredUsers: StoredAccount[] = storedUsersRaw ? JSON.parse(storedUsersRaw) : [];

        // Check if user already exists
        const existing = registeredUsers.find(
          (acc) => acc.user.email.toLowerCase() === cleanEmail
        );

        if (existing) {
          const errorMsg = 'An account with this email already exists. Please login instead.';
          setAuthError(errorMsg);
          setIsLoading(false);
          return { success: false, error: errorMsg };
        }

        // Create new user record
        const newUser: AuthUser = {
          id: `user-${Date.now()}`,
          name: data.name.trim(),
          email: cleanEmail,
          grade: (typeof data.grade === 'string' ? data.grade : '10th'),
          level: data.level || 'Intermediate',
          preferredSubjects:
            data.preferredSubjects.length > 0
              ? data.preferredSubjects
              : ['Mathematics', 'Science'],
          preferredStyle: 'Simple',
          isDemo: false,
          emailVerified: true,
          createdAt: new Date().toISOString()
        };

        registeredUsers.push({
          user: newUser,
          passwordHash: cleanPassword
        });
        localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(registeredUsers));

        setUser(newUser);
        setIsAuthenticated(true);
        setAuthError(null);
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));

        setIsLoading(false);
        return { success: true, requiresConfirmation: false };
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      let errorMsg = 'Failed to create account. Please try again.';
      if (err.message?.includes('Password should be at least 6 characters')) {
        errorMsg = err.message;
      } else if (err.message?.includes('already exists') || err.message?.includes('already registered')) {
        errorMsg = 'An account with this email already exists. Please login instead.';
      } else if (err.message) {
        errorMsg = err.message;
      }
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const resendVerificationEmail = async (): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    setIsLoading(true);

    try {
      if (!pendingVerificationEmail) {
        throw new Error('No pending verification email found. Please enter your email and try logging in.');
      }

      if (supabase) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: pendingVerificationEmail,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (error) {
          if (error.message?.includes('rate limit') || error.status === 429) {
            throw new Error('Rate limit reached. Please wait a minute before requesting another email.');
          }
          if (error.message?.includes('confirmation email') || error.status === 500) {
            throw new Error('Supabase email service is currently rate-limited on the free tier. To bypass, please disable "Confirm email" in your Supabase Dashboard under Authentication > Providers > Email.');
          }
          throw error;
        }
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      console.error('Resend verification error:', err);
      const errorMsg = err.message || 'Failed to resend verification email. Please try again.';
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setPendingVerificationEmail(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut error:', e);
      }
    }

    // Clear syllabus data for all possible users (defensive cleanup)
    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith('gurumitra_syllabus_data_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // Ignore errors in cleanup
    }

    // Prevent navigation back to protected view via browser back button
    try {
      window.history.pushState(null, '', window.location.href);
    } catch (e) {
      // Ignore in non-browser envs
    }
  };

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; message: string; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}`
        });
        if (error) throw error;
        return {
          success: true,
          message: `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox.`
        };
      } else {
        // Fallback simulated delay
        await new Promise((resolve) => setTimeout(resolve, 600));
        return {
          success: true,
          message: `Password reset instructions have been sent to ${cleanEmail}. (Prototype simulation mode)`
        };
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      const errorMsg = err.message || 'Failed to send password reset email.';
      return {
        success: false,
        message: errorMsg,
        error: errorMsg
      };
    }
  };

  const loginAsDemo = async (): Promise<{ success: boolean; error?: string }> => {
    return login({ email: DEMO_USER.email, password: DEMO_PASSWORD });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        authError,
        isConfigured,
        login,
        signIn: login,
        signup,
        signUp: signup,
        logout,
        signOut: logout,
        resetPassword,
        clearError,
        demoCredentials: {
          email: DEMO_USER.email,
          password: DEMO_PASSWORD
        },
        loginAsDemo,
        resendVerificationEmail,
        pendingVerificationEmail
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};