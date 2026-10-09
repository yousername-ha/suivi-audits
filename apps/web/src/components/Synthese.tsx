/* Synthèse : cartes du tableau de bord, communes à l'accueil et à l'écran mural (/mur).
   Grille « grille-cartes » : on ajoute des colonnes sur les grands écrans au lieu d'élargir les cartes. */
import { Card, Stack, Table, Text, Title } from '@mantine/core';
import type { Synthese } from '@suivi/shared';
import { IconeAdministration, StatusChip } from '@suivi/ui';
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
        <div className="table-wrap">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Échéance</Table.Th>
                <Table.Th>Écart</Table.Th>
                <Table.Th>Pilote</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {s.echeances.map((e) => (
                <Table.Tr key={e.id + e.echeance}>
                  <Table.Td className="nowrap">
                    {e.enRetard ? <StatusChip etat="erreur">{fmtJour(e.echeance)}</StatusChip> : fmtJour(e.echeance)}
                  </Table.Td>
                  <Table.Td>{e.texte || e.id}</Table.Td>
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
          {e && <Repartition titre="Écarts par statut" valeurs={e.parStatut} />}
          {e && <Repartition titre="Écarts par type" valeurs={e.parType} />}
          {mesures}
          <Plan s={s} />
          <Echeances s={s} />
          {extra}
        </>
      )}
      {vue === 'ecarts' && (
        <>
          {chiffres}
          {e && <Repartition titre="Écarts par statut" valeurs={e.parStatut} />}
          {e && <Repartition titre="Écarts par type" valeurs={e.parType} />}
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
