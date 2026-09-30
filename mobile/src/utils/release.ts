import { Alert } from 'react-native';
import { api } from '../config/api';

export class ReleaseCancelled extends Error {
  constructor() {
    super('RELEASE_CANCELLED');
    this.name = 'ReleaseCancelled';
  }
}

export async function releaseWithRestrictionCheck(path: string, body: Record<string, unknown>) {
  try {
    return await api.post(path, body);
  } catch (err: any) {
    if (err?.response?.data?.error?.code !== 'RESTRICTION_WARNING') throw err;
    const message = err.response.data.error.message as string;
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Lista de restrição',
        message,
        [
          { text: 'Não liberar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Liberar mesmo assim', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
    if (!proceed) throw new ReleaseCancelled();
    return api.post(path, { ...body, acknowledgeRestriction: true });
  }
}

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weekdayText(weekdays?: string | null) {
  if (!weekdays) return '';
  return weekdays
    .split(',')
    .map((value) => WEEKDAY_SHORT[Number(value)] || '')
    .filter(Boolean)
    .join(', ');
}
