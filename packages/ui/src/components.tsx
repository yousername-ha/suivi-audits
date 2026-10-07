/* Composants communs de la charte : page, en-tête de page, tableau, section de formulaire, puce d'état,
   confirmation, message d'erreur. Tous les écrans les utilisent. */
import { Alert, Badge, Button, Card, Group, Modal, Stack, Text, Title } from '@mantine/core';
import { useState, type ReactNode } from 'react';

/** Page : pleine largeur (par défaut) ou largeur de formulaire. */
export function Page({ children, variant = 'pleine' }: { children: ReactNode; variant?: 'pleine' | 'formulaire' }) {
  return <div className={variant === 'formulaire' ? 'page page--formulaire' : 'page'}>{children}</div>;
}

/** En-tête de page : titre, description, actions et éléments annexes (présence…). */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__titre">
        <Title order={1}>{title}</Title>
        {description && (
          <Text c="dimmed" size="sm" className="lecture">
            {description}
          </Text>
        )}
      </div>
      {actions && <Group gap="xs">{actions}</Group>}
    </header>
  );
}

/** Tableau dans une carte, défilant horizontalement si nécessaire. */
export function DataTable({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <Card className="data-table" p={0}>
      <div className="table-wrap" role="region" aria-label={label} tabIndex={label ? 0 : undefined}>
        {children}
      </div>
    </Card>
  );
}

export type Etat = 'succes' | 'attention' | 'erreur' | 'info' | 'neutre';
const ETAT_COULEUR: Record<Etat, string> = {
  succes: 'suivi',
  attention: 'orange',
  erreur: 'red',
  info: 'violet',
  neutre: 'gray',
};
/** Puce d'état : couleur selon le sens (succès, attention, erreur, information, neutre). */
export function StatusChip({ etat, children }: { etat: Etat; children: ReactNode }) {
  return (
    <Badge color={ETAT_COULEUR[etat]} variant="light">
      {children}
    </Badge>
  );
}

/** Section de formulaire avec son propre bouton Enregistrer et l'indication des modifications non enregistrées. */
export function FormSection({
  title,
  description,
  children,
  dirty,
  saving,
  canSave = true,
  onSave,
  onReset,
  error,
  readOnlyReason,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dirty: boolean;
  saving?: boolean;
  canSave?: boolean;
  onSave: () => unknown;
  onReset?: () => unknown;
  error?: string | null;
  readOnlyReason?: string;
}) {
  return (
    <Card component="section" aria-label={typeof title === 'string' ? title : undefined}>
      <Stack>
        <div>
          <Title order={2} size="h3">
            {title}
          </Title>
          {description && (
            <Text c="dimmed" size="sm" className="lecture">
              {description}
            </Text>
          )}
        </div>
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        {children}
        <div className="form-section__pied">
          {!canSave && readOnlyReason && (
            <Text size="sm" c="dimmed">
              {readOnlyReason}
            </Text>
          )}
          {dirty && (
            <Badge color="orange" variant="light" role="status">
              Modifications non enregistrées
            </Badge>
          )}
          {onReset && dirty && (
            <Button variant="default" onClick={() => void onReset()}>
              Annuler les modifications
            </Button>
          )}
          <Button onClick={() => void onSave()} loading={saving} disabled={!canSave || !dirty}>
            Enregistrer
          </Button>
        </div>
      </Stack>
    </Card>
  );
}

/** Boîte de dialogue de confirmation. */
export function ConfirmDialog({
  opened,
  title = 'Confirmation',
  message,
  confirmLabel = 'Confirmer',
  color = 'red',
  onConfirm,
  onClose,
}: {
  opened: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  color?: string;
  onConfirm: () => unknown;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack>
        <Text>{message}</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Annuler
          </Button>
          <Button
            color={color}
            onClick={async () => {
              onClose();
              await onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Bouton qui demande confirmation avant une action risquée. */
export function ConfirmButton({
  children,
  message,
  onConfirm,
  color = 'red',
  ...rest
}: {
  children: ReactNode;
  message: string;
  onConfirm: () => unknown;
  color?: string;
  size?: string;
  variant?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button color={color} onClick={() => setOpen(true)} {...rest}>
        {children}
      </Button>
      <ConfirmDialog
        opened={open}
        message={message}
        color={color}
        onConfirm={onConfirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/** Message d'erreur (null : rien). */
export function ErrorAlert({ error, title = 'Erreur' }: { error: unknown; title?: string }) {
  if (!error) return null;
  return (
    <Alert color="red" title={title} role="alert">
      {error instanceof Error ? error.message : String(error)}
    </Alert>
  );
}
