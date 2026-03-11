import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Users,
  FolderOpen,
  PenTool,
  CreditCard,
  TrendingUp,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';
import { getDossiers, getCheques, getAllClients } from '../lib/api';
import {
  formatCurrency,
  formatRelativeTime,
  dossierStatusConfig,
} from '../lib/utils';
import type { Dossier } from '../types';
import styles from './Dashboard.module.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function Dashboard() {
  const { data: dossiersData } = useQuery({
    queryKey: ['dossiers', 'dashboard'],
    queryFn: () => getDossiers({ limit: 100 }).then((res) => res.data),
  });
  const dossiers = dossiersData?.data ?? [];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => getAllClients().then((res) => res.data),
  });

  const { data: chequesData } = useQuery({
    queryKey: ['cheques', 'dashboard'],
    queryFn: () => getCheques({ limit: 100 }).then((res) => res.data),
  });
  const cheques = chequesData?.data ?? [];

  // Calculate stats
  const pendingSignatures = dossiers.filter(
    (d) => d.status === 'SENT'
  ).length;
  const pendingPayments = dossiers.filter(
    (d) => d.status === 'SIGNED' || d.status === 'PAYMENT_PENDING'
  ).length;
  const pendingCheques = cheques.filter(
    (c) => c.status === 'ATTENDU' || c.status === 'RECU'
  ).length;
  const totalRevenue = dossiers
    .filter((d) => d.status === 'PAID')
    .reduce((sum, d) => sum + parseFloat(d.lettreMission?.totalAmount || '0'), 0);

  const recentDossiers = [...dossiers]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    .slice(0, 5);

  return (
    <motion.div
      className={styles.page}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.header className={styles.header} variants={itemVariants}>
        <div>
          <h1 className={styles.title}>Tableau de bord</h1>
          <p className={styles.subtitle}>
            Vue d'ensemble de votre activité
          </p>
        </div>
        <Link to="/dossiers?new=1">
          <Button leftIcon={<FolderOpen size={18} />}>
            Nouveau dossier
          </Button>
        </Link>
      </motion.header>

      {/* Stats Grid */}
      <motion.div className={styles.statsGrid} variants={itemVariants}>
        <StatCard
          icon={<Users size={22} />}
          label="Clients"
          value={clients.length}
          trend="+12%"
          color="var(--azure-500)"
          bgColor="rgba(59, 130, 246, 0.1)"
        />
        <StatCard
          icon={<FolderOpen size={22} />}
          label="Dossiers"
          value={dossiers.length}
          trend="+8%"
          color="var(--gold-500)"
          bgColor="rgba(184, 149, 106, 0.1)"
        />
        <StatCard
          icon={<PenTool size={22} />}
          label="Signatures en attente"
          value={pendingSignatures}
          color="var(--ink-600)"
          bgColor="var(--ink-100)"
          alert={pendingSignatures > 0}
        />
        <StatCard
          icon={<CreditCard size={22} />}
          label="Paiements en attente"
          value={pendingPayments}
          color="var(--gold-600)"
          bgColor="var(--gold-300)"
          alert={pendingPayments > 0}
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label="Chiffre d'affaires"
          value={formatCurrency(totalRevenue)}
          isLarge
          color="var(--emerald-600)"
          bgColor="rgba(36, 122, 100, 0.1)"
        />
      </motion.div>

      <div className={styles.mainContent}>
        {/* Recent Dossiers */}
        <motion.div variants={itemVariants}>
          <Card padding="none" className={styles.recentCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Dossiers récents</h2>
              <Link to="/dossiers" className={styles.viewAll}>
                Voir tout <ArrowRight size={16} />
              </Link>
            </div>
            <div className={styles.dossierList}>
              {recentDossiers.length === 0 ? (
                <div className={styles.emptyState}>
                  <FolderOpen size={40} strokeWidth={1} />
                  <p>Aucun dossier pour le moment</p>
                  <Link to="/dossiers/new">
                    <Button variant="secondary" size="sm">
                      Créer un dossier
                    </Button>
                  </Link>
                </div>
              ) : (
                recentDossiers.map((dossier) => (
                  <DossierRow key={dossier.id} dossier={dossier} />
                ))
              )}
            </div>
          </Card>
        </motion.div>

        {/* Sidebar with alerts */}
        <motion.div className={styles.sidebar} variants={itemVariants}>
          {/* Pending Actions */}
          <Card className={styles.alertsCard}>
            <h3 className={styles.sidebarTitle}>Actions requises</h3>
            <div className={styles.alertsList}>
              {pendingSignatures > 0 && (
                <AlertItem
                  icon={<Clock size={18} />}
                  label={`${pendingSignatures} signature(s) en attente`}
                  variant="warning"
                />
              )}
              {pendingCheques > 0 && (
                <AlertItem
                  icon={<CreditCard size={18} />}
                  label={`${pendingCheques} chèque(s) à traiter`}
                  variant="info"
                />
              )}
              {pendingSignatures === 0 && pendingCheques === 0 && (
                <div className={styles.noAlerts}>
                  <CheckCircle2 size={24} />
                  <span>Tout est à jour</span>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <h3 className={styles.sidebarTitle}>Répartition des dossiers</h3>
            <div className={styles.statusBreakdown}>
              {Object.entries(
                dossiers.reduce(
                  (acc, d) => {
                    acc[d.status] = (acc[d.status] || 0) + 1;
                    return acc;
                  },
                  {} as Record<string, number>
                )
              ).map(([status, count]) => {
                const config = dossierStatusConfig[status as keyof typeof dossierStatusConfig];
                return (
                  <div key={status} className={styles.statusRow}>
                    <Badge
                      size="sm"
                      color={config?.color}
                      bgColor={config?.bgColor}
                    >
                      {config?.label || status}
                    </Badge>
                    <span className={styles.statusCount}>{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
  color,
  bgColor,
  isLarge,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  color: string;
  bgColor: string;
  isLarge?: boolean;
  alert?: boolean;
}) {
  return (
    <motion.div
      className={`${styles.statCard} ${isLarge ? styles.statCardLarge : ''}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      <div className={styles.statIcon} style={{ color, backgroundColor: bgColor }}>
        {icon}
        {alert && <span className={styles.alertDot} />}
      </div>
      <div className={styles.statContent}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </div>
      {trend && (
        <span className={styles.statTrend}>
          <TrendingUp size={14} /> {trend}
        </span>
      )}
    </motion.div>
  );
}

function DossierRow({ dossier }: { dossier: Dossier }) {
  const config = dossierStatusConfig[dossier.status];

  return (
    <Link to={`/dossiers/${dossier.id}`} className={styles.dossierRow}>
      <div className={styles.dossierInfo}>
        <span className={styles.dossierRef}>{dossier.reference}</span>
        <span className={styles.dossierClient}>
          {dossier.client
            ? `${dossier.client.firstName} ${dossier.client.lastName}`
            : '—'}
        </span>
      </div>
      <div className={styles.dossierMeta}>
        <Badge size="sm" color={config?.color} bgColor={config?.bgColor}>
          {config?.label}
        </Badge>
        <span className={styles.dossierTime}>
          {formatRelativeTime(dossier.updatedAt)}
        </span>
      </div>
    </Link>
  );
}

function AlertItem({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant: 'warning' | 'info' | 'danger';
}) {
  const colors = {
    warning: { color: 'var(--gold-600)', bg: 'var(--gold-300)' },
    info: { color: 'var(--azure-600)', bg: '#dbeafe' },
    danger: { color: 'var(--crimson-600)', bg: '#fee2e2' },
  };

  return (
    <div
      className={styles.alertItem}
      style={{ backgroundColor: colors[variant].bg }}
    >
      <span style={{ color: colors[variant].color }}>{icon}</span>
      <span>{label}</span>
    </div>
  );
}
