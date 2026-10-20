/* Graphe des périmètres : un arbre (parent → enfants) de cartes de synthèse. Les compteurs viennent du serveur
   (`GET /api/grc/perimetres/synthese`) : un compteur absent s'affiche « indisponible », jamais comme un zéro. La création
   passe par le même formulaire que la liste (même route, même identifiant) ; le graphe n'a pas de modèle propre. */
import { Button, Group, Text } from '@mantine/core';
import { arbre, LIBELLES_NIVEAU, type CartePerimetre, type NiveauPerimetre } from '@suivi/shared';

const LARGEUR = 264;
const HAUTEUR = 284;
const ECART_X = 24;
const ECART_Y = 56;

interface Place {
  carte: CartePerimetre;
  x: number;
  y: number;
  parent: string | null;
}

/** Disposition en arbre : les feuilles se suivent de gauche à droite, chaque parent est centré sur ses enfants. */
export function disposer(cartes: readonly CartePerimetre[]) {
  const racines = arbre(cartes.map((c) => ({ ...c, id: c.id, parentId: c.parentId, name: c.name })));
  const places: Place[] = [];
  let colonne = 0;
  const poser = (n: (typeof racines)[number], parent: string | null): number => {
    const enfants = n.enfants.map((e) => poser(e, n.item.id));
    const x = enfants.length ? (enfants[0]! + enfants[enfants.length - 1]!) / 2 : colonne++ * (LARGEUR + ECART_X);
    places.push({ carte: cartes.find((c) => c.id === n.item.id)!, x, y: n.profondeur * (HAUTEUR + ECART_Y), parent });
    return x;
  };
  racines.forEach((r) => poser(r, null));
  const profondeur = places.length ? Math.max(...places.map((p) => p.y)) + HAUTEUR : HAUTEUR;
  const largeur = places.length ? Math.max(...places.map((p) => p.x)) + LARGEUR : LARGEUR;
  return { places, largeur, hauteur: profondeur };
}

const n = (v: number) => v.toLocaleString('fr-FR');
const retard = (c: { ouverts: number; enRetard: number }) => `${n(c.ouverts)} ouverte(s) · ${n(c.enRetard)} en retard`;

/** Lignes de compteurs d'une carte ; `null` : indisponible (droit manquant ou donnée non mesurable). */
export function lignesCompteurs(
  c: CartePerimetre['compteurs'],
): { libelle: string; valeur: string; alerte: boolean }[] {
  const indisponible = 'indisponible';
  return [
    {
      libelle: 'Actions',
      valeur: c.actions ? retard(c.actions) : indisponible,
      alerte: !!c.actions && c.actions.enRetard > 0,
    },
    {
      libelle: 'Tâches récurrentes',
      valeur: c.recurrentes
        ? `${n(c.recurrentes.series)} série(s) · ${retard(c.recurrentes.occurrences)}`
        : indisponible,
      alerte: !!c.recurrentes && c.recurrentes.occurrences.enRetard > 0,
    },
    {
      libelle: 'Écarts',
      valeur: c.ecarts ? `${n(c.ecarts.ouverts)} ouvert(s) · ${n(c.ecarts.enRetard)} en retard` : indisponible,
      alerte: !!c.ecarts && c.ecarts.enRetard > 0,
    },
    {
      libelle: 'Continuité',
      valeur: c.continuite ? `${n(c.continuite.bia)} BIA · ${n(c.continuite.plans)} plan(s)` : indisponible,
      alerte: false,
    },
    {
      libelle: 'Conformité',
      valeur: c.conformite
        ? `${n(c.conformite.couvertes)} / ${n(c.conformite.exigences)} exigences couvertes`
        : indisponible,
      alerte: false,
    },
  ];
}

export function CartesPerimetres({
  cartes,
  total,
  affiche,
  onChoisir,
  onCreerEnfant,
}: {
  cartes: readonly CartePerimetre[];
  /** Total sans doublon sur l'ensemble des périmètres accessibles (jamais la somme des cartes). */
  total?: CartePerimetre['compteurs'];
  affiche: string;
  onChoisir: (id: string) => void;
  /** Absent : la personne ne peut pas créer de périmètre. */
  onCreerEnfant?: (parentId: string) => void;
}) {
  const { places, largeur, hauteur } = disposer(cartes);
  if (!places.length) return <Text>Aucun périmètre accessible.</Text>;
  return (
    <>
      {total && (
        <dl className="graphe-total" aria-label="Total sans doublon sur tous les périmètres accessibles">
          {lignesCompteurs(total)
            .filter((l) => l.libelle !== 'Conformité')
            .map((l) => (
              <div key={l.libelle}>
                <dt>Total · {l.libelle}</dt>
                <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
              </div>
            ))}
          <Text size="xs">
            Chaque élément n’est compté qu’une fois : un registre partagé entre plusieurs périmètres figure dans chacune
            de leurs cartes, mais une seule fois ici.
          </Text>
        </dl>
      )}
      <div className="table-wrap" role="region" aria-label="Graphe des périmètres, défilement possible" tabIndex={0}>
        <svg
          className="graphe-perimetres"
          width={largeur}
          height={hauteur}
          viewBox={`0 0 ${largeur} ${hauteur}`}
          role="group"
          aria-label="Périmètres et leurs compteurs de synthèse"
        >
          {places
            .filter((p) => p.parent)
            .map((p) => {
              const parent = places.find((q) => q.carte.id === p.parent)!;
              const x1 = parent.x + LARGEUR / 2,
                y1 = parent.y + HAUTEUR,
                x2 = p.x + LARGEUR / 2,
                y2 = p.y,
                milieu = (y1 + y2) / 2;
              return (
                <path
                  key={p.carte.id}
                  className="graphe-lien"
                  d={`M${x1} ${y1} V${milieu} H${x2} V${y2}`}
                  fill="none"
                  aria-hidden="true"
                />
              );
            })}
          {places.map(({ carte, x, y }) => (
            <foreignObject key={carte.id} x={x} y={y} width={LARGEUR} height={HAUTEUR}>
              <div className="graphe-carte" role="group" aria-label={`Périmètre ${carte.name}`}>
                <Text fw={600} lineClamp={1} title={carte.name}>
                  {carte.name}
                </Text>
                <Text size="xs" lineClamp={1}>
                  {LIBELLES_NIVEAU[carte.entityKind as NiveauPerimetre] ?? carte.entityKind}
                  {carte.nature ? ` · ${carte.nature}` : ''}
                </Text>
                <dl className="graphe-compteurs">
                  {lignesCompteurs(carte.compteurs).map((l) => (
                    <div key={l.libelle}>
                      <dt>{l.libelle}</dt>
                      <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
                    </div>
                  ))}
                </dl>
                {carte.sousPerimetres > 0 && (
                  <dl
                    className="graphe-compteurs graphe-ensemble"
                    role="group"
                    aria-label={`Total de ${carte.name} avec ses sous-périmètres, chaque élément une seule fois`}
                  >
                    <Text size="xs" fw={600}>
                      Total avec {n(carte.sousPerimetres)} sous-périmètre(s)
                    </Text>
                    {lignesCompteurs(carte.total)
                      .filter((l) => l.libelle !== 'Conformité')
                      .map((l) => (
                        <div key={l.libelle}>
                          <dt>{l.libelle}</dt>
                          <dd className={l.alerte ? 'graphe-alerte' : undefined}>{l.valeur}</dd>
                        </div>
                      ))}
                  </dl>
                )}
                <Group gap="2xs" wrap="nowrap">
                  {carte.id !== affiche && (
                    <Button
                      size="compact-xs"
                      variant="default"
                      aria-label={`Afficher le périmètre ${carte.name} dans le Pilotage`}
                      onClick={() => onChoisir(carte.id)}
                    >
                      Afficher
                    </Button>
                  )}
                  {onCreerEnfant && (
                    <Button
                      size="compact-xs"
                      variant="default"
                      aria-label={`Ajouter un périmètre enfant à ${carte.name}`}
                      onClick={() => onCreerEnfant(carte.id)}
                    >
                      Ajouter un enfant
                    </Button>
                  )}
                </Group>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
    </>
  );
}
