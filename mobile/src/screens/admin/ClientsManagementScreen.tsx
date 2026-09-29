import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Users,
  Building2,
  Phone,
  Search,
  ArrowLeft,
  Home,
  MessageCircle,
  Pencil,
  Trash2,
  MoreVertical,
  Plus,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';

interface ClientsManagementScreenProps {
  onBack?: () => void;
}

export const ClientsManagementScreen: React.FC<ClientsManagementScreenProps> = ({ onBack }) => {
  // Aba ativa: 'clients' (Moradores) por padrão ou 'destinations' (Unidades / Aptos)
  const [activeTab, setActiveTab] = useState<'clients' | 'destinations'>('clients');

  const [clients, setClients] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Novo Morador
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [selectedDestId, setSelectedDestId] = useState('');
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Modal Nova Unidade / Apartamento
  const [isDestModalOpen, setIsDestModalOpen] = useState(false);
  const [destName, setDestName] = useState('');
  const [destBlock, setDestBlock] = useState('');
  const [destCode, setDestCode] = useState('');
  const [isSubmittingDest, setIsSubmittingDest] = useState(false);

  // Modal Editar Morador
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDocument, setEditDocument] = useState('');
  const [editSelectedDestId, setEditSelectedDestId] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Modal Editar Unidade
  const [isEditDestModalOpen, setIsEditDestModalOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<any>(null);
  const [editDestName, setEditDestName] = useState('');
  const [editDestBlock, setEditDestBlock] = useState('');
  const [editDestCode, setEditDestCode] = useState('');
  const [isSubmittingEditDest, setIsSubmittingEditDest] = useState(false);

  // Menu de ações por card
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [clientsRes, destsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/destinations'),
      ]);

      setClients(clientsRes.data.data?.clients || clientsRes.data.data?.items || clientsRes.data.data || []);
      const destList = destsRes.data.data?.destinations || destsRes.data.data || [];
      setDestinations(destList);
      if (destList.length > 0 && !selectedDestId) {
        setSelectedDestId(destList[0].id);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar moradores e unidades:', err.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      loadData();
      return;
    }

    if (activeTab === 'clients') {
      try {
        const res = await api.get(`/clients/search?q=${encodeURIComponent(text.trim())}`);
        setClients(res.data.data?.clients || []);
      } catch (err) {}
    } else {
      try {
        const res = await api.get(`/destinations?search=${encodeURIComponent(text.trim())}`);
        setDestinations(res.data.data?.destinations || []);
      } catch (err) {}
    }
  };

  // Alterna aba e limpa a busca
  const handleSwitchTab = (tab: 'clients' | 'destinations') => {
    setActiveTab(tab);
    setSearchQuery('');
    setActiveMenuId(null);
    loadData();
  };

  // ==================== AÇÕES DE UNIDADE ====================
  const handleCreateDestination = async () => {
    if (!destName.trim()) {
      Alert.alert('Atenção', 'Informe o nome da unidade (ex: Apartamento 101).');
      return;
    }

    try {
      setIsSubmittingDest(true);
      const res = await api.post('/destinations', {
        name: destName.trim(),
        block: destBlock.trim() || undefined,
        code: destCode.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert('Sucesso', 'Unidade cadastrada com sucesso!');
        setIsDestModalOpen(false);
        setDestName('');
        setDestBlock('');
        setDestCode('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao cadastrar unidade');
    } finally {
      setIsSubmittingDest(false);
    }
  };

  const openEditDest = (d: any) => {
    setEditingDest(d);
    setEditDestName(d.name || '');
    setEditDestBlock(d.block || '');
    setEditDestCode(d.code || '');
    setActiveMenuId(null);
    setIsEditDestModalOpen(true);
  };

  const handleEditDestination = async () => {
    if (!editDestName.trim()) {
      Alert.alert('Atenção', 'O nome da unidade não pode ficar em branco.');
      return;
    }

    try {
      setIsSubmittingEditDest(true);
      await api.put(`/destinations/${editingDest.id}`, {
        name: editDestName.trim(),
        block: editDestBlock.trim() || undefined,
        code: editDestCode.trim() || undefined,
      });

      Alert.alert('Sucesso', 'Unidade atualizada com sucesso!');
      setIsEditDestModalOpen(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao atualizar unidade');
    } finally {
      setIsSubmittingEditDest(false);
    }
  };

  const handleDeleteDestination = (d: any) => {
    setActiveMenuId(null);
    Alert.alert(
      'Excluir Unidade',
      `Tem certeza que deseja excluir ${d.name}? Os moradores vinculados permanecerão no sistema, mas sem esta unidade.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/destinations/${d.id}`);
              Alert.alert('Sucesso', 'Unidade removida com sucesso.');
              loadData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao excluir unidade');
            }
          },
        },
      ]
    );
  };

  // ==================== AÇÕES DE MORADOR ====================
  const handleCreateClient = async () => {
    if (!clientName.trim() || !whatsapp.trim()) {
      Alert.alert('Atenção', 'Preencha o nome do morador e o WhatsApp.');
      return;
    }

    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Atenção', 'WhatsApp deve conter DDD e número (ex: 11999998888 ou 5511999998888).');
      return;
    }

    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    try {
      setIsSubmittingClient(true);
      const res = await api.post('/clients', {
        name: clientName.trim(),
        whatsappNumber: formattedPhone,
        email: email.trim() || undefined,
        document: document.trim() || undefined,
        destinationIds: selectedDestId ? [selectedDestId] : undefined,
      });

      if (res.data.success) {
        Alert.alert('Sucesso', 'Morador cadastrado com sucesso e vinculado à unidade!');
        setIsClientModalOpen(false);
        setClientName('');
        setWhatsapp('');
        setEmail('');
        setDocument('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao cadastrar morador');
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const openEditClient = (c: any) => {
    setEditingClient(c);
    setEditClientName(c.name);
    setEditWhatsapp(c.whatsappNumber?.replace(/^55/, '') || '');
    setEditEmail(c.email || '');
    setEditDocument(c.document || '');
    const firstDest = (c.destinations || [])[0]?.destination?.id || (c.destinations || [])[0]?.id || '';
    setEditSelectedDestId(firstDest);
    setActiveMenuId(null);
    setIsEditClientModalOpen(true);
  };

  const handleEditClient = async () => {
    if (!editClientName.trim()) {
      Alert.alert('Atenção', 'O nome não pode ficar em branco.');
      return;
    }
    const cleanPhone = editWhatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Atenção', 'WhatsApp deve conter DDD e número.');
      return;
    }
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    try {
      setIsSubmittingEdit(true);
      await api.put(`/clients/${editingClient.id}`, {
        name: editClientName.trim(),
        whatsappNumber: formattedPhone,
        email: editEmail.trim() || undefined,
        document: editDocument.trim() || undefined,
        destinationIds: editSelectedDestId ? [editSelectedDestId] : undefined,
      });
      Alert.alert('Sucesso', 'Dados do morador atualizados com sucesso!');
      setIsEditClientModalOpen(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao atualizar morador');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteClient = (c: any) => {
    Alert.alert(
      'Excluir morador',
      `Tem certeza que deseja excluir ${c.name}? O histórico de visitas será mantido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/clients/${c.id}`);
              Alert.alert('Sucesso', 'Morador removido com sucesso.');
              loadData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao excluir morador');
            }
          },
        },
      ]
    );
    setActiveMenuId(null);
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0) + 14;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding }]}>
        <View style={styles.headerRow}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft size={20} color={colors.white} />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Gestão de Moradores & Unidades</Text>
            <Text style={styles.headerSubtitle}>Cadastro de residentes e apartamentos</Text>
          </View>
        </View>

        {/* Abas Internas (Moradores e Unidades / Aptos) */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'clients' && styles.tabButtonActive]}
            onPress={() => handleSwitchTab('clients')}
            activeOpacity={0.8}
          >
            <Users size={16} color={activeTab === 'clients' ? '#165337' : 'rgba(255,255,255,0.75)'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabButtonText, activeTab === 'clients' && styles.tabButtonTextActive]}>
              Morador
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'destinations' && styles.tabButtonActive]}
            onPress={() => handleSwitchTab('destinations')}
            activeOpacity={0.8}
          >
            <Home size={16} color={activeTab === 'destinations' ? '#165337' : 'rgba(255,255,255,0.75)'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabButtonText, activeTab === 'destinations' && styles.tabButtonTextActive]}>
              Unidade / Apto
            </Text>
          </TouchableOpacity>
        </View>

        {/* Linha de Busca + Botão Adicionar ao lado */}
        <View style={styles.searchActionRow}>
          <View style={styles.searchBar}>
            <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === 'clients'
                  ? 'Buscar morador ou celular...'
                  : 'Buscar unidade, bloco ou código...'
              }
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {activeTab === 'clients' ? (
            <TouchableOpacity
              style={styles.actionBtnHeader}
              onPress={() => setIsClientModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#165337" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnHeaderText}>Morador</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtnHeader}
              onPress={() => setIsDestModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#165337" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnHeaderText}>Unidade</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conteúdo Principal da Aba Selecionada */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {activeTab === 'clients' ? 'Carregando moradores...' : 'Carregando unidades...'}
          </Text>
        </View>
      ) : activeTab === 'clients' ? (
        /* ================= LISTA DE MORADORES ================= */
        <FlatList
          data={clients}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={['#2563EB']}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhum morador cadastrado</Text>
              <Text style={styles.emptySub}>
                Toque no botão "Morador" acima para cadastrar os residentes.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const destNames = (item.destinations || [])
              .map((d: any) => d.destination?.name || d.name)
              .filter(Boolean)
              .join(', ');
            const menuOpen = activeMenuId === item.id;

            return (
              <View style={styles.clientCard}>
                <View style={styles.clientCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    {destNames ? (
                      <View style={[styles.destBadge, { alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Building2 size={12} color="#1D4ED8" style={{ marginRight: 4 }} />
                        <Text style={styles.destBadgeText}>{destNames}</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => setActiveMenuId(menuOpen ? null : item.id)}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.clientDetailRow}>
                  <MessageCircle size={14} color="#16A34A" style={{ marginRight: 6 }} />
                  <Text style={styles.clientPhoneText}>+{item.whatsappNumber}</Text>
                </View>

                {item.document && (
                  <Text style={styles.clientDocText}>Doc: {item.document}</Text>
                )}

                {menuOpen && (
                  <View style={styles.actionMenu}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => openEditClient(item)}>
                      <Pencil size={15} color="#1D4ED8" />
                      <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Editar dados</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity style={styles.actionItem} onPress={() => handleDeleteClient(item)}>
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.actionText, { color: '#DC2626' }]}>Excluir morador</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        /* ================= LISTA DE UNIDADES / APTOS ================= */
        <FlatList
          data={destinations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={['#2563EB']}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Home size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>Nenhuma unidade cadastrada</Text>
              <Text style={styles.emptySub}>
                Toque no botão "Unidade" acima para cadastrar apartamentos e blocos.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const menuOpen = activeMenuId === item.id;
            const residentsCount = item.clients?.length || 0;

            return (
              <View style={styles.clientCard}>
                <View style={styles.clientCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      {item.block && (
                        <View style={styles.destMetaBadge}>
                          <Text style={styles.destMetaBadgeText}>Bloco: {item.block}</Text>
                        </View>
                      )}
                      {item.code && (
                        <View style={styles.destMetaBadge}>
                          <Text style={styles.destMetaBadgeText}>Cód: {item.code}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.menuBtn}
                    onPress={() => setActiveMenuId(menuOpen ? null : item.id)}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={styles.clientDetailRow}>
                  <Users size={14} color="#2563EB" style={{ marginRight: 6 }} />
                  <Text style={styles.unitResidentsText}>
                    {residentsCount === 0
                      ? 'Nenhum morador vinculado'
                      : residentsCount === 1
                      ? '1 morador vinculado'
                      : `${residentsCount} moradores vinculados`}
                  </Text>
                </View>

                {menuOpen && (
                  <View style={styles.actionMenu}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => openEditDest(item)}>
                      <Pencil size={15} color="#1D4ED8" />
                      <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Editar unidade</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity style={styles.actionItem} onPress={() => handleDeleteDestination(item)}>
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.actionText, { color: '#DC2626' }]}>Excluir unidade</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      {/* Modal 1: Cadastrar Morador */}
      <Modal visible={isClientModalOpen} animationType="slide" transparent onRequestClose={() => setIsClientModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Novo Morador</Text>
            <Text style={styles.modalSubtitle}>Insira os dados do morador para receber as visitas.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome do Morador / Responsável *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Carlos Oliveira"
                placeholderTextColor="#94A3B8"
                value={clientName}
                onChangeText={setClientName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>WhatsApp para Autorizações *</Text>
              <TextInput
                style={styles.input}
                placeholder="11999998888 (com DDD)"
                placeholderTextColor="#94A3B8"
                value={whatsapp}
                onChangeText={setWhatsapp}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Unidade / Apartamento *</Text>
              {destinations.length === 0 ? (
                <TouchableOpacity
                  style={styles.noDestBox}
                  onPress={() => {
                    setIsClientModalOpen(false);
                    setIsDestModalOpen(true);
                  }}
                >
                  <Text style={styles.noDestText}>
                    Nenhuma unidade cadastrada. Toque aqui para criar a primeira!
                  </Text>
                </TouchableOpacity>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                  {destinations.map((d) => {
                    const isSelected = selectedDestId === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.destChip, isSelected && styles.destChipSelected]}
                        onPress={() => setSelectedDestId(d.id)}
                      >
                        <Text style={[styles.destChipText, isSelected && styles.destChipTextSelected]}>
                          {d.name} {d.block ? `(${d.block})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Documento (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="CPF ou RG"
                placeholderTextColor="#94A3B8"
                value={document}
                onChangeText={setDocument}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsClientModalOpen(false)}
                disabled={isSubmittingClient}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateClient}
                disabled={isSubmittingClient}
              >
                {isSubmittingClient ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Morador</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 2: Cadastrar Unidade / Apartamento */}
      <Modal visible={isDestModalOpen} animationType="slide" transparent onRequestClose={() => setIsDestModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar Nova Unidade</Text>
            <Text style={styles.modalSubtitle}>Ex: Apartamento, Sala Comercial, Consultório.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome da Unidade *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Apartamento 101"
                placeholderTextColor="#94A3B8"
                value={destName}
                onChangeText={setDestName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Bloco / Torre / Setor (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Bloco A ou Torre Sul"
                placeholderTextColor="#94A3B8"
                value={destBlock}
                onChangeText={setDestBlock}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Código Rápido (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 101-A"
                placeholderTextColor="#94A3B8"
                value={destCode}
                onChangeText={setDestCode}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsDestModalOpen(false)}
                disabled={isSubmittingDest}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreateDestination}
                disabled={isSubmittingDest}
              >
                {isSubmittingDest ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Criar Unidade</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 3: Editar Morador */}
      <Modal visible={isEditClientModalOpen} animationType="slide" transparent onRequestClose={() => setIsEditClientModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Dados do Morador</Text>
            <Text style={styles.modalSubtitle}>Atualize as informações do morador e seus destinos.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome Completo *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Carlos Oliveira"
                placeholderTextColor="#94A3B8"
                value={editClientName}
                onChangeText={setEditClientName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>WhatsApp para Autorizações *</Text>
              <TextInput
                style={styles.input}
                placeholder="11999998888 (com DDD)"
                placeholderTextColor="#94A3B8"
                value={editWhatsapp}
                onChangeText={setEditWhatsapp}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Unidade / Apartamento</Text>
              {destinations.length === 0 ? (
                <Text style={styles.noDestText}>Nenhuma unidade cadastrada.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                  {destinations.map((d) => {
                    const isSelected = editSelectedDestId === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[styles.destChip, isSelected && styles.destChipSelected]}
                        onPress={() => setEditSelectedDestId(d.id)}
                      >
                        <Text style={[styles.destChipText, isSelected && styles.destChipTextSelected]}>
                          {d.name} {d.block ? `(${d.block})` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>E-mail (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="morador@email.com"
                placeholderTextColor="#94A3B8"
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Documento (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="CPF ou RG"
                placeholderTextColor="#94A3B8"
                value={editDocument}
                onChangeText={setEditDocument}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditClientModalOpen(false)}
                disabled={isSubmittingEdit}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleEditClient}
                disabled={isSubmittingEdit}
              >
                {isSubmittingEdit ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Alterações</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 4: Editar Unidade / Apto */}
      <Modal visible={isEditDestModalOpen} animationType="slide" transparent onRequestClose={() => setIsEditDestModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Unidade / Apto</Text>
            <Text style={styles.modalSubtitle}>Atualize os dados desta unidade ou apartamento.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome da Unidade *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Apartamento 101"
                placeholderTextColor="#94A3B8"
                value={editDestName}
                onChangeText={setEditDestName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Bloco / Torre (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Bloco A"
                placeholderTextColor="#94A3B8"
                value={editDestBlock}
                onChangeText={setEditDestBlock}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Código Rápido (Opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 101-A"
                placeholderTextColor="#94A3B8"
                value={editDestCode}
                onChangeText={setEditDestCode}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsEditDestModalOpen(false)}
                disabled={isSubmittingEditDest}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleEditDestination}
                disabled={isSubmittingEditDest}
              >
                {isSubmittingEditDest ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar Unidade</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#165337',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  // Container de Abas (Morador / Unidade)
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.white,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  tabButtonTextActive: {
    color: '#165337',
    fontWeight: '800',
  },
  // Linha de Busca + Ação
  searchActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  actionBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionBtnHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#165337',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  clientCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  destBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  destBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  destMetaBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  destMetaBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  clientDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  clientPhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
  },
  unitResidentsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  clientDocText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  menuBtn: {
    padding: 4,
  },
  actionMenu: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    marginTop: 2,
  },
  formGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: '#0F172A',
  },
  noDestBox: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noDestText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
  },
  destChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  destChipSelected: {
    backgroundColor: '#165337',
    borderColor: '#165337',
  },
  destChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  destChipTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    backgroundColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
