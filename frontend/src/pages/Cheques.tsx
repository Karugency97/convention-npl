import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  Search,
  Check,
  X,
  Clock,
  Building2,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { Button, Card, Badge, Modal } from '../components/ui';
import { getCheques, updateChequeStatus, getDossiers } from '../lib/api';
import { formatCurrency, formatDate, chequeStatusConfig } from '../lib/utils';
import type { Cheque, ChequeStatus, Dossier } from '../types';
import styles from './Cheques.module.css';

type FilterStatus = ChequeStatus | 'ALL';

export function Cheques() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);

  const { data: cheques = [] } = useQuery({
    queryKey: ['cheques'],
    queryFn: () => getCheques().then((res) => res.data),
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ['dossiers'],
    queryFn: () => getDossiers().then((res) => res.data),
  });

  // Get dossier for a cheque (would need to be fetched properly in real app)
  const getDossierForCheque = (cheque: Cheque): Dossier | undefined => {
    return dossiers.find((d) =>
      d.paiements?.some((p) => p.cheques?.some((c) => c.id === cheque.id))
    );
  };

  // Filter cheques
  const filteredCheques = cheques.filter((cheque) => {
    const matchesSearch =
      cheque.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cheque.banque.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || cheque.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    attendu: cheques.filter((c) => c.status === 'ATTENDU').length,
    recu: cheques.filter((c) => c.status === 'RECU').length,
    encaisse: cheques.filter((c) => c.status === 'ENCAISSE').length,
    rejete: cheques.filter((c) => c.status === 'REJETE').length,
    totalPending: cheques
      .filter((c) => c.status === 'ATTENDU' || c.status === 'RECU')
      .reduce((sum, c) => sum + parseFloat(c.montant), 0),
  };

  const statusFilters: { value: FilterStatus; label: string; count?: number }[] = [
    { value: 'ALL', label: 'Tous', count: cheques.length },
    { value: 'ATTENDU', label: 'Attendus', count: stats.attendu },
    { value: 'RECU', label: 'Reçus', count: stats.recu },
    { value: 'ENCAISSE', label: 'Encaissés', count: stats.encaisse },
    { value: 'REJETE', label: 'Rejetés', count: stats.rejete },
  ];

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestion des chèques</h1>
          <p className={styles.subtitle}>
            {stats.attendu + stats.recu} chèque(s) en attente ·{' '}
            {formatCurrency(stats.totalPending)} à encaisser
          </p>
        </div>
      </header>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <StatCard
          icon={<Clock size={20} />}
          label="Attendus"
          value={stats.attendu}
          color="var(--gold-600)"
          bgColor="var(--gold-300)"
        />
        <StatCard
          icon={<Check size={20} />}
          label="Reçus"
          value={stats.recu}
          color="var(--azure-600)"
          bgColor="#dbeafe"
        />
        <StatCard
          icon={<Building2 size={20} />}
          label="Encaissés"
          value={stats.encaisse}
          color="var(--emerald-600)"
          bgColor="#d1fae5"
        />
        <StatCard
          icon={<X size={20} />}
          label="Rejetés"
          value={stats.rejete}
          color="var(--crimson-600)"
          bgColor="#fee2e2"
        />
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Rechercher par numéro ou banque..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.statusFilters}>
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterButton} ${
                statusFilter === filter.value ? styles.filterActive : ''
              }`}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
              {filter.count !== undefined && (
                <span className={styles.filterCount}>{filter.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cheques List */}
      <Card padding="none">
        <div className={styles.tableHeader}>
          <span>Numéro</span>
          <span>Banque</span>
          <span>Montant</span>
          <span>Date d'émission</span>
          <span>Statut</span>
          <span>Actions</span>
        </div>

        <div className={styles.tableBody}>
          <AnimatePresence mode="popLayout">
            {filteredCheques.length === 0 ? (
              <div className={styles.emptyState}>
                <CreditCard size={40} strokeWidth={1} />
                <p>Aucun chèque trouvé</p>
              </div>
            ) : (
              filteredCheques.map((cheque, index) => {
                const dossier = getDossierForCheque(cheque);
                return (
                  <motion.div
                    key={cheque.id}
                    className={styles.tableRow}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <ChequeRow
                      cheque={cheque}
                      dossier={dossier}
                      onSelect={() => setSelectedCheque(cheque)}
                    />
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Cheque Detail Modal */}
      <ChequeDetailModal
        cheque={selectedCheque}
        dossier={selectedCheque ? getDossierForCheque(selectedCheque) : undefined}
        onClose={() => setSelectedCheque(null)}
      />
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ color, backgroundColor: bgColor }}>
        {icon}
      </div>
      <div className={styles.statContent}>
        <span className={styles.statValue}>{value}</span>
        <span className={styles.statLabel}>{label}</span>
      </div>
    </div>
  );
}

function ChequeRow({
  cheque,
  onSelect,
}: {
  cheque: Cheque;
  dossier?: Dossier;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const statusConfig = chequeStatusConfig[cheque.status];

  const updateMutation = useMutation({
    mutationFn: (newStatus: 'RECU' | 'ENCAISSE' | 'REJETE') =>
      updateChequeStatus(cheque.id, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      queryClient.invalidateQueries({ queryKey: ['dossiers'] });
    },
  });

  const getNextAction = (): {
    label: string;
    status: 'RECU' | 'ENCAISSE' | 'REJETE';
    variant: 'primary' | 'secondary' | 'danger';
  } | null => {
    switch (cheque.status) {
      case 'ATTENDU':
        return { label: 'Marquer reçu', status: 'RECU', variant: 'secondary' };
      case 'RECU':
        return { label: 'Encaisser', status: 'ENCAISSE', variant: 'primary' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();

  return (
    <>
      <div className={styles.cellNumero}>
        <CreditCard size={16} />
        <span>{cheque.numero}</span>
      </div>
      <div className={styles.cellBanque}>{cheque.banque}</div>
      <div className={styles.cellMontant}>{formatCurrency(cheque.montant)}</div>
      <div className={styles.cellDate}>{formatDate(cheque.dateEmission)}</div>
      <div className={styles.cellStatus}>
        <Badge
          size="sm"
          color={statusConfig?.color}
          bgColor={statusConfig?.bgColor}
        >
          {statusConfig?.label}
        </Badge>
      </div>
      <div className={styles.cellActions}>
        {nextAction && (
          <Button
            variant={nextAction.variant}
            size="sm"
            onClick={() => updateMutation.mutate(nextAction.status)}
            isLoading={updateMutation.isPending}
          >
            {nextAction.label}
          </Button>
        )}
        {cheque.status === 'RECU' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateMutation.mutate('REJETE')}
            isLoading={updateMutation.isPending}
          >
            <X size={16} />
          </Button>
        )}
        <button className={styles.detailButton} onClick={onSelect}>
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}

function ChequeDetailModal({
  cheque,
  dossier,
  onClose,
}: {
  cheque: Cheque | null;
  dossier?: Dossier;
  onClose: () => void;
}) {
  if (!cheque) return null;

  const statusConfig = chequeStatusConfig[cheque.status];

  return (
    <Modal
      isOpen={!!cheque}
      onClose={onClose}
      title={`Chèque n°${cheque.numero}`}
      size="md"
    >
      <div className={styles.chequeDetail}>
        <div className={styles.detailHeader}>
          <Badge
            color={statusConfig?.color}
            bgColor={statusConfig?.bgColor}
          >
            {statusConfig?.label}
          </Badge>
          <span className={styles.detailAmount}>
            {formatCurrency(cheque.montant)}
          </span>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Banque</span>
            <span className={styles.detailValue}>{cheque.banque}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Date d'émission</span>
            <span className={styles.detailValue}>
              {formatDate(cheque.dateEmission)}
            </span>
          </div>
          {cheque.dateReception && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date de réception</span>
              <span className={styles.detailValue}>
                {formatDate(cheque.dateReception)}
              </span>
            </div>
          )}
          {cheque.dateEncaissement && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date d'encaissement</span>
              <span className={styles.detailValue}>
                {formatDate(cheque.dateEncaissement)}
              </span>
            </div>
          )}
        </div>

        {dossier && (
          <div className={styles.detailDossier}>
            <span className={styles.detailLabel}>Dossier associé</span>
            <Link
              to={`/dossiers/${dossier.id}`}
              className={styles.dossierLink}
              onClick={onClose}
            >
              <FileText size={16} />
              <span>{dossier.reference}</span>
              <span className={styles.dossierDesc}>{dossier.description}</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </Modal>
  );
}
