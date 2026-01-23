export interface Client {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type DossierStatus =
  | 'DRAFT'
  | 'LETTRE_GENERATED'
  | 'SENT_FOR_SIGNATURE'
  | 'SIGNED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED';

export interface Dossier {
  id: string;
  reference: string;
  clientId: string;
  description: string;
  status: DossierStatus;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  lettreMission?: LettreMission;
  paiements?: Paiement[];
}

export interface LettreMission {
  id: string;
  dossierId: string;
  templateData: Record<string, string>;
  pdfUrl: string;
  pdfGeneratedAt: string;
  firmaSignatureId: string | null;
  sentForSignatureAt: string | null;
  signedAt: string | null;
  signedPdfUrl: string | null;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
}

export type PaiementMode = 'PAYPLUG' | 'CHEQUES';
export type PaiementStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ChequeStatus = 'ATTENDU' | 'RECU' | 'ENCAISSE' | 'REJETE';

export interface Paiement {
  id: string;
  dossierId: string;
  mode: PaiementMode;
  status: PaiementStatus;
  amount: string;
  payplugPaymentId: string | null;
  payplugPaymentUrl: string | null;
  createdAt: string;
  updatedAt: string;
  cheques?: Cheque[];
}

export interface Cheque {
  id: string;
  paiementId: string;
  numero: string;
  banque: string;
  montant: string;
  dateEmission: string;
  status: ChequeStatus;
  dateReception: string | null;
  dateEncaissement: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface Stats {
  totalClients: number;
  totalDossiers: number;
  pendingSignatures: number;
  pendingPayments: number;
  totalRevenue: number;
}
