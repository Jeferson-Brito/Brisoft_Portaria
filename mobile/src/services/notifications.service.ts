import { Platform, InteractionManager } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '../config/api';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo';

function getNotifications() {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

function configureNotificationHandler() {
  const NotificationsModule = getNotifications();
  if (!NotificationsModule?.setNotificationHandler) {
    return;
  }

  try {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Ignora em caso de indisponibilidade nativa no boot
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }

  await new Promise<void>((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });

  configureNotificationHandler();
  const Notifications = getNotifications();
  if (!Notifications) {
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('portaria-alerts', {
        name: 'Alertas de Acesso da Portaria',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        enableVibrate: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('⚠️ Permissão de notificações negada pelo usuário.');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '6bbcb9f7-7eae-44e1-b8cb-2bd2219e081f';

    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenData?.data || null;
    } catch (err: any) {
      console.warn('⚠️ [Notifications] Falha ao obter getExpoPushTokenAsync:', err?.message || err);
    }

    if (token) {
      try {
        await api.post('/users/push-token', { pushToken: token });
      } catch (err: any) {
        console.warn('⚠️ [Notifications] Falha ao enviar token para o servidor:', err?.message || err);
      }
    }

    return token;
  } catch (error: any) {
    console.warn('Erro ao registrar notificações:', error?.message || error);
    return null;
  }
}

export async function triggerLocalAlertNotification(title: string, body: string, isAuthorized: boolean) {
  const Notifications = getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        channelId: 'portaria-alerts',
        color: isAuthorized ? '#10B981' : '#EF4444',
      },
      trigger: null,
    });
  } catch (err: any) {
    console.warn('Erro ao disparar notificação local:', err?.message || err);
  }
}
