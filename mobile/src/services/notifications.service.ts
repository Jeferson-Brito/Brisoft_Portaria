import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { api } from '../config/api';

// Detecta se está executando no Expo Go
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as any).appOwnership === 'expo' ||
  typeof (Constants as any).expoGoConfig !== 'undefined';

// Carregamento dinâmico: NUNCA faz import estático de 'expo-notifications' no Expo Go
// porque o módulo executa addPushTokenListener na inicialização e gera erro no SDK 53
function getNotifications() {
  if (isExpoGo || Platform.OS === 'web') {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

// Configura o handler no APK compilado
const NotificationsModule = getNotifications();
if (NotificationsModule?.setNotificationHandler) {
  try {
    NotificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    // Ignora em caso de indisponibilidade
  }
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications || Platform.OS === 'web') {
    return null;
  }

  try {
    // Canal de notificação do Android com som e prioridade máxima
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
      try {
        await api.post('/users/push-token', {
          error: 'PERMISSION_NOT_GRANTED',
          debugInfo: { existingStatus, finalStatus, platform: Platform.OS },
        });
      } catch {}
      return null;
    }

    // Obtém o token do Expo Push (apenas em APK standalone / development build)
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
      const errMsg = err?.message || String(err);
      console.warn('⚠️ [Notifications] Falha ao obter getExpoPushTokenAsync:', errMsg);
      try {
        await api.post('/users/push-token', {
          error: errMsg,
          debugInfo: { projectId, platform: Platform.OS },
        });
      } catch {}
    }

    if (token) {
      console.log('📱 [Notifications] Expo Push Token obtido com sucesso:', token);
      try {
        await api.post('/users/push-token', { pushToken: token });
        console.log('✅ [Notifications] Token registrado no servidor com sucesso.');
      } catch (err: any) {
        console.warn('⚠️ [Notifications] Falha ao enviar token para o servidor:', err?.message || err);
      }
    } else {
      console.warn('⚠️ [Notifications] getExpoPushTokenAsync retornou token vazio.');
    }

    return token;
  } catch (error: any) {
    const mainErr = error?.message || String(error);
    console.warn('Erro ao registrar notificações:', mainErr);
    try {
      await api.post('/users/push-token', { error: mainErr });
    } catch {}
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
      trigger: null, // Disparo imediato
    });
  } catch (err: any) {
    console.warn('Erro ao disparar notificação local:', err?.message || err);
  }
}
