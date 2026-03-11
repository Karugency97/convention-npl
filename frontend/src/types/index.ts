export type UserRole = 'ADMIN' | 'AVOCAT' | 'SECRETAIRE';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

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
  | 'SENT'
  | 'SIGNED'
  | 'PAYMENT_PENDING'
  | 'PAID'
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

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
