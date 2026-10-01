import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
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
  Key,
  Lock,
  SlidersHorizontal,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordField } from '../../components/PasswordField';
import { usePlaceTerms } from '../../utils/placeTerms';

interface ClientsManagementScreenProps {
  onBack?: () => void;
  section?: 'all' | 'residents' | 'units';
}

export const ClientsManagementScreen: React.FC<ClientsManagementScreenProps> = ({ onBack, section = 'all' }) => {
  const { user: currentUser } = useAuth();
  const terms = usePlaceTerms();
  const clientLower = terms.client.toLowerCase();
  const clientsLower = terms.clients.toLowerCase();
  const unitLower = terms.unit.toLowerCase();
  const unitsLower = terms.units.toLowerCase();
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  // Aba ativa: 'clients' (Moradores) por padrão ou 'destinations' (Unidades / Aptos)
  const [activeTab, setActiveTab] = useState<'clients' | 'destinations'>(section === 'units' ? 'destinations' : 'clients');
  const [accessByClient, setAccessByClient] = useState<Record<string, any>>({});
  const [accessFilter, setAccessFilter] = useState<'all' | 'with' | 'without'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterButtonRef = useRef<View>(null);
  const [filterAnchor, setFilterAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [menuClient, setMenuClient] = useState<any>(null);

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
  const [accessClient, setAccessClient] = useState<any>(null);
  const [accessName, setAccessName] = useState('');
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [isAccessSubmitting, setIsAccessSubmitting] = useState(false);

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

      const clientList = clientsRes.data.data?.clients || clientsRes.data.data?.items || clientsRes.data.data || [];
      setClients(clientList);
      try {
        const usersRes = await api.get('/users', { params: { role: 'CLIENT' } });
        const accessUsers = usersRes.data.data?.users || [];
        const map: Record<string, any> = {};
        for (const accessUser of accessUsers) {
          if (accessUser.clientId) map[accessUser.clientId] = accessUser;
        }
        if (Object.keys(map).length < accessUsers.length) {
          for (const accessUser of accessUsers) {
            const byEmail = clientList.find(
              (client: any) =>
                client.email &&
                accessUser.email &&
                String(client.email).trim().toLowerCase() === String(accessUser.email).trim().toLowerCase()
            );
            if (byEmail && !map[byEmail.id]) {
              map[byEmail.id] = { ...accessUser, clientId: byEmail.id };
            }
          }
        }
        setAccessByClient(map);
      } catch (err) {
        console.warn('Falha ao carregar acessos dos moradores:', err);
      }
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
      Alert.alert('Atenção', `Informe o nome da ${unitLower}.`);
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
        Alert.alert('Sucesso', 'Cadastro salvo.');
        setIsDestModalOpen(false);
        setDestName('');
        setDestBlock('');
        setDestCode('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao cadastrar ${unitLower}`);
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
      Alert.alert('Atenção', `O nome da ${unitLower} não pode ficar em branco.`);
      return;
    }

    try {
      setIsSubmittingEditDest(true);
      await api.put(`/destinations/${editingDest.id}`, {
        name: editDestName.trim(),
        block: editDestBlock.trim() || undefined,
        code: editDestCode.trim() || undefined,
      });

      Alert.alert('Sucesso', 'Cadastro salvo.');
      setIsEditDestModalOpen(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao atualizar ${unitLower}`);
    } finally {
      setIsSubmittingEditDest(false);
    }
  };

  const handleDeleteDestination = (d: any) => {
    setActiveMenuId(null);
    Alert.alert(
      `Excluir ${terms.unit}`,
      `Tem certeza que deseja excluir ${d.name}? Os ${clientsLower} vinculados permanecem no sistema, mas sem esta ${unitLower}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/destinations/${d.id}`);
              Alert.alert('Sucesso', 'Cadastro removido.');
              loadData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao excluir ${unitLower}`);
            }
          },
        },
      ]
    );
  };

  // ==================== AÇÕES DE MORADOR ====================
  const handleCreateClient = async () => {
    if (!clientName.trim() || !whatsapp.trim()) {
      Alert.alert('Atenção', `Preencha o nome do ${clientLower} e o WhatsApp.`);
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
        Alert.alert('Sucesso', `${terms.client} cadastrado e vinculado à ${unitLower}!`);
        setIsClientModalOpen(false);
        setClientName('');
        setWhatsapp('');
        setEmail('');
        setDocument('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao cadastrar ${clientLower}`);
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
      Alert.alert('Sucesso', `Dados do ${clientLower} atualizados com sucesso!`);
      setIsEditClientModalOpen(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao atualizar ${clientLower}`);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteClient = (c: any) => {
    Alert.alert(
      `Excluir ${clientLower}`,
      `Tem certeza que deseja excluir ${c.name}? O histórico de visitas será mantido.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const access = accessByClient[c.id];
              if (access?.id) await api.delete(`/users/${access.id}`);
              await api.delete(`/clients/${c.id}`);
              Alert.alert('Sucesso', `${terms.client} removido com sucesso.`);
              loadData();
            } catch (err: any) {
              Alert.alert('Erro', err.response?.data?.error?.message || `Falha ao excluir ${clientLower}`);
            }
          },
        },
      ]
    );
    setActiveMenuId(null);
  };

  const openAccessModal = (client: any) => {
    const access = accessByClient[client.id];
    setAccessClient(client);
    setAccessName(access?.name || client.name || '');
    setAccessEmail(access?.email || client.email || '');
    setAccessPassword('');
    setActiveMenuId(null);
  };

  const handleSaveAccess = async () => {
    if (!accessClient) return;
    const access = accessByClient[accessClient.id];
    if (!accessEmail.trim()) {
      Alert.alert('Atenção', `Informe o e-mail de acesso do ${clientLower}.`);
      return;
    }
    if (!access && accessPassword.trim().length < 8) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (access && accessPassword.trim() && accessPassword.trim().length < 8) {
      Alert.alert('Atenção', 'A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    try {
      setIsAccessSubmitting(true);
      if (access) {
        await api.patch(`/users/${access.id}`, {
          name: accessName.trim() || accessClient.name,
          email: accessEmail.trim(),
          ...(accessPassword.trim() ? { newPassword: accessPassword.trim() } : {}),
        });
        Alert.alert('Sucesso', `Acesso do ${clientLower} atualizado.`);
      } else {
        const created = await api.post('/users', {
          name: accessName.trim() || accessClient.name,
          email: accessEmail.trim(),
          password: accessPassword.trim(),
          role: 'CLIENT',
          clientId: accessClient.id,
        });
        const accessUser = created.data?.data?.user;
        setAccessByClient((current) => ({
          ...current,
          [accessClient.id]: {
            ...(accessUser || {}),
            id: accessUser?.id,
            clientId: accessClient.id,
            email: accessEmail.trim(),
            name: accessName.trim() || accessClient.name,
          },
        }));
        Alert.alert('Sucesso', `O ${clientLower} já pode entrar no aplicativo com esse e-mail e senha.`);
      }
      setAccessClient(null);
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao salvar o acesso');
    } finally {
      setIsAccessSubmitting(false);
    }
  };

  const handleRemoveAccess = (client: any) => {
    const access = accessByClient[client.id];
    if (!access) return;
    setActiveMenuId(null);
    Alert.alert('Remover acesso', `${client.name} deixa de entrar no aplicativo. O cadastro continua.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover acesso',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/${access.id}`);
            Alert.alert('Sucesso', 'Acesso removido.');
            loadData();
          } catch (err: any) {
            Alert.alert('Erro', err.response?.data?.error?.message || 'Falha ao remover o acesso');
          }
        },
      },
    ]);
  };

  const visibleClients = clients.filter((client) => {
    const hasAccess = !!accessByClient[client.id];
    if (accessFilter === 'with') return hasAccess;
    if (accessFilter === 'without') return !hasAccess;
    return true;
  });

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
            <Text style={styles.headerTitle}>
              {section === 'units' ? terms.units : section === 'residents' ? terms.clients : `${terms.clients} e ${terms.units}`}
            </Text>
            <Text style={styles.headerSubtitle}>
              {section === 'units'
                ? `Cadastro de ${unitsLower}`
                : section === 'residents'
                  ? 'Cadastro, acesso ao aplicativo e busca'
                  : `Cadastro de ${clientsLower} e ${unitsLower}`}
            </Text>
          </View>
        </View>

        {section === 'all' && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'clients' && styles.tabButtonActive]}
            onPress={() => handleSwitchTab('clients')}
            activeOpacity={0.8}
          >
            <Users size={16} color={activeTab === 'clients' ? '#165337' : 'rgba(255,255,255,0.75)'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabButtonText, activeTab === 'clients' && styles.tabButtonTextActive]}>
              {terms.client}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'destinations' && styles.tabButtonActive]}
            onPress={() => handleSwitchTab('destinations')}
            activeOpacity={0.8}
          >
            <Home size={16} color={activeTab === 'destinations' ? '#165337' : 'rgba(255,255,255,0.75)'} style={{ marginRight: 6 }} />
            <Text style={[styles.tabButtonText, activeTab === 'destinations' && styles.tabButtonTextActive]}>
              {terms.unit}
            </Text>
          </TouchableOpacity>
        </View>
        )}

        {section === 'all' && (
        <View style={styles.searchActionRow}>
          <View style={styles.searchBar}>
            <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                activeTab === 'clients'
                  ? `Buscar ${clientLower} ou celular...`
                  : `Buscar ${unitLower}...`
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
              <Text style={styles.actionBtnHeaderText}>{terms.client}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtnHeader}
              onPress={() => setIsDestModalOpen(true)}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#165337" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnHeaderText}>{terms.unit}</Text>
            </TouchableOpacity>
          )}
        </View>
        )}
      </View>

      {section !== 'all' && (
        <View style={styles.toolbar}>
          <View style={styles.searchFilterRow}>
            <View style={styles.searchBarLight}>
              <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={activeTab === 'clients' ? 'Buscar por nome ou celular' : `Buscar ${unitLower}`}
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
            {section === 'residents' && (
              <View ref={filterButtonRef} collapsable={false}>
                <TouchableOpacity
                  style={[styles.filterButton, accessFilter !== 'all' && styles.filterButtonActive]}
                  onPress={() => {
                    filterButtonRef.current?.measureInWindow((x, y, width, height) => {
                      setFilterAnchor({ x, y, width, height });
                      setIsFilterOpen(true);
                    });
                  }}
                  activeOpacity={0.85}
                >
                  <SlidersHorizontal size={18} color={accessFilter !== 'all' ? colors.white : '#165337'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => (activeTab === 'clients' ? setIsClientModalOpen(true) : setIsDestModalOpen(true))}
            activeOpacity={0.85}
          >
            <Plus size={18} color={colors.white} style={{ marginRight: 6 }} />
            <Text style={styles.addButtonText}>{activeTab === 'clients' ? `Cadastrar ${clientLower}` : `Cadastrar ${unitLower}`}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Conteúdo Principal da Aba Selecionada */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>
            {activeTab === 'clients' ? `Carregando ${clientsLower}...` : `Carregando ${unitsLower}...`}
          </Text>
        </View>
      ) : activeTab === 'clients' ? (
        /* ================= LISTA DE MORADORES ================= */
        <FlatList
          data={visibleClients}
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
              <Text style={styles.emptyTitle}>Nenhum {clientLower} cadastrado</Text>
              <Text style={styles.emptySub}>
                Toque em cadastrar para incluir o primeiro {clientLower}.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const destNames = (item.destinations || [])
              .map((d: any) => d.destination?.name || d.name)
              .filter(Boolean)
              .join(', ');
            const access = accessByClient[item.id];

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
                    onPress={() => setMenuClient(item)}
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

                <Text style={[styles.accessBadge, access ? styles.accessBadgeOn : styles.accessBadgeOff]}>
                  {access ? `Acesso: ${access.email}` : 'Sem acesso ao aplicativo'}
                </Text>
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
              <Text style={styles.emptyTitle}>Nenhuma {unitLower} na lista</Text>
              <Text style={styles.emptySub}>
                Toque em cadastrar para incluir a primeira {unitLower}.
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
                      ? `Nenhum ${clientLower} vinculado`
                      : residentsCount === 1
                      ? `1 ${clientLower} vinculado`
                      : `${residentsCount} ${clientsLower} vinculados`}
                  </Text>
                </View>

                {menuOpen && (
                  <View style={styles.actionMenu}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => openEditDest(item)}>
                      <Pencil size={15} color="#1D4ED8" />
                      <Text style={[styles.actionText, { color: '#1D4ED8' }]}>Editar {unitLower}</Text>
                    </TouchableOpacity>
                    <View style={styles.actionDivider} />
                    <TouchableOpacity style={styles.actionItem} onPress={() => handleDeleteDestination(item)}>
                      <Trash2 size={15} color="#DC2626" />
                      <Text style={[styles.actionText, { color: '#DC2626' }]}>Excluir {unitLower}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={isFilterOpen} animationType="fade" transparent onRequestClose={() => setIsFilterOpen(false)}>
        <View style={styles.popupRoot}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setIsFilterOpen(false)} />
          <View
            style={[
              styles.filterPopup,
              {
                top: filterAnchor.y + filterAnchor.height + 6,
                right: Math.max(12, Dimensions.get('window').width - (filterAnchor.x + filterAnchor.width)),
              },
            ]}
          >
            {([
              ['all', 'Todos'],
              ['with', 'Com acesso'],
              ['without', 'Sem acesso'],
            ] as const).map(([value, label]) => {
              const selected = accessFilter === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterPopupOption, selected && styles.filterPopupOptionSelected]}
                  onPress={() => {
                    setAccessFilter(value);
                    setIsFilterOpen(false);
                  }}
                >
                  <Text style={[styles.filterPopupText, selected && styles.filterPopupTextSelected]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={!!menuClient} animationType="slide" transparent onRequestClose={() => setMenuClient(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setMenuClient(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{menuClient?.name}</Text>
            <Text style={styles.sheetSubtitle}>O que você quer fazer com este {clientLower}?</Text>
            {isAdmin && (
              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => {
                  const client = menuClient;
                  setMenuClient(null);
                  openAccessModal(client);
                }}
              >
                <Key size={18} color="#165337" />
                <Text style={styles.sheetActionText}>
                  {menuClient && accessByClient[menuClient.id] ? 'Editar acesso' : 'Criar acesso'}
                </Text>
              </TouchableOpacity>
            )}
            {isAdmin && menuClient && accessByClient[menuClient.id] && (
              <TouchableOpacity
                style={styles.sheetAction}
                onPress={() => {
                  const client = menuClient;
                  setMenuClient(null);
                  handleRemoveAccess(client);
                }}
              >
                <Lock size={18} color="#B45309" />
                <Text style={[styles.sheetActionText, { color: '#B45309' }]}>Remover acesso</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                const client = menuClient;
                setMenuClient(null);
                openEditClient(client);
              }}
            >
              <Pencil size={18} color="#1D4ED8" />
              <Text style={[styles.sheetActionText, { color: '#1D4ED8' }]}>Editar cadastro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                const client = menuClient;
                setMenuClient(null);
                handleDeleteClient(client);
              }}
            >
              <Trash2 size={18} color="#DC2626" />
              <Text style={[styles.sheetActionText, { color: '#DC2626' }]}>Excluir {clientLower}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!accessClient} animationType="slide" transparent onRequestClose={() => setAccessClient(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{accessByClient[accessClient?.id] ? 'Editar acesso' : 'Criar acesso'}</Text>
            <Text style={styles.modalSubtitle}>
              {accessClient?.name} entra no aplicativo com este e-mail e senha.
            </Text>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome *</Text>
              <TextInput style={styles.input} value={accessName} onChangeText={setAccessName} placeholderTextColor="#94A3B8" />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>E-mail de acesso *</Text>
              <TextInput
                style={styles.input}
                value={accessEmail}
                onChangeText={setAccessEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="morador@email.com"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>
                {accessByClient[accessClient?.id] ? 'Nova senha (opcional)' : 'Senha * (mínimo 8 caracteres)'}
              </Text>
              <PasswordField
                containerStyle={styles.input}
                value={accessPassword}
                onChangeText={setAccessPassword}
                placeholder={accessByClient[accessClient?.id] ? 'Deixe em branco para manter' : 'Senha provisória'}
                showStrength
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAccessClient(null)} disabled={isAccessSubmitting}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAccess} disabled={isAccessSubmitting}>
                {isAccessSubmitting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.saveBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal 1: Cadastrar Morador */}
      <Modal visible={isClientModalOpen} animationType="slide" transparent onRequestClose={() => setIsClientModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cadastrar {terms.client}</Text>
            <Text style={styles.modalSubtitle}>Dados de quem recebe as visitas e autoriza pelo WhatsApp.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome do {terms.client} *</Text>
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
              <Text style={styles.inputLabel}>{terms.unit} *</Text>
              {destinations.length === 0 ? (
                <TouchableOpacity
                  style={styles.noDestBox}
                  onPress={() => {
                    setIsClientModalOpen(false);
                    setIsDestModalOpen(true);
                  }}
                >
                  <Text style={styles.noDestText}>
                    Ainda não há {unitLower}. Toque aqui para criar a primeira!
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
                  <Text style={styles.saveBtnText}>Salvar {terms.client}</Text>
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
            <Text style={styles.modalTitle}>Cadastrar {terms.unit}</Text>
            <Text style={styles.modalSubtitle}>Exemplo: {terms.unit} 101.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome da {terms.unit} *</Text>
              <TextInput
                style={styles.input}
                placeholder={`Ex: ${terms.unit} 101`}
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
                  <Text style={styles.saveBtnText}>Criar {terms.unit}</Text>
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
            <Text style={styles.modalTitle}>Editar {terms.client}</Text>
            <Text style={styles.modalSubtitle}>Atualize as informações e o vínculo com a {unitLower}.</Text>

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
              <Text style={styles.inputLabel}>{terms.unit}</Text>
              {destinations.length === 0 ? (
                <Text style={styles.noDestText}>Ainda não há {unitLower}.</Text>
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
            <Text style={styles.modalTitle}>Editar {terms.unit}</Text>
            <Text style={styles.modalSubtitle}>Atualize os dados desta {unitLower}.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nome da {terms.unit} *</Text>
              <TextInput
                style={styles.input}
                placeholder={`Ex: ${terms.unit} 101`}
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
                  <Text style={styles.saveBtnText}>Salvar {terms.unit}</Text>
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
    fontSize: 13,
    color: '#D1FAE5',
    marginTop: 2,
  },
  // Container de Abas (Morador / Unidade)
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 3,
    marginTop: 14,
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
    marginTop: 14,
  },
  toolbar: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBarLight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#165337',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  filterButtonActive: {
    backgroundColor: '#165337',
  },
  popupRoot: {
    flex: 1,
  },
  filterPopup: {
    position: 'absolute',
    minWidth: 168,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  filterPopupOption: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  filterPopupOptionSelected: {
    backgroundColor: '#E7F0EA',
  },
  filterPopupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  filterPopupTextSelected: {
    color: '#165337',
    fontWeight: '800',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 6,
  },
  sheetOption: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  sheetOptionSelected: {
    backgroundColor: '#E7F0EA',
  },
  sheetOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  sheetOptionTextSelected: {
    color: '#165337',
    fontWeight: '800',
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  sheetActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#165337',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#165337',
    height: 46,
    borderRadius: 12,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  filterChipLight: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  filterChipLightActive: {
    backgroundColor: '#165337',
  },
  filterChipLightText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipLightTextActive: {
    color: colors.white,
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
  },
  filterChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#165337',
  },
  accessBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  accessBadgeOn: {
    color: '#166534',
    backgroundColor: '#DCFCE7',
  },
  accessBadgeOff: {
    color: '#92400E',
    backgroundColor: '#FEF3C7',
  },
});
