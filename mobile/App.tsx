import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';

LogBox.ignoreLogs([
  'Erro de conexão WebSocket',
  'WebSocket: timeout',
  'Socket.io',
]);
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { RealtimeProvider } from './src/contexts/RealtimeContext';
import { RealtimeAlertBanner } from './src/components/RealtimeAlertBanner';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { SubscriptionScreen } from './src/screens/auth/SubscriptionScreen';
import { DashboardScreen } from './src/screens/concierge/DashboardScreen';
import { SuperAdminDashboardScreen } from './src/screens/admin/SuperAdminDashboardScreen';

const AnimatedLoadingScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringScale1 = useRef(new Animated.Value(1)).current;
  const ringOpacity1 = useRef(new Animated.Value(0.6)).current;
  const ringScale2 = useRef(new Animated.Value(1)).current;
  const ringOpacity2 = useRef(new Animated.Value(0.4)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade/scale in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    // Ripple rings loop
    const makeRipple = (
      scaleRef: Animated.Value,
      opacityRef: Animated.Value,
      delay: number,
      startOpacity: number
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scaleRef, {
              toValue: 1.6,
              duration: 1400,
              useNativeDriver: true,
              easing: Easing.out(Easing.ease),
            }),
            Animated.timing(opacityRef, {
              toValue: 0,
              duration: 1400,
              useNativeDriver: true,
              easing: Easing.in(Easing.ease),
            }),
          ]),
          Animated.parallel([
            Animated.timing(scaleRef, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacityRef, { toValue: startOpacity, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
    };

    const r1 = makeRipple(ringScale1, ringOpacity1, 0, 0.6);
    const r2 = makeRipple(ringScale2, ringOpacity2, 700, 0.4);
    r1.start();
    r2.start();

    // Progress bar shimmer
    const bar = Animated.loop(
      Animated.sequence([
        Animated.timing(barWidth, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(barWidth, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ])
    );
    bar.start();

    return () => {
      r1.stop();
      r2.stop();
      bar.stop();
    };
  }, []);

  return (
    <View style={styles.loadingContainer}>
      {/* Ripple rings + Logo */}
      <View style={styles.ringWrapper}>
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: ringScale1 }], opacity: ringOpacity1 },
          ]}
        />
        <Animated.View
          style={[
            styles.ring,
            { transform: [{ scale: ringScale2 }], opacity: ringOpacity2 },
          ]}
        />
        <Animated.Image
          source={require('./assets/logo.png')}
          style={[
            styles.loadingLogo,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.loadingBrand}>Combate Portaria</Text>
      <Text style={styles.loadingTagline}>Controle de Acesso Inteligente</Text>

      {/* Animated progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};

const MainNavigator: React.FC = () => {
  const { user, isLoading, isSubscriptionBlocked } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (isLoading) {
    return <AnimatedLoadingScreen />;
  }

  // Não logado
  if (!user) {
    if (showRegister) {
      return <RegisterScreen onLoginPress={() => setShowRegister(false)} />;
    }
    return <LoginScreen onRegisterPress={() => setShowRegister(true)} />;
  }

  // Logado mas assinatura bloqueada (expirada, suspensa, cancelada)
  if (isSubscriptionBlocked) {
    return <SubscriptionScreen />;
  }

  // Super Administrador: Painel exclusivo de Gestão SaaS Master
  if (user.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboardScreen />;
  }

  // Logado e assinatura ok
  return <DashboardScreen />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RealtimeProvider>
          <StatusBar style="light" />
          <MainNavigator />
          <RealtimeAlertBanner />
        </RealtimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#165337',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringWrapper: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: 'rgba(52, 211, 153, 0.45)',
  },
  loadingLogo: {
    width: 120,
    height: 120,
  },
  loadingBrand: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  loadingTagline: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 36,
  },
  progressTrack: {
    width: 190,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#34D399',
    borderRadius: 2,
  },
});
