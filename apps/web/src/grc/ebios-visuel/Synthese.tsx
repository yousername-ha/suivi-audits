/* Suivi ligne par ligne, matrice et cercle (003-07) : trois représentations des mêmes scénarios opérationnels, avec une
   sélection et des filtres communs. La liste est l'équivalent complet du graphique. Le cercle répartit les scénarios
   régulièrement dans l'ordre alphabétique : la position ne traduit aucun score, les valeurs sont écrites dans la liste. */
import { Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { ECHELLE_GRAVITE, ECHELLE_VRAISEMBLANCE } from '@suivi/shared';
import { DataTable } from '@suivi/ui';
import { useMemo, useState } from 'react';
import { filtrer, lignes, nonPlaces, pointsCercle, type Filtre, type Ligne, type ObjetVisuel } from './modele';

const TEINTE_GRAVITE: Record<number, string> = {
  1: 'graph-vert',
  2: 'graph-bleu',
  3: 'graph-orange',
  4: 'graph-rouge',
};
const classeGravite = (g: number | null) => (g ? TEINTE_GRAVITE[g]! : 'graph-gris');
const NIVEAUX_G = ECHELLE_GRAVITE.map((l, i) => ({ value: String(i + 1), label: `G${i + 1} — ${l}` }));
const NIVEAUX_V = ECHELLE_VRAISEMBLANCE.map((l, i) => ({ value: String(i + 1), label: `V${i + 1} — ${l}` }));

export function Synthese({
  objets,
  choisi,
  onChoisir,
  onOuvrir,
  onVoirChemin,
  actions,
}: {
  objets: readonly ObjetVisuel[];
  choisi: string | null;
  onChoisir: (ref: string | null) => void;
  onOuvrir: (id: string) => void;
  onVoirChemin: (strategiqueRef: string) => void;
  actions?: (l: Ligne) => React.ReactNode;
}) {
  const toutes = useMemo(() => lignes(objets), [objets]);
  const [filtre, setFiltre] = useState<Filtre>({ gravite: null, vraisemblance: null });
  const visibles = filtrer(toutes, filtre);
  const rang = new Map(toutes.map((l, i) => [l.ref, i + 1]));
  const sansRang = nonPlaces(toutes);
  const actuelle = toutes.find((l) => l.ref === choisi) ?? null;
  const points = pointsCercle(toutes.length, 118, 150, 150);
  const casesMatrice = new Map<string, Ligne[]>();
  for (const l of visibles)
    if (l.gravite && l.vraisemblance)
      casesMatrice.set(`${l.gravite}-${l.vraisemblance}`, [
        ...(casesMatrice.get(`${l.gravite}-${l.vraisemblance}`) ?? []),
        l,
      ]);
  if (!toutes.length)
    return (
      <Text size="sm">
        La synthèse apparaît dès qu’un scénario opérationnel est saisi dans l’atelier 4 : il apparaîtra alors dans la
        liste, la matrice et le cercle.
      </Text>
    );
  return (
    <Stack gap="md" data-testid="synthese-ebios">
      <Group align="end" wrap="wrap">
        <Select
          label="Gravité"
          placeholder="Toutes"
          clearable
          data={NIVEAUX_G}
          value={filtre.gravite ? String(filtre.gravite) : null}
          onChange={(v) => setFiltre((f) => ({ ...f, gravite: v ? Number(v) : null }))}
        />
        <Select
          label="Vraisemblance"
          placeholder="Toutes"
          clearable
          data={NIVEAUX_V}
          value={filtre.vraisemblance ? String(filtre.vraisemblance) : null}
          onChange={(v) => setFiltre((f) => ({ ...f, vraisemblance: v ? Number(v) : null }))}
        />
        <Button variant="subtle" onClick={() => setFiltre({ gravite: null, vraisemblance: null })}>
          Effacer les filtres
        </Button>
        <Text size="sm" role="status">
          {visibles.length} scénario(s) affiché(s) sur {toutes.length}.
        </Text>
      </Group>
      <div className="ebios-synthese">
        <div className="ebios-cercle">
          <svg
            viewBox="0 0 300 300"
            role="group"
            aria-label={`Cercle de ${toutes.length} scénario(s) opérationnel(s) ; la liste ci-dessous en donne les valeurs.`}
          >
            <circle cx={150} cy={150} r={118} className="ebios-cercle__anneau" />
            <text x={150} y={146} className="ebios-cercle__centre" fontSize={22} fontWeight={650}>
              {toutes.length}
            </text>
            <text x={150} y={162} className="ebios-cercle__sous-centre" fontSize={9}>
              scénario(s)
            </text>
            {toutes.map((l, i) => {
              const p = points[i]!;
              const filtre_ok = visibles.includes(l);
              const choisie = l.ref === choisi;
              return (
                <g
                  key={l.ref}
                  role="button"
                  tabIndex={0}
                  aria-pressed={choisie}
                  aria-label={`Scénario ${rang.get(l.ref)} : ${l.nom}, gravité ${l.graviteTexte}, vraisemblance ${l.vraisemblanceTexte}`}
                  className={`ebios-point ${classeGravite(l.gravite)}${choisie ? ' ebios-point--choisi' : ''}${filtre_ok ? '' : ' ebios-point--masque'}`}
                  onClick={() => onChoisir(choisie ? null : l.ref)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChoisir(choisie ? null : l.ref);
                    }
                  }}
                >
                  <circle cx={p.x} cy={p.y} r={choisie ? 17 : 14} />
                  <text x={p.x} y={p.y + 4} className="ebios-point__rang" fontSize={11} fontWeight={700}>
                    {rang.get(l.ref)}
                  </text>
                </g>
              );
            })}
          </svg>
          <ul className="graph-legende-ligne" aria-label="Légende des couleurs du cercle">
            {NIVEAUX_G.map((n, i) => (
              <li key={n.value}>
                <span className={`graph-pastille ${TEINTE_GRAVITE[i + 1]}`} aria-hidden="true" /> {n.label}
              </li>
            ))}
            <li>
              <span className="graph-pastille graph-gris" aria-hidden="true" /> Gravité non rangée
            </li>
          </ul>
          <Text size="xs" c="dimmed">
            Couleur = gravité du scénario stratégique. Les scénarios sont répartis dans l’ordre alphabétique : leur
            position ne dit rien du niveau de risque.
          </Text>
        </div>
        <DataTable label="Scénarios opérationnels par gravité et vraisemblance">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Gravité \ vraisemblance</Table.Th>
                {ECHELLE_VRAISEMBLANCE.map((l, i) => (
                  <Table.Th key={l}>{`V${i + 1}`}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[4, 3, 2, 1].map((g) => (
                <Table.Tr key={g}>
                  <Table.Th scope="row">{`G${g} — ${ECHELLE_GRAVITE[g - 1]}`}</Table.Th>
                  {[1, 2, 3, 4].map((v) => (
                    <Table.Td key={v}>
                      <Group gap="2xs">
                        {(casesMatrice.get(`${g}-${v}`) ?? []).map((l) => (
                          <Button
                            key={l.ref}
                            size="compact-xs"
                            variant={l.ref === choisi ? 'filled' : 'light'}
                            aria-pressed={l.ref === choisi}
                            aria-label={`Scénario ${rang.get(l.ref)} : ${l.nom}`}
                            onClick={() => onChoisir(l.ref === choisi ? null : l.ref)}
                          >
                            {rang.get(l.ref)}
                          </Button>
                        ))}
                      </Group>
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </DataTable>
      </div>
      {sansRang.length > 0 && (
        <Text size="sm" data-testid="non-places">
          Non placés dans la matrice (gravité ou vraisemblance sans rang de 1 à 4) :{' '}
          {sansRang.map((l) => `${rang.get(l.ref)}. ${l.nom}`).join(' ; ')}.
        </Text>
      )}
      <DataTable label="Liste des scénarios opérationnels">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>N°</Table.Th>
              <Table.Th>Scénario opérationnel</Table.Th>
              <Table.Th>Gravité</Table.Th>
              <Table.Th>Vraisemblance</Table.Th>
              <Table.Th>Scénario stratégique</Table.Th>
              {actions && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibles.map((l) => (
              <Table.Tr
                key={l.ref}
                data-selected={l.ref === choisi ? 'true' : undefined}
                className={l.ref === choisi ? 'ebios-ligne--choisie' : undefined}
              >
                <Table.Td>{rang.get(l.ref)}</Table.Td>
                <Table.Td>
                  <Button
                    variant="subtle"
                    size="compact-sm"
                    aria-pressed={l.ref === choisi}
                    onClick={() => onChoisir(l.ref === choisi ? null : l.ref)}
                  >
                    {l.nom}
                  </Button>
                </Table.Td>
                <Table.Td>{l.graviteTexte}</Table.Td>
                <Table.Td>{l.vraisemblanceTexte}</Table.Td>
                <Table.Td>{l.strategique}</Table.Td>
                {actions && <Table.Td>{actions(l)}</Table.Td>}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </DataTable>
      {!visibles.length && <Text size="sm">Aucun scénario ne correspond aux filtres.</Text>}
      {actuelle && (
        <Group gap="xs" aria-live="polite">
          <Text size="sm">
            Sélection : {rang.get(actuelle.ref)}. {actuelle.nom}
          </Text>
          <Button size="xs" variant="default" onClick={() => onOuvrir(actuelle.id)}>
            Ouvrir
          </Button>
          {actuelle.strategiqueRef && (
            <Button size="xs" variant="light" onClick={() => onVoirChemin(actuelle.strategiqueRef)}>
              Voir son chemin
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
