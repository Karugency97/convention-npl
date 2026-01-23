import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  FileText,
  Settings,
  Scale,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/cheques', icon: CreditCard, label: 'Chèques' },
];

export function Sidebar() {
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
        <NavLink to="/settings" className={styles.settingsLink}>
          <Settings size={18} strokeWidth={1.5} />
          <span>Paramètres</span>
        </NavLink>
        <div className={styles.version}>
          <FileText size={14} />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}
