import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  FolderOpen,
  Filter,
  ArrowUpDown,
  FileText,
  PenTool,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Pagination, SearchBar } from '../components/ui';
import { getDossiers, getAllClients, createDossier } from '../lib/api';
import {
  formatDate,
  formatCurrency,
  dossierStatusConfig,
} from '../lib/utils';
import type { Dossier, Client, DossierStatus } from '../types';
import styles from './Dossiers.module.css';

const statusFilters: { value: DossierStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'SENT', label: 'En signature' },
  { value: 'SIGNED', label: 'Signes' },
  { value: 'PAYMENT_PENDING', label: 'Paiement en cours' },
  { value: 'PAID', label: 'Payes' },
];

export function Dossiers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get('client');
  const shouldOpenNew = searchParams.get('new') === '1';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'reference'>('date');
  const [page, setPage] = useState(1);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Open modal if ?new=1 is in URL
  useEffect(() => {
    if (shouldOpenNew) {
      setIsNewModalOpen(true);
      // Remove the query param
      setSearchParams({});
    }
  }, [shouldOpenNew, setSearchParams]);

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: [
      'dossiers',
      {
        page,
        search: searchQuery,
        status: statusFilter,
        clientId: clientFilter,
        sortBy,
      },
    ],
    queryFn: () =>
      getDossiers({
        page,
        limit: 20,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        clientId: clientFilter || undefined,
        sortBy: sortBy === 'reference' ? 'reference' : 'createdAt',
        sortOrder: sortBy === 'reference' ? 'asc' : 'desc',
      }).then((res) => res.data),
  });

  const dossiers = paginatedData?.data ?? [];
  const meta = paginatedData?.meta;

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => getAllClients().then((res) => res.data),
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (newStatus: DossierStatus | 'ALL') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Stats from meta
  const total = meta?.total ?? 0;

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dossiers</h1>
          <p className={styles.subtitle}>
            {total} dossier{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          leftIcon={<Plus size={18} />}
          onClick={() => setIsNewModalOpen(true)}
        >
          Nouveau dossier
        </Button>
      </header>

      {/* Filters */}
      <div className={styles.toolbar}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Rechercher un dossier..."
        />

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <Filter size={16} />
            <select
              value={statusFilter}
              onChange={(e) =>
                handleStatusChange(e.target.value as DossierStatus | 'ALL')
              }
              className={styles.select}
            >
              {statusFilters.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className={styles.sortButton}
            onClick={() => {
              setSortBy(sortBy === 'date' ? 'reference' : 'date');
              setPage(1);
            }}
          >
            <ArrowUpDown size={16} />
            {sortBy === 'date' ? 'Date' : 'Reference'}
          </button>
        </div>
      </div>

      {/* Dossier List */}
      <div className={styles.dossierList}>
        <AnimatePresence mode="popLayout">
          {dossiers.map((dossier, index) => (
            <motion.div
              key={dossier.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: index * 0.02 }}
            >
              <DossierCard dossier={dossier} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {dossiers.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <FolderOpen size={48} strokeWidth={1} />
          <h3>Aucun dossier trouve</h3>
          <p>
            {searchQuery || statusFilter !== 'ALL'
              ? 'Essayez de modifier vos filtres'
              : 'Creez votre premier dossier pour commencer'}
          </p>
          {!searchQuery && statusFilter === 'ALL' && (
            <Button variant="secondary" onClick={() => setIsNewModalOpen(true)}>
              Creer un dossier
            </Button>
          )}
        </div>
      )}

      {/* Pagination */}
      {meta && (
        <Pagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          limit={meta.limit}
          onPageChange={setPage}
        />
      )}

      {/* New Dossier Modal */}
      <NewDossierModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        clients={clients}
      />
    </motion.div>
  );
}

function DossierCard({ dossier }: { dossier: Dossier }) {
  const statusConfig = dossierStatusConfig[dossier.status];

  const getProgressSteps = () => {
    const steps = [
      { label: 'Lettre', icon: FileText, done: !!dossier.lettreMission },
      {
        label: 'Signature',
        icon: PenTool,
        done:
          dossier.status === 'SIGNED' ||
          dossier.status === 'PAYMENT_PENDING' ||
          dossier.status === 'PAID',
      },
      { label: 'Paiement', icon: CreditCard, done: dossier.status === 'PAID' },
    ];
    return steps;
  };

  const steps = getProgressSteps();

  return (
    <Link to={`/dossiers/${dossier.id}`} className={styles.cardLink}>
      <Card className={styles.dossierCard} hover>
        <div className={styles.cardMain}>
          <div className={styles.cardHeader}>
            <div className={styles.refBadge}>
              <FolderOpen size={14} />
              {dossier.reference}
            </div>
            <Badge
              size="sm"
              color={statusConfig?.color}
              bgColor={statusConfig?.bgColor}
            >
              {statusConfig?.label}
            </Badge>
          </div>

          <h3 className={styles.cardTitle}>{dossier.description}</h3>

          <div className={styles.cardMeta}>
            {dossier.client && (
              <span className={styles.clientName}>
                {dossier.client.firstName} {dossier.client.lastName}
              </span>
            )}
            <span className={styles.separator}>.</span>
            <span className={styles.date}>{formatDate(dossier.createdAt)}</span>
            {dossier.lettreMission && (
              <>
                <span className={styles.separator}>.</span>
                <span className={styles.amount}>
                  {formatCurrency(dossier.lettreMission.totalAmount)}
                </span>
              </>
            )}
          </div>
        </div>

        <div className={styles.cardProgress}>
          <div className={styles.progressSteps}>
            {steps.map((step) => (
              <div
                key={step.label}
                className={`${styles.step} ${step.done ? styles.stepDone : ''}`}
              >
                <div className={styles.stepIcon}>
                  <step.icon size={14} />
                </div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            ))}
          </div>
          <ChevronRight size={20} className={styles.chevron} />
        </div>
      </Card>
    </Link>
  );
}

function NewDossierModal({
  isOpen,
  onClose,
  clients,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    clientId: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useMutation({
    mutationFn: createDossier,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['dossiers'] });
      onClose();
      setFormData({ clientId: '', description: '' });
      navigate(`/dossiers/${response.data.id}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.clientId) newErrors.clientId = 'Client requis';
    if (!formData.description.trim())
      newErrors.description = 'Description requise';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    createMutation.mutate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau dossier" size="md">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Client</label>
          <select
            value={formData.clientId}
            onChange={(e) =>
              setFormData({ ...formData, clientId: e.target.value })
            }
            className={styles.formSelect}
            disabled={createMutation.isPending}
          >
            <option value="">Selectionner un client...</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.firstName} {client.lastName} - {client.email}
              </option>
            ))}
          </select>
          {errors.clientId && (
            <span className={styles.formError}>{errors.clientId}</span>
          )}
        </div>

        <Input
          label="Description de l'affaire"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          error={errors.description}
          placeholder="Ex: Litige commercial avec fournisseur"
          disabled={createMutation.isPending}
        />

        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={createMutation.isPending}>
            Annuler
          </Button>
          <Button type="submit" isLoading={createMutation.isPending}>
            Creer le dossier
          </Button>
        </div>
      </form>
    </Modal>
  );
}
