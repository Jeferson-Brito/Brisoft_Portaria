// Guarda em memória a última resposta de cada aba, para ela abrir já com dados
// enquanto a versão nova chega do servidor. Limpo ao sair da conta.
const cache = new Map<string, unknown>();

export function readScreenCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function writeScreenCache<T>(key: string, value: T) {
  cache.set(key, value);
}

export function clearScreenCache() {
  cache.clear();
}
