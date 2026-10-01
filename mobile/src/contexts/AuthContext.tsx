import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setOnUnauthorizedCallback, setMemoryToken } from '../config/api';
import { registerForPushNotificationsAsync } from '../services/notifications.service';
import { clearSessionSecrets, getSessionValue, setSessionValue } from '../services/secure-session';
import { setPhotoAccessToken } from '../utils/photo';
import { clearScreenCache } from '../utils/screenCache';

export interface Subscription {
  plan: 'TRIAL' | 'BASIC' | 'ENTERPRISE';
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  trialEndsAt: string | null;
  currentPeriodEnd?: string | null;
  daysRemaining: number | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'CONCIERGE' | 'CLIENT';
  organizationId: string;
  organizationName: string;
  clientId?: string | null;
    mustCompleteProfile?: boolean;
    whatsappVerified?: boolean;
    resident?: { id: string; name: string; units: Array<{ id: string; name: string; block?: string | null; isPrimary?: boolean }> } | null;
  subscription?: Subscription | null;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSubscriptionBlocked: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshSubscription: () => Promise<any>;
  patchUser: (partial: Partial<User>) => Promise<void>;
}

export interface RegisterData {
  organizationName: string;
  organizationDocument: string;
  documentType: 'CPF' | 'CNPJ';
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone: string;
  verificationCode: string;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

// Status que bloqueiam o uso do app (exceto SUPER_ADMIN)
const BLOCKED_STATUSES = ['EXPIRED', 'SUSPENDED', 'CANCELLED'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      clearScreenCache();
      setUser(null);
      setToken(null);
    });

    async function loadStorageData() {
      try {
        const remember = await AsyncStorage.getItem('@brisoft_portaria:remember');
        if (remember === '0') {
          setIsLoading(false);
          return;
        }

        const storedToken = await getSessionValue('token');
        const storedUser = await getSessionValue('user');

        if (storedToken && storedUser) {
          setMemoryToken(storedToken);
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setTimeout(() => {
            registerForPushNotificationsAsync();
          }, 2500);
        }
      } catch (err) {
        console.error('Erro ao restaurar sessão local:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStorageData();
  }, []);

  // Verifica se a assinatura bloqueia o uso do app (exceto SUPER_ADMIN)
  const isSubscriptionBlocked =
    user?.role !== 'SUPER_ADMIN' &&
    !!user?.subscription &&
    (BLOCKED_STATUSES.includes(user.subscription.status) || (user.subscription as any).isBlocked === true);

  const signIn = async (email: string, password: string, remember = true) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: loggedUser, token: authToken, refreshToken } = response.data.data;

      clearScreenCache();
      setUser(loggedUser);
      setToken(authToken);
      setMemoryToken(authToken);

      if (remember) {
        await AsyncStorage.setItem('@brisoft_portaria:remember', '1');
        await AsyncStorage.setItem('@brisoft_portaria:rememberedEmail', email.trim());
        await setSessionValue('token', authToken);
        await setSessionValue('refreshToken', refreshToken);
        await setSessionValue('user', JSON.stringify(loggedUser));
      } else {
        await AsyncStorage.setItem('@brisoft_portaria:remember', '0');
        await AsyncStorage.removeItem('@brisoft_portaria:rememberedEmail');
        await clearSessionSecrets();
      }

      setTimeout(() => {
        registerForPushNotificationsAsync();
      }, 2500);
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
      throw new Error(errorMsg);
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await api.post('/auth/register', data);
      const { admin, token: authToken, organization, subscription } = response.data.data;

      const loggedUser: User = {
        ...admin,
        organizationId: organization.id,
        organizationName: organization.name,
        subscription,
      };

      setUser(loggedUser);
      setToken(authToken);

      await setSessionValue('token', authToken);
      await setSessionValue('user', JSON.stringify(loggedUser));
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        'Não foi possível criar a conta. Tente novamente.';
      throw new Error(errorMsg);
    }
  };

  // Atualiza os dados de subscription do usuário logado
  const refreshSubscription = async () => {
    const response = await api.get('/auth/me');
    const freshUser = response.data.data.user;
    let nextUser: User | null = null;

    setUser((current) => {
      nextUser = {
        ...(current || freshUser),
        name: freshUser.name || current?.name,
        email: freshUser.email || current?.email,
        role: freshUser.role || current?.role,
        organizationId: freshUser.organization?.id || current?.organizationId,
        organizationName: freshUser.organization?.name || current?.organizationName,
        clientId: freshUser.clientId ?? current?.clientId ?? null,
        resident: freshUser.resident ?? current?.resident ?? null,
        subscription: freshUser.subscription ?? current?.subscription ?? null,
      };
      return nextUser;
    });

    if (nextUser) {
      const remember = await AsyncStorage.getItem('@brisoft_portaria:remember');
      if (remember !== '0') {
        const stored = JSON.stringify(nextUser);
        await setSessionValue('user', stored);
      }
    }

    return nextUser?.subscription ?? null;
  };

  const patchUser = async (partial: Partial<User>) => {
    let next: User | null = null;
    setUser((current) => {
      if (!current) return current;
      next = { ...current, ...partial };
      return next;
    });
    if (next) await setSessionValue('user', JSON.stringify(next));
  };

  const signOut = async () => {
    try {
      await clearSessionSecrets();
    } finally {
      clearScreenCache();
      setMemoryToken(null);
      setUser(null);
      setToken(null);
    }
  };

  setPhotoAccessToken(token);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isSubscriptionBlocked, signIn, signOut, register, refreshSubscription, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
