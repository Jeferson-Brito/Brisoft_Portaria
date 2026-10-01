import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MapPin } from 'lucide-react-native';

type Suggestion = { text: string; magicKey: string; title: string; detail: string; label: string };
type Point = { lat: number; lng: number; label: string };

const GEOCODE = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';

function splitAddress(text: string) {
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  return {
    title: parts[0] || text,
    detail: parts.slice(1, 4).join(', '),
    label: parts.filter((part) => part !== 'BRA').slice(0, 4).join(', '),
  };
}

async function suggestAddresses(query: string): Promise<Suggestion[]> {
  const response = await fetch(
    `${GEOCODE}/suggest?f=json&countryCode=BRA&maxSuggestions=5&text=${encodeURIComponent(query)}`,
  );
  const data = await response.json();
  const items = Array.isArray(data?.suggestions) ? data.suggestions : [];
  return items.map((item: any) => {
    const parts = splitAddress(String(item.text || ''));
    return { text: String(item.text || ''), magicKey: String(item.magicKey || ''), ...parts };
  }).filter((item: Suggestion) => item.text && item.magicKey);
}

async function locateText(query: string): Promise<Point | null> {
  const response = await fetch(
    `${GEOCODE}/findAddressCandidates?f=json&countryCode=BRA&maxLocations=1&singleLine=${encodeURIComponent(query)}`,
  );
  const data = await response.json();
  const found = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  if (!found?.location) return null;
  return { lat: Number(found.location.y), lng: Number(found.location.x), label: splitAddress(String(found.address || query)).label };
}

async function locateAddress(text: string, magicKey: string): Promise<Point | null> {
  const response = await fetch(
    `${GEOCODE}/findAddressCandidates?f=json&countryCode=BRA&maxLocations=1&outFields=Addr_type,Match_addr&magicKey=${encodeURIComponent(magicKey)}&singleLine=${encodeURIComponent(text)}`,
  );
  const data = await response.json();
  const found = Array.isArray(data?.candidates) ? data.candidates[0] : null;
  if (!found?.location) return null;
  const parts = splitAddress(String(found.address || text));
  return { lat: Number(found.location.y), lng: Number(found.location.x), label: parts.label };
}

function mapHtml(lat: number, lng: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #e8eef2; }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 17);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri'
    }).addTo(map);
    const marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lat: position.lat, lng: position.lng }));
      }
    });
    setTimeout(() => map.invalidateSize(), 250);
  </script>
</body>
</html>`;
}

const StreetMap: React.FC<{ lat: number; lng: number; onTouch: (active: boolean) => void; onMove: (lat: number, lng: number) => void }> = ({
  lat,
  lng,
  onTouch,
  onMove,
}) => (
  <View
    style={styles.frame}
    onTouchStart={() => onTouch(true)}
    onTouchEnd={() => onTouch(false)}
    onTouchCancel={() => onTouch(false)}
  >
    <WebView
      style={styles.map}
      originWhitelist={['*']}
      source={{ html: mapHtml(lat, lng), baseUrl: 'https://server.arcgisonline.com' }}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled
      nestedScrollEnabled
      setSupportMultipleWindows={false}
      onMessage={(event) => {
        try {
          const next = JSON.parse(event.nativeEvent.data);
          if (Number.isFinite(next.lat) && Number.isFinite(next.lng)) onMove(next.lat, next.lng);
        } catch {
          /* ignore malformed map messages */
        }
      }}
    />
  </View>
);

export const AddressMap: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onTouchMap?: (active: boolean) => void;
}> = ({ value, onChange, onTouchMap }) => {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [point, setPoint] = useState<Point | null>(null);
  const [looking, setLooking] = useState(false);
  const chosen = useRef('');

  useEffect(() => {
    const query = value.trim();
    if (chosen.current && chosen.current === query) {
      setSuggestions([]);
      return;
    }
    if (query.length < 3) {
      setSuggestions([]);
      setLooking(false);
      return;
    }

    const timer = setTimeout(async () => {
      if (!focused) {
        setSuggestions([]);
        setLooking(true);
        try {
          const located = await locateText(query);
          if (located) setPoint(located);
        } catch {
          /* the saved address stays written even if the map fails */
        } finally {
          setLooking(false);
        }
        return;
      }
      setLooking(true);
      try {
        const results = await suggestAddresses(query);
        setSuggestions(focused ? results : []);
        const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 2 && !/^\d+$/.test(word));
        const number = query.match(/\d{2,6}/)?.[0];
        const precise = results.filter((item) => {
          const text = item.text.toLowerCase();
          const hasNumber = !number || text.includes(number);
          const hasWords = words.every((word) => text.includes(word));
          return hasNumber && hasWords;
        });
        if (precise.length === 1 && chosen.current !== query) {
          const located = await locateAddress(precise[0].text, precise[0].magicKey);
          if (located) setPoint(located);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLooking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, focused]);

  const choose = async (item: Suggestion) => {
    setLooking(true);
    try {
      const located = await locateAddress(item.text, item.magicKey);
      const label = located?.label || item.label;
      chosen.current = label;
      onChange(label);
      if (located) setPoint(located);
      setSuggestions([]);
      setFocused(false);
    } finally {
      setLooking(false);
    }
  };

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Digite a rua, o número ou o nome do local"
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={(text) => {
          if (text.trim() !== chosen.current) chosen.current = '';
          onChange(text);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
      />

      {focused && (looking || suggestions.length > 0) ? (
        <View style={styles.list}>
          {looking && suggestions.length === 0 ? (
            <View style={styles.row}>
              <ActivityIndicator color="#165337" />
              <Text style={styles.looking}>Buscando endereços...</Text>
            </View>
          ) : suggestions.map((item) => (
            <TouchableOpacity key={item.magicKey} style={styles.row} onPress={() => choose(item)}>
              <MapPin size={18} color="#165337" />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {point ? (
        <View style={styles.wrap}>
          <StreetMap
            lat={point.lat}
            lng={point.lng}
            onTouch={(active) => onTouchMap?.(active)}
            onMove={(lat, lng) => setPoint((current) => current ? { ...current, lat, lng } : current)}
          />
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>As sugestões aparecem enquanto você digita. Toque em uma para marcar o mapa.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#F8FAF9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    minHeight: 52,
  },
  list: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  looking: { color: '#64748B' },
  title: { color: '#0F172A', fontWeight: '700' },
  detail: { color: '#64748B', marginTop: 2, fontSize: 12 },
  wrap: { marginTop: 12 },
  frame: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E8EEF2' },
  map: { flex: 1, backgroundColor: 'transparent' },
  empty: {
    marginTop: 12,
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emptyText: { color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
