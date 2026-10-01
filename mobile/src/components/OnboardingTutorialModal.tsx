import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  Linking,
} from 'react-native';
import {
  Sparkles,
  Building2,
  MessageSquare,
  Users,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  Clock,
  Package,
  Calendar,
  CreditCard,
  ExternalLink,
  ArrowRight,
  HelpCircle,
  QrCode,
  Smartphone,
  PhoneCall,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildPlaceTerms } from '../utils/placeTerms';

export interface OnboardingTutorialModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigate: (
    screen:
      | 'org_profile'
      | 'whatsapp'
      | 'clients_mgmt'
      | 'users_mgmt'
      | 'subscription'
      | 'packages'
      | 'preauthorizations'
  ) => void;
  orgProfile?: {
    companyName?: string;
    unitLabel?: string;
    clientLabel?: string;
    type?: string;
  };
}

export const OnboardingTutorialModal: React.FC<OnboardingTutorialModalProps> = ({
  visible,
  onClose,
  onNavigate,
  orgProfile,
}) => {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 20
  );
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 24);

  const handleStepAction = (
    screen:
      | 'org_profile'
      | 'whatsapp'
      | 'clients_mgmt'
      | 'users_mgmt'
      | 'subscription'
  ) => {
    onClose();
    onNavigate(screen);
  };

  const terms = buildPlaceTerms(orgProfile?.clientLabel, orgProfile?.unitLabel);
  const stepsMeta = [
    { id: 1, title: 'Segmento', icon: Building2 },
    { id: 2, title: 'WhatsApp', icon: MessageSquare },
    { id: 3, title: terms.clients, icon: Users },
    { id: 4, title: 'Porteiros', icon: UserCheck },
    { id: 5, title: 'Operação', icon: Sparkles },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepBody}>
            {/* Tag / Badge */}
            <View style={[styles.stepBadge, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.stepBadgeText, { color: '#B45309' }]}>
                PASSO 1 • OBRIGATÓRIO
              </Text>
            </View>

            <Text style={styles.stepTitle}>Segmento & Personalização</Text>
            <Text style={styles.stepDescription}>
              Cada estabelecimento possui uma dinâmica própria. Ajustar o segmento permite que o sistema use os termos exatos do seu local.
            </Text>

            {/* Comparativo de Modelos */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardInfoTitle}>🏢 Como o sistema se adapta:</Text>
              
              <View style={styles.infoRow}>
                <View style={styles.infoBullet} />
                <Text style={styles.infoText}>
                  <Text style={styles.boldText}>Condomínio Residencial:</Text> Usa "Apartamento / Bloco" e "Moradores".
                </Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoBullet} />
                <Text style={styles.infoText}>
                  <Text style={styles.boldText}>Edifício Comercial:</Text> Usa "Sala / Andar" e "Clientes / Colaboradores".
                </Text>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoBullet} />
                <Text style={styles.infoText}>
                  <Text style={styles.boldText}>Clínica ou Empresa:</Text> Usa "Consultório / Setor" e "Pacientes / Funcionários".
                </Text>
              </View>
            </View>

            {/* Dica Importante */}
            <View style={styles.tipBox}>
              <Sparkles size={18} color="#165337" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.tipText}>
                O nome da empresa ou condomínio que você definir aparecerá no topo do aplicativo de todos os seus porteiros e nos avisos do WhatsApp.
              </Text>
            </View>

            {/* Botão Ação Direta */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleStepAction('org_profile')}
              activeOpacity={0.88}
            >
              <Building2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Ajustar Segmento da Empresa</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepBody}>
            {/* Tag / Badge */}
            <View style={[styles.stepBadge, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.stepBadgeText, { color: '#15803D' }]}>
                PASSO 2 • O CORAÇÃO DA PORTARIA
              </Text>
            </View>

            <Text style={styles.stepTitle}>Vincular WhatsApp da Portaria</Text>
            <Text style={styles.stepDescription}>
              O WhatsApp é o motor principal do Brisoft Portaria. É através dele que o morador recebe as notificações de visita e autoriza na hora sem precisar instalar aplicativo nenhum!
            </Text>

            {/* 3 Passos para Conectar */}
            <View style={styles.stepsTimeline}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineNumber}>
                  <Text style={styles.timelineNumberText}>1</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Toque no botão abaixo</Text>
                  <Text style={styles.timelineDesc}>
                    Abra a tela de configuração do Robô WhatsApp e clique em "Gerar QR Code".
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineNumber}>
                  <Text style={styles.timelineNumberText}>2</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Abra o WhatsApp da Portaria</Text>
                  <Text style={styles.timelineDesc}>
                    No celular que atende a portaria, abra WhatsApp &gt; Configurações (ou 3 pontinhos) &gt; Aparelhos Conectados &gt; Conectar Aparelho.
                  </Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={styles.timelineNumber}>
                  <Text style={styles.timelineNumberText}>3</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>Aponte a câmera para o QR Code</Text>
                  <Text style={styles.timelineDesc}>
                    Em segundos a sessão ficará <Text style={{ color: '#16A34A', fontWeight: '700' }}>ONLINE</Text> e todos os avisos começarão a funcionar automaticamente!
                  </Text>
                </View>
              </View>
            </View>

            {/* Botão Ação Direta */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#15803D' }]}
              onPress={() => handleStepAction('whatsapp')}
              activeOpacity={0.88}
            >
              <MessageSquare size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Conectar WhatsApp Agora</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepBody}>
            {/* Tag / Badge */}
            <View style={[styles.stepBadge, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.stepBadgeText, { color: '#1D4ED8' }]}>
                PASSO 3 • OBRIGATÓRIO
              </Text>
            </View>

            <Text style={styles.stepTitle}>Cadastrar {terms.units} e {terms.clients}</Text>
            <Text style={styles.stepDescription}>
              Para que os porteiros possam acionar os responsáveis, você precisa cadastrar as unidades e os contatos de quem reside ou trabalha no local.
            </Text>

            {/* Como funciona */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardInfoTitle}>📌 Ordem recomendada no cadastro:</Text>

              <View style={styles.highlightStepBox}>
                <Text style={styles.highlightStepNumber}>1º</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.highlightStepTitle}>Cadastrar a {terms.unit} primeiro</Text>
                  <Text style={styles.highlightStepDesc}>
                    Crie as unidades físicas (ex: Apto 101, Apto 102 - Bloco A, ou Sala 501).
                  </Text>
                </View>
              </View>

              <View style={styles.highlightStepBox}>
                <Text style={styles.highlightStepNumber}>2º</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.highlightStepTitle}>Cadastrar o {terms.client}</Text>
                  <Text style={styles.highlightStepDesc}>
                    Insira o nome do morador, o número de WhatsApp com DDD e vincule à unidade criada.
                  </Text>
                </View>
              </View>
            </View>

            {/* Aviso de WhatsApp com DDD */}
            <View style={styles.alertBox}>
              <Text style={styles.alertBoxText}>
                ⚠️ <Text style={styles.boldText}>Atenção ao Telefone:</Text> Digite sempre com DDD (ex: 11999998888). O robô utiliza esse número para enviar as fotos e botões de autorização.
              </Text>
            </View>

            {/* Botão Ação Direta */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#1E40AF' }]}
              onPress={() => handleStepAction('clients_mgmt')}
              activeOpacity={0.88}
            >
              <Users size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Cadastrar {terms.units} e {terms.clients}</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepBody}>
            {/* Tag / Badge */}
            <View style={[styles.stepBadge, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[styles.stepBadgeText, { color: '#7E22CE' }]}>
                PASSO 4 • EQUIPE & SEGURANÇA
              </Text>
            </View>

            <Text style={styles.stepTitle}>Cadastrar Porteiros e Operadores</Text>
            <Text style={styles.stepDescription}>
              Para sua segurança, os porteiros devem ter seus próprios logins. Assim, eles operam o atendimento diário sem ter acesso a dados financeiros ou cadastros restritos.
            </Text>

            <View style={styles.cardInfo}>
              <Text style={styles.cardInfoTitle}>🛡️ Perfis de Acesso Disponíveis:</Text>

              <View style={styles.roleCard}>
                <View style={[styles.roleIconWrap, { backgroundColor: '#DCFCE7' }]}>
                  <UserCheck size={18} color="#15803D" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.roleTitle}>Portaria / Operador</Text>
                  <Text style={styles.roleDesc}>
                    Acesso exclusivo à tela de atendimento: registrar visitantes, registrar encomendas e confirmar entrada. Não acessa WhatsApp nem cobranças.
                  </Text>
                </View>
              </View>

              <View style={styles.roleCard}>
                <View style={[styles.roleIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <ShieldCheck size={18} color="#B45309" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.roleTitle}>Administrador (Você)</Text>
                  <Text style={styles.roleDesc}>
                    Acesso total: gerencia equipe, conecta WhatsApp, altera segmento e gerencia a assinatura mensal.
                  </Text>
                </View>
              </View>
            </View>

            {/* Botão Ação Direta */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#6B21A8' }]}
              onPress={() => handleStepAction('users_mgmt')}
              activeOpacity={0.88}
            >
              <UserCheck size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Cadastrar Equipe de Portaria</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepBody}>
            {/* Tag / Badge */}
            <View style={[styles.stepBadge, { backgroundColor: '#E0F2FE' }]}>
              <Text style={[styles.stepBadgeText, { color: '#0369A1' }]}>
                PASSO 5 • OPERAÇÃO NO DIA A DIA
              </Text>
            </View>

            <Text style={styles.stepTitle}>Como Usar o App no Dia a Dia</Text>
            <Text style={styles.stepDescription}>
              Pronto! Sua portaria já pode operar com máxima velocidade. Veja o resumo das 4 ações principais:
            </Text>

            <View style={styles.opsContainer}>
              {/* 1. Visitas */}
              <View style={styles.opCard}>
                <View style={[styles.opBadgeIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Users size={16} color="#15803D" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.opTitle}>1. Solicitação de Visitante</Text>
                  <Text style={styles.opText}>
                    O visitante chega &gt; O porteiro clica em <Text style={styles.boldText}>+ Nova Solicitação</Text> &gt; Seleciona a unidade do morador &gt; Digita o nome e tira foto &gt; Envia. O morador aprova no WhatsApp e o porteiro clica em <Text style={{ color: '#16A34A', fontWeight: '700' }}>Registrar Entrada</Text>.
                  </Text>
                </View>
              </View>

              {/* 2. Encomendas */}
              <View style={styles.opCard}>
                <View style={[styles.opBadgeIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Package size={16} color="#B45309" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.opTitle}>2. Encomendas & Pacotes</Text>
                  <Text style={styles.opText}>
                    O entregador chega &gt; Vá na aba <Text style={styles.boldText}>Encomendas</Text> &gt; Registre a unidade e foto do pacote. O morador recebe o código no WhatsApp. Ao entregar, dê baixa no sistema com 1 toque!
                  </Text>
                </View>
              </View>

              {/* 3. Pré-autorizações */}
              <View style={styles.opCard}>
                <View style={[styles.opBadgeIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Calendar size={16} color="#1D4ED8" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.opTitle}>3. Agendamentos & Pré-Autorizações</Text>
                  <Text style={styles.opText}>
                    Moradores podem avisar com antecedência sobre festas ou prestadores. Fica visível na aba <Text style={styles.boldText}>Pré-Autorizações</Text> para entrada imediata sem fila.
                  </Text>
                </View>
              </View>

              {/* 4. Assinatura Stripe */}
              <View style={styles.opCard}>
                <View style={[styles.opBadgeIcon, { backgroundColor: '#F3E8FF' }]}>
                  <CreditCard size={16} color="#7E22CE" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.opTitle}>4. Teste Grátis & Assinatura</Text>
                  <Text style={styles.opText}>
                    Você possui <Text style={styles.boldText}>7 dias de teste grátis</Text> com todas as funções liberadas. Para continuar usando sem bloqueios, acesse <Text style={styles.boldText}>Configurações &gt; Assinatura</Text> e assine via Stripe com ativação instantânea!
                  </Text>
                </View>
              </View>
            </View>

            {/* Botão Finalizar */}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#165337', marginTop: 14 }]}
              onPress={onClose}
              activeOpacity={0.88}
            >
              <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Concluir Tutorial & Começar</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: topInset }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0D3824" />

        {/* HEADER SUPERIOR VERDE ESMERALDA */}
        <View style={styles.header}>
          <View style={styles.headerWaveDecoration} />

          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.headerSparkleIcon}>
                <Sparkles size={20} color="#FBBF24" />
              </View>
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.headerTitle}>Guia de Implantação</Text>
                <Text style={styles.headerSubtitle}>
                  Brisoft Portaria
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <X size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stepper Horizontal Interativo */}
          <View style={styles.stepperContainer}>
            {stepsMeta.map((s) => {
              const StepIcon = s.icon;
              const isActive = currentStep === s.id;
              const isPast = currentStep > s.id;

              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.stepPill,
                    isActive && styles.stepPillActive,
                    isPast && styles.stepPillPast,
                  ]}
                  onPress={() => setCurrentStep(s.id)}
                  activeOpacity={0.8}
                >
                  <StepIcon
                    size={14}
                    color={isActive ? '#0D3824' : isPast ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)'}
                  />
                  <Text
                    style={[
                      styles.stepPillText,
                      isActive && styles.stepPillTextActive,
                      isPast && styles.stepPillTextPast,
                    ]}
                  >
                    {s.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* CONTEÚDO ROLÁVEL DO PASSO ATUAL */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>

        {/* BARRA DE NAVEGAÇÃO FIXA NO RODAPÉ */}
        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 8 }]}>
          {currentStep > 1 ? (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
              activeOpacity={0.8}
            >
              <ChevronLeft size={18} color="#475569" />
              <Text style={styles.prevBtnText}>Anterior</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBtnText}>Pular Tutorial</Text>
            </TouchableOpacity>
          )}

          {/* Indicador de passos em texto */}
          <Text style={styles.stepCounterText}>
            Passo {currentStep} de {totalSteps}
          </Text>

          {currentStep < totalSteps ? (
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
              activeOpacity={0.88}
            >
              <Text style={styles.nextBtnText}>Próximo</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: '#165337' }]}
              onPress={onClose}
              activeOpacity={0.88}
            >
              <Text style={styles.nextBtnText}>Começar</Text>
              <CheckCircle2 size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D3824',
  },
  header: {
    backgroundColor: '#0D3824',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  headerWaveDecoration: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(180, 222, 196, 0.12)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSparkleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '500',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    zIndex: 2,
  },
  stepPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  stepPillActive: {
    backgroundColor: '#FBBF24',
  },
  stepPillPast: {
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  stepPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  stepPillTextActive: {
    color: '#0D3824',
    fontWeight: '800',
  },
  stepPillTextPast: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    padding: 20,
  },
  stepBody: {
    flex: 1,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 18,
  },
  cardInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardInfoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  infoBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#165337',
    marginTop: 7,
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  tipText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
    flex: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#165337',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
    shadowColor: '#165337',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepsTimeline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  timelineNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  timelineDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  highlightStepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highlightStepNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
  },
  highlightStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  highlightStepDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 2,
  },
  alertBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  alertBoxText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  roleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginTop: 2,
  },
  opsContainer: {
    marginBottom: 16,
  },
  opCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  opBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  opTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3,
  },
  opText: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  prevBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  stepCounterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 4,
  },
});
