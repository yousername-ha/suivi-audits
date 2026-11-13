/* Chemins stratégiques (003-08 et 003-10) : source → parties prenantes → événements redoutés, tracés d'après les liens
   enregistrés dans l'étude. Un chemin se choisit dans la liste (clavier compris) ; seul le chemin choisi a un contour
   épais et un flux animé, les autres restent visibles. Les animations sont décoratives : pause, réglage « Animées /
   Automatiques / Arrêtées » (comme dans le parcours guidé) et respect du mouvement réduit du système. */
import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { MOUVEMENTS, useOngletVisible, type Mouvement } from '../../parcours-iso/mouvement';
import {
  ECART_X,
  HAUTEUR_NOEUD,
  LARGEUR_NOEUD,
  alternatives,
  construireChemins,
  disposer,
  trace,
  type Chemin,
  type ObjetVisuel,
} from './modele';
import { LegendePictos, PictoSource, libelleFamille } from './Pictos';

const COLONNES = ['Sources de risque', 'Parties prenantes', 'Événements redoutés'];
const tronque = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function Chemins({
  objets,
  choisi,
  onChoisir,
  onOuvrir,
  onVoirSynthese,
}: {
  objets: readonly ObjetVisuel[];
  choisi: string | null;
  onChoisir: (ref: string | null) => void;
  onOuvrir: (id: string) => void;
  onVoirSynthese: (ref: string) => void;
}) {
  const modele = useMemo(() => construireChemins(objets), [objets]);
  const { positions, largeur, hauteur } = useMemo(() => disposer(modele.etapes), [modele.etapes]);
  const [mouvement, setMouvement] = useState<Mouvement>('automatique');
  const [pause, setPause] = useState(false);
  const reduit = useReducedMotion();
  const visible = useOngletVisible();
  const actuel = modele.chemins.find((c) => c.ref === choisi) ?? null;
  const anime = !!actuel && !pause && visible && (mouvement === 'animees' || (mouvement === 'automatique' && !reduit));
  const dessines = modele.chemins.filter((c) => !c.manques.length);
  const aretes = [...modele.aretes].sort(
    (a, b) => Number(!!actuel && a.chemins.includes(actuel.ref)) - Number(!!actuel && b.chemins.includes(actuel.ref)),
  );
  if (!modele.chemins.length)
    return (
      <Text size="sm">
        Aucun scénario stratégique dans cette étude : ajoutez-en dans l’atelier 3 pour voir leurs chemins.
      </Text>
    );
  const alt = actuel && !actuel.manques.length ? alternatives(modele.chemins, actuel) : null;
  const nom = (r: string) => modele.etapes.get(r)?.libelle ?? 'Élément lié';
  const operationnels = actuel
    ? objets.filter((o) => o.kind === 'operational_scenario' && o.data.strategicScenarioRef === actuel.ref)
    : [];
  return (
    <Stack gap="sm" className="ebios-chemins" data-anime={anime ? 'oui' : 'non'}>
      <Text size="sm">
        Chaque chemin relie une source de risque, les parties prenantes de l’écosystème (dans l’ordre saisi) et les
        événements redoutés. Choisissez un chemin pour le mettre en évidence ; les autres restent visibles.
      </Text>
      <Group align="end" wrap="wrap">
        <Select
          label="Animations"
          description="Décoratives : elles ne signalent aucun état."
          allowDeselect={false}
          data={MOUVEMENTS}
          value={mouvement}
          onChange={(v) => v && setMouvement(v as Mouvement)}
        />
        <Button variant="default" onClick={() => setPause((p) => !p)} disabled={!actuel} aria-pressed={pause}>
          {pause ? 'Reprendre le mouvement' : 'Mettre en pause'}
        </Button>
        <Button variant="subtle" onClick={() => onChoisir(null)} disabled={!actuel}>
          Voir tous les chemins
        </Button>
      </Group>
      <div role="group" aria-label="Chemins stratégiques" className="ebios-chemins__liste">
        {modele.chemins.map((c) => (
          <Button
            key={c.ref}
            size="xs"
            variant={c.ref === choisi ? 'filled' : 'light'}
            aria-pressed={c.ref === choisi}
            onClick={() => onChoisir(c.ref === choisi ? null : c.ref)}
          >
            {c.nom}
            {c.manques.length ? ' (incomplet)' : ''}
          </Button>
        ))}
      </div>
      {modele.chemins.some((c) => c.manques.length) && (
        <Alert color="orange" title="Chemins incomplets">
          <ul>
            {modele.chemins
              .filter((c) => c.manques.length)
              .map((c) => (
                <li key={c.ref}>
                  {c.nom} : {c.manques.join(', ')}. Il n’est pas dessiné tant que ces données manquent.
                </li>
              ))}
          </ul>
        </Alert>
      )}
      {dessines.length > 0 && (
        <div className="ebios-chemins__toile">
          <svg
            viewBox={`0 0 ${largeur} ${hauteur + 22}`}
            role="img"
            aria-label={`Graphe de ${dessines.length} chemin(s) stratégique(s) ; le détail du chemin choisi est écrit sous le graphe.`}
          >
            <defs>
              <marker
                id="ebios-fleche"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0 0 10 5 0 10z" className="ebios-fleche" />
              </marker>
              <marker
                id="ebios-fleche-choisie"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 0 10 5 0 10z" className="ebios-fleche ebios-fleche--choisie" />
              </marker>
            </defs>
            {COLONNES.map((c, i) => (
              <text
                key={c}
                x={16 + i * (LARGEUR_NOEUD + ECART_X)}
                y={11}
                className="ebios-colonne"
                fontSize={10}
                fontWeight={600}
              >
                {c}
              </text>
            ))}
            <g transform="translate(0 22)">
              {aretes.map((a) => {
                const de = positions.get(a.de);
                const vers = positions.get(a.vers);
                if (!de || !vers) return null;
                const dedans = !!actuel && a.chemins.includes(actuel.ref);
                const d = trace(de, vers);
                return (
                  <g key={a.de + a.vers}>
                    <path
                      d={d}
                      className={dedans ? 'ebios-lien ebios-lien--choisi' : 'ebios-lien'}
                      markerEnd={dedans ? 'url(#ebios-fleche-choisie)' : 'url(#ebios-fleche)'}
                    />
                    {dedans && <path d={d} className="ebios-flux" pathLength={100} />}
                  </g>
                );
              })}
              {[...modele.etapes.values()].map((e) => {
                const p = positions.get(e.ref);
                if (!p) return null;
                const dedans = !!actuel && cheminContient(actuel, e.ref);
                return (
                  <g key={e.ref} className={dedans ? 'ebios-noeud ebios-noeud--choisi' : 'ebios-noeud'}>
                    <title>{`${e.libelle} — ${e.detail}`}</title>
                    <rect x={p.x} y={p.y} width={LARGEUR_NOEUD} height={HAUTEUR_NOEUD} rx={8} />
                    {e.famille && (
                      <g transform={`translate(${p.x + 8} ${p.y + 11})`}>
                        <PictoSource famille={e.famille} />
                      </g>
                    )}
                    <text
                      x={p.x + (e.famille ? 40 : 12)}
                      y={p.y + 19}
                      className="ebios-noeud__nom"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {tronque(e.libelle, e.famille ? 23 : 28)}
                    </text>
                    <text x={p.x + (e.famille ? 40 : 12)} y={p.y + 34} className="ebios-noeud__detail" fontSize={10}>
                      {tronque(e.detail, e.famille ? 28 : 33)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}
      <Text size="xs" c="dimmed">
        Les pictogrammes sont indicatifs, déduits de la catégorie saisie pour la source : ils ne changent ni la source
        ni son classement. Le sens de lecture est de gauche à droite, des sources vers les événements redoutés.
      </Text>
      <LegendePictos />
      {actuel && (
        <Stack gap="xs" aria-live="polite" data-testid="chemin-detail">
          <Text fw={600}>{actuel.nom}</Text>
          <Text size="sm">Gravité du scénario : {actuel.gravite}</Text>
          {!actuel.manques.length && (
            <ol aria-label="Étapes du chemin choisi">
              {actuel.source && (
                <li>
                  Source : {nom(actuel.source)}
                  {modele.etapes.get(actuel.source)?.famille
                    ? ` (pictogramme indicatif : ${libelleFamille(modele.etapes.get(actuel.source)!.famille!)})`
                    : ''}
                </li>
              )}
              {actuel.parties.map((p) => (
                <li key={p}>Partie prenante : {nom(p)}</li>
              ))}
              <li>Événement(s) redouté(s) : {actuel.evenements.map(nom).join(', ')}</li>
            </ol>
          )}
          {alt && (alt.memeEvenement.length > 0 || alt.memeSource.length > 0) && (
            <Stack gap="2xs">
              <Text size="sm" fw={600}>
                Chemins alternatifs
              </Text>
              {alt.memeEvenement.length > 0 && (
                <Text size="sm">
                  Vers le même événement redouté : {alt.memeEvenement.map((c) => c.nom).join(', ')}.
                </Text>
              )}
              {alt.memeSource.length > 0 && (
                <Text size="sm">Depuis la même source : {alt.memeSource.map((c) => c.nom).join(', ')}.</Text>
              )}
              <Group gap="xs">
                {[...new Set([...alt.memeEvenement, ...alt.memeSource])].map((c) => (
                  <Button key={c.ref} size="xs" variant="default" onClick={() => onChoisir(c.ref)}>
                    {`Comparer avec ${c.nom}`}
                  </Button>
                ))}
              </Group>
            </Stack>
          )}
          <Group gap="xs">
            <Button size="xs" variant="default" onClick={() => onOuvrir(actuel.ref.replace(/^object:/, ''))}>
              Ouvrir le scénario stratégique
            </Button>
          </Group>
          {operationnels.length > 0 && (
            <Stack gap="2xs">
              <Text size="sm" fw={600}>
                Scénarios opérationnels qui en découlent
              </Text>
              {operationnels.map((o) => (
                <Group key={o.id} gap="xs">
                  <Text size="sm">{o.name}</Text>
                  <Button size="xs" variant="subtle" onClick={() => onVoirSynthese('object:' + o.id)}>
                    Voir dans la synthèse
                  </Button>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function cheminContient(c: Chemin, ref: string) {
  return c.source === ref || c.parties.includes(ref) || c.evenements.includes(ref);
}
