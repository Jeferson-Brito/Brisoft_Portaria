import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

type SessionKey = 'token' | 'refreshToken' | 'user';

const SECURE_KEYS: Record<SessionKey, string> = {
  token: 'brisoft_portaria_token',
  refreshToken: 'brisoft_portaria_refresh',
  user: 'brisoft_portaria_user',
};

const LEGACY_KEYS: Record<SessionKey, string[]> = {
  token: ['@brisoft_portaria:token', '@combate_portaria:token'],
  refreshToken: ['@brisoft_portaria:refreshToken', '@combate_portaria:refreshToken'],
  user: ['@brisoft_portaria:user', '@combate_portaria:user'],
};

function usesSecureStore() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function usesWebSessionStore() {
  return Platform.OS === 'web' && typeof sessionStorage !== 'undefined';
}

function readWebSession(key: SessionKey): string | null {
  if (!usesWebSessionStore()) return null;
  try {
    return sessionStorage.getItem(SECURE_KEYS[key]);
  } catch {
    return null;
  }
}

function writeWebSession(key: SessionKey, value: string) {
  if (!usesWebSessionStore()) return false;
  try {
    sessionStorage.setItem(SECURE_KEYS[key], value);
    return true;
  } catch {
    return false;
  }
}

function clearWebSession(key: SessionKey) {
  if (!usesWebSessionStore()) return;
  try {
    sessionStorage.removeItem(SECURE_KEYS[key]);
  } catch {
    // ignore
  }
}

export async function getSessionValue(key: SessionKey): Promise<string | null> {
  if (usesSecureStore()) {
    try {
      const current = await SecureStore.getItemAsync(SECURE_KEYS[key]);
      if (current) return current;
    } catch {
      // segue para a leitura antiga
    }
  }

  const fromWeb = readWebSession(key);
  if (fromWeb) return fromWeb;

  for (const legacy of LEGACY_KEYS[key]) {
    const old = await AsyncStorage.getItem(legacy);
    if (!old) continue;
    if (usesSecureStore()) {
      try {
        await SecureStore.setItemAsync(SECURE_KEYS[key], old);
        await AsyncStorage.removeItem(legacy);
      } catch {
        // mantém o valor antigo se o cofre recusar o tamanho
      }
    } else if (usesWebSessionStore()) {
      writeWebSession(key, old);
      await AsyncStorage.removeItem(legacy).catch(() => {});
    }
    return old;
  }

  return null;
}

export async function setSessionValue(key: SessionKey, value: string) {
  if (usesSecureStore()) {
    try {
      await SecureStore.setItemAsync(SECURE_KEYS[key], value);
      await Promise.all(LEGACY_KEYS[key].map((legacy) => AsyncStorage.removeItem(legacy)));
      return;
    } catch {
      // aparelhos sem cofre disponível continuam no armazenamento do app
    }
  }

  if (writeWebSession(key, value)) {
    await Promise.all(LEGACY_KEYS[key].map((legacy) => AsyncStorage.removeItem(legacy).catch(() => {})));
    return;
  }

  await AsyncStorage.setItem(LEGACY_KEYS[key][0], value);
}

export async function clearSessionSecrets() {
  await Promise.all(
    (Object.keys(SECURE_KEYS) as SessionKey[]).map(async (key) => {
      if (usesSecureStore()) {
        await SecureStore.deleteItemAsync(SECURE_KEYS[key]).catch(() => {});
      }
      clearWebSession(key);
      await Promise.all(LEGACY_KEYS[key].map((legacy) => AsyncStorage.removeItem(legacy)));
    })
  );
}
