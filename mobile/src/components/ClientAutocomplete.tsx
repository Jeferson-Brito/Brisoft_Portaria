import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Search, Building, User, Phone, Check, RefreshCw } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { api } from '../config/api';

export interface ClientDestinationItem {
  id: string;
  name: string;
  whatsappNumber: string;
  company?: string;
  destinations: Array<{
    destination: {
      id: string;
      name: string;
      block?: string;
      code?: string;
    };
  }>;
}

interface ClientAutocompleteProps {
  onSelectClient: (client: ClientDestinationItem | null, selectedDestinationId: string) => void;
  selectedClientId?: string;
}

export const ClientAutocomplete: React.FC<ClientAutocompleteProps> = ({
  onSelectClient,
  selectedClientId,
}) => {
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState<ClientDestinationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ClientDestinationItem | null>(null);

  // Se o componente foi resetado pelo pai
  useEffect(() => {
    if (!selectedClientId) {
      setSelectedItem(null);
    }
  }, [selectedClientId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setClients([]);
      setIsLoading(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchClients(trimmed);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const fetchClients = async (searchQuery: string) => {
    try {
      setIsLoading(true);
      const response = await api.get('/clients/search', {
        params: { q: searchQuery },
      });
      setClients(response.data?.data?.clients || []);
    } catch (err) {
      console.warn('Erro ao buscar clientes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (client: ClientDestinationItem) => {
    setSelectedItem(client);
    setQuery('');
    setClients([]);
    const primaryDestId = client.destinations[0]?.destination.id || '';
    onSelectClient(client, primaryDestId);
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setQuery('');
    setClients([]);
    onSelectClient(null, '');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Destino / Morador</Text>

      {/* 1. SELEÇÃO ATIVA: CARD COMPACTO E MODERNO */}
      {selectedItem ? (
        <View style={styles.selectedCard}>
          <View style={styles.selectedHeaderRow}>
            <View style={styles.destinationBadge}>
              <Building size={14} color="#165337" style={{ marginRight: 5 }} />
              <Text style={styles.destinationBadgeText}>
                {selectedItem.destinations.length > 0
                  ? `${selectedItem.destinations[0].destination.name}${
                      selectedItem.destinations[0].destination.block
                        ? ` (${selectedItem.destinations[0].destination.block})`
                        : ''
                    }`
                  : 'Unidade vinculada'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.changeBtn}
              onPress={handleClearSelection}
              activeOpacity={0.7}
            >
              <RefreshCw size={12} color="#165337" style={{ marginRight: 4 }} />
              <Text style={styles.changeBtnText}>Alterar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.selectedBodyRow}>
            <View style={styles.clientIconCircle}>
              <User size={16} color="#165337" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedClientName}>{selectedItem.name}</Text>
              {selectedItem.whatsappNumber ? (
                <View style={styles.phoneRow}>
                  <Phone size={12} color="#64748B" style={{ marginRight: 4 }} />
                  <Text style={styles.selectedClientPhone}>{selectedItem.whatsappNumber}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.checkIndicator}>
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </View>
          </View>
        </View>
      ) : (
        /* 2. CAMPO DE BUSCA (QUANDO NÃO SELECIONADO) */
        <View style={styles.searchSection}>
          <View style={styles.searchBox}>
            <Search size={18} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Digite o número da unidade ou nome..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {isLoading && <ActivityIndicator size="small" color="#165337" />}
          </View>

          {/* RESULTADOS DA BUSCA (APENAS QUANDO HOUVER DIGITAÇÃO) */}
          {query.trim().length > 0 && (
            <View style={styles.resultsContainer}>
              {clients.length > 0 ? (
                clients.slice(0, 5).map((item) => {
                  const destinationName =
                    item.destinations.length > 0
                      ? `${item.destinations[0].destination.name}${
                          item.destinations[0].destination.block
                            ? ` (${item.destinations[0].destination.block})`
                            : ''
                        }`
                      : 'Sem unidade';

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.resultItem}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.resultItemHeader}>
                        <View style={styles.resultDestBadge}>
                          <Building size={12} color="#165337" style={{ marginRight: 4 }} />
                          <Text style={styles.resultDestText}>{destinationName}</Text>
                        </View>
                      </View>

                      <View style={styles.resultClientInfo}>
                        <Text style={styles.resultClientName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.resultClientPhone}>
                          {item.whatsappNumber}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : !isLoading ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>Nenhuma unidade ou morador encontrado.</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#165337',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // Card Selecionado (Elegante & Compacto)
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#165337',
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  destinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF7ED',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  destinationBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#165337',
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#165337',
  },
  selectedBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedClientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  selectedClientPhone: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  checkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Campo de Busca
  searchSection: {
    position: 'relative',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    height: 50,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
  },

  // Resultados Dropdown
  resultsContainer: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  resultItem: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  resultItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultDestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  resultDestText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#165337',
  },
  resultClientInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultClientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  resultClientPhone: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  emptyBox: {
    padding: 14,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
});
