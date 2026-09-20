import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth, users, setAuth, clearAuth, getUser, getToken } from '../api';
import UpgradeProModal from '../components/UpgradeProModal';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(() => getUser());
  const [token, setToken] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Synchronize and validate active session on mount
  const refreshUser = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return null;
    }

    try {
      const meData = await users.me();
      const mergedUser = {
        ...getUser(),
        ...meData,
        has_onboarding: meData.has_onboarding ?? (!!meData.objectives?.distance_km && !!meData.objectives?.level),
      };
      localStorage.setItem('rush_user', JSON.stringify(mergedUser));
      setUser(mergedUser);
      setToken(currentToken);
      return mergedUser;
    } catch (err) {
      console.warn('Session check failed or expired:', (err as Error)?.message);
      clearAuth();
      setUser(null);
      setToken(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen to custom auth expiration events from api.js
    const handleAuthExpired = () => {
      clearAuth();
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await auth.login(email, password);
    setAuth(data);
    const activeUser = data.user;
    setUser(activeUser);
    setToken(data.token || data.access_token);
    return activeUser;
  };

  const register = async (
    params: any,
    maybePassword?: string,
    maybeName?: string,
    maybeUsername?: string,
  ) => {
    let payload: any;
    if (typeof params === 'object' && params !== null) {
      payload = params;
    } else {
      payload = {
        email: params,
        password: maybePassword,
        name: maybeName,
        username: maybeUsername,
      };
    }

    const data = await auth.register(payload);
    setAuth(data);
    const activeUser = data.user;
    setUser(activeUser);
    setToken(data.token || data.access_token);
    return activeUser;
  };

  const logout = async () => {
    try {
      await auth.logout();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearAuth();
      setUser(null);
      setToken(null);
    }
  };

  const updateUser = (partialData: any) => {
    setUser((prev: any) => {
      const updated = { ...(prev || {}), ...partialData };
      localStorage.setItem('rush_user', JSON.stringify(updated));
      return updated;
    });
  };

  const openUpgradeModal = () => setIsUpgradeModalOpen(true);
  const closeUpgradeModal = () => setIsUpgradeModalOpen(false);

  const isAuthenticated = Boolean(user && token);
  const isPro = Boolean(
    user?.is_pro ||
    ['coach', 'owner', 'admin'].includes(user?.role) ||
    user?.subscription_tier === 'pro' ||
    user?.subscription_tier === 'lifetime'
  );

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    isPro,
    openUpgradeModal,
    closeUpgradeModal,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <UpgradeProModal
        isOpen={isUpgradeModalOpen}
        onClose={closeUpgradeModal}
        onUpgraded={refreshUser}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
