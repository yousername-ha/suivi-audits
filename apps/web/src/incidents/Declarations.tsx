/* Bloc « Déclarations » de l'onglet Fiche d'un incident et fiche de préparation (ADR 0105) : régime, étape, statut et compte
   à rebours de chaque déclaration ; préparation rubrique par rubrique avec un bouton « Copier » (recopie dans le formulaire du
   portail), téléchargement Word ; confirmer, écarter « non requise » (motif obligatoire), marquer « envoyée » (référence
   obligatoire), ouvrir une déclaration ou un complément et corriger la date de qualification, réservés au rôle « RSSI ».
   Une déclaration envoyée s'affiche figée. Les droits sont ceux renvoyés par le serveur, qui les contrôle de nouveau. */
import {
  Alert,
  Button,
  CopyButton,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  ETAPE_DECLARATION_LIBELLES,
  ETAPES_PAR_REGIME,
  REGIME_DECLARATION_LIBELLES,
  REGIMES_DECLARATION,
  STATUT_DECLARATION_LIBELLES,
  compteARebours,
  dateHeureParis,
  declarationFigee,
  declarationOuverte,
  type DeclarationIncidentDto,
  type EtatEcheance,
  type Incident,
  type StatutDeclaration,
  type VueDeclarationsIncident,
} from '@suivi/shared';
import { DataTable, StatusChip, type Etat } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, download, get } from '../api';
import { ErrorAlert } from '../components/common';

const TON_STATUT: Record<StatutDeclaration, Etat> = {
  proposee: 'info',
  a_declarer: 'attention',
  non_requise: 'neutre',
  envoyee: 'succes',
};
const TON_DELAI: Record<EtatEcheance, Etat> = {
  sans_delai: 'erreur',
  sans_echeance: 'neutre',
  a_venir: 'info',
  proche: 'attention',
  depassee: 'erreur',
};
export const libelleDeclaration = (d: Pick<DeclarationIncidentDto, 'regime' | 'etape'>) =>
  `${REGIME_DECLARATION_LIBELLES[d.regime]} — ${ETAPE_DECLARATION_LIBELLES[d.etape].toLowerCase()}`;
export const urlDeclarations = (incidentId: string) => `/api/incidents/${encodeURIComponent(incidentId)}/declarations`;
export const urlDeclaration = (incidentId: string, id: string, suite = '') =>
  `${urlDeclarations(incidentId)}/${encodeURIComponent(id)}${suite}`;
/** Déclarations qu'il reste possible d'ouvrir à la main (une par régime et par étape). */
export function ouvrables(declarations: readonly Pick<DeclarationIncidentDto, 'regime' | 'etape'>[]) {
  return REGIMES_DECLARATION.flatMap((regime) =>
    ETAPES_PAR_REGIME[regime]
      .filter((etape) => !declarations.some((d) => d.regime === regime && d.etape === etape))
      .map((etape) => ({ value: `${regime}/${etape}`, label: libelleDeclaration({ regime, etape }) })),
  );
}
/** Valeur d'un champ « date et heure » (heure locale du navigateur) pour une date ISO, et réciproquement. */
const versChampLocal = (v: string) => {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* ------------------------------------------------------------------ Conteneur (données et gestes) */
export function BlocDeclarations({ i }: { i: Incident }) {
  const qc = useQueryClient();
  const cle = ['incidents', 'declarations', i.id];
  const q = useQuery({ queryKey: cle, queryFn: () => get<VueDeclarationsIncident>(urlDeclarations(i.id)) });
  const [erreur, setErreur] = useState<unknown>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const agir = async (methode: string, chemin: string, corps?: unknown, version?: number) => {
    try {
      setErreur(null);
      await api(methode, chemin, {
        ...(corps === undefined ? {} : { body: corps }),
        ...(version === undefined ? {} : { ifMatch: version }),
      });
      await qc.invalidateQueries({ queryKey: ['incidents'] });
      return true;
    } catch (e) {
      setErreur(e);
      await qc.invalidateQueries({ queryKey: cle });
      return false;
    }
  };
  const v = q.data;
  if (!v) return <ErrorAlert error={q.error} />;
  // Rien à montrer pour un incident qui n'est pas un incident de sécurité et n'a aucune déclaration.
  if (!v.declarations.length && !v.qualifieeLe && i.kind !== 'Incident de sécurité') return null;
  const fiche = v.declarations.find((d) => d.id === ouverte) ?? null;
  return (
    <>
      <BlocDeclarationsVue
        vue={v}
        maintenant={maintenant}
        erreur={erreur}
        onOuvrirFiche={setOuverte}
        onConfirmer={(d) => agir('POST', urlDeclaration(i.id, d.id, '/confirmation'), {}, d.version)}
        onEcarter={(d, motif) => agir('POST', urlDeclaration(i.id, d.id, '/mise-a-l-ecart'), { motif }, d.version)}
        onEnvoyer={(d, reference) => agir('POST', urlDeclaration(i.id, d.id, '/envoi'), { reference }, d.version)}
        onCompleter={(d) => agir('POST', urlDeclaration(i.id, d.id, '/complement'), {})}
        onOuvrir={(regime, etape) => agir('POST', urlDeclarations(i.id), { regime, etape })}
        onCorrigerQualification={(qualifieeLe) =>
          agir('PUT', `/api/incidents/${encodeURIComponent(i.id)}/qualification`, { qualifieeLe })
        }
        onWord={(d) => download(urlDeclaration(i.id, d.id, '/export'))}
      />
      <Modal
        opened={!!fiche}
        onClose={() => setOuverte(null)}
        title={fiche ? `Fiche de préparation : ${libelleDeclaration(fiche)}` : 'Fiche de préparation'}
        size="xl"
        centered
        lockScroll={false}
        closeButtonProps={{ 'aria-label': 'Fermer la fiche de préparation' }}
      >
        {fiche && (
          <FichePreparationVue
            d={fiche}
            modifiable={v.peutPreparer}
            peutExporter={v.peutExporter}
            erreur={erreur}
            onRubrique={(cle, valeur) =>
              agir('PATCH', urlDeclaration(i.id, fiche.id), { rubriques: { [cle]: valeur } }, fiche.version)
            }
            onReference={(reference) => agir('PATCH', urlDeclaration(i.id, fiche.id), { reference }, fiche.version)}
            onWord={() => download(urlDeclaration(i.id, fiche.id, '/export'))}
          />
        )}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ Bloc (présentation) */
type Geste = Promise<boolean>;
export interface BlocDeclarationsProps {
  vue: VueDeclarationsIncident;
  maintenant: Date;
  erreur?: unknown;
  onOuvrirFiche: (id: string) => void;
  onConfirmer: (d: DeclarationIncidentDto) => Geste;
  onEcarter: (d: DeclarationIncidentDto, motif: string) => Geste;
  onEnvoyer: (d: DeclarationIncidentDto, reference: string) => Geste;
  onCompleter: (d: DeclarationIncidentDto) => Geste;
  onOuvrir: (regime: string, etape: string) => Geste;
  onCorrigerQualification: (qualifieeLe: string) => Geste;
  onWord: (d: DeclarationIncidentDto) => void;
}

export function BlocDeclarationsVue(p: BlocDeclarationsProps) {
  const { vue, maintenant } = p;
  const [ecart, setEcart] = useState<DeclarationIncidentDto | null>(null);
  const [envoi, setEnvoi] = useState<DeclarationIncidentDto | null>(null);
  const [motif, setMotif] = useState('');
  const [reference, setReference] = useState('');
  const [aOuvrir, setAOuvrir] = useState<string | null>(null);
  const [date, setDate] = useState(vue.qualifieeLe ? versChampLocal(vue.qualifieeLe) : '');
  const possibles = ouvrables(vue.declarations);
  return (
    <Stack gap="xs" id="declarations-incident">
      <Title order={3} size="h4">
        Déclarations
      </Title>
      <Text size="sm" c="dimmed">
        Déclarations réglementaires (santé, NIS 2) : proposées à la qualification, confirmées ou écartées par le RSSI,
        préparées rubrique par rubrique puis recopiées dans le portail. Rubriques à confirmer contre les formulaires des
        portails avant la première utilisation.
      </Text>
      <Text size="sm">
        Qualification : {vue.qualifieeLe ? dateHeureParis(vue.qualifieeLe) : 'date non enregistrée'}
      </Text>
      <ErrorAlert error={p.erreur} />
      {vue.declarations.length > 0 ? (
        <DataTable label="Déclarations de l’incident">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Régime</Table.Th>
                <Table.Th>Étape</Table.Th>
                <Table.Th>Statut</Table.Th>
                <Table.Th>Délai</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {vue.declarations.map((d) => {
                const delai = compteARebours(d, maintenant);
                return (
                  <Table.Tr key={d.id}>
                    <Table.Td>{REGIME_DECLARATION_LIBELLES[d.regime]}</Table.Td>
                    <Table.Td>{ETAPE_DECLARATION_LIBELLES[d.etape]}</Table.Td>
                    <Table.Td>
                      <StatusChip etat={TON_STATUT[d.statut]}>{STATUT_DECLARATION_LIBELLES[d.statut]}</StatusChip>
                    </Table.Td>
                    <Table.Td>
                      {delai ? (
                        <StatusChip etat={TON_DELAI[delai.etat]}>{delai.libelle}</StatusChip>
                      ) : d.envoi ? (
                        <Text size="sm">
                          Envoyée le {dateHeureParis(d.envoi.le)} par {d.envoi.par}, référence {d.envoi.reference}
                        </Text>
                      ) : (
                        <Text size="sm">
                          Non requise{d.decision ? ` (${d.decision.par}, ${dateHeureParis(d.decision.le)})` : ''} :{' '}
                          {d.motif}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button size="compact-sm" variant="light" onClick={() => p.onOuvrirFiche(d.id)}>
                          {declarationFigee(d.statut) ? 'Voir' : 'Préparer'}
                        </Button>
                        {vue.peutExporter && (
                          <Button size="compact-sm" variant="default" onClick={() => p.onWord(d)}>
                            Word
                          </Button>
                        )}
                        {vue.peutDeclarer && d.statut === 'proposee' && (
                          <Button size="compact-sm" variant="default" onClick={() => void p.onConfirmer(d)}>
                            Confirmer « à déclarer »
                          </Button>
                        )}
                        {vue.peutDeclarer && declarationOuverte(d.statut) && (
                          <>
                            <Button
                              size="compact-sm"
                              onClick={() => {
                                setReference(d.reference);
                                setEnvoi(d);
                              }}
                            >
                              Marquer envoyée
                            </Button>
                            <Button
                              size="compact-sm"
                              variant="default"
                              onClick={() => {
                                setMotif('');
                                setEcart(d);
                              }}
                            >
                              Non requise
                            </Button>
                          </>
                        )}
                        {vue.peutDeclarer && d.statut === 'envoyee' && (
                          <Button size="compact-sm" variant="default" onClick={() => void p.onCompleter(d)}>
                            Ajouter un complément
                          </Button>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </DataTable>
      ) : (
        <Text size="sm">Aucune déclaration pour cet incident.</Text>
      )}
      {vue.peutDeclarer && (
        <Group align="flex-end">
          {possibles.length > 0 && (
            <>
              <Select
                label="Ouvrir une déclaration non proposée"
                placeholder="Régime et étape"
                data={possibles}
                value={aOuvrir}
                onChange={setAOuvrir}
                allowDeselect={false}
              />
              <Button
                variant="default"
                disabled={!aOuvrir}
                onClick={async () => {
                  const [regime, etape] = aOuvrir!.split('/') as [string, string];
                  if (await p.onOuvrir(regime, etape)) setAOuvrir(null);
                }}
              >
                Ouvrir
              </Button>
            </>
          )}
          <TextInput
            label="Date et heure de qualification"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
          <Button
            variant="default"
            disabled={!date || (!!vue.qualifieeLe && date === versChampLocal(vue.qualifieeLe))}
            onClick={() => void p.onCorrigerQualification(new Date(date).toISOString())}
          >
            Corriger la date
          </Button>
        </Group>
      )}
      {!vue.peutDeclarer && vue.declarations.some((d) => declarationOuverte(d.statut)) && (
        <Text size="xs" c="dimmed">
          Confirmer, écarter et marquer envoyée sont réservés au rôle RSSI.
        </Text>
      )}
      <Modal
        opened={!!ecart}
        onClose={() => setEcart(null)}
        title={ecart ? `Non requise : ${libelleDeclaration(ecart)}` : 'Non requise'}
        centered
        lockScroll={false}
      >
        <Stack>
          <Text size="sm">Le motif est obligatoire et sera figé avec la décision.</Text>
          <Textarea
            label="Motif"
            required
            autosize
            minRows={3}
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEcart(null)}>
              Annuler
            </Button>
            <Button
              disabled={!motif.trim()}
              onClick={async () => {
                if (ecart && (await p.onEcarter(ecart, motif.trim()))) setEcart(null);
              }}
            >
              Écarter « non requise »
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        opened={!!envoi}
        onClose={() => setEnvoi(null)}
        title={envoi ? `Marquer envoyée : ${libelleDeclaration(envoi)}` : 'Marquer envoyée'}
        centered
        lockScroll={false}
      >
        <Stack>
          <Alert color="orange" variant="light">
            Le texte des rubriques, la date, l’heure et votre nom seront figés : la déclaration ne pourra plus être
            modifiée ni supprimée. Un complément se fait par une nouvelle déclaration liée.
          </Alert>
          <TextInput
            label="Numéro de dossier ou d’accusé de réception"
            required
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEnvoi(null)}>
              Annuler
            </Button>
            <Button
              disabled={!reference.trim()}
              onClick={async () => {
                if (envoi && (await p.onEnvoyer(envoi, reference.trim()))) setEnvoi(null);
              }}
            >
              Marquer envoyée
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/* ------------------------------------------------------------------ Fiche de préparation (présentation) */
export interface FichePreparationProps {
  d: DeclarationIncidentDto;
  modifiable: boolean;
  peutExporter: boolean;
  erreur?: unknown;
  onRubrique: (cle: string, valeur: string | null) => Geste;
  onReference: (reference: string) => Geste;
  onWord: () => void;
}

export function FichePreparationVue({
  d,
  modifiable,
  peutExporter,
  erreur,
  onRubrique,
  onReference,
  onWord,
}: FichePreparationProps) {
  const figee = declarationFigee(d.statut);
  const editable = modifiable && !figee;
  return (
    <Stack>
      <ErrorAlert error={erreur} />
      {d.envoi ? (
        <Alert color="teal" variant="light" title="Texte transmis, figé">
          Envoyée le {dateHeureParis(d.envoi.le)} par {d.envoi.par}, référence {d.envoi.reference}.
        </Alert>
      ) : d.statut === 'non_requise' ? (
        <Alert color="gray" variant="light" title="Écartée : non requise">
          {d.motif}
        </Alert>
      ) : (
        <Text size="sm" c="dimmed">
          Rubriques pré-remplies depuis la fiche de l’incident, sa chronologie et l’identité de l’établissement ;
          modifiables jusqu’à l’envoi. « Copier » place le texte dans le presse-papiers, pour le recopier dans le
          formulaire du portail.
        </Text>
      )}
      {!figee && (
        <TextInput
          key={`reference-${d.version}`}
          label="Numéro de dossier pressenti"
          defaultValue={d.reference}
          disabled={!editable}
          onBlur={(e) => {
            const v = e.currentTarget.value.trim();
            if (v !== d.reference) void onReference(v);
          }}
        />
      )}
      {d.rubriques.map((r) => (
        <Stack key={r.cle} gap="xs" className="declaration-rubrique">
          <Group justify="space-between" align="flex-end" wrap="nowrap">
            <div>
              <Text fw={600} size="sm">
                {r.libelle}
              </Text>
              <Text size="xs" c="dimmed">
                Source : {r.source}
              </Text>
            </div>
            <CopyButton value={r.valeur}>
              {({ copied, copy }) => (
                <Button
                  size="compact-sm"
                  variant={copied ? 'filled' : 'default'}
                  onClick={copy}
                  disabled={!r.valeur}
                  aria-label={`Copier : ${r.libelle}`}
                >
                  {copied ? 'Copié' : 'Copier'}
                </Button>
              )}
            </CopyButton>
          </Group>
          {editable ? (
            <>
              <Textarea
                key={`${r.cle}-${d.version}`}
                aria-label={r.libelle}
                description={r.aide}
                autosize
                minRows={2}
                defaultValue={r.valeur}
                onBlur={(e) => {
                  if (e.currentTarget.value !== r.valeur) void onRubrique(r.cle, e.currentTarget.value);
                }}
              />
              {r.modifiee && (
                <div>
                  <Button size="compact-xs" variant="subtle" onClick={() => void onRubrique(r.cle, null)}>
                    Revenir à la valeur de la fiche
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Text size="sm" className="declaration-texte">
              {r.valeur || 'Non renseigné'}
            </Text>
          )}
        </Stack>
      ))}
      {peutExporter && (
        <Group justify="flex-end">
          <Button variant="default" onClick={onWord}>
            Télécharger en Word
          </Button>
        </Group>
      )}
    </Stack>
  );
}
