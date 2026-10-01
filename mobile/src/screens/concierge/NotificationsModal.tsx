import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Bell,
  X,
  CircleCheck,
  CircleX,
  Clock,
  Package,
  Trash2,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { usePlaceTerms } from '../../utils/placeTerms';
import { RealtimeAlert } from '../../contexts/RealtimeContext';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: RealtimeAlert[];
  onClear: () => void;
  onSelectNotification?: (notification: RealtimeAlert) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  notifications,
  onClear,
  onSelectNotification,
}) => {
  const terms = usePlaceTerms();
  const renderItem = ({ item }: { item: RealtimeAlert }) => {
    const isAuth = item.type === 'AUTHORIZED';
    const isDenied = item.type === 'DENIED';

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          isAuth && styles.cardAuth,
          isDenied && styles.cardDenied,
        ]}
        onPress={() => {
          if (onSelectNotification) onSelectNotification(item);
          onClose();
        }}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: isAuth
                ? '#DCFCE7'
                : isDenied
                ? '#FEE2E2'
                : '#DBEAFE',
            },
          ]}
        >
          {isAuth ? (
            <CircleCheck size={20} color="#16A34A" />
          ) : isDenied ? (
            <CircleX size={20} color="#DC2626" />
          ) : (
            <Clock size={20} color="#2563EB" />
          )}
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardTime}>Agora</Text>
          </View>
          <Text style={styles.cardMessage}>{item.message}</Text>
          {item.visitorName && (
            <Text style={styles.cardMeta}>
              Visitante: <Text style={{ fontWeight: '700' }}>{item.visitorName}</Text> • {item.destinationName || ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.headerIcon}>
                <Bell size={20} color={colors.white} />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.title}>Notificações</Text>
                <Text style={styles.subtitle}>
                  {notifications.length > 0
                    ? `${notifications.length} alerta(s) recebido(s)`
                    : 'Nenhum alerta recente'}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {notifications.length > 0 && (
                <TouchableOpacity
                  onPress={onClear}
                  style={styles.clearBtn}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                activeOpacity={0.7}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <FlatList
            data={notifications}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Bell size={44} color="#94A3B8" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Sem novas notificações</Text>
                <Text style={styles.emptySubtitle}>
                  Quando os {terms.clients.toLowerCase()} autorizarem ou recusarem acessos pelo WhatsApp, os avisos aparecerão aqui em tempo real.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '45%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardAuth: {
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  cardDenied: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardMessage: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
