import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  User,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Edit2,
  Trash2,
  FolderOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card, Input, Modal, Pagination, SearchBar } from '../components/ui';
import { getClients, getAllClients, createClient, updateClient, deleteClient } from '../lib/api';
import { formatDate, formatPhone } from '../lib/utils';
import type { Client } from '../types';
import styles from './Clients.module.css';

export function Clients() {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['clients', { page, search: searchQuery }],
    queryFn: () =>
      getClients({
        page,
        limit: 20,
        search: searchQuery || undefined,
      }).then((res) => res.data),
  });

  const clients = paginatedData?.data ?? [];
  const meta = paginatedData?.meta;

  // Fetch all dossiers count via a lightweight query
  const { data: allClients = [] } = useQuery({
    queryKey: ['clients', 'all'],
    queryFn: () => getAllClients().then((res) => res.data),
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Clients</h1>
          <p className={styles.subtitle}>
            {meta?.total ?? allClients.length} client{(meta?.total ?? allClients.length) !== 1 ? 's' : ''} enregistre{(meta?.total ?? allClients.length) !== 1 ? 's' : ''}
          </p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Nouveau client
        </Button>
      </header>

      {/* Search */}
      <div className={styles.toolbar}>
        <SearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Rechercher un client..."
        />
      </div>

      {/* Client List */}
      <div className={styles.clientGrid}>
        <AnimatePresence mode="popLayout">
          {clients.map((client, index) => (
            <motion.div
              key={client.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.03 }}
            >
              <ClientCard
                client={client}
                onEdit={() => openEditModal(client)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {clients.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <User size={48} strokeWidth={1} />
          <h3>Aucun client trouve</h3>
          <p>
            {searchQuery
              ? 'Essayez avec d\'autres termes de recherche'
              : 'Commencez par ajouter votre premier client'}
          </p>
          {!searchQuery && (
            <Button variant="secondary" onClick={openCreateModal}>
              Ajouter un client
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

      {/* Modal */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={closeModal}
        client={editingClient}
      />
    </motion.div>
  );
}

function ClientCard({
  client,
  onEdit,
}: {
  client: Client;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const [showActions, setShowActions] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(client.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return (
    <Card className={styles.clientCard} hover>
      <div className={styles.clientHeader}>
        <div className={styles.avatar}>
          {client.firstName[0]}
          {client.lastName[0]}
        </div>
        <div className={styles.clientInfo}>
          <h3 className={styles.clientName}>
            {client.firstName} {client.lastName}
          </h3>
          <span className={styles.clientSince}>
            Client depuis {formatDate(client.createdAt)}
          </span>
        </div>
        <div className={styles.actionsWrapper}>
          <button
            className={styles.moreButton}
            onClick={() => setShowActions(!showActions)}
          >
            <MoreVertical size={18} />
          </button>
          <AnimatePresence>
            {showActions && (
              <motion.div
                className={styles.actionsMenu}
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
              >
                <button onClick={onEdit}>
                  <Edit2 size={16} /> Modifier
                </button>
                <button
                  className={styles.danger}
                  onClick={() => {
                    if (confirm('Supprimer ce client ?')) {
                      deleteMutation.mutate();
                    }
                  }}
                >
                  <Trash2 size={16} /> Supprimer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.clientDetails}>
        <div className={styles.detailRow}>
          <Mail size={16} />
          <a href={`mailto:${client.email}`}>{client.email}</a>
        </div>
        <div className={styles.detailRow}>
          <Phone size={16} />
          <a href={`tel:${client.phone}`}>{formatPhone(client.phone)}</a>
        </div>
        <div className={styles.detailRow}>
          <MapPin size={16} />
          <span>{client.address}</span>
        </div>
      </div>

      <div className={styles.clientFooter}>
        <Link
          to={`/dossiers?client=${client.id}`}
          className={styles.dossierBadge}
        >
          <FolderOpen size={14} />
          <span>Voir dossiers</span>
        </Link>
        <Link to={`/dossiers/new?clientId=${client.id}`}>
          <Button variant="ghost" size="sm">
            Nouveau dossier
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function ClientModal({
  isOpen,
  onClose,
  client,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes
  useState(() => {
    if (isOpen && client) {
      setFormData({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        address: client.address,
      });
    } else if (isOpen) {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
      });
    }
    setErrors({});
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        const messages = Array.isArray(error.response.data.message)
          ? error.response.data.message
          : [error.response.data.message];
        setErrors({ general: messages.join(', ') });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => updateClient(client!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'Prenom requis';
    if (!formData.lastName.trim()) newErrors.lastName = 'Nom requis';
    if (!formData.email.trim()) newErrors.email = 'Email requis';
    if (!formData.phone.trim()) newErrors.phone = 'Telephone requis';
    if (!formData.address.trim()) newErrors.address = 'Adresse requise';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (client) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client ? 'Modifier le client' : 'Nouveau client'}
      size="md"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <Input
            label="Prenom"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            error={errors.firstName}
            placeholder="Jean"
          />
          <Input
            label="Nom"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            error={errors.lastName}
            placeholder="Dupont"
          />
        </div>
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          placeholder="jean.dupont@example.com"
        />
        <Input
          label="Telephone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          error={errors.phone}
          placeholder="+33 6 12 34 56 78"
        />
        <Input
          label="Adresse"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          error={errors.address}
          placeholder="10 rue de Paris, 75001 Paris"
        />

        {errors.general && (
          <p className={styles.errorMessage}>{errors.general}</p>
        )}

        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {client ? 'Enregistrer' : 'Creer le client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
