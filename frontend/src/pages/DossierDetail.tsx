import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  PenTool,
  CreditCard,
  CheckCircle2,
  Clock,
  Download,
  Send,
  RefreshCw,
  ExternalLink,
  User,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  Euro,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Modal,
  Input,
} from '../components/ui';
import {
  getDossier,
  createLettreMission,
  sendForSignature,
  getLettreMissionPdfUrl,
  choosePaiement,
} from '../lib/api';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPhone,
  dossierStatusConfig,
  chequeStatusConfig,
} from '../lib/utils';
import type { DossierStatus, Cheque } from '../types';
import styles from './DossierDetail.module.css';

export function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLettreMissionModalOpen, setIsLettreMissionModalOpen] = useState(false);
  const [isPaiementModalOpen, setIsPaiementModalOpen] = useState(false);

  const {
    data: dossier,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['dossier', id],
    queryFn: () => getDossier(id!).then((res) => res.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <RefreshCw className={styles.spinner} size={24} />
        <span>Chargement du dossier...</span>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className={styles.error}>
        <AlertCircle size={48} />
        <h2>Dossier introuvable</h2>
        <p>Ce dossier n'existe pas ou a été supprimé.</p>
        <Button variant="secondary" onClick={() => navigate('/dossiers')}>
          Retour aux dossiers
        </Button>
      </div>
    );
  }

  const statusConfig = dossierStatusConfig[dossier.status];
  const currentStep = getWorkflowStep(dossier.status);

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backButton}
            onClick={() => navigate('/dossiers')}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className={styles.headerMeta}>
              <span className={styles.reference}>{dossier.reference}</span>
              <Badge
                color={statusConfig?.color}
                bgColor={statusConfig?.bgColor}
              >
                {statusConfig?.label}
              </Badge>
            </div>
            <h1 className={styles.title}>{dossier.description}</h1>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <WorkflowProgress currentStep={currentStep} dossier={dossier} />

      {/* Content Grid */}
      <div className={styles.content}>
        {/* Main Column */}
        <div className={styles.mainColumn}>
          {/* Lettre de Mission Section */}
          <LettreMissionSection
            dossier={dossier}
            onCreateClick={() => setIsLettreMissionModalOpen(true)}
          />

          {/* Signature Section */}
          <SignatureSection dossier={dossier} />

          {/* Paiement Section */}
          <PaiementSection
            dossier={dossier}
            onChoosePaiement={() => setIsPaiementModalOpen(true)}
          />
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          {/* Client Info */}
          {dossier.client && (
            <Card>
              <CardHeader title="Client" />
              <CardContent>
                <div className={styles.clientInfo}>
                  <div className={styles.clientAvatar}>
                    <User size={20} />
                  </div>
                  <div className={styles.clientDetails}>
                    <h4 className={styles.clientName}>
                      {dossier.client.firstName} {dossier.client.lastName}
                    </h4>
                    <div className={styles.clientRow}>
                      <Mail size={14} />
                      <a href={`mailto:${dossier.client.email}`}>
                        {dossier.client.email}
                      </a>
                    </div>
                    <div className={styles.clientRow}>
                      <Phone size={14} />
                      <span>{formatPhone(dossier.client.phone)}</span>
                    </div>
                    <div className={styles.clientRow}>
                      <MapPin size={14} />
                      <span>{dossier.client.address}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader title="Historique" />
            <CardContent>
              <div className={styles.timeline}>
                <TimelineItem
                  date={dossier.createdAt}
                  label="Dossier créé"
                  done
                />
                {dossier.lettreMission?.pdfGeneratedAt && (
                  <TimelineItem
                    date={dossier.lettreMission.pdfGeneratedAt}
                    label="Lettre générée"
                    done
                  />
                )}
                {dossier.lettreMission?.sentForSignatureAt && (
                  <TimelineItem
                    date={dossier.lettreMission.sentForSignatureAt}
                    label="Envoyée pour signature"
                    done
                  />
                )}
                {dossier.lettreMission?.signedAt && (
                  <TimelineItem
                    date={dossier.lettreMission.signedAt}
                    label="Document signé"
                    done
                  />
                )}
                {dossier.paiements?.[0]?.status === 'COMPLETED' && (
                  <TimelineItem
                    date={dossier.paiements[0].updatedAt}
                    label="Paiement reçu"
                    done
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Modals */}
      <LettreMissionModal
        isOpen={isLettreMissionModalOpen}
        onClose={() => setIsLettreMissionModalOpen(false)}
        dossierId={dossier.id}
      />

      <PaiementModal
        isOpen={isPaiementModalOpen}
        onClose={() => setIsPaiementModalOpen(false)}
        dossier={dossier}
      />
    </motion.div>
  );
}

function getWorkflowStep(status: DossierStatus): number {
  switch (status) {
    case 'DRAFT':
      return 0;
    case 'LETTRE_GENERATED':
      return 1;
    case 'SENT_FOR_SIGNATURE':
      return 1;
    case 'SIGNED':
      return 2;
    case 'PAYMENT_PENDING':
      return 2;
    case 'PAID':
      return 3;
    default:
      return 0;
  }
}

function WorkflowProgress({
  currentStep,
}: {
  currentStep: number;
  dossier: any;
}) {
  const steps = [
    { label: 'Lettre de mission', icon: FileText },
    { label: 'Signature', icon: PenTool },
    { label: 'Paiement', icon: CreditCard },
    { label: 'Terminé', icon: CheckCircle2 },
  ];

  return (
    <div className={styles.progressBar}>
      {steps.map((step, index) => {
        const isDone = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div
            key={step.label}
            className={`${styles.progressStep} ${isDone ? styles.done : ''} ${
              isCurrent ? styles.current : ''
            }`}
          >
            <div className={styles.progressIcon}>
              {isDone ? (
                <CheckCircle2 size={20} />
              ) : (
                <step.icon size={20} />
              )}
            </div>
            <span className={styles.progressLabel}>{step.label}</span>
            {index < steps.length - 1 && (
              <div
                className={`${styles.progressLine} ${
                  isDone ? styles.lineDone : ''
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LettreMissionSection({
  dossier,
  onCreateClick,
}: {
  dossier: any;
  onCreateClick: () => void;
}) {
  const lettre = dossier.lettreMission;

  const downloadMutation = useMutation({
    mutationFn: () => getLettreMissionPdfUrl(dossier.id),
    onSuccess: (response) => {
      window.open(response.data.url, '_blank');
    },
  });

  if (!lettre) {
    return (
      <Card className={styles.sectionCard}>
        <div className={styles.emptySection}>
          <FileText size={40} strokeWidth={1} />
          <h3>Lettre de mission</h3>
          <p>
            Créez la convention d'honoraires pour ce dossier. Elle sera générée
            au format PDF prête pour signature.
          </p>
          <Button onClick={onCreateClick}>Créer la lettre de mission</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Lettre de mission"
        action={
          <div className={styles.headerActions}>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Download size={16} />}
              onClick={() => downloadMutation.mutate()}
              isLoading={downloadMutation.isPending}
            >
              Télécharger
            </Button>
          </div>
        }
      />
      <CardContent>
        <div className={styles.lettreInfo}>
          <div className={styles.lettreRow}>
            <span className={styles.lettreLabel}>Montant total</span>
            <span className={styles.lettreValue}>
              {formatCurrency(lettre.totalAmount)}
            </span>
          </div>
          <div className={styles.lettreRow}>
            <span className={styles.lettreLabel}>Générée le</span>
            <span className={styles.lettreValue}>
              {formatDateTime(lettre.pdfGeneratedAt)}
            </span>
          </div>
          {lettre.templateData?.honorairesDetails && (
            <div className={styles.lettreDetails}>
              <span className={styles.lettreLabel}>Détail des honoraires</span>
              <p>{lettre.templateData.honorairesDetails}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SignatureSection({ dossier }: { dossier: any }) {
  const queryClient = useQueryClient();
  const lettre = dossier.lettreMission;

  const sendMutation = useMutation({
    mutationFn: () => sendForSignature(dossier.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossier', dossier.id] });
    },
  });

  if (!lettre) {
    return (
      <Card className={styles.sectionCard}>
        <div className={styles.disabledSection}>
          <PenTool size={24} />
          <span>Générez d'abord la lettre de mission</span>
        </div>
      </Card>
    );
  }

  if (lettre.signedAt) {
    return (
      <Card>
        <CardHeader
          title="Signature"
          action={
            <Badge variant="success">
              <CheckCircle2 size={14} /> Signé
            </Badge>
          }
        />
        <CardContent>
          <div className={styles.signedInfo}>
            <CheckCircle2 size={32} className={styles.signedIcon} />
            <div>
              <p className={styles.signedText}>
                Document signé le {formatDateTime(lettre.signedAt)}
              </p>
              {lettre.signedPdfUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Download size={16} />}
                >
                  Télécharger le document signé
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (lettre.sentForSignatureAt) {
    return (
      <Card>
        <CardHeader
          title="Signature"
          action={
            <Badge variant="warning">
              <Clock size={14} /> En attente
            </Badge>
          }
        />
        <CardContent>
          <div className={styles.pendingSignature}>
            <Clock size={32} className={styles.pendingIcon} />
            <div>
              <p className={styles.pendingText}>
                En attente de la signature du client
              </p>
              <span className={styles.pendingDate}>
                Envoyée le {formatDateTime(lettre.sentForSignatureAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Signature" />
      <CardContent>
        <div className={styles.signatureAction}>
          <p>
            Envoyez la lettre de mission au client pour signature électronique
            via Firma.
          </p>
          <Button
            leftIcon={<Send size={18} />}
            onClick={() => sendMutation.mutate()}
            isLoading={sendMutation.isPending}
          >
            Envoyer pour signature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaiementSection({
  dossier,
  onChoosePaiement,
}: {
  dossier: any;
  onChoosePaiement: () => void;
}) {
  const lettre = dossier.lettreMission;
  const paiement = dossier.paiements?.[0];

  if (!lettre?.signedAt) {
    return (
      <Card className={styles.sectionCard}>
        <div className={styles.disabledSection}>
          <CreditCard size={24} />
          <span>La lettre doit être signée avant le paiement</span>
        </div>
      </Card>
    );
  }

  if (paiement?.status === 'COMPLETED') {
    return (
      <Card>
        <CardHeader
          title="Paiement"
          action={
            <Badge variant="success">
              <CheckCircle2 size={14} /> Payé
            </Badge>
          }
        />
        <CardContent>
          <div className={styles.paidInfo}>
            <CheckCircle2 size={32} className={styles.paidIcon} />
            <div>
              <p className={styles.paidAmount}>
                {formatCurrency(paiement.amount)}
              </p>
              <span className={styles.paidMethod}>
                {paiement.mode === 'PAYPLUG' ? 'Paiement en ligne' : 'Chèque'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paiement) {
    if (paiement.mode === 'PAYPLUG') {
      return (
        <Card>
          <CardHeader
            title="Paiement"
            action={
              <Badge variant="warning">
                <Clock size={14} /> En attente
              </Badge>
            }
          />
          <CardContent>
            <div className={styles.pendingPayment}>
              <p>Paiement en ligne en attente</p>
              {paiement.payplugPaymentUrl && (
                <Button
                  variant="secondary"
                  leftIcon={<ExternalLink size={16} />}
                  onClick={() =>
                    window.open(paiement.payplugPaymentUrl, '_blank')
                  }
                >
                  Lien de paiement
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    // Cheques
    return (
      <Card>
        <CardHeader
          title="Paiement par chèques"
          action={
            <Badge variant="info">
              <CreditCard size={14} /> {paiement.cheques?.length || 0} chèque(s)
            </Badge>
          }
        />
        <CardContent>
          <div className={styles.chequesList}>
            {paiement.cheques?.map((cheque: Cheque) => {
              const statusConf = chequeStatusConfig[cheque.status];
              return (
                <div key={cheque.id} className={styles.chequeRow}>
                  <div className={styles.chequeInfo}>
                    <span className={styles.chequeNumero}>
                      Chèque n°{cheque.numero}
                    </span>
                    <span className={styles.chequeBanque}>{cheque.banque}</span>
                  </div>
                  <span className={styles.chequeMontant}>
                    {formatCurrency(cheque.montant)}
                  </span>
                  <Badge
                    size="sm"
                    color={statusConf?.color}
                    bgColor={statusConf?.bgColor}
                  >
                    {statusConf?.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No paiement yet
  return (
    <Card>
      <CardHeader title="Paiement" />
      <CardContent>
        <div className={styles.choosePaiement}>
          <p>
            Le document a été signé. Choisissez le mode de paiement pour ce
            dossier.
          </p>
          <div className={styles.paiementOptions}>
            <Button onClick={onChoosePaiement}>
              <Euro size={18} />
              Choisir le mode de paiement
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({
  date,
  label,
  done,
}: {
  date: string;
  label: string;
  done: boolean;
}) {
  return (
    <div className={`${styles.timelineItem} ${done ? styles.timelineDone : ''}`}>
      <div className={styles.timelineDot} />
      <div className={styles.timelineContent}>
        <span className={styles.timelineLabel}>{label}</span>
        <span className={styles.timelineDate}>{formatDate(date)}</span>
      </div>
    </div>
  );
}

function LettreMissionModal({
  isOpen,
  onClose,
  dossierId,
}: {
  isOpen: boolean;
  onClose: () => void;
  dossierId: string;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    missionDescription: '',
    totalAmount: '',
    honorairesDetails: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      createLettreMission(dossierId, {
        missionDescription: formData.missionDescription,
        totalAmount: parseFloat(formData.totalAmount),
        honorairesDetails: formData.honorairesDetails || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossier', dossierId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Créer la lettre de mission"
      size="lg"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input
          label="Description de la mission"
          value={formData.missionDescription}
          onChange={(e) =>
            setFormData({ ...formData, missionDescription: e.target.value })
          }
          placeholder="Ex: Assistance juridique pour litige commercial"
        />

        <Input
          label="Montant total des honoraires (€)"
          type="number"
          step="0.01"
          min="0"
          value={formData.totalAmount}
          onChange={(e) =>
            setFormData({ ...formData, totalAmount: e.target.value })
          }
          placeholder="5000"
        />

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Détail des honoraires (optionnel)
          </label>
          <textarea
            className={styles.textarea}
            value={formData.honorairesDetails}
            onChange={(e) =>
              setFormData({ ...formData, honorairesDetails: e.target.value })
            }
            placeholder="Ex: Analyse du dossier: 1500€ | Procédure: 3500€"
            rows={3}
          />
        </div>

        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Générer la lettre
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PaiementModal({
  isOpen,
  onClose,
  dossier,
}: {
  isOpen: boolean;
  onClose: () => void;
  dossier: any;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'PAYPLUG' | 'CHEQUES' | null>(null);
  const [cheques, setCheques] = useState([
    { numero: '', banque: '', montant: '', dateEmission: '' },
  ]);

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'PAYPLUG') {
        return choosePaiement(dossier.id, { mode: 'PAYPLUG' });
      }
      return choosePaiement(dossier.id, {
        mode: 'CHEQUES',
        cheques: cheques.map((c) => ({
          numero: c.numero,
          banque: c.banque,
          montant: parseFloat(c.montant),
          dateEmission: c.dateEmission,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dossier', dossier.id] });
      onClose();
    },
  });

  const addCheque = () => {
    setCheques([
      ...cheques,
      { numero: '', banque: '', montant: '', dateEmission: '' },
    ]);
  };

  const updateCheque = (index: number, field: string, value: string) => {
    const newCheques = [...cheques];
    newCheques[index] = { ...newCheques[index], [field]: value };
    setCheques(newCheques);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choisir le mode de paiement"
      size="lg"
    >
      {!mode ? (
        <div className={styles.paiementChoice}>
          <button
            className={styles.paiementOption}
            onClick={() => setMode('PAYPLUG')}
          >
            <CreditCard size={32} />
            <h4>Paiement en ligne</h4>
            <p>Le client recevra un lien de paiement sécurisé</p>
          </button>
          <button
            className={styles.paiementOption}
            onClick={() => setMode('CHEQUES')}
          >
            <FileText size={32} />
            <h4>Paiement par chèques</h4>
            <p>Suivi des chèques reçus et encaissés</p>
          </button>
        </div>
      ) : mode === 'PAYPLUG' ? (
        <div className={styles.confirmPaiement}>
          <p>
            Un lien de paiement de{' '}
            <strong>{formatCurrency(dossier.lettreMission?.totalAmount || 0)}</strong>{' '}
            sera créé.
          </p>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setMode(null)}>
              Retour
            </Button>
            <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
              Créer le paiement
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className={styles.chequesForm}
        >
          {cheques.map((cheque, index) => (
            <div key={index} className={styles.chequeForm}>
              <h5>Chèque {index + 1}</h5>
              <div className={styles.chequeFields}>
                <Input
                  label="Numéro"
                  value={cheque.numero}
                  onChange={(e) => updateCheque(index, 'numero', e.target.value)}
                  placeholder="1234567"
                />
                <Input
                  label="Banque"
                  value={cheque.banque}
                  onChange={(e) => updateCheque(index, 'banque', e.target.value)}
                  placeholder="BNP Paribas"
                />
                <Input
                  label="Montant (€)"
                  type="number"
                  value={cheque.montant}
                  onChange={(e) => updateCheque(index, 'montant', e.target.value)}
                  placeholder="1500"
                />
                <Input
                  label="Date d'émission"
                  type="date"
                  value={cheque.dateEmission}
                  onChange={(e) =>
                    updateCheque(index, 'dateEmission', e.target.value)
                  }
                />
              </div>
            </div>
          ))}
          <Button variant="ghost" type="button" onClick={addCheque}>
            + Ajouter un chèque
          </Button>
          <div className={styles.formActions}>
            <Button variant="secondary" type="button" onClick={() => setMode(null)}>
              Retour
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Enregistrer les chèques
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
