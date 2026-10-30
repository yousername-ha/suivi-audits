/* Mode « Modifier la disposition » du tableau de bord de l'accueil (ADR 0078, lot 2a) : déplacer les dalles au glisser
   (évènements de pointeur, souris ou doigt) ou au clavier (flèches, Origine, Fin sur la poignée), changer leur largeur,
   les masquer et les réafficher. Enregistre la disposition personnelle ; un administrateur peut aussi la proposer à
   tous. Aucune donnée n'est enregistrée : seulement l'ordre, les largeurs et les dalles masquées. Le glissé réordonne
   la grille en direct, sans élément positionné par script (CSP, ADR 0006). */
import { Alert, Button, Group, NativeSelect, Text, VisuallyHidden } from '@mantine/core';
import {
  completerDisposition,
  dallesAffichees,
  deplacerDalle,
  deplacerDalleAuClavier,
  LARGEURS_DALLE,
  LIBELLES_LARGEUR,
  memesDispositions,
  modifierDalle,
  type Disposition,
  type DispositionsOut,
  type IdDalle,
  type Synthese,
} from '@suivi/shared';
import { ConfirmButton, ErrorAlert, type LargeurDalle } from '@suivi/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { api, del } from '../api';
import { dallesTableauDeBord } from './TableauDeBord';

export const CLE_DISPOSITION = ['tableau-de-bord', 'disposition'] as const;
const URL_PERSO = '/api/tableau-de-bord/disposition';
const URL_DEFAUT = '/api/admin/tableau-de-bord/disposition-par-defaut';

const SENS_TOUCHES: Record<string, -1 | 1 | 'debut' | 'fin'> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
  Home: 'debut',
  End: 'fin',
};

function IconePoignee() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="5.5" cy="3.5" r="1.5" />
      <circle cx="10.5" cy="3.5" r="1.5" />
      <circle cx="5.5" cy="8" r="1.5" />
      <circle cx="10.5" cy="8" r="1.5" />
      <circle cx="5.5" cy="12.5" r="1.5" />
      <circle cx="10.5" cy="12.5" r="1.5" />
    </svg>
  );
}

export function EditionTableauDeBord({
  s,
  dispositions,
  peutDefinirDefaut,
  onFin,
}: {
  s: Synthese;
  dispositions: DispositionsOut;
  peutDefinirDefaut: boolean;
  onFin: () => void;
}) {
  const qc = useQueryClient();
  const aide = useId();
  const dalles = useMemo(() => dallesTableauDeBord(s), [s]);
  const parId = useMemo(() => new Map(dalles.map((x) => [x.id, x])), [dalles]);
  const disponibles = useMemo(() => new Set<IdDalle>(parId.keys()), [parId]);
  // Départ : la disposition affichée (la sienne, sinon celle de l'organisation, sinon la standard), complète.
  const depart = useMemo(
    () =>
      completerDisposition(
        (dispositions.personnelle ?? dispositions.organisation)?.disposition ?? null,
        Object.fromEntries(dalles.map((x) => [x.id, x.largeur])) as Partial<Record<IdDalle, LargeurDalle>>,
      ),
    [dispositions, dalles],
  );
  const [d, setD] = useState<Disposition>(depart);
  const [glissee, setGlissee] = useState<IdDalle | null>(null);
  const [annonce, setAnnonce] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const vues = dallesAffichees(d, disponibles);
  const masquees = d.dalles.filter((x) => x.masquee && disponibles.has(x.id));
  const titre = (id: IdDalle) => parId.get(id)?.titre ?? id;
  const modifiee = !memesDispositions(d, depart);

  const annoncerRang = (disposition: Disposition, id: IdDalle) => {
    const ids = dallesAffichees(disposition, disponibles).map((x) => x.id);
    setAnnonce(`« ${titre(id)} » : position ${ids.indexOf(id) + 1} sur ${ids.length}.`);
  };

  async function agir(fn: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: CLE_DISPOSITION });
      onFin();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }

  const surTouche = (id: IdDalle) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const sens = SENS_TOUCHES[e.key];
    if (!sens) return;
    e.preventDefault();
    const r = deplacerDalleAuClavier(d, id, sens, disponibles);
    setD(r.disposition);
    setAnnonce(`« ${titre(id)} » : position ${r.rang} sur ${r.total}.`);
  };

  const surPointeurBas = (id: IdDalle) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setGlissee(id);
  };
  const surPointeurDeplace = (id: IdDalle) => (e: PointerEvent<HTMLButtonElement>) => {
    if (glissee !== id) return;
    const sous = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-dalle]');
    const cible = sous?.dataset.dalle as IdDalle | undefined;
    if (!cible || cible === id || !disponibles.has(cible)) return;
    // Vers une dalle plus loin : se placer après elle ; plus haut : avant elle (pas d'oscillation au survol).
    const ids = vues.map((x) => x.id);
    setD((cur) => deplacerDalle(cur, id, cible, ids.indexOf(cible) > ids.indexOf(id)));
  };
  const surPointeurHaut = (id: IdDalle) => () => {
    if (glissee !== id) return;
    setGlissee(null);
    annoncerRang(d, id);
  };

  return (
    <div className="tdb tdb--edition">
      <div className="tdb-edition-barre" role="region" aria-label="Modifier la disposition du tableau de bord">
        <Text size="sm" id={aide}>
          Glissez une dalle par sa poignée, ou placez-vous sur la poignée et utilisez les flèches du clavier (Origine et
          Fin : premier et dernier rang). Les dalles sans données lisibles avec vos droits n’apparaissent pas.
        </Text>
        <Group gap="xs">
          <Button
            disabled={!modifiee || pending}
            loading={pending}
            onClick={() =>
              void agir(() =>
                api('PUT', URL_PERSO, { body: { disposition: d }, ifMatch: dispositions.personnelle?.version ?? 0 }),
              )
            }
          >
            Enregistrer
          </Button>
          <Button variant="default" disabled={pending} onClick={onFin}>
            Annuler
          </Button>
          {dispositions.personnelle && (
            <ConfirmButton
              variant="default"
              color="gray"
              message="Revenir à la disposition par défaut ? Votre disposition personnelle sera supprimée."
              onConfirm={() => void agir(() => del(URL_PERSO))}
            >
              Revenir à la disposition par défaut
            </ConfirmButton>
          )}
          {peutDefinirDefaut && (
            <ConfirmButton
              variant="light"
              color="blue"
              message="Proposer cette disposition à tous ? Elle s’affichera pour chaque personne qui n’a pas la sienne."
              onConfirm={() =>
                void agir(() =>
                  api('PUT', URL_DEFAUT, {
                    body: { disposition: d },
                    ifMatch: dispositions.organisation?.version ?? 0,
                  }),
                )
              }
            >
              Proposer cette disposition à tous
            </ConfirmButton>
          )}
          {peutDefinirDefaut && dispositions.organisation && (
            <ConfirmButton
              variant="default"
              color="gray"
              message="Rétablir la disposition standard pour tous ceux qui n’ont pas la leur ?"
              onConfirm={() => void agir(() => del(URL_DEFAUT))}
            >
              Rétablir la disposition standard pour tous
            </ConfirmButton>
          )}
        </Group>
        <ErrorAlert error={error} />
        {masquees.length > 0 && (
          <div className="tdb-masquees" role="group" aria-label="Dalles masquées">
            <Text size="sm" fw={600}>
              Dalles masquées :
            </Text>
            {masquees.map((x) => (
              <Button
                key={x.id}
                size="compact-sm"
                variant="light"
                onClick={() => {
                  setD((cur) => modifierDalle(cur, x.id, { masquee: false }));
                  setAnnonce(`« ${titre(x.id)} » est de nouveau affichée.`);
                }}
              >
                Afficher « {titre(x.id)} »
              </Button>
            ))}
          </div>
        )}
        {vues.length === 0 && (
          <Alert color="yellow" role="status">
            Toutes les dalles sont masquées : réaffichez-en au moins une pour garder un tableau de bord utile.
          </Alert>
        )}
        <VisuallyHidden aria-live="polite">{annonce}</VisuallyHidden>
      </div>
      <div className="grille-cartes tdb-grille">
        {vues.map((x) => {
          const dalle = parId.get(x.id)!;
          return (
            <div
              key={x.id}
              data-dalle={x.id}
              className={`tdb-l${x.largeur} tdb-case${glissee === x.id ? ' tdb-case--glissee' : ''}`}
            >
              <div className="tdb-case-outils">
                <button
                  type="button"
                  className="tdb-poignee"
                  aria-label={`Déplacer « ${dalle.titre} »`}
                  aria-describedby={aide}
                  onKeyDown={surTouche(x.id)}
                  onPointerDown={surPointeurBas(x.id)}
                  onPointerMove={surPointeurDeplace(x.id)}
                  onPointerUp={surPointeurHaut(x.id)}
                  onPointerCancel={surPointeurHaut(x.id)}
                >
                  <IconePoignee />
                </button>
                <NativeSelect
                  className="tdb-case-largeur"
                  size="xs"
                  aria-label={`Largeur de « ${dalle.titre} »`}
                  value={String(x.largeur)}
                  data={LARGEURS_DALLE.map((l) => ({ value: String(l), label: LIBELLES_LARGEUR[l] }))}
                  onChange={(e) => {
                    const largeur = Number(e.currentTarget.value) as LargeurDalle;
                    setD((cur) => modifierDalle(cur, x.id, { largeur }));
                  }}
                />
                <Button
                  size="compact-sm"
                  variant="subtle"
                  aria-label={`Masquer « ${dalle.titre} »`}
                  onClick={() => {
                    setD((cur) => modifierDalle(cur, x.id, { masquee: true }));
                    setAnnonce(`« ${dalle.titre} » est masquée.`);
                  }}
                >
                  Masquer
                </Button>
              </div>
              {dalle.rendu(x.largeur)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
