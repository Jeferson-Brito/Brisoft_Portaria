import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setOnUnauthorizedCallback } from '../config/api';
import { registerForPushNotificationsAsync } from '../services/notifications.service';

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
  role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPERVISOR' | 'CONCIERGE';
  organizationId: string;
  organizationName: string;
  subscription?: Subscription | null;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSubscriptionBlocked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export interface RegisterData {
  organizationName: string;
  organizationDocument?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
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
      setUser(null);
      setToken(null);
    });

    async function loadStorageData() {
      try {
        const storedToken =
          (await AsyncStorage.getItem('@brisoft_portaria:token')) ||
          (await AsyncStorage.getItem('@combate_portaria:token'));
        const storedUser =
          (await AsyncStorage.getItem('@brisoft_portaria:user')) ||
          (await AsyncStorage.getItem('@combate_portaria:user'));

        if (storedToken && storedUser) {
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

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: loggedUser, token: authToken, refreshToken } = response.data.data;

      setUser(loggedUser);
      setToken(authToken);

      await AsyncStorage.setItem('@brisoft_portaria:token', authToken);
      await AsyncStorage.setItem('@brisoft_portaria:refreshToken', refreshToken);
      await AsyncStorage.setItem('@brisoft_portaria:user', JSON.stringify(loggedUser));

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

      await AsyncStorage.setItem('@combate_portaria:token', authToken);
      await AsyncStorage.setItem('@combate_portaria:user', JSON.stringify(loggedUser));
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error?.message ||
        'Não foi possível criar a conta. Tente novamente.';
      throw new Error(errorMsg);
    }
  };

  // Atualiza os dados de subscription do usuário logado
  const refreshSubscription = async () => {
    try {
      const response = await api.get('/auth/me');
      const freshUser = response.data.data.user;
      setUser(freshUser);
      await AsyncStorage.setItem('@combate_portaria:user', JSON.stringify(freshUser));
    } catch (err) {
      console.warn('Não foi possível atualizar dados da assinatura.');
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('@brisoft_portaria:token');
      await AsyncStorage.removeItem('@brisoft_portaria:refreshToken');
      await AsyncStorage.removeItem('@brisoft_portaria:user');
      await AsyncStorage.removeItem('@combate_portaria:token');
      await AsyncStorage.removeItem('@combate_portaria:refreshToken');
      await AsyncStorage.removeItem('@combate_portaria:user');
    } finally {
      setUser(null);
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isSubscriptionBlocked, signIn, signOut, register, refreshSubscription }}>
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
