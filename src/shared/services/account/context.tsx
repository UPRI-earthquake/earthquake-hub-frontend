import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useRemoteGetProfile from './data';
import { Profile } from './types';
import axios from 'axios';

interface AuthContextType {
  isLoggedIn: boolean;
  profile?: Profile;
  reload: () => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }) {
  const { data: payload, isLoading, refetch: reload } = useRemoteGetProfile();
  const isLoggedIn = useMemo(() => !isLoading && !!payload, [isLoading, payload]);

  const logout = () => {
      
  };

  const profile: Profile | undefined = payload ? {
    username: payload.username,
    email: payload.email,
    derivedRole: payload.roles.includes("brgy") ? "brgy" : "citizen",
    rshakeEmailEnabled: payload.alertPreferences.rshakeEmailEnabled,
    passwordStatus: payload.passwordStatus,
    passwordPolicyVersion: payload.passwordPolicyVersion
  } : undefined;

  useEffect(() => {
    axios.defaults.withCredentials = true;
  }, []);

  return (
      <AuthContext.Provider value={{ isLoggedIn, profile, reload, logout }}>
      {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}