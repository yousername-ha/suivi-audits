/* Vue Timeline des actions : une barre par action, du début à l'échéance, sur une période qui défile (le Gantt mensuel
   ne montre qu'un mois). Les actions sans aucune date sont listées à part ; rien n'est inventé pour les placer. */
import { Button, Group, Stack, Text } from '@mantine/core';
import type { BusinessPolicy, GrcObject, TaskData } from '@suivi/shared';

const JOUR = 86_400_000;
const LARGEUR_JOUR = 4;
const MARGE_GAUCHE = 260;
const HAUTEUR_LIGNE = 34;

export interface Frise {
  /** Premier jour affiché (minuit UTC) et nombre de jours. */
  debut: number;
  jours: number;
  /** Actions placées (au moins une date) et actions sans date. */
  placees: { objet: GrcObject; de: number; a: number }[];
  sansDate: GrcObject[];
}
const jourDe = (iso: string) => Math.floor(new Date(iso).getTime() / JOUR) * JOUR;

/** Calcul pur (testé) : bornes de la période affichée et position de chaque action. Marge d'une semaine de chaque côté,
    période bornée à deux ans pour garder une frise lisible. */
export function calculerFrise(items: GrcObject[], aujourdhui: number): Frise {
  const placees: Frise['placees'] = [];
  const sansDate: GrcObject[] = [];
  for (const objet of items) {
    const t = objet.data as Partial<TaskData>;
    const dates = [t.startAt, t.dueAt].filter((d): d is string => typeof d === 'string' && !!d).map(jourDe);
    if (!dates.length) sansDate.push(objet);
    else placees.push({ objet, de: Math.min(...dates), a: Math.max(...dates) });
  }
  const jourAuj = Math.floor(aujourdhui / JOUR) * JOUR;
  const bornes = [...placees.flatMap((p) => [p.de, p.a]), jourAuj];
  const debut = Math.min(...bornes) - 7 * JOUR;
  const fin = Math.min(Math.max(...bornes) + 7 * JOUR, debut + 730 * JOUR);
  placees.sort((x, y) => x.de - y.de || x.a - y.a);
  return { debut, jours: Math.round((fin - debut) / JOUR) + 1, placees, sansDate };
}

export function Timeline({
  items,
  policy,
  onOpen,
}: {
  items: GrcObject[];
  policy: BusinessPolicy;
  onOpen: (o: GrcObject) => void;
}) {
  const frise = calculerFrise(items, Date.now());
  const x = (jour: number) => MARGE_GAUCHE + ((jour - frise.debut) / JOUR) * LARGEUR_JOUR;
  const largeur = MARGE_GAUCHE + frise.jours * LARGEUR_JOUR + 20;
  const hauteur = frise.placees.length * HAUTEUR_LIGNE + 56;
  // Un repère par mois, au premier jour du mois.
  const mois: { jour: number; libelle: string }[] = [];
  for (
    let d = new Date(frise.debut);
    d.getTime() <= frise.debut + (frise.jours - 1) * JOUR;
    d.setUTCDate(d.getUTCDate() + 1)
  )
    if (d.getUTCDate() === 1)
      mois.push({
        jour: d.getTime(),
        libelle: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      });
  const aujourdhui = Math.floor(Date.now() / JOUR) * JOUR;
  return (
    <Stack>
      <div
        className="grc-timeline"
        role="region"
        tabIndex={0}
        aria-label="Timeline des actions, défilement horizontal possible"
      >
        <svg role="img" aria-label="Timeline des actions, du début à l’échéance" width={largeur} height={hauteur}>
          {mois.map((m) => (
            <g key={m.jour}>
              <line x1={x(m.jour)} x2={x(m.jour)} y1="28" y2={hauteur} className="grc-timeline__mois" />
              <text x={x(m.jour) + 3} y="20">
                {m.libelle}
              </text>
            </g>
          ))}
          <line x1={x(aujourdhui)} x2={x(aujourdhui)} y1="28" y2={hauteur} className="grc-timeline__aujourdhui" />
          {frise.placees.map(({ objet, de, a }, i) => {
            const t = objet.data as Partial<TaskData>;
            const y = 36 + i * HAUTEUR_LIGNE;
            const couleur = policy.statuses.find((s) => s.id === t.status)?.color ?? 'var(--carte-vert-accent)';
            return (
              <g
                key={objet.id}
                role="button"
                tabIndex={0}
                aria-label={objet.name}
                onClick={() => onOpen(objet)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(objet);
                  }
                }}
              >
                <text x="5" y={y + 15}>
                  {objet.name.length > 34 ? objet.name.slice(0, 33) + '…' : objet.name}
                </text>
                <rect
                  x={x(de)}
                  y={y}
                  width={Math.max(8, x(a) - x(de) + LARGEUR_JOUR)}
                  height="22"
                  rx="5"
                  fill={couleur}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {frise.sansDate.length > 0 && (
        <Stack gap="xs">
          <Text size="sm">Sans date de début ni d’échéance ({frise.sansDate.length})</Text>
          <Group gap="xs">
            {frise.sansDate.map((o) => (
              <Button key={o.id} variant="subtle" size="compact-sm" onClick={() => onOpen(o)}>
                {o.name}
              </Button>
            ))}
          </Group>
        </Stack>
      )}
    </Stack>
  );
}
