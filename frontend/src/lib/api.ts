import axios from 'axios';
import type {
  Client,
  Dossier,
  LettreMission,
  Paiement,
  Cheque,
  PaginatedResult,
  PaginationParams,
  DossierStatus,
  AuthResponse,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: ajouter le token JWT à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: rediriger vers login si 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Auth
export const loginRequest = (email: string, password: string) =>
  api.post<AuthResponse>('/auth/login', { email, password });

export const getProfile = () =>
  api.get('/auth/profile');

// Health
export const checkHealth = () => api.get('/health');

// Clients
export const getClients = (params?: PaginationParams) =>
  api.get<PaginatedResult<Client>>('/clients', { params });
export const getAllClients = () =>
  api.get<Client[]>('/clients', { params: { all: 'true' } });
export const getClient = (id: string) => api.get<Client>(`/clients/${id}`);
export const createClient = (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.post<Client>('/clients', data);
export const updateClient = (id: string, data: Partial<Client>) =>
  api.patch<Client>(`/clients/${id}`, data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);

// Dossiers
export const getDossiers = (
  params?: PaginationParams & { status?: DossierStatus; clientId?: string },
) => api.get<PaginatedResult<Dossier>>('/dossiers', { params });
export const getDossier = (id: string) => api.get<Dossier>(`/dossiers/${id}`);
export const createDossier = (data: { clientId: string; description: string }) =>
  api.post<Dossier>('/dossiers', data);
export const updateDossier = (id: string, data: Partial<Dossier>) =>
  api.patch<Dossier>(`/dossiers/${id}`, data);
export const deleteDossier = (id: string) => api.delete(`/dossiers/${id}`);

// Lettre Mission
export const getLettreMission = (dossierId: string) =>
  api.get<LettreMission>(`/dossiers/${dossierId}/lettre-mission`);
export const createLettreMission = (
  dossierId: string,
  data: {
    missionDescription: string;
    totalAmount: number;
    honorairesDetails?: string;
  }
) => api.post<LettreMission>(`/dossiers/${dossierId}/lettre-mission`, data);
export const regenerateLettreMission = (dossierId: string) =>
  api.post<LettreMission>(`/dossiers/${dossierId}/lettre-mission/regenerate`);
export const getLettreMissionPdfUrl = (dossierId: string) =>
  api.get<{ url: string }>(`/dossiers/${dossierId}/lettre-mission/pdf`);

// Signature
export const sendForSignature = (dossierId: string) =>
  api.post(`/dossiers/${dossierId}/lettre-mission/send`);
export const getSignatureStatus = (dossierId: string) =>
  api.get(`/dossiers/${dossierId}/signature-status`);

// Paiement
export const choosePaiement = (
  dossierId: string,
  data: {
    mode: 'PAYPLUG' | 'CHEQUES';
    cheques?: Array<{
      numero: string;
      banque: string;
      montant: number;
      dateEmission: string;
    }>;
  }
) => api.post<Paiement>(`/dossiers/${dossierId}/paiement/choose`, data);
export const getPaiement = (id: string) => api.get<Paiement>(`/paiements/${id}`);
export const getDossierPaiements = (dossierId: string) =>
  api.get<Paiement[]>(`/dossiers/${dossierId}/paiements`);

// Cheques
export const getCheques = (
  params?: PaginationParams & { status?: string },
) => api.get<PaginatedResult<Cheque>>('/cheques', { params });
export const getCheque = (id: string) => api.get<Cheque>(`/cheques/${id}`);
export const updateChequeStatus = (
  id: string,
  status: 'RECU' | 'ENCAISSE' | 'REJETE'
) => api.patch<Cheque>(`/cheques/${id}/status`, { status });
export const getDossierCheques = (dossierId: string) =>
  api.get<Cheque[]>(`/dossiers/${dossierId}/cheques`);
