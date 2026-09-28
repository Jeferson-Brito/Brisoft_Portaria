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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Package,
  Plus,
  Building,
  KeyRound,
  CircleCheck,
  Clock,
  Send,
  X,
  Truck,
  User,
  Barcode,
  Camera,
  CheckCircle,
  Eye,
  Check,
  History,
  Archive,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { api } from '../../config/api';
import { AppHeader } from '../../components/AppHeader';
import { ScrollToTopButton } from '../../components/ScrollToTopButton';

interface PackagesScreenProps {
  onBack?: () => void;
}

export const PackagesScreen: React.FC<PackagesScreenProps> = ({ onBack }) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'history'>('pending');
  const listRef = useRef<FlatList>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [historyPackages, setHistoryPackages] = useState<any[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Novo Pacote
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDestId, setSelectedDestId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [carrier, setCarrier] = useState('Mercado Livre');
  const [trackingCode, setTrackingCode] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sender, setSender] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Visualizar Foto Grande
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Modal Retirada com Código
  const [selectedPackageForPickup, setSelectedPackageForPickup] = useState<any | null>(null);
  const [inputPickupCode, setInputPickupCode] = useState('');
  const [pickedUpBy, setPickedUpBy] = useState('');
  const [isPickingUp, setIsPickingUp] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [pkgsRes, histRes, destsRes, clientsRes] = await Promise.all([
        api.get('/packages/pending'),
        api.get('/packages/history?limit=50'),
        api.get('/destinations'),
        api.get('/clients'),
      ]);

      setPackages(pkgsRes.data.data || []);
      setHistoryPackages(histRes.data.data || []);
      const destList = destsRes.data.data?.destinations || destsRes.data.data || [];
      setDestinations(destList);
      if (destList.length > 0 && !selectedDestId) {
        setSelectedDestId(destList[0].id);
      }
      setClients(clientsRes.data.data?.clients || clientsRes.data.data || []);
    } catch (err) {
      console.warn('Erro ao carregar encomendas:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Tirar foto da encomenda via câmera nativa
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão de Câmera',
          'É necessário conceder permissão de câmera para fotografar a encomenda recebida.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhotoUri(asset.uri);
        if (asset.base64) {
          setPhotoBase64(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setPhotoBase64(asset.uri);
        }
      }
    } catch (err: any) {
      Alert.alert('Erro ao abrir câmera', err.message || 'Falha ao acessar a câmera.');
    }
  };

  // Cadastrar encomenda e avisar cliente
  const handleCreatePackage = async () => {
    if (!selectedDestId) {
      Alert.alert('Atenção', 'Selecione a unidade de destino da encomenda.');
      return;
    }

    if (!photoBase64) {
      Alert.alert(
        'Foto Obrigatória 📸',
        'É obrigatório tirar a foto da encomenda recebida para comprovação e envio no WhatsApp do cliente!'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.post('/packages', {
        destinationId: selectedDestId,
        clientId: selectedClientId || undefined,
        carrier,
        trackingCode: trackingCode.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        sender: sender.trim() || undefined,
        photoUrl: photoBase64,
      });

      if (res.data.success) {
        Alert.alert(
          '📦 Encomenda Recebida!',
          `A encomenda foi registrada com foto. O cliente recebeu o comprovante e código de retirada automaticamente no WhatsApp!`
        );
        setIsNewModalOpen(false);
        setTrackingCode('');
        setRecipientName('');
        setSender('');
        setPhotoUri(null);
        setPhotoBase64(null);
        setSelectedClientId('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao registrar encomenda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Coleta direta: o porteiro confirma entrega presencial direta
  const handleConfirmDirectPickup = async () => {
    if (!selectedPackageForPickup) return;
    const personName = selectedPackageForPickup.client?.name || selectedPackageForPickup.recipientName || 'Cliente';
    try {
      setIsPickingUp(true);
      await api.post(`/packages/${selectedPackageForPickup.id}/pickup`, {
        directPickup: true,
        pickedUpBy: personName,
      });
      setSelectedPackageForPickup(null);
      setInputPickupCode('');
      loadData();
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.message || 'Falha ao registrar retirada.');
    } finally {
      setIsPickingUp(false);
    }
  };

  // Retirada com validação do código de 4 dígitos
  const handleConfirmPickupWithCode = async () => {
    if (!inputPickupCode.trim() || inputPickupCode.length !== 4) {
      Alert.alert('Atenção', 'Digite o código de 4 dígitos informado pelo cliente.');
      return;
    }

    try {
      setIsPickingUp(true);
      const res = await api.post(`/packages/${selectedPackageForPickup.id}/pickup`, {
        pickupCode: inputPickupCode.trim(),
        pickedUpBy: pickedUpBy.trim() || undefined,
      });

      if (res.data.success) {
        Alert.alert('Sucesso! 🟢', 'Código validado! Encomenda liberada com sucesso.');
        setSelectedPackageForPickup(null);
        setInputPickupCode('');
        setPickedUpBy('');
        loadData();
      }
    } catch (err: any) {
      Alert.alert('Atenção', err.response?.data?.message || 'Código de retirada incorreto!');
    } finally {
      setIsPickingUp(false);
    }
  };

  const handleResendCode = async (packageId: string) => {
    try {
      await api.post(`/packages/${packageId}/resend-code`);
      Alert.alert('Sucesso! 🟢', 'Código de retirada reenviado para o WhatsApp do cliente.');
    } catch (err: any) {
      Alert.alert('Aviso', err.response?.data?.message || 'Não foi possível reenviar.');
    }
  };

  const currentList = activeSubTab === 'pending' ? packages : historyPackages;

  return (
    <View style={styles.container}>
      {/* Header Unificado */}
      <AppHeader
        title="Controle de Encomendas"
        subtitle="Recebimento com foto e aviso automático no WhatsApp"
        onBack={onBack}
        badge={packages.length}
      />

      {/* Barra de Sub-Abas: Pendentes vs Histórico */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'pending' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('pending')}
          activeOpacity={0.8}
        >
          <Package size={17} color={activeSubTab === 'pending' ? '#1D4ED8' : '#64748B'} />
          <Text style={[styles.subTabText, activeSubTab === 'pending' && styles.subTabTextActive]}>
            Aguardando Retirada ({packages.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabItem, activeSubTab === 'history' && styles.subTabItemActive]}
          onPress={() => setActiveSubTab('history')}
          activeOpacity={0.8}
        >
          <History size={17} color={activeSubTab === 'history' ? '#1D4ED8' : '#64748B'} />
          <Text style={[styles.subTabText, activeSubTab === 'history' && styles.subTabTextActive]}>
            Histórico ({historyPackages.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Botão + Receber Pacote (Exibido na aba Pendentes) */}
      {activeSubTab === 'pending' && (
        <View style={styles.topBtnRow}>
          <TouchableOpacity
            style={styles.receiveBtn}
            onPress={() => setIsNewModalOpen(true)}
            activeOpacity={0.85}
          >
            <Plus size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.receiveBtnText}>Receber Nova Encomenda</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de Encomendas */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Carregando encomendas da portaria...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={currentList}
          keyExtractor={(item) => item.id}
          scrollEventThrottle={16}
          onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 150)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              colors={['#1D4ED8']}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CircleCheck size={48} color="#16A34A" style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>
                {activeSubTab === 'pending' ? 'Tudo em dia!' : 'Nenhum histórico'}
              </Text>
              <Text style={styles.emptySub}>
                {activeSubTab === 'pending'
                  ? 'Todas as encomendas já foram retiradas pelos clientes.'
                  : 'Nenhuma encomenda registrada no histórico ainda.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPickedUp = item.status === 'PICKED_UP';

            return (
              <View style={[styles.packageCard, isPickedUp && styles.packageCardPickedUp]}>
                <View style={styles.cardHeader}>
                  <View style={styles.carrierBadge}>
                    <Truck size={14} color="#1D4ED8" style={{ marginRight: 4 }} />
                    <Text style={styles.carrierText}>{item.carrier || 'Encomenda'}</Text>
                  </View>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>

                {/* Linha Destino & Morador */}
                <View style={styles.destRow}>
                  <Building size={16} color="#0F172A" style={{ marginRight: 6 }} />
                  <Text style={styles.destName}>
                    {item.destination?.name}{' '}
                    {item.destination?.block ? `(${item.destination.block})` : ''}
                  </Text>
                  {item.client?.name && (
                    <Text style={styles.clientName}> — {item.client.name}</Text>
                  )}
                </View>

                {/* Destinatário na etiqueta */}
                {item.recipientName && (
                  <View style={styles.detailRow}>
                    <User size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.detailText}>Para: {item.recipientName}</Text>
                  </View>
                )}

                {/* Rastreio */}
                {item.trackingCode && (
                  <View style={styles.detailRow}>
                    <Barcode size={14} color="#64748B" style={{ marginRight: 6 }} />
                    <Text style={styles.detailText}>Rastreio: {item.trackingCode}</Text>
                  </View>
                )}

                {/* Foto da Encomenda Registrada */}
                {item.photoUrl && (
                  <TouchableOpacity
                    style={styles.photoPreviewRow}
                    onPress={() => setPreviewPhotoUrl(item.photoUrl)}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.photoUrl }} style={styles.thumbImage} />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.photoLabel}>📸 Foto da Encomenda Salva</Text>
                      <Text style={styles.photoHint}>Toque para ampliar comprovante</Text>
                    </View>
                    <Eye size={18} color="#2563EB" />
                  </TouchableOpacity>
                )}

                {/* Horário de Recebimento */}
                <View style={styles.timeRow}>
                  <Clock size={13} color="#94A3B8" style={{ marginRight: 4 }} />
                  <Text style={styles.timeText}>
                    Recebido em {new Date(item.receivedAt).toLocaleDateString('pt-BR')} às{' '}
                    {new Date(item.receivedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* Se já foi retirado, exibe comprovante de coleta */}
                {isPickedUp ? (
                  <View style={styles.pickedUpBanner}>
                    <CheckCircle size={16} color="#16A34A" style={{ marginRight: 6 }} />
                    <Text style={styles.pickedUpBannerText}>
                      Coletado por *{item.pickedUpBy || 'Cliente'}* em{' '}
                      {item.pickedUpAt
                        ? new Date(item.pickedUpAt).toLocaleDateString('pt-BR') +
                          ' às ' +
                          new Date(item.pickedUpAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Confirmado'}
                    </Text>
                  </View>
                ) : (
                  /* Botões de Ação na Portaria */
                  <View style={styles.actionColumn}>
                    {/* Botão Principal: O cliente já pegou / coletou */}
                    <TouchableOpacity
                      style={styles.directPickupBtn}
                      onPress={() => {
                        setSelectedPackageForPickup(item);
                        setInputPickupCode('');
                      }}
                      activeOpacity={0.85}
                    >
                      <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.directPickupBtnText}>
                        Marcar que Cliente Já Coletou
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.subActionRow}>
                      <TouchableOpacity
                        style={styles.resendBtn}
                        onPress={() => handleResendCode(item.id)}
                        activeOpacity={0.8}
                      >
                        <Send size={14} color="#64748B" style={{ marginRight: 4 }} />
                        <Text style={styles.resendBtnText}>Reenviar WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
        bottom={85}
      />

      {/* Modal: Receber Encomenda com Foto Obrigatória */}
      <Modal visible={isNewModalOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Receber Encomenda</Text>
                <Text style={styles.modalSubtitle}>
                  Foto obrigatória para comprovar e notificar no WhatsApp
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsNewModalOpen(false)}>
                <X size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 180 }}
            >
              {/* ÁREA DA FOTO OBRIGATÓRIA */}
              <Text style={styles.label}>Foto da Encomenda * (Obrigatória)</Text>
              {photoUri ? (
                <View style={styles.photoContainer}>
                  <Image source={{ uri: photoUri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.retakeBtn}
                    onPress={handleTakePhoto}
                    activeOpacity={0.8}
                  >
                    <Camera size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.retakeBtnText}>Tirar Outra Foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cameraBox}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.cameraIconCircle}>
                    <Camera size={28} color="#1D4ED8" />
                  </View>
                  <Text style={styles.cameraBoxTitle}>Tirar Foto da Encomenda</Text>
                  <Text style={styles.cameraBoxSub}>
                    Fotografe a etiqueta com o nome ou pacote recebido
                  </Text>
                </TouchableOpacity>
              )}

              {/* Seleção do Destino / Unidade */}
              <Text style={[styles.label, { marginTop: 14 }]}>Unidade / Destino *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {destinations.map((d: any) => (
                  <TouchableOpacity
                    key={d.id}
                    style={[styles.destChip, selectedDestId === d.id && styles.destChipActive]}
                    onPress={() => setSelectedDestId(d.id)}
                  >
                    <Text
                      style={[
                        styles.destChipText,
                        selectedDestId === d.id && styles.destChipTextActive,
                      ]}
                    >
                      {d.name} {d.block ? `(${d.block})` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Seleção do Cliente / Morador */}
              <Text style={styles.label}>Cliente / Morador da Unidade (Opcional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity
                  style={[styles.clientChip, !selectedClientId && styles.clientChipActive]}
                  onPress={() => setSelectedClientId('')}
                >
                  <Text style={[styles.clientChipText, !selectedClientId && styles.clientChipTextActive]}>
                    Morador Padrão
                  </Text>
                </TouchableOpacity>
                {clients.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.clientChip, selectedClientId === c.id && styles.clientChipActive]}
                    onPress={() => {
                      setSelectedClientId(c.id);
                      setRecipientName(c.name);
                    }}
                  >
                    <Text
                      style={[
                        styles.clientChipText,
                        selectedClientId === c.id && styles.clientChipTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Transportadora */}
              <Text style={styles.label}>Transportadora / Loja</Text>
              <View style={styles.carrierGrid}>
                {['Mercado Livre', 'Amazon', 'Correios', 'Shopee', 'Loggi', 'Outro'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.carrierOption, carrier === c && styles.carrierOptionActive]}
                    onPress={() => setCarrier(c)}
                  >
                    <Text
                      style={[
                        styles.carrierOptionText,
                        carrier === c && styles.carrierOptionTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nome na Etiqueta */}
              <Text style={styles.label}>Nome do Destinatário (na etiqueta)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Jeferson Brito"
                placeholderTextColor="#94A3B8"
                value={recipientName}
                onChangeText={setRecipientName}
              />

              {/* Código de Rastreio */}
              <Text style={styles.label}>Código de Rastreio (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: BR123456789"
                placeholderTextColor="#94A3B8"
                value={trackingCode}
                onChangeText={setTrackingCode}
              />

              {/* Botão de Envio */}
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleCreatePackage}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Salvar e Avisar Cliente no WhatsApp</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Confirmar Coleta da Encomenda com Código ou Direta */}
      <Modal visible={!!selectedPackageForPickup} animationType="fade" transparent onRequestClose={() => setSelectedPackageForPickup(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlayCenter}
        >
          <View style={styles.confirmPopupCard}>
            <View style={styles.confirmPopupHeader}>
              <View style={styles.confirmPopupIconCircle}>
                <Package size={26} color="#16A34A" />
              </View>
              <TouchableOpacity
                onPress={() => setSelectedPackageForPickup(null)}
                style={styles.confirmPopupCloseBtn}
                activeOpacity={0.7}
              >
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.confirmPopupTitle}>Confirmar Coleta</Text>
            <Text style={styles.confirmPopupSubtitle}>
              Entrega para{' '}
              <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                {selectedPackageForPickup?.destination?.name || 'Unidade'}
              </Text>
              {selectedPackageForPickup?.client?.name ? ` — ${selectedPackageForPickup.client.name}` : ''}
              {` (${selectedPackageForPickup?.code || ''})`}
            </Text>

            <View style={styles.codeSectionBox}>
              <Text style={styles.codeSectionLabel}>Código de Retirada (4 dígitos)</Text>
              <Text style={styles.codeSectionHint}>
                Solicite o código que o morador recebeu no WhatsApp:
              </Text>
              <TextInput
                style={styles.pickupCodeInput}
                placeholder="0000"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={4}
                value={inputPickupCode}
                onChangeText={setInputPickupCode}
                autoFocus={true}
              />
            </View>

            {/* Ação 1: Validar código */}
            <TouchableOpacity
              style={[
                styles.confirmCodeBtn,
                (!inputPickupCode || inputPickupCode.length !== 4 || isPickingUp) && { opacity: 0.6 },
              ]}
              onPress={handleConfirmPickupWithCode}
              disabled={isPickingUp || !inputPickupCode || inputPickupCode.length !== 4}
              activeOpacity={0.85}
            >
              {isPickingUp ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmCodeBtnText}>Validar Código e Concluir</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Ação 2: Entregar sem código se o morador não tiver celular no momento */}
            <TouchableOpacity
              style={styles.directCollectSecondaryBtn}
              onPress={handleConfirmDirectPickup}
              disabled={isPickingUp}
              activeOpacity={0.8}
            >
              <Text style={styles.directCollectSecondaryText}>
                Entregar Sem Código (Coleta Presencial)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmPopupCancelBtn}
              onPress={() => setSelectedPackageForPickup(null)}
              disabled={isPickingUp}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmPopupCancelText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: Visualizar Foto Grande */}
      <Modal visible={!!previewPhotoUrl} animationType="fade" transparent>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.closePhotoBtn}
            onPress={() => setPreviewPhotoUrl(null)}
          >
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {previewPhotoUrl && (
            <Image
              source={{ uri: previewPhotoUrl }}
              style={styles.fullPhoto}
              resizeMode="contain"
            />
          )}
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
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 4,
  },
  subTabItemActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
  },
  subTabTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  topBtnRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  receiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  receiveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  packageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  packageCardPickedUp: {
    borderLeftColor: '#16A34A',
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  carrierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  carrierText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  destName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  clientName: {
    fontSize: 14,
    color: '#475569',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  photoHint: {
    fontSize: 11,
    color: '#2563EB',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  pickedUpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  pickedUpBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  actionColumn: {
    marginTop: 6,
  },
  directPickupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingVertical: 12,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  directPickupBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  subActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  codePickupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 8,
    marginRight: 6,
  },
  codePickupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  resendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 8,
    marginLeft: 6,
  },
  resendBtnText: {
    fontSize: 12,
    color: '#475569',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  cameraBox: {
    borderWidth: 2,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    marginBottom: 12,
  },
  cameraIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cameraBoxTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  cameraBoxSub: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  destChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  destChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  destChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  destChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clientChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clientChipActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  clientChipText: {
    fontSize: 12,
    color: '#475569',
  },
  clientChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  carrierGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  carrierOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  carrierOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  carrierOptionText: {
    fontSize: 12,
    color: '#475569',
  },
  carrierOptionTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pickupHint: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmPopupCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  confirmPopupIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPopupCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPopupTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  confirmPopupSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  codeSectionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  codeSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  codeSectionHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  pickupCodeInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2563EB',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 8,
    color: '#0F172A',
    paddingVertical: 10,
  },
  confirmCodeBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmCodeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  directCollectSecondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  directCollectSecondaryText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmPopupCancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  confirmPopupCancelText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePhotoBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPhoto: {
    width: '90%',
    height: '75%',
    borderRadius: 12,
  },
});
