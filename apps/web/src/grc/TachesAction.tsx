/* Tâches d'une action (ADR 0111, décision du RSSI pour la 7.5.0, maquette validée) : section de la fiche de l'action.
   « n faites sur N », barre d'avancement avec le pourcentage, liste (case à cocher, intitulé barré si faite, responsable en
   initiales, échéance en rouge gras si dépassée et non faite, menu ⋯ Modifier / Supprimer), champ « Nouvelle tâche… » et
   « Ajouter ». Les tâches sont des données de l'action : elles s'enregistrent avec elle (mise à jour existante, version et
   If-Match), par qui peut la modifier ; sans ce droit, la section est en lecture seule. Le responsable d'une tâche est un
   simple affichage : il n'ouvre l'action à personne. Cocher toutes les tâches ne termine pas l'action. */
import { ActionIcon, Button, Checkbox, Menu, Text, TextInput } from '@mantine/core';
import { jourParis, avancementTaches, TACHES_ACTION_MAX, type TacheAction } from '@suivi/shared';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { libelleDesignation, SelecteurResponsableTypé, useProposables } from '../components/selecteurs';
import { PastilleResponsable } from './TimelineCommun';

const dateCourte = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function TachesAction({
  smsi,
  taches,
  onChange,
  readonly,
}: {
  smsi: string;
  taches: TacheAction[];
  onChange: (taches: TacheAction[]) => void;
  readonly: boolean;
}) {
  const [nouvelle, setNouvelle] = useState('');
  const [edition, setEdition] = useState<string | null>(null);
  const proposables = useProposables(smsi);
  const idTitre = useId();
  const av = avancementTaches(taches);
  // Largeur de la jauge par le CSSOM (CSP stricte : aucun style en ligne).
  const jauge = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    jauge.current?.style.setProperty('--taches-avancement', `${av?.pourcentage ?? 0}%`);
  }, [av?.pourcentage]);
  const aujourdhui = jourParis();
  const maj = (id: string, patch: Partial<TacheAction>) =>
    onChange(taches.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const plein = taches.length >= TACHES_ACTION_MAX;
  const ajouter = () => {
    const intitule = nouvelle.replace(/\s+/g, ' ').trim();
    if (!intitule || plein) return;
    onChange([...taches, { id: crypto.randomUUID(), intitule, faite: false, echeance: null }]);
    setNouvelle('');
  };
  const libelle = (t: TacheAction) =>
    t.responsable ? libelleDesignation({ responsable: t.responsable }, proposables.data) : 'Non désigné';
  return (
    <section className="taches-action" aria-labelledby={idTitre}>
      <div className="taches-action__tete">
        <h3 id={idTitre} className="taches-action__titre">
          Tâches
        </h3>
        <Text size="sm" c="dimmed">
          {av ? `${av.faites} ${av.faites > 1 ? 'faites' : 'faite'} sur ${av.total}` : 'Aucune tâche'}
        </Text>
      </div>
      {av && (
        <div className="taches-action__avancement">
          <div
            ref={jauge}
            className="taches-action__jauge"
            role="progressbar"
            aria-label="Avancement des tâches"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={av.pourcentage}
          >
            <span className="taches-action__plein" />
          </div>
          <span className="taches-action__pourcentage">{av.pourcentage} %</span>
        </div>
      )}
      {taches.length > 0 && (
        <ul className="taches-action__liste">
          {taches.map((t) => {
            const retard = !t.faite && !!t.echeance && t.echeance < aujourdhui;
            if (edition === t.id)
              return (
                <li key={t.id} className="taches-action__edition">
                  <TextInput
                    label="Intitulé de la tâche"
                    value={t.intitule}
                    maxLength={200}
                    onChange={(e) => maj(t.id, { intitule: e.currentTarget.value })}
                  />
                  <SelecteurResponsableTypé
                    smsi={smsi}
                    label="Responsable de la tâche (affichage seulement)"
                    data={{ ownerId: null, responsable: t.responsable ?? null }}
                    onChange={(p) =>
                      maj(t.id, {
                        responsable: p.ownerId ? { type: 'utilisateur', id: p.ownerId } : p.responsable,
                      })
                    }
                  />
                  <TextInput
                    label="Échéance de la tâche"
                    type="date"
                    value={t.echeance ?? ''}
                    onChange={(e) => maj(t.id, { echeance: e.currentTarget.value || null })}
                  />
                  <Button variant="light" disabled={!t.intitule.trim()} onClick={() => setEdition(null)}>
                    Terminer
                  </Button>
                </li>
              );
            return (
              <li key={t.id} className="taches-action__ligne">
                <Checkbox
                  color="teal"
                  checked={t.faite}
                  disabled={readonly}
                  aria-label={`Tâche faite : ${t.intitule}`}
                  onChange={(e) => maj(t.id, { faite: e.currentTarget.checked })}
                />
                <span
                  className={
                    t.faite ? 'taches-action__intitule taches-action__intitule--faite' : 'taches-action__intitule'
                  }
                >
                  {t.intitule}
                </span>
                <PastilleResponsable libelle={libelle(t)} vide={!t.responsable} />
                <span
                  className={retard ? 'taches-action__date taches-action__date--retard' : 'taches-action__date'}
                  title={retard ? 'Échéance dépassée' : undefined}
                >
                  {t.echeance ? dateCourte(t.echeance) : '—'}
                </span>
                {readonly ? (
                  <span />
                ) : (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" aria-label={`Actions de la tâche : ${t.intitule}`}>
                        <span aria-hidden="true">⋯</span>
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item onClick={() => setEdition(t.id)}>Modifier</Menu.Item>
                      <Menu.Item color="red" onClick={() => onChange(taches.filter((x) => x.id !== t.id))}>
                        Supprimer
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!readonly && (
        <div className="taches-action__ajout">
          <TextInput
            aria-label="Nouvelle tâche"
            placeholder="Nouvelle tâche…"
            value={nouvelle}
            maxLength={200}
            disabled={plein}
            onChange={(e) => setNouvelle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ajouter();
              }
            }}
          />
          <Button onClick={ajouter} disabled={!nouvelle.trim() || plein}>
            Ajouter
          </Button>
        </div>
      )}
      {plein && !readonly && (
        <Text size="xs" c="dimmed">
          Une action compte au plus {TACHES_ACTION_MAX} tâches.
        </Text>
      )}
      <Text size="xs" c="dimmed">
        Les tâches s’enregistrent avec la fiche. Cocher toutes les tâches ne termine pas l’action.
      </Text>
    </section>
  );
}
