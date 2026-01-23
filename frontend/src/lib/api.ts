import axios from 'axios';
import type { Client, Dossier, LettreMission, Paiement, Cheque } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY || 'npl-dev-api-key-2024';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
});

// Health
export const checkHealth = () => api.get('/health');

// Clients
export const getClients = () => api.get<Client[]>('/clients');
export const getClient = (id: string) => api.get<Client>(`/clients/${id}`);
export const createClient = (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) =>
  api.post<Client>('/clients', data);
export const updateClient = (id: string, data: Partial<Client>) =>
  api.patch<Client>(`/clients/${id}`, data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);

// Dossiers
export const getDossiers = () => api.get<Dossier[]>('/dossiers');
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
export const getCheques = (status?: string) =>
  api.get<Cheque[]>('/cheques', { params: status ? { status } : {} });
export const getCheque = (id: string) => api.get<Cheque>(`/cheques/${id}`);
export const updateChequeStatus = (
  id: string,
  status: 'RECU' | 'ENCAISSE' | 'REJETE'
) => api.patch<Cheque>(`/cheques/${id}/status`, { status });
export const getDossierCheques = (dossierId: string) =>
  api.get<Cheque[]>(`/dossiers/${dossierId}/cheques`);
