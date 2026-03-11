import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  FileText,
  Settings,
  Scale,
  LogOut,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/cheques', icon: CreditCard, label: 'Cheques' },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrateur',
  AVOCAT: 'Avocat',
  SECRETAIRE: 'Secretaire',
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <motion.div
          className={styles.logoIcon}
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Scale size={28} strokeWidth={1.5} />
        </motion.div>
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>Cabinet NPL</span>
          <span className={styles.logoSubtitle}>Convention</span>
        </div>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map((item, index) => (
            <motion.li
              key={item.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.active : ''}`
                }
                end={item.to === '/'}
              >
                <item.icon size={20} strokeWidth={1.5} />
                <span>{item.label}</span>
              </NavLink>
            </motion.li>
          ))}
        </ul>
      </nav>

      <div className={styles.footer}>
        <div className={styles.divider} />

        {user && (
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              <User size={16} strokeWidth={1.5} />
            </div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>
                {user.firstName} {user.lastName}
              </span>
              <span className={styles.userRole}>
                {roleLabels[user.role] || user.role}
              </span>
            </div>
          </div>
        )}

        <NavLink to="/settings" className={styles.settingsLink}>
          <Settings size={18} strokeWidth={1.5} />
          <span>Parametres</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className={styles.logoutButton}
          type="button"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Deconnexion</span>
        </button>

        <div className={styles.version}>
          <FileText size={14} />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
