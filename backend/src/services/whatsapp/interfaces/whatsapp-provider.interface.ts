export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED';

export interface WhatsAppStatusInfo {
  status: WhatsAppConnectionStatus;
  phoneConnected?: string;
  qrCode?: string; // QR code em Base64 ou raw string
  lastConnectedAt?: Date;
}

export interface ApprovalRequestMessageData {
  clientName: string;
  clientPhone: string;
  visitorName: string;
  visitorCompany?: string;
  visitorType: string;
  visitReason: string;
  arrivalFormattedTime: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  requestCode: string;
  customTemplate?: string;
  photoUrl?: string;
  notes?: string;
  conciergeName?: string;
}

export interface ReminderMessageData {
  clientName: string;
  clientPhone: string;
  visitorName: string;
  requestCode: string;
  customTemplate?: string;
  conciergeName?: string;
  photoUrl?: string;
  notes?: string;
  visitorCompany?: string;
  visitorType?: string;
  visitReason?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
}

export interface IncomingMessageEvent {
  fromPhone: string; // Número no formato E.164 ou dígitos do LID
  fromJid?: string; // remoteJid completo (ex: 5583993858515@s.whatsapp.net ou 254103234056367@lid)
  text: string;
  timestamp: Date;
  pushName?: string;
  quotedCode?: string;
  quotedText?: string;
  rawMessage?: any;
}

export interface IWhatsAppProvider {
  connect(organizationId: string): Promise<void>;
  disconnect(organizationId: string): Promise<void>;
  getStatus(organizationId: string): Promise<WhatsAppStatusInfo>;
  sendApprovalRequest(data: ApprovalRequestMessageData): Promise<{ messageId: string }>;
  sendReminder(data: ReminderMessageData): Promise<{ messageId: string }>;
  sendMessage(toPhone: string, text: string): Promise<{ messageId: string }>;
  sendImageMessage?(toPhone: string, imageBase64OrUrl: string, caption?: string): Promise<{ messageId: string }>;
  onMessageReceived(callback: (msg: IncomingMessageEvent) => Promise<void>): void;
}
