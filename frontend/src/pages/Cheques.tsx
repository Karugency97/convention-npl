import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard,
  Check,
  X,
  Clock,
  Building2,
  ArrowRight,
} from 'lucide-react';
import { Button, Card, Badge, Modal, Pagination, SearchBar } from '../components/ui';
import { getCheques, updateChequeStatus } from '../lib/api';
import { formatCurrency, formatDate, chequeStatusConfig } from '../lib/utils';
import type { Cheque, ChequeStatus } from '../types';
import styles from './Cheques.module.css';

type FilterStatus = ChequeStatus | 'ALL';

export function Cheques() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [page, setPage] = useState(1);
  const [selectedCheque, setSelectedCheque] = useState<Cheque | null>(null);

  const { data: paginatedData } = useQuery({
    queryKey: ['cheques', { page, search: searchQuery, status: statusFilter }],
    queryFn: () =>
      getCheques({
        page,
        limit: 20,
        search: searchQuery || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      }).then((res) => res.data),
  });

  const cheques = paginatedData?.data ?? [];
  const meta = paginatedData?.meta;

  // Fetch all cheques (no pagination) for stats
  const { data: allChequesData } = useQuery({
    queryKey: ['cheques', 'stats'],
    queryFn: () =>
      getCheques({ limit: 100, page: 1 }).then((res) => res.data),
  });

  const allCheques = allChequesData?.data ?? [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const handleStatusChange = (newStatus: FilterStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  // Stats
  const stats = {
    attendu: allCheques.filter((c) => c.status === 'ATTENDU').length,
    recu: allCheques.filter((c) => c.status === 'RECU').length,
    encaisse: allCheques.filter((c) => c.status === 'ENCAISSE').length,
    rejete: allCheques.filter((c) => (c.status as string) === 'REJETE').length,
    totalPending: allCheques
      .filter((c) => c.status === 'ATTENDU' || c.status === 'RECU')
      .reduce((sum, c) => sum + parseFloat(c.montant), 0),
  };

  const statusFiltersList: { value: FilterStatus; label: string; count?: number }[] = [
    { value: 'ALL', label: 'Tous', count: allChequesData?.meta?.total ?? allCheques.length },
    { value: 'ATTENDU', label: 'Attendus', count: stats.attendu },
    { value: 'RECU', label: 'Recus', count: stats.recu },
    { value: 'ENCAISSE', label: 'Encaisses', count: stats.encaisse },
    { value: 'REJETE', label: 'Rejetes', count: stats.rejete },
  ];

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Gestion des cheques</h1>
          <p className={styles.subtitle}>
            {stats.attendu + stats.recu} cheque(s) en attente .{' '}
            {formatCurrency(stats.totalPending)} a encaisser
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
          label="Recus"
          value={stats.recu}
          color="var(--azure-600)"
          bgColor="#dbeafe"
        />
        <StatCard
          icon={<Building2 size={20} />}
          label="Encaisses"
          value={stats.encaisse}
          color="var(--emerald-600)"
          bgColor="#d1fae5"
        />
        <StatCard
          icon={<X size={20} />}
          label="Rejetes"
          value={stats.rejete}
          color="var(--crimson-600)"
          bgColor="#fee2e2"
        />
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Rechercher par numero, client ou dossier..."
        />

        <div className={styles.statusFilters}>
          {statusFiltersList.map((filter) => (
            <button
              key={filter.value}
              className={`${styles.filterButton} ${
                statusFilter === filter.value ? styles.filterActive : ''
              }`}
              onClick={() => handleStatusChange(filter.value)}
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
          <span>Numero</span>
          <span>Banque</span>
          <span>Montant</span>
          <span>Date d'emission</span>
          <span>Statut</span>
          <span>Actions</span>
        </div>

        <div className={styles.tableBody}>
          <AnimatePresence mode="popLayout">
            {cheques.length === 0 ? (
              <div className={styles.emptyState}>
                <CreditCard size={40} strokeWidth={1} />
                <p>Aucun cheque trouve</p>
              </div>
            ) : (
              cheques.map((cheque, index) => (
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
                    onSelect={() => setSelectedCheque(cheque)}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </Card>

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

      {/* Cheque Detail Modal */}
      <ChequeDetailModal
        cheque={selectedCheque}
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
        return { label: 'Marquer recu', status: 'RECU', variant: 'secondary' };
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
  onClose,
}: {
  cheque: Cheque | null;
  onClose: () => void;
}) {
  if (!cheque) return null;

  const statusConfig = chequeStatusConfig[cheque.status];

  return (
    <Modal
      isOpen={!!cheque}
      onClose={onClose}
      title={`Cheque n${cheque.numero}`}
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
            <span className={styles.detailLabel}>Date d'emission</span>
            <span className={styles.detailValue}>
              {formatDate(cheque.dateEmission)}
            </span>
          </div>
          {cheque.dateReception && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Date de reception</span>
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
      </div>
    </Modal>
  );
}
