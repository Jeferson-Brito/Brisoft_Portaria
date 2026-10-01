import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { clearSessionSecrets, getSessionValue } from '../services/secure-session';

// Detecta dinamicamente o IP da máquina que hospeda o servidor
export const getHostIp = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return ip;
    }
  }

  // Fallback padrão para a rede local da portaria
  return '192.168.15.115';
};

const PRODUCTION_API_URL = 'https://portaria.brisoft.com.br/api/v1';

export const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Se estiver em desenvolvimento local no navegador
  if (__DEV__ && Platform.OS === 'web') {
    return 'http://localhost:3333/api/v1';
  }

  // Se estiver rodando em desenvolvimento local no Expo Go
  if (__DEV__) {
    const hostIp = getHostIp();
    if (hostIp && hostIp !== '192.168.15.115') {
      return `http://${hostIp}:3333/api/v1`;
    }
  }

  // Padrão para app instalado (APK / Produção)
  return PRODUCTION_API_URL;
};

export const getSocketUrl = () => {
  const url = getBaseUrl();
  return url.replace('/api/v1', '');
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 35000, // 35 segundos para suportar eventual cold-start do Render
});

let memoryToken: string | null = null;

export function setMemoryToken(token: string | null) {
  memoryToken = token;
}

api.interceptors.request.use(
  async (config) => {
    try {
      const token = memoryToken || (await getSessionValue('token'));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Erro ao ler token da sessão:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorizedCallback = (cb: () => void) => {
  onUnauthorizedCallback = cb;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Sessão expirada ou token inválido — limpa ambas as chaves (antiga e nova)
      try {
        await clearSessionSecrets();
      } catch {}
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

