import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Sparkles,
  Building2,
  MessageSquare,
  Users,
  UserCheck,
  ChevronRight,
  X,
  BookOpen,
  ArrowRight,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlaceTerms } from '../utils/placeTerms';

interface SetupGuideBannerProps {
  userId?: string;
  onOpenTutorial: () => void;
  onNavigate: (
    screen: 'org_profile' | 'whatsapp' | 'clients_mgmt' | 'residents' | 'users_mgmt'
  ) => void;
}

export const SetupGuideBanner: React.FC<SetupGuideBannerProps> = ({
  userId,
  onOpenTutorial,
  onNavigate,
}) => {
  const terms = usePlaceTerms();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkDismissed = async () => {
      if (!userId) return;
      try {
        const val =
          (await AsyncStorage.getItem(`@brisoft_portaria:guide_banner_dismissed_${userId}`)) ||
          (await AsyncStorage.getItem(`@combate_portaria:guide_banner_dismissed_${userId}`));
        if (val === 'true') {
          setIsDismissed(true);
        }
      } catch (err) {
        // ignore
      }
    };
    checkDismissed();
  }, [userId]);

  const handleDismiss = async () => {
    setIsDismissed(true);
    if (userId) {
      try {
        await AsyncStorage.setItem(`@brisoft_portaria:guide_banner_dismissed_${userId}`, 'true');
      } catch (err) {
        // ignore
      }
    }
  };

  if (isDismissed) return null;

  return (
    <View style={styles.card}>
      {/* Header do Card */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconCircle}>
            <Sparkles size={16} color="#165337" />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.title}>Início Rápido da Portaria</Text>
            <Text style={styles.subtitle}>Passos essenciais para começar a operar</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Grid de 4 Ações Rápidas */}
      <View style={styles.chipsContainer}>
        <TouchableOpacity
          style={styles.chip}
          onPress={() => onNavigate('org_profile')}
          activeOpacity={0.8}
        >
          <Building2 size={13} color="#B45309" style={{ marginRight: 5 }} />
          <Text style={styles.chipText}>1. Segmento</Text>
          <ChevronRight size={12} color="#B45309" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chip}
          onPress={() => onNavigate('whatsapp')}
          activeOpacity={0.8}
        >
          <MessageSquare size={13} color="#15803D" style={{ marginRight: 5 }} />
          <Text style={styles.chipText}>2. WhatsApp</Text>
          <ChevronRight size={12} color="#15803D" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chip}
          onPress={() => onNavigate('residents')}
          activeOpacity={0.8}
        >
          <Users size={13} color="#1D4ED8" style={{ marginRight: 5 }} />
          <Text style={styles.chipText}>3. {terms.clients}</Text>
          <ChevronRight size={12} color="#1D4ED8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chip}
          onPress={() => onNavigate('users_mgmt')}
          activeOpacity={0.8}
        >
          <UserCheck size={13} color="#7E22CE" style={{ marginRight: 5 }} />
          <Text style={styles.chipText}>4. Porteiros</Text>
          <ChevronRight size={12} color="#7E22CE" />
        </TouchableOpacity>
      </View>

      {/* Botão de Abrir Tutorial */}
      <TouchableOpacity
        style={styles.openTutorialBtn}
        onPress={onOpenTutorial}
        activeOpacity={0.85}
      >
        <BookOpen size={14} color="#165337" style={{ marginRight: 6 }} />
        <Text style={styles.openTutorialBtnText}>Ver Tutorial & Guia Passo a Passo</Text>
        <ArrowRight size={13} color="#165337" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginRight: 2,
  },
  openTutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingVertical: 9,
  },
  openTutorialBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#165337',
  },
});
