/* Cloche des rappels (7.6.1, demande du RSSI du 23/11/2026) : « Mes rappels » quitte le menu du Pilotage pour une cloche dans
   l'en-tête, à gauche du compte. Le nombre de rappels non lus s'affiche sur la cloche ; un clic ouvre les plus récents, et
   « Voir tous mes rappels » mène à la page complète (/pilotage/rappels), qui reste en place. */
import { ActionIcon, Popover, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconeCloche } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { get } from '../api';

type Rappel = { id: string; title: string; message: string; readAt: string | null; lien?: string };

/** Les cinq derniers non lus, puis la page complète. */
const APERCU = 5;

export function ClocheRappels() {
  const [ouvert, setOuvert] = useState(false);
  const naviguer = useNavigate();
  const q = useQuery({
    queryKey: ['grc', 'notifications'],
    queryFn: () => get<Rappel[]>('/api/grc/notifications'),
  });
  const nonLus = (q.data ?? []).filter((n) => !n.readAt);
  const libelle = nonLus.length
    ? `Mes rappels : ${nonLus.length} non lu${nonLus.length > 1 ? 's' : ''}`
    : 'Mes rappels : aucun non lu';
  return (
    <Popover opened={ouvert} onChange={setOuvert} position="bottom-end" shadow="md" width={360} withinPortal>
      <Popover.Target>
        <Tooltip label={libelle} events={{ hover: true, focus: true, touch: false }} disabled={ouvert}>
          <ActionIcon
            variant="default"
            className="theme-bascule cloche-rappels"
            aria-label={libelle}
            aria-haspopup="dialog"
            aria-expanded={ouvert}
            onClick={() => setOuvert((o) => !o)}
          >
            <IconeCloche />
            {nonLus.length > 0 && (
              <span className="cloche-rappels__nombre" aria-hidden="true">
                {nonLus.length > 99 ? '99+' : nonLus.length}
              </span>
            )}
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown className="cloche-rappels__panneau" role="dialog" aria-label="Mes rappels">
        <div className="cloche-rappels__tete">
          <span>Mes rappels</span>
          <span className="cloche-rappels__compte">{nonLus.length ? `${nonLus.length} non lus` : 'Tout est lu'}</span>
        </div>
        {nonLus.length === 0 ? (
          <Text size="sm" c="dimmed" className="cloche-rappels__vide">
            Aucun rappel en attente.
          </Text>
        ) : (
          <ul className="cloche-rappels__liste">
            {nonLus.slice(0, APERCU).map((n) => (
              <li key={n.id}>
                <UnstyledButton
                  className="cloche-rappels__item"
                  onClick={() => {
                    setOuvert(false);
                    void naviguer(n.lien ?? '/pilotage/rappels');
                  }}
                >
                  <span className="cloche-rappels__titre">{n.title}</span>
                  <span className="cloche-rappels__message">{n.message}</span>
                </UnstyledButton>
              </li>
            ))}
          </ul>
        )}
        <Link to="/pilotage/rappels" className="cloche-rappels__tout" onClick={() => setOuvert(false)}>
          Voir tous mes rappels
        </Link>
      </Popover.Dropdown>
    </Popover>
  );
}
