/* Carte du prochain audit (reprise de « Pronostic ») : probabilité que chaque exigence soit examinée par l'auditeur
   AFNOR, d'après la couverture de l'année précédente et les écarts encore ouverts ; mesures à préparer par ordre de
   probabilité, avec l'avancement de la préparation. Le calcul est celui de l'outil historique (parité testée). */
import { Alert, Anchor, Button, Card, Group, Modal, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import {
  ANNEX_A_GROUPS,
  LV,
  PREP_LABELS,
  PREP_VALUES,
  guideDe,
  itemCode,
  type Analysis,
  type Level,
} from '@suivi/shared/audit';
import { StatusChip } from '@suivi/ui';
import { Link } from 'react-router';
import { ErrorAlert } from '../components/common';
import { useCan } from '../session';
import { CycleAudit } from './CycleAudit';
import { useActionAudit, useAudit, type DonneesAudit, type ExigenceAudit } from './commun';

type Lentille = 'prono' | 'afnor' | 'interne';
const NIVEAUX: Record<string, Level[]> = {
  prio: ['certain', 'tres'],
  plus: ['certain', 'tres', 'probable'],
  socle: ['socle'],
  all: ['certain', 'tres', 'probable', 'socle', 'faible'],
};

export function Pronostic() {
  const { q, d, analyses } = useAudit();
  const can = useCan(),
    modifiable = can('audit', 'modifier'),
    [lentille, setLentille] = useState<Lentille>('prono'),
    [niveaux, setNiveaux] = useState('prio'),
    [fiche, setFiche] = useState<string | null>(null),
    [cycle, setCycle] = useState(false);
  if (!d) return <ErrorAlert error={q.error} />;
  if (!d.items.length)
    return (
      <Alert>
        Aucune exigence dans l’état de l’outil de suivi : importez les référentiels (Pilotage → Conformité →
        Bibliothèque de référentiels) ou ouvrez l’outil historique une première fois.
      </Alert>
    );
  const N = d.nextYear,
    P = N - 1;
  const placees = new Set(d.plan?.slots.flatMap((s) => s.items) ?? []);
  const lignes = [
    { cle: 'ISO', libelle: 'Clauses 4 à 10', sous: 'ISO 27001, socle', items: d.items.filter((i) => i.ref === 'ISO') },
    ...Object.entries(ANNEX_A_GROUPS).map(([g, titre]) => ({
      cle: g,
      libelle: `A.${g.slice(2)} ${titre}`,
      sous: 'Annexe A',
      items: d.items.filter((i) => i.group === g),
    })),
    { cle: 'HDS', libelle: 'HDS v2', sous: 'Exigences', items: d.items.filter((i) => i.ref === 'HDS') },
  ].filter((l) => l.items.length);
  const nb = (k: Level) => d.items.filter((i) => analyses[i.id]?.level === k).length;
  const source = lentille === 'afnor' ? 'afnor' : 'interne';
  const audites = d.items.filter((i) => i[source][P] === 'X').length;
  const liste = d.items
    .filter((i) => NIVEAUX[niveaux]!.includes(analyses[i.id]!.level))
    .sort(
      (a, b) =>
        LV[analyses[a.id]!.level].o - LV[analyses[b.id]!.level].o ||
        analyses[b.id]!.score - analyses[a.id]!.score ||
        d.items.indexOf(a) - d.items.indexOf(b),
    );
  const ouverte = d.items.find((i) => i.id === fiche) ?? null;
  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Carte du prochain audit</Text>
          <Text size="sm" c="dimmed">
            {lentille === 'prono'
              ? `Probabilité que chaque mesure soit examinée par l’auditeur AFNOR en ${N}, d’après la couverture ${P} et les écarts encore ouverts. Sélectionnez une case pour le détail.`
              : `Mesures auditées en ${P} ${lentille === 'afnor' ? 'par l’AFNOR' : 'en audit interne'}.`}
          </Text>
        </div>
        <Group>
          <SegmentedControl
            aria-label="Lentille de la carte"
            value={lentille}
            onChange={(v) => setLentille(v as Lentille)}
            data={[
              { value: 'prono', label: `Pronostic ${N}` },
              { value: 'afnor', label: `AFNOR ${P}` },
              { value: 'interne', label: `Interne ${P}` },
            ]}
          />
          <Button variant="default" onClick={() => setCycle(true)}>
            Cycle d’audit
          </Button>
        </Group>
      </Group>
      <Group component="ul" className="audit-legende" gap="md">
        {lentille === 'prono' ? (
          (['certain', 'tres', 'probable', 'socle', 'faible'] as Level[]).map((k) => (
            <li key={k}>
              <span className={`audit-pastille audit-niv-${k}`} aria-hidden="true" />
              {LV[k].l} <b>{nb(k)}</b>
            </li>
          ))
        ) : (
          <>
            <li>
              <span className={`audit-pastille audit-cov-x-${source}`} aria-hidden="true" />
              Auditée en {P} <b>{audites}</b>
            </li>
            <li>
              <span className={`audit-pastille audit-cov-p-${source}`} aria-hidden="true" />
              Prévue
            </li>
            <li>
              <span className="audit-pastille audit-niv-faible" aria-hidden="true" />
              Non auditée <b>{d.items.length - audites}</b>
            </li>
          </>
        )}
      </Group>
      <Stack gap="xs">
        {lignes.map((l) => (
          <div key={l.cle} className="audit-ligne">
            <div className="audit-ligne-titre">
              <Text size="sm" fw={600}>
                {l.libelle}
              </Text>
              <Text size="xs" c="dimmed">
                {l.sous}, {l.items.length} mesures
              </Text>
            </div>
            <div className="audit-tuiles">
              {l.items.map((it) => {
                const a = analyses[it.id]!;
                const v = it[source][P];
                const classe =
                  lentille === 'prono'
                    ? `audit-niv-${a.level}`
                    : v === 'X'
                      ? `audit-cov-x-${source}`
                      : v === 'P'
                        ? `audit-cov-p-${source}`
                        : 'audit-niv-faible';
                const libelle = `${itemCode(it)} ${it.title}. ${lentille === 'prono' ? LV[a.level].l : ''}${a.open.length ? ', écart ouvert' : ''}${it.prep === 'pret' ? ', prête' : ''}`;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`audit-tuile ${classe}`}
                    title={libelle}
                    aria-label={libelle}
                    onClick={() => setFiche(it.id)}
                  >
                    {it.num}
                    {lentille === 'prono' && a.open.length > 0 && <span className="audit-point" aria-hidden="true" />}
                    {it.prep === 'pret' && <span className="audit-pret" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Text fw={600}>Mesures à préparer</Text>
          <Text size="sm" c="dimmed">
            Classées par probabilité puis par poids des motifs. Indiquez l’avancement des preuves au fil de la
            préparation.
          </Text>
        </div>
        <SegmentedControl
          aria-label="Niveau des mesures à préparer"
          value={niveaux}
          onChange={setNiveaux}
          data={[
            { value: 'prio', label: 'Certain et très probable' },
            { value: 'plus', label: 'Avec probable' },
            { value: 'socle', label: 'Systématique' },
            { value: 'all', label: 'Toutes' },
          ]}
        />
      </Group>
      {!liste.length && <Text size="sm">Aucune mesure à ce niveau.</Text>}
      <Stack component="ol" className="audit-liste" gap="xs">
        {liste.map((it) => (
          <MesureAPreparer
            key={it.id}
            d={d}
            it={it}
            a={analyses[it.id]!}
            placee={placees.has(it.id)}
            modifiable={modifiable}
            onOuvrir={() => setFiche(it.id)}
          />
        ))}
      </Stack>
      <Modal
        opened={!!ouverte}
        onClose={() => setFiche(null)}
        size="lg"
        lockScroll={false}
        title={ouverte ? `${itemCode(ouverte)} — ${ouverte.title}` : ''}
      >
        {ouverte && <FicheExigence d={d} it={ouverte} a={analyses[ouverte.id]!} modifiable={modifiable} />}
      </Modal>
      {cycle && <CycleAudit d={d} ouvert modifiable={modifiable} onClose={() => setCycle(false)} />}
    </Stack>
  );
}

function Preparation({ it, modifiable }: { it: ExigenceAudit; modifiable: boolean }) {
  const agir = useActionAudit();
  const [erreur, setErreur] = useState<unknown>(null);
  return (
    <Stack gap="xs">
      <ErrorAlert error={erreur} />
      <Group gap="xs" role="group" aria-label="Préparation">
        {PREP_VALUES.map((v) => (
          <Button
            key={v || 'a-preparer'}
            size="compact-sm"
            variant={(it.prep || '') === v ? 'filled' : 'default'}
            aria-pressed={(it.prep || '') === v}
            disabled={!modifiable}
            onClick={() => {
              setErreur(null);
              agir('POST', '/preparation', { id: it.id, valeur: v }).catch(setErreur);
            }}
          >
            {PREP_LABELS[v]}
          </Button>
        ))}
      </Group>
    </Stack>
  );
}

function MesureAPreparer({
  d,
  it,
  a,
  placee,
  modifiable,
  onOuvrir,
}: {
  d: DonneesAudit;
  it: ExigenceAudit;
  a: Analysis;
  placee: boolean;
  modifiable: boolean;
  onOuvrir: () => void;
}) {
  return (
    <Card component="li" withBorder padding="sm" className="audit-mesure">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={0}>
          <Group gap="xs">
            <span className={`audit-niveau audit-niv-${a.level}`}>{LV[a.level].l}</span>
            <Anchor component="button" type="button" fw={600} onClick={onOuvrir}>
              {itemCode(it)}
            </Anchor>
            <Text size="sm">{it.title}</Text>
          </Group>
          <ul className="audit-motifs">
            {a.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <Group gap="xs">
            {a.internalGap && (
              <StatusChip etat="attention">Pas encore prévue à l’audit interne {d.nextYear}</StatusChip>
            )}
            {!placee && d.plan && a.level !== 'faible' && (
              <StatusChip etat="erreur">Sans créneau dans le plan</StatusChip>
            )}
            {it.owner && <StatusChip etat="neutre">Pilote : {it.owner}</StatusChip>}
          </Group>
        </Stack>
        <Preparation it={it} modifiable={modifiable} />
      </Group>
    </Card>
  );
}

function FicheExigence({
  d,
  it,
  a,
  modifiable,
}: {
  d: DonneesAudit;
  it: ExigenceAudit;
  a: Analysis;
  modifiable: boolean;
}) {
  const guide = guideDe(it);
  return (
    <Stack>
      <Group>
        <span className={`audit-niveau audit-niv-${a.level}`}>{LV[a.level].l}</span>
        <Text size="sm">Score {a.score}</Text>
      </Group>
      <ul className="audit-motifs">
        {a.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <Preparation it={it} modifiable={modifiable} />
      <div>
        <Text fw={600} size="sm">
          Écarts liés ({a.findings.length})
        </Text>
        {!a.findings.length && <Text size="sm">Aucun écart lié.</Text>}
        <ul className="audit-motifs">
          {a.findings.map((f) => (
            <li key={f.id}>
              {f.id} — {f.type}, {f.source} {f.year}, {f.status.toLowerCase()} :{' '}
              {d.findings.find((x) => x.id === f.id)?.text}
            </li>
          ))}
        </ul>
        {a.findings.length > 0 && (
          <Anchor component={Link} to="/pilotage/amelioration">
            Ouvrir les écarts
          </Anchor>
        )}
      </div>
      {guide && (
        <>
          <div>
            <Text fw={600} size="sm">
              Preuves types
            </Text>
            <ul className="audit-motifs">
              {guide.preuves.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <Text fw={600} size="sm">
              Questions probables de l’auditeur
            </Text>
            <ul className="audit-motifs">
              {guide.questions.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Stack>
  );
}
