/* Vue Timeline des actions : une barre par action, du début à l'échéance, sur une période qui défile (le Gantt mensuel
   ne montre qu'un mois). Les actions sans aucune date sont listées à part ; rien n'est inventé pour les placer. */
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import type { BusinessPolicy, GrcObject, TaskData } from '@suivi/shared';
import { enRetard, libelleStatut, symboleStatut } from './etat-action';

const JOUR = 86_400_000;
const LARGEUR_JOUR = 4;
const MARGE_GAUCHE = 280;
const HAUTEUR_LIGNE = 34;

export interface Frise {
  /** Premier jour affiché (minuit UTC) et nombre de jours. */
  debut: number;
  jours: number;
  /** Actions placées (au moins une date) et actions sans date. */
  placees: { objet: GrcObject; de: number; a: number }[];
  sansDate: GrcObject[];
  /** Actions dont les dates ne se placent pas, avec la raison : jamais corrigées ni inversées en silence. */
  incoherentes: { objet: GrcObject; raison: RaisonDate }[];
  /** Vrai quand la période a été bornée à deux ans : des actions peuvent alors tomber hors de la période affichée. */
  tronquee: boolean;
  /** Actions placées dont la barre est entièrement hors de la période affichée (non dessinées). */
  horsPeriode: GrcObject[];
}
type RaisonDate = 'debut-apres-echeance' | 'date-illisible';
const RAISON_DATE_LABELS: Record<RaisonDate, string> = {
  'debut-apres-echeance': 'le début est postérieur à l’échéance',
  'date-illisible': 'une date est illisible',
};
const jourDe = (iso: string) => Math.floor(new Date(iso).getTime() / JOUR) * JOUR;

/** Calcul pur (testé) : bornes de la période affichée et position de chaque action. Marge d'une semaine de chaque côté,
    période bornée à deux ans pour garder une frise lisible. */
export function calculerFrise(items: GrcObject[], aujourdhui: number): Frise {
  const placees: Frise['placees'] = [];
  const sansDate: GrcObject[] = [];
  const incoherentes: Frise['incoherentes'] = [];
  for (const objet of items) {
    const t = objet.data as Partial<TaskData>;
    const brutes = [t.startAt, t.dueAt].filter((d): d is string => typeof d === 'string' && !!d);
    if (!brutes.length) {
      sansDate.push(objet);
      continue;
    }
    const dates = brutes.map(jourDe);
    if (dates.some((d) => !Number.isFinite(d))) {
      incoherentes.push({ objet, raison: 'date-illisible' });
      continue;
    }
    // Début et échéance renseignés : un début après l'échéance est une erreur de saisie, pas une barre à l'envers.
    if (brutes.length === 2 && dates[0]! > dates[1]!) {
      incoherentes.push({ objet, raison: 'debut-apres-echeance' });
      continue;
    }
    placees.push({ objet, de: Math.min(...dates), a: Math.max(...dates) });
  }
  const jourAuj = Math.floor(aujourdhui / JOUR) * JOUR;
  const bornes = [...placees.flatMap((p) => [p.de, p.a]), jourAuj];
  const debut = Math.min(...bornes) - 7 * JOUR;
  const finComplete = Math.max(...bornes) + 7 * JOUR;
  const fin = Math.min(finComplete, debut + 730 * JOUR);
  placees.sort((x, y) => x.de - y.de || x.a - y.a);
  const horsPeriode = placees.filter((p) => p.de > fin || p.a < debut).map((p) => p.objet);
  return {
    debut,
    jours: Math.round((fin - debut) / JOUR) + 1,
    placees: placees.filter((p) => !horsPeriode.includes(p.objet)),
    sansDate,
    incoherentes,
    tronquee: finComplete > fin,
    horsPeriode,
  };
}

/** Phrase lue pour une action : intitulé, état, retard et période (jamais la couleur seule). */
function descriptionAction(o: GrcObject, policy: BusinessPolicy, retard: boolean, fr: (jour: number) => string) {
  const t = o.data as Partial<TaskData>;
  const periode = [t.startAt && `du ${fr(jourDe(t.startAt))}`, t.dueAt && `échéance le ${fr(jourDe(t.dueAt))}`]
    .filter(Boolean)
    .join(', ');
  return `${o.name}, ${libelleStatut(policy, o).toLowerCase()}${retard ? ', en retard' : ''}${periode ? ', ' + periode : ''}`;
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
  const maintenant = Date.now();
  const frise = calculerFrise(items, maintenant);
  const x = (jour: number) => ((jour - frise.debut) / JOUR) * LARGEUR_JOUR;
  const largeurFrise = frise.jours * LARGEUR_JOUR + 20;
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
  const aujourdhui = Math.floor(maintenant / JOUR) * JOUR;
  const fr = (jour: number) => new Date(jour).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  const ouvrir = (objet: GrcObject) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => onOpen(objet),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(objet);
      }
    },
  });
  return (
    <Stack>
      <Text size="sm">
        Période affichée : du {fr(frise.debut)} au {fr(frise.debut + (frise.jours - 1) * JOUR)}.
      </Text>
      <Group gap="md" role="group" aria-label="Légende : état de l’action, symbole et couleur de la barre">
        {policy.statuses.map((st) => (
          <Group key={st.id} gap={6} wrap="nowrap">
            <svg width="14" height="14" aria-hidden="true">
              <rect width="14" height="14" rx="3" fill={st.color} />
            </svg>
            <Text size="xs">
              {symboleStatut(policy, st.id)} {st.label}
            </Text>
          </Group>
        ))}
        <Text size="xs" className="grc-timeline__retard-legende">
          ! En retard : barre cerclée de rouge
        </Text>
      </Group>
      {frise.tronquee && (
        <Alert color="orange" role="status">
          La période est limitée à deux ans pour rester lisible : les échéances plus lointaines ne sont pas dessinées
          {frise.horsPeriode.length ? ` (${frise.horsPeriode.length} action(s) hors période, listées ci-dessous)` : ''}.
        </Alert>
      )}
      {frise.incoherentes.length > 0 && (
        <Alert color="red" role="alert" title="Dates à corriger : ces actions ne peuvent pas être placées">
          {frise.incoherentes.map(({ objet, raison }) => (
            <Group key={objet.id} gap="xs">
              <Text size="sm">
                {objet.name} : {RAISON_DATE_LABELS[raison]}.
              </Text>
              <Button variant="subtle" size="compact-sm" onClick={() => onOpen(objet)}>
                Corriger les dates
              </Button>
            </Group>
          ))}
        </Alert>
      )}
      <div
        className="grc-timeline"
        role="region"
        tabIndex={0}
        aria-label="Timeline des actions, défilement possible dans les deux sens"
      >
        <svg
          className="grc-timeline__etiquettes"
          role="group"
          aria-label="Intitulés des actions"
          width={MARGE_GAUCHE}
          height={hauteur}
        >
          <text x="5" y="20" className="grc-timeline__entete">
            Action · état
          </text>
          {frise.placees.map(({ objet }, i) => {
            const y = 36 + i * HAUTEUR_LIGNE;
            const retard = enRetard(objet, policy, maintenant);
            const nom = objet.name.length > 28 ? objet.name.slice(0, 27) + '…' : objet.name;
            return (
              <g
                key={objet.id}
                {...ouvrir(objet)}
                aria-label={descriptionAction(objet, policy, retard, fr)}
                className="grc-timeline__ligne"
              >
                <title>{objet.name}</title>
                <text x="5" y={y + 15}>
                  {symboleStatut(policy, objet.data.status)} {nom}
                </text>
                {retard && (
                  <text x={MARGE_GAUCHE - 8} y={y + 15} textAnchor="end" className="grc-timeline__retard">
                    ! En retard
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <svg
          className="grc-timeline__frise"
          role="img"
          aria-label="Barres du début à l’échéance de chaque action"
          width={largeurFrise}
          height={hauteur}
        >
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
            const retard = enRetard(objet, policy, maintenant);
            return (
              <g key={objet.id} aria-hidden="true">
                <rect
                  x={x(de)}
                  y={y}
                  width={Math.max(8, x(a) - x(de) + LARGEUR_JOUR)}
                  height="22"
                  rx="5"
                  fill={couleur}
                  className={retard ? 'grc-timeline__barre grc-timeline__barre--retard' : 'grc-timeline__barre'}
                  onClick={() => onOpen(objet)}
                />
              </g>
            );
          })}
        </svg>
      </div>
      {frise.horsPeriode.length > 0 && (
        <Stack gap="xs">
          <Text size="sm">Hors de la période affichée ({frise.horsPeriode.length})</Text>
          <Group gap="xs">
            {frise.horsPeriode.map((o) => (
              <Button key={o.id} variant="subtle" size="compact-sm" onClick={() => onOpen(o)}>
                {o.name}
              </Button>
            ))}
          </Group>
        </Stack>
      )}
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
