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

export async function getSessionValue(key: SessionKey): Promise<string | null> {
  if (usesSecureStore()) {
    try {
      const current = await SecureStore.getItemAsync(SECURE_KEYS[key]);
      if (current) return current;
    } catch {
      // segue para a leitura antiga
    }
  }

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
  await AsyncStorage.setItem(LEGACY_KEYS[key][0], value);
}

export async function clearSessionSecrets() {
  await Promise.all(
    (Object.keys(SECURE_KEYS) as SessionKey[]).map(async (key) => {
      if (usesSecureStore()) {
        await SecureStore.deleteItemAsync(SECURE_KEYS[key]).catch(() => {});
      }
      await Promise.all(LEGACY_KEYS[key].map((legacy) => AsyncStorage.removeItem(legacy)));
    })
  );
}
