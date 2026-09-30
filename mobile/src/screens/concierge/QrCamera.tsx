import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Props = {
  active: boolean;
  onCode: (code: string) => void;
};

export const QrCamera: React.FC<Props> = ({ active, onCode }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!active) return null;
  if (!permission?.granted) {
    return <Text style={{ color: '#64748B', marginBottom: 12 }}>Permita a câmera para escanear, ou digite o código abaixo.</Text>;
  }

  return (
    <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={done ? undefined : ({ data }) => {
          const code = String(data || '').trim().toUpperCase();
          if (!code.includes('VIS-')) return;
          const token = code.match(/VIS-[A-Z0-9]+/)?.[0];
          if (!token) return;
          setDone(true);
          onCode(token);
        }}
      />
    </View>
  );
};
