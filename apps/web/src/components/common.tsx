/* Composants communs : erreur, commande copiable, présence, secret affiché une fois, dates. */
import { Alert, Avatar, Button, CopyButton, Group, Modal, Stack, Text, Tooltip } from '@mantine/core';
import type { PresenceEntry } from '@suivi/shared';
import { usePresenceOn } from '../realtime';

export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export const fmtSize = (n: number | null | undefined) =>
  n == null ? '' : n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;

export function CopyCommand({ command }: { command: string }) {
  return (
    <div className="cmd">
      <code>{command}</code>
      <CopyButton value={command}>
        {({ copied, copy }) => (
          <Button
            size="compact-sm"
            variant={copied ? 'filled' : 'default'}
            onClick={copy}
            aria-label={`Copier : ${command}`}
          >
            {copied ? 'Copié' : 'Copier'}
          </Button>
        )}
      </CopyButton>
    </div>
  );
}

const initials = (n: string) =>
  n
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]!.toUpperCase())
    .join('');

/** Qui consulte ou modifie la même ressource. */
export function PresenceBar({ resource }: { resource: string }) {
  const others = usePresenceOn(resource);
  if (!others.length) return null;
  const byUser = new Map<string, PresenceEntry>();
  for (const p of others) if (!byUser.has(p.username) || p.mode === 'edit') byUser.set(p.username, p);
  const list = [...byUser.values()];
  return (
    <Group gap="xs" aria-live="polite" className="presence-bar">
      <Avatar.Group>
        {list.slice(0, 5).map((p) => (
          <Tooltip key={p.username} label={`${p.name} ${p.mode === 'edit' ? 'modifie' : 'consulte'}`}>
            <Avatar size="sm" radius="xl" color={p.mode === 'edit' ? 'orange' : 'suivi'}>
              {initials(p.name)}
            </Avatar>
          </Tooltip>
        ))}
      </Avatar.Group>
      <Text size="sm" c="dimmed">
        {list.map((p) => `${p.name} ${p.mode === 'edit' ? 'modifie' : 'consulte'}`).join(', ')}
      </Text>
    </Group>
  );
}

/** Secret affiché une seule fois (mot de passe temporaire). */
export function SecretModal({
  title,
  intro,
  secret,
  onClose,
}: {
  title: string;
  intro: string;
  secret: string | null;
  onClose: () => void;
}) {
  return (
    <Modal opened={!!secret} onClose={onClose} title={title} centered>
      <Stack>
        <Text size="sm">{intro}</Text>
        <div className="secret" data-testid="secret">
          {secret}
        </div>
        <Alert color="orange">
          Ce mot de passe n’est affiché qu’une fois. Transmettez-le par un canal séparé (de vive voix, SMS) ; il devra
          être changé à la première connexion.
        </Alert>
        <Group justify="flex-end">
          <CopyButton value={secret ?? ''}>
            {({ copied, copy }) => (
              <Button variant="default" onClick={copy}>
                {copied ? 'Copié' : 'Copier'}
              </Button>
            )}
          </CopyButton>
          <Button onClick={onClose}>Fermer</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/* Composants de la charte (packages/ui), réexportés pour les écrans existants. */
export { ConfirmButton, ErrorAlert } from '@suivi/ui';
