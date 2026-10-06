import { AppState, AppStateStatus } from 'react-native';
import { api } from '../config/api';

type SubscriptionLike = {
  status?: string;
  isBlocked?: boolean;
  [key: string]: unknown;
};

/**
 * Após abrir o Stripe, o app costuma ir para segundo plano e perde o WebSocket.
 * Esta rotina consulta a assinatura até ficar ACTIVE (ou esgotar o tempo).
 */
export function startPaymentActivationWatch(options: {
  onActivated: (subscription: SubscriptionLike) => void;
  onTick?: (subscription: SubscriptionLike | null) => void;
  intervalMs?: number;
  timeoutMs?: number;
}): () => void {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 3 * 60 * 1000;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    stopped = true;
    if (timer) clearInterval(timer);
    if (timeout) clearTimeout(timeout);
    timer = null;
    timeout = null;
    appSub?.remove();
  };

  const check = async () => {
    if (stopped) return;
    try {
      const response = await api.get('/subscriptions/current');
      const info = (response.data?.data || null) as SubscriptionLike | null;
      options.onTick?.(info);
      if (info && info.status === 'ACTIVE' && info.isBlocked !== true) {
        options.onActivated(info);
        stop();
      }
    } catch {
      // mantém tentando até o timeout
    }
  };

  timer = setInterval(check, intervalMs);
  timeout = setTimeout(stop, timeoutMs);

  // Checa imediatamente ao voltar do Stripe / segundo plano
  const appSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      void check();
    }
  });

  // Primeira consulta após um curto atraso (dá tempo do webhook)
  setTimeout(() => {
    void check();
  }, 1500);

  return stop;
}
