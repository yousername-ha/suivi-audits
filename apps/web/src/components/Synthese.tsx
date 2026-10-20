/* Synthèse : cartes du tableau de bord, communes à l'accueil et à l'écran mural (/mur).
   Grille « grille-cartes » : on ajoute des colonnes sur les grands écrans au lieu d'élargir les cartes. */
import { Card, Stack, Table, Text, Title } from '@mantine/core';
import type { Synthese } from '@suivi/shared';
import { Anneau, Histogramme, IconeAdministration, Jauge, StatusChip, type TeinteGraphique } from '@suivi/ui';
import type { ReactNode } from 'react';

export type SyntheseApi = Synthese & { ecran: string | null };
export const VUES = ['synthese', 'ecarts', 'echeances', 'plan'] as const;
export type Vue = (typeof VUES)[number];
export const VUE_LABELS: Record<Vue, string> = {
  synthese: 'Synthèse',
  ecarts: 'Écarts ouverts',
  echeances: 'Échéances',
  plan: 'Plan d’audit',
};

const fmtJour = (d: string) =>
  /^\d{4}-\d{2}-\d{2}/.test(d) ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('fr-FR') : d || '—';

function Carte({
  titre,
  children,
  large = false,
  className = '',
}: {
  titre: string;
  children: ReactNode;
  large?: boolean;
  className?: string;
}) {
  return (
    <Card
      withBorder
      className={`carte${large ? ' carte-large' : ''} ${className}`}
      component="section"
      aria-label={titre}
    >
      <Title order={2} size="h4" mb="xs">
        {titre}
      </Title>
      {children}
    </Card>
  );
}

function Chiffre({ valeur, libelle, etat }: { valeur: number; libelle: string; etat?: 'erreur' | 'attention' }) {
  return (
    <div className={`chiffre-cle${etat ? ` chiffre-cle--${etat}` : ''}`}>
      <Text className="chiffre-cle__valeur chiffres" c={etat === 'erreur' ? 'red' : etat ? 'orange' : undefined}>
        {valeur}
      </Text>
      <Text size="sm" c="dimmed">
        {libelle}
      </Text>
    </div>
  );
}

function Repartition({ titre, valeurs }: { titre: string; valeurs: Record<string, number> }) {
  const lignes = Object.entries(valeurs).sort((a, b) => b[1] - a[1]);
  const total = lignes.reduce((s, [, n]) => s + n, 0);
  return (
    <Carte titre={titre} className="repartition-carte">
      {lignes.length ? (
        <Table>
          <Table.Tbody>
            {lignes.map(([k, n]) => (
              <Table.Tr key={k}>
                <Table.Td>
                  <span className="repartition-label">{k}</span>
                  <svg className="repartition-barre" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
                    <rect width="100" height="4" rx="2" className="repartition-piste" />
                    <rect width={total ? (n / total) * 100 : 0} height="4" rx="2" className="repartition-valeur" />
                  </svg>
                </Table.Td>
                <Table.Td ta="right" className="chiffres">
                  {n}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          Aucune donnée.
        </Text>
      )}
    </Carte>
  );
}

function Echeances({ s, large }: { s: Synthese; large?: boolean }) {
  return (
    <Carte titre="Prochaines échéances" large={large} className="echeances-carte">
      {s.echeances.length ? (
        <div className="table-wrap" role="region" aria-label="Prochaines échéances" tabIndex={0}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Échéance</Table.Th>
                <Table.Th>Élément</Table.Th>
                <Table.Th>Pilote</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {s.echeances.map((e) => (
                <Table.Tr key={e.id + e.echeance}>
                  <Table.Td className="nowrap">
                    {e.enRetard ? <StatusChip etat="erreur">{fmtJour(e.echeance)}</StatusChip> : fmtJour(e.echeance)}
                  </Table.Td>
                  <Table.Td>
                    <b>{e.type}</b> · {e.texte || e.id}
                    {e.perimetre && (
                      <Text size="xs" c="dimmed">
                        {e.perimetre}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{e.pilote}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ) : (
        <Text size="sm" c="dimmed">
          Aucune échéance dans la période.
        </Text>
      )}
    </Carte>
  );
}

function Plan({ s, large }: { s: Synthese; large?: boolean }) {
  if (!s.plan) return null;
  return (
    <Carte titre="Plan d’audit" large={large} className="plan-carte">
      <Stack gap="xs">
        <Text size="sm">Statut : {s.plan.statut || 'non renseigné'}</Text>
        {s.plan.jours.length ? (
          <Table>
            <Table.Tbody>
              {s.plan.jours.map((j) => (
                <Table.Tr key={j.label + j.date}>
                  <Table.Td>{j.label || 'Journée'}</Table.Td>
                  <Table.Td className="nowrap">{fmtJour(j.date)}</Table.Td>
                  <Table.Td ta="right" className="chiffres">
                    {j.creneaux} créneau{j.creneaux > 1 ? 'x' : ''}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            Aucune journée planifiée.
          </Text>
        )}
      </Stack>
    </Carte>
  );
}

const TEINTE_ECART: Record<string, TeinteGraphique> = {
  'NC maj': 'rouge',
  'NC min': 'orange',
  PS: 'violet',
  PP: 'bleu',
  Remarque: 'gris',
};

/** Écarts ouverts par type (anneau) et actions réalisées (jauge), comme le tableau de bord historique. */
function EcartsOuverts({ s }: { s: Synthese }) {
  const e = s.ecartsOuverts;
  if (!e) return null;
  const retard = s.ecarts?.enRetard ?? 0;
  return (
    <Carte titre="Écarts ouverts" className="graph-carte">
      <Anneau
        titre="Écarts ouverts par type"
        parts={e.parType
          .filter((t) => t.n || t.type)
          .map((t) => ({ libelle: t.libelle, valeur: t.n, teinte: TEINTE_ECART[t.type] ?? 'gris' }))}
        centre={String(e.ouverts)}
        sousCentre="ouverts"
      />
      <Jauge
        libelle="Actions réalisées"
        valeur={e.actionsRealisees}
        max={e.actionsTotal}
        texte={`${e.actionsRealisees}/${e.actionsTotal}`}
        detail={retard ? `${retard} écart(s) en retard` : 'Aucun écart en retard'}
      />
    </Carte>
  );
}

function Indicateurs({ s }: { s: Synthese }) {
  const i = s.indicateurs;
  if (!i) return null;
  return (
    <Carte titre="Objectifs et indicateurs" className="graph-carte">
      <Anneau
        titre="Indicateurs"
        parts={[
          { libelle: 'Atteints', valeur: i.atteints, teinte: 'vert' },
          { libelle: 'Non atteints', valeur: i.nonAtteints, teinte: 'rouge' },
          { libelle: 'Non mesurés', valeur: i.nonMesures, teinte: 'gris' },
        ]}
        centre={`${i.atteints}/${i.total}`}
        sousCentre="atteints"
      />
    </Carte>
  );
}

const pc = (n: number, d: number) => (d ? (n * 100) / d : 0);

function Conformite({ s }: { s: Synthese }) {
  const c = s.conformite;
  if (!c || !c.some((r) => r.exigences)) return null;
  return (
    <Carte titre="Conformité par référentiel" className="graph-carte">
      <Histogramme
        titre="Niveau de mise en œuvre des exigences applicables, en pourcentage (déclaration d’applicabilité)"
        categories={c
          .filter((r) => r.exigences)
          .map((r) => ({
            libelle: r.libelle,
            valeurs: {
              t: pc(r.total, r.applicables),
              p: pc(r.partiel, r.applicables),
              i: pc(r.insuffisant, r.applicables),
              n: pc(r.nonRenseigne, r.applicables),
            },
          }))}
        series={[
          { cle: 't', libelle: 'Total', teinte: 'vert' },
          { cle: 'p', libelle: 'Partiel', teinte: 'orange' },
          { cle: 'i', libelle: 'Insuffisant', teinte: 'rouge' },
          { cle: 'n', libelle: 'Non renseigné', teinte: 'gris' },
        ]}
        max={100}
        format={(v) => `${Math.round(v)} %`}
      />
      <Text size="xs" c="dimmed" mt="xs">
        Déclaration interne : ce n’est ni un taux de conformité certifié ni le résultat d’un audit.
      </Text>
    </Carte>
  );
}

function Plans({ s }: { s: Synthese }) {
  const p = s.plans;
  if (!p) return null;
  return (
    <Carte titre={`Plans du SMSI ${p.annee}`} className="graph-carte">
      <Histogramme
        titre={`Actions des plans ${p.annee} par type et par état`}
        categories={p.types.map((t) => ({
          libelle: t.libelle,
          valeurs: { r: t.realises, v: t.aVenir, l: t.enRetard },
        }))}
        series={[
          { cle: 'r', libelle: 'Réalisé', teinte: 'vert' },
          { cle: 'v', libelle: 'À venir', teinte: 'bleu' },
          { cle: 'l', libelle: 'En retard', teinte: 'rouge' },
        ]}
        vide={`Aucune action planifiée en ${p.annee}.`}
      />
    </Carte>
  );
}

/** Actions et tâches récurrentes des registres (tous les périmètres lisibles, chaque élément compté une fois). */
function Actions({ s }: { s: Synthese }) {
  const a = s.actions,
    r = s.recurrences;
  if (!a && !r) return null;
  return (
    <Carte titre="Actions et tâches récurrentes" className="ecarts-carte">
      <div className="chiffres-grille">
        {a && <Chiffre valeur={a.ouvertes} libelle="actions ouvertes" />}
        {a && <Chiffre valeur={a.enRetard} libelle="actions en retard" etat={a.enRetard ? 'erreur' : undefined} />}
        {r && <Chiffre valeur={r.series} libelle="séries actives" />}
        {r && (
          <Chiffre
            valeur={r.occurrencesEnRetard}
            libelle="occurrences en retard"
            etat={r.occurrencesEnRetard ? 'erreur' : undefined}
          />
        )}
      </div>
      {a && a.total > 0 && (
        <Jauge
          libelle="Actions terminées"
          valeur={a.terminees}
          max={a.total}
          texte={`${a.terminees}/${a.total}`}
          detail={`${r?.occurrencesOuvertes ?? 0} occurrence(s) ouverte(s)`}
        />
      )}
    </Carte>
  );
}

/** Risques et continuité d'activité. */
function Risques({ s }: { s: Synthese }) {
  const r = s.risques,
    c = s.continuite;
  if (!r && !c) return null;
  return (
    <Carte titre="Risques et continuité" className="ecarts-carte">
      <div className="chiffres-grille">
        {r && <Chiffre valeur={r.total} libelle="risques" />}
        {r && (
          <Chiffre
            valeur={r.sansDecision}
            libelle="sans appréciation validée"
            etat={r.sansDecision ? 'attention' : undefined}
          />
        )}
        {r && <Chiffre valeur={r.revueEchue} libelle="revues échues" etat={r.revueEchue ? 'attention' : undefined} />}
        {c && <Chiffre valeur={c.bia} libelle="analyses d’impact (BIA)" />}
        {c && <Chiffre valeur={c.plans} libelle="plans de continuité" />}
      </div>
    </Carte>
  );
}

/** Tableau de bord graphique du Pilotage (lot U2) : mêmes agrégats que la synthèse, centrés sur le SMSI. */
export function CartesPilotage({ s }: { s: Synthese }) {
  return (
    <div className="grille-cartes synthese-grille">
      <Indicateurs s={s} />
      <EcartsOuverts s={s} />
      <Conformite s={s} />
      <Plans s={s} />
      <Actions s={s} />
      <Risques s={s} />
    </div>
  );
}

/** Cartes de la synthèse. vue : sous-ensemble affiché (rotation de l'écran mural). */
export function SyntheseCartes({ s, vue = 'synthese', extra }: { s: Synthese; vue?: Vue; extra?: ReactNode }) {
  const e = s.ecarts;
  const chiffres = e && (
    <Carte titre="Écarts" className="ecarts-carte">
      <div className="chiffres-grille">
        <Chiffre valeur={e.ouverts} libelle="ouverts" />
        <Chiffre valeur={e.enRetard} libelle="en retard" etat={e.enRetard ? 'erreur' : undefined} />
        <Chiffre valeur={e.aEcheance} libelle="à échéance proche" etat={e.aEcheance ? 'attention' : undefined} />
        <Chiffre valeur={e.total} libelle="au total" />
      </div>
    </Carte>
  );
  const audit = (
    <Carte titre="Prochain audit" className="audit-carte">
      <span className="audit-symbole" aria-hidden="true">
        <IconeAdministration />
      </span>
      {s.prochainAudit ? (
        <Stack gap="2xs">
          <Text className="chiffre-cle__valeur chiffres">{fmtJour(s.prochainAudit.date)}</Text>
          <Text size="sm" c="dimmed">
            {[s.prochainAudit.annee, s.prochainAudit.libelle].filter(Boolean).join(' — ') || 'Date à confirmer'}
          </Text>
          {s.auditInterne && <Text size="sm">Audit interne : {fmtJour(s.auditInterne)}</Text>}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Non planifié ou non visible avec vos droits.
        </Text>
      )}
    </Carte>
  );
  const mesures = s.mesures && (
    <Repartition
      titre={`Mesures suivies (${s.mesures.total})`}
      valeurs={Object.fromEntries(
        Object.entries(s.mesures.parReferentiel).map(([k, n]) => [
          k === 'A' ? 'ISO 27001, Annexe A' : k === 'ISO' ? 'ISO 27001, clauses' : k || 'Autre',
          n,
        ]),
      )}
    />
  );
  return (
    <div className="grille-cartes synthese-grille">
      {vue === 'synthese' && (
        <>
          {audit}
          {chiffres}
          <Conformite s={s} />
          <EcartsOuverts s={s} />
          <Indicateurs s={s} />
          <Plans s={s} />
          <Actions s={s} />
          <Risques s={s} />
          {e && <Repartition titre="Écarts par statut" valeurs={e.parStatut} />}
          {e && <Repartition titre="Écarts par classification" valeurs={e.parType} />}
          {e && <Repartition titre="Écarts par audit à l’origine" valeurs={e.parSource} />}
          {mesures}
          <Plan s={s} />
          <Echeances s={s} />
          {extra}
        </>
      )}
      {vue === 'ecarts' && (
        <>
          {chiffres}
          <EcartsOuverts s={s} />
          {e && <Repartition titre="Écarts par statut" valeurs={e.parStatut} />}
          {e && <Repartition titre="Écarts par classification" valeurs={e.parType} />}
          <Actions s={s} />
          <Echeances s={s} />
        </>
      )}
      {vue === 'echeances' && <Echeances s={s} large />}
      {vue === 'plan' && (
        <>
          {audit}
          <Plan s={s} />
        </>
      )}
    </div>
  );
}
