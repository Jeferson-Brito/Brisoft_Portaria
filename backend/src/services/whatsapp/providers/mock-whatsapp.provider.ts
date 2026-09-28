import {
  IWhatsAppProvider,
  WhatsAppStatusInfo,
  ApprovalRequestMessageData,
  ReminderMessageData,
  IncomingMessageEvent,
} from '../interfaces/whatsapp-provider.interface.js';
import {
  parseMessageTemplate,
  DEFAULT_APPROVAL_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
} from '../templates/template.parser.js';

export class MockWhatsAppProvider implements IWhatsAppProvider {
  private statusInfo: WhatsAppStatusInfo = {
    status: 'CONNECTED',
    phoneConnected: '5511999998888',
    lastConnectedAt: new Date(),
  };

  public sentMessages: Array<{ to: string; text: string; data: any }> = [];
  private messageListeners: Array<(msg: IncomingMessageEvent) => Promise<void>> = [];

  async connect(_organizationId: string): Promise<void> {
    this.statusInfo.status = 'CONNECTED';
    this.statusInfo.lastConnectedAt = new Date();
  }

  async disconnect(_organizationId: string): Promise<void> {
    this.statusInfo.status = 'DISCONNECTED';
  }

  async getStatus(_organizationId: string): Promise<WhatsAppStatusInfo> {
    return this.statusInfo;
  }

  async sendApprovalRequest(data: ApprovalRequestMessageData): Promise<{ messageId: string }> {
    const text = parseMessageTemplate(data.customTemplate || DEFAULT_APPROVAL_TEMPLATE, {
      cliente: data.clientName,
      visitante: data.visitorName,
      empresa: data.visitorCompany,
      tipo: data.visitorType,
      motivo: data.visitReason,
      horario: data.arrivalFormattedTime,
      veiculo: data.vehicleModel,
      placa: data.vehiclePlate,
      codigo: data.requestCode,
      observacao: data.notes,
      operador: data.conciergeName,
    });

    if (data.photoUrl) {
      return this.sendImageMessage(data.clientPhone, data.photoUrl, text);
    }

    const messageId = `mock_msg_${Date.now()}`;
    this.sentMessages.push({ to: data.clientPhone, text, data });
    return { messageId };
  }

  async sendReminder(data: ReminderMessageData): Promise<{ messageId: string }> {
    const text = parseMessageTemplate(data.customTemplate || DEFAULT_REMINDER_TEMPLATE, {
      cliente: data.clientName,
      visitante: data.visitorName,
      motivo: 'Lembrete de liberação',
      horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      codigo: data.requestCode,
      operador: data.conciergeName,
    });

    const messageId = `mock_remind_${Date.now()}`;
    this.sentMessages.push({ to: data.clientPhone, text, data });
    return { messageId };
  }

  async sendMessage(toPhone: string, text: string): Promise<{ messageId: string }> {
    const messageId = `mock_direct_${Date.now()}`;
    this.sentMessages.push({ to: toPhone, text, data: { text } });
    return { messageId };
  }

  async sendImageMessage(toPhone: string, imageBase64OrUrl: string, caption?: string): Promise<{ messageId: string }> {
    const messageId = `mock_img_${Date.now()}`;
    this.sentMessages.push({ to: toPhone, text: caption || '', data: { image: imageBase64OrUrl, caption } });
    return { messageId };
  }

  onMessageReceived(callback: (msg: IncomingMessageEvent) => Promise<void>): void {
    this.messageListeners.push(callback);
  }

  // Método auxiliar para testes e simulação de moradores respondendo no WhatsApp
  async simulateIncomingMessage(fromPhone: string, text: string) {
    const event: IncomingMessageEvent = {
      fromPhone: fromPhone.replace(/\D/g, ''),
      text: text.trim(),
      timestamp: new Date(),
    };

    for (const listener of this.messageListeners) {
      await listener(event);
    }
  }
}
