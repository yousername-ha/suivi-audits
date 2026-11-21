/* Module Vulnérabilités (ADR 0100, lot AD-1) : page « Active Directory » (une page du module, sans fenêtre). Rapport
   d'analyse de l'Active Directory du service ADS de l'ANSSI (à partir d'une collecte ORADAD), importé par fichier JSON lu
   dans le navigateur (ads.ts) : seuls la note, la progression, les points non conformes et, bornés, les noms courts et la
   nature des objets concernés partent vers le serveur.
   La page montre à toute personne qui lit le module des nombres seulement : note globale et son évolution, progression
   par niveau, points ouverts par niveau et par type, et pour chaque point le nombre d'objets et sa variation, points
   corrigés depuis l'import précédent. Les noms ne sont demandés au serveur que point par point, sur clic, par une route à
   part (chaque consultation est tracée au journal d'audit) : la lecture de la page n'en reçoit aucun. Ils font partie du
   droit « Analyste », branché sur l'accès au module en attendant le lot 3 de l'ADR 0092 (décision du RSSI du 20/11/2026).
   Import et suppression d'un import avec le droit d'administrer le module.
   CSP stricte (ADR 0006) : composants de la charte, ni style ni script en ligne, aucune fenêtre. */
import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  List,
  Progress,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  ADS_BORNES,
  type AnnuaireAdsDto,
  type BilanImportAdsDto,
  evolutionNoteAds,
  type ImportAdsDto,
  libelleTypeAds,
  NATURE_OBJET_ADS_LIBELLES,
  NIVEAUX_ADS,
  type NomObjetAds,
  type NomsPointAdsDto,
  type PointCorrigeAdsDto,
  type PointOuvertAdsDto,
  pointsParNiveauEtType,
  type ProgressionNiveauAds,
  TYPES_POINT_ADS,
  TYPE_POINT_ADS_LIBELLES,
  variationAds,
} from '@suivi/shared';
import { ErrorAlert, Page } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { EnteteVulnerabilites } from './EnteteVulnerabilites';
import { api, errorMessage, get } from '../api';
import { RefusImport } from '../integrations/ImportNessus';
import { MOT_SUPPRESSION } from '../integrations/SuppressionNessus';
import { useCan } from '../session';
import {
  corpsImportAds,
  ErreurRapportAds,
  erreurTailleAds,
  type ExtraitAds,
  libelleEcartsAds,
  lireJsonAds,
  lireRapportAds,
  resumeExtraitAds,
} from './ads';

const CLE = ['vulnerabilites', 'annuaire'] as const;
const URL = '/api/vulnerabilites/annuaire';
const pluriel = (n: number, un: string, plusieurs: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;
const jour = (d: string | null) => (d ? d.split('-').reverse().join('/') : 'date non indiquée');
const horodatage = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' });

/* ------------------------------------------------------------------ Note globale */
export function texteEvolutionNote(courant: ImportAdsDto | null, precedent: ImportAdsDto | null): string {
  const e = evolutionNoteAds(courant, precedent);
  if (e === null) return 'Premier import : pas encore d’évolution.';
  if (e === 0) return `Inchangée depuis l’import du ${jour(precedent!.dateRapport)}.`;
  return `${e > 0 ? `+${e}` : `−${-e}`} depuis l’import du ${jour(precedent!.dateRapport)} (${precedent!.note} sur 5).`;
}

export function NoteAds({ data }: { data: Pick<AnnuaireAdsDto, 'courant' | 'precedent' | 'historique'> }) {
  const { courant, precedent, historique } = data;
  if (!courant)
    return (
      <Alert color="gray" title="Aucun rapport importé">
        Aucun rapport de l’Active Directory n’a encore été importé.
      </Alert>
    );
  return (
    <Stack gap="xs">
      <Group gap="sm" align="baseline">
        <Title order={2} size="h3">
          Note globale : {courant.note} sur 5
        </Title>
        <Text size="sm" c="dimmed">
          rapport du {jour(courant.dateRapport)}, importé le {horodatage(courant.importeLe)}
        </Text>
      </Group>
      <Text size="sm">{texteEvolutionNote(courant, precedent)}</Text>
      {historique.length > 1 && (
        <Text size="sm" c="dimmed">
          Notes successives, de la plus récente à la plus ancienne : {historique.map((h) => h.note).join(', ')}.
        </Text>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Progression par niveau */
const pourcentageNiveau = (p: ProgressionNiveauAds): number | null =>
  p.pourcentage ?? (p.total ? Math.round((p.conformes! / p.total) * 1000) / 10 : null);

export function ProgressionAds({
  progression,
  conformes,
}: {
  progression: ProgressionNiveauAds[];
  conformes: number | null;
}) {
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">
        Progression par niveau
      </Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Niveau</Table.Th>
            <Table.Th>Points conformes</Table.Th>
            <Table.Th>Progression</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {progression.map((p) => {
            const pct = pourcentageNiveau(p);
            return (
              <Table.Tr key={p.niveau}>
                <Table.Th scope="row">Niveau {p.niveau}</Table.Th>
                <Table.Td>
                  {p.conformes !== null && p.total !== null ? `${p.conformes} sur ${p.total}` : 'non indiqué'}
                </Table.Td>
                <Table.Td>
                  {pct === null ? (
                    'non indiquée'
                  ) : (
                    <Stack gap="2xs">
                      <Progress value={pct} aria-label={`Progression du niveau ${p.niveau}`} />
                      <Text size="sm">{pct.toLocaleString('fr-FR')} %</Text>
                    </Stack>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {conformes !== null && (
        <Text size="sm" c="dimmed">
          {pluriel(conformes, 'point de contrôle conforme', 'points de contrôle conformes')} au total (le rapport ne les
          détaille pas).
        </Text>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Points ouverts par niveau et par type */
export function NiveauxTypesAds({ points }: { points: readonly PointOuvertAdsDto[] }) {
  const m = pointsParNiveauEtType(points);
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">
        Points ouverts par niveau et par type
      </Title>
      <Table withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Niveau</Table.Th>
            {[...TYPES_POINT_ADS].reverse().map((t) => (
              <Table.Th key={t}>{libelleTypeAds(t)}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {NIVEAUX_ADS.map((n) => (
            <Table.Tr key={n}>
              <Table.Th scope="row">Niveau {n}</Table.Th>
              {[...TYPES_POINT_ADS].reverse().map((t) => (
                <Table.Td key={t}>{m[n]![t]}</Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

/* ------------------------------------------------------------------ Noms d'un point (sur clic, consultation tracée) */
const libelleNom = (n: NomObjetAds) => `${n.nom} (${NATURE_OBJET_ADS_LIBELLES[n.nature]})`;

function ListeNoms({ titre, noms }: { titre: string; noms: readonly NomObjetAds[] }) {
  return (
    <Stack gap="2xs">
      <Text size="sm" fw={600}>
        {titre} ({noms.length.toLocaleString('fr-FR')})
      </Text>
      {noms.length ? (
        <List size="sm">
          {noms.map((n) => (
            <List.Item key={`${n.nature}-${n.nom}`}>{libelleNom(n)}</List.Item>
          ))}
        </List>
      ) : (
        <Text size="sm" c="dimmed">
          aucun
        </Text>
      )}
    </Stack>
  );
}

export function NomsPointAds({ data }: { data: NomsPointAdsDto }) {
  return (
    <Stack gap="xs">
      <ListeNoms titre="Objets concernés au dernier import" noms={data.noms} />
      {data.sansNom > 0 && (
        <Text size="sm" c="dimmed">
          Et {pluriel(data.sansNom, 'autre objet', 'autres objets')}, comptés sans nom conservé (au-delà de{' '}
          {ADS_BORNES.nomsParPoint} noms par point, ou sans nom lisible).
        </Text>
      )}
      {data.comparaison ? (
        <>
          <ListeNoms titre={`Apparus depuis l’import n° ${data.comparaison.numero}`} noms={data.comparaison.apparus} />
          <ListeNoms
            titre={`Corrigés depuis l’import n° ${data.comparaison.numero}`}
            noms={data.comparaison.corriges}
          />
          {!data.comparaison.complete && (
            <Text size="sm" c="dimmed">
              Comparaison partielle : l’un des deux imports n’a pas gardé tous les noms de ce point.
            </Text>
          )}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          Pas d’import précédent dont les noms sont gardés : ni « apparus » ni « corrigés ».
        </Text>
      )}
    </Stack>
  );
}

function NomsDemandes({ identifiant }: { identifiant: string }) {
  // Une demande par ouverture (chaque demande est tracée) : ni relance automatique, ni conservation après fermeture.
  const q = useQuery({
    queryKey: [...CLE, 'noms', identifiant],
    queryFn: () => get<NomsPointAdsDto>(`${URL}/points/${encodeURIComponent(identifiant)}/noms`),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <Stack gap="xs">
      <ErrorAlert error={q.error} />
      {q.isPending && (
        <Text size="sm" role="status">
          Lecture des noms…
        </Text>
      )}
      {q.data && <NomsPointAds data={q.data} />}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Liste des points */
export function PointsOuvertsAds({
  points,
  ouvert,
  onOuvrir,
}: {
  points: readonly PointOuvertAdsDto[];
  ouvert: string | null;
  onOuvrir: (identifiant: string | null) => void;
}) {
  if (!points.length)
    return (
      <Text size="sm" c="dimmed">
        Aucun point de contrôle non conforme au dernier import.
      </Text>
    );
  return (
    <div className="table-wrap" role="region" aria-label="Points de contrôle ouverts" tabIndex={0}>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Point de contrôle</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Niveau</Table.Th>
            <Table.Th>Objets concernés</Table.Th>
            <Table.Th>Variation</Table.Th>
            <Table.Th>Noms</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {points.map((p) => (
            <PointLigne key={p.identifiant} p={p} ouvert={ouvert} onOuvrir={onOuvrir} />
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}

function PointLigne({
  p,
  ouvert,
  onOuvrir,
}: {
  p: PointOuvertAdsDto;
  ouvert: string | null;
  onOuvrir: (identifiant: string | null) => void;
}) {
  const est = ouvert === p.identifiant;
  return (
    <>
      <Table.Tr>
        <Table.Td>
          <Text size="sm" fw={600}>
            {p.titre}
          </Text>
          <Text size="xs" c="dimmed">
            {p.identifiant} · module {p.reference}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color={p.type === 3 ? 'red' : p.type === 2 ? 'orange' : 'gray'}>
            {libelleTypeAds(p.type)}
          </Badge>
        </Table.Td>
        <Table.Td>{p.niveau}</Table.Td>
        <Table.Td>{p.objets.toLocaleString('fr-FR')}</Table.Td>
        <Table.Td>{variationAds(p)}</Table.Td>
        <Table.Td>
          <Button size="xs" variant="default" onClick={() => onOuvrir(est ? null : p.identifiant)} aria-expanded={est}>
            {est ? 'Masquer les noms' : 'Voir les noms'}
          </Button>
        </Table.Td>
      </Table.Tr>
      {est && (
        <Table.Tr>
          <Table.Td colSpan={6}>
            <NomsDemandes identifiant={p.identifiant} />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

export function CorrigesAds({
  corriges,
  precedent,
  ouvert,
  onOuvrir,
}: {
  corriges: readonly PointCorrigeAdsDto[];
  precedent: ImportAdsDto | null;
  ouvert: string | null;
  onOuvrir: (identifiant: string | null) => void;
}) {
  if (!precedent) return null;
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">
        Corrigés depuis l’import du {jour(precedent.dateRapport)}
      </Title>
      {corriges.length ? (
        <List size="sm" spacing="xs">
          {corriges.map((c) => (
            <List.Item key={c.identifiant}>
              <Stack gap="2xs">
                <Group gap="xs">
                  <Text size="sm">
                    {c.titre} ({c.identifiant}, {TYPE_POINT_ADS_LIBELLES[c.type]}, niveau {c.niveau}) :{' '}
                    {pluriel(c.objets, 'objet', 'objets')} à l’import précédent
                  </Text>
                  <Button
                    size="xs"
                    variant="default"
                    onClick={() => onOuvrir(ouvert === c.identifiant ? null : c.identifiant)}
                    aria-expanded={ouvert === c.identifiant}
                  >
                    {ouvert === c.identifiant ? 'Masquer les noms' : 'Voir les noms'}
                  </Button>
                </Group>
                {ouvert === c.identifiant && <NomsDemandes identifiant={c.identifiant} />}
              </Stack>
            </List.Item>
          ))}
        </List>
      ) : (
        <Text size="sm" c="dimmed">
          Aucun point corrigé.
        </Text>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Import (section de la page) */
type Etape =
  | { nom: 'choix' }
  | { nom: 'pret'; extrait: ExtraitAds }
  | { nom: 'envoi'; extrait: ExtraitAds }
  | { nom: 'refus'; extrait: ExtraitAds; erreur: string }
  | { nom: 'fini'; bilan: BilanImportAdsDto };

export function texteBilanAds(b: BilanImportAdsDto): string {
  return `Import n° ${b.numero} : ${pluriel(b.points, 'point non conforme', 'points non conformes')}, ${pluriel(b.objets, 'objet concerné', 'objets concernés')}, ${pluriel(b.noms, 'nom conservé', 'noms conservés')}.${b.nomsPurges ? ` Noms effacés de ${pluriel(b.nomsPurges, 'import plus ancien', 'imports plus anciens')} (seuls les deux derniers gardent leurs noms).` : ''}`;
}

export function ImportAdsSection({ onFait }: { onFait: () => void }) {
  const id = useId();
  const [etape, setEtape] = useState<Etape>({ nom: 'choix' });
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const lire = async (f: File | null) => {
    setFichier(f);
    setErreur(null);
    setEtape({ nom: 'choix' });
    if (!f) return;
    const e = erreurTailleAds(f.size);
    if (e) {
      setErreur(e);
      return;
    }
    try {
      setEtape({ nom: 'pret', extrait: lireRapportAds(lireJsonAds(await f.text())) });
    } catch (x) {
      setErreur(x instanceof ErreurRapportAds ? x.message : `Fichier illisible : ${errorMessage(x)}`);
    }
  };
  const envoyer = async (extrait: ExtraitAds) => {
    setEtape({ nom: 'envoi', extrait });
    try {
      const bilan = await api<BilanImportAdsDto>('POST', `${URL}/imports`, { body: corpsImportAds(extrait) });
      setEtape({ nom: 'fini', bilan });
      setFichier(null);
      onFait();
    } catch (x) {
      setEtape({ nom: 'refus', extrait, erreur: errorMessage(x) });
    }
  };
  return (
    <Stack>
      <Title order={2} size="h4">
        Importer un rapport
      </Title>
      <Text size="sm" c="dimmed" className="lecture">
        Choisissez le rapport JSON de l’analyse de l’Active Directory remis par le service ADS de l’ANSSI (à partir de
        votre collecte ORADAD). Il est lu dans votre navigateur : seuls partent la note globale, la progression par
        niveau, les points de contrôle non conformes et, pour chacun, le nombre d’objets concernés et au plus{' '}
        {ADS_BORNES.nomsParPoint} noms courts avec leur nature. Ne partent jamais : mots de passe, empreintes, attributs
        des comptes, SID, chemins LDAP complets, nom de domaine, nom du fichier. Seuls les deux derniers imports gardent
        leurs noms.
      </Text>
      <FileInput
        label="Rapport de l’Active Directory (JSON)"
        description={`Rapport JSON, ${ADS_BORNES.fichierMo} Mo au plus.`}
        placeholder="Choisir un fichier"
        accept=".json,application/json"
        value={fichier}
        onChange={(f) => void lire(f)}
        disabled={etape.nom === 'envoi'}
        clearable={etape.nom !== 'envoi'}
        error={erreur ?? undefined}
        clearButtonProps={{ 'aria-label': 'Retirer le fichier' }}
      />
      {(etape.nom === 'pret' || etape.nom === 'refus' || etape.nom === 'envoi') && (
        <Stack gap="xs">
          <Text size="sm" role="status">
            {resumeExtraitAds(etape.extrait)}
          </Text>
          <Text size="xs" c="dimmed">
            Écartés ou raccourcis sur votre poste : {libelleEcartsAds(etape.extrait.ecartes)}.
          </Text>
          {etape.nom === 'refus' && (
            <RefusImport id={`${id}-refus`} erreur={etape.erreur} rien="Rien n’a été importé." />
          )}
          <Group justify="flex-end">
            <Button
              loading={etape.nom === 'envoi'}
              onClick={() => void envoyer(etape.extrait)}
              aria-describedby={etape.nom === 'refus' ? `${id}-refus` : undefined}
            >
              Importer
            </Button>
          </Group>
        </Stack>
      )}
      {etape.nom === 'fini' && (
        <Alert color="teal" role="status" title="Import terminé">
          {texteBilanAds(etape.bilan)}
        </Alert>
      )}
    </Stack>
  );
}

/* ------------------------------------------------------------------ Historique et suppression */
export function HistoriqueAds({
  historique,
  administrer,
  onSupprime,
}: {
  historique: readonly ImportAdsDto[];
  administrer: boolean;
  onSupprime: () => void;
}) {
  const [cible, setCible] = useState<ImportAdsDto | null>(null);
  if (!historique.length) return null;
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">
        Imports
      </Title>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Import</Table.Th>
            <Table.Th>Rapport du</Table.Th>
            <Table.Th>Note</Table.Th>
            <Table.Th>Points non conformes</Table.Th>
            <Table.Th>Objets</Table.Th>
            <Table.Th>Noms</Table.Th>
            {administrer && <Table.Th>Action</Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {historique.map((h) => (
            <Table.Tr key={h.id}>
              <Table.Td>
                n° {h.numero}, le <span className="horodatage">{horodatage(h.importeLe)}</span> par {h.importePar}
              </Table.Td>
              <Table.Td>{jour(h.dateRapport)}</Table.Td>
              <Table.Td>{h.note} sur 5</Table.Td>
              <Table.Td>{h.points.toLocaleString('fr-FR')}</Table.Td>
              <Table.Td>{h.objets.toLocaleString('fr-FR')}</Table.Td>
              <Table.Td>{h.nomsConserves ? 'gardés' : 'effacés (nombres seulement)'}</Table.Td>
              {administrer && (
                <Table.Td>
                  <Button size="xs" variant="default" color="red" onClick={() => setCible(h)}>
                    Supprimer
                  </Button>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {administrer && cible && (
        <SuppressionImportAds
          key={cible.id}
          cible={cible}
          onAnnuler={() => setCible(null)}
          onFait={() => {
            setCible(null);
            onSupprime();
          }}
        />
      )}
    </Stack>
  );
}

export function SuppressionImportAds({
  cible,
  onAnnuler,
  onFait,
}: {
  cible: ImportAdsDto;
  onAnnuler: () => void;
  onFait: () => void;
}) {
  const id = useId();
  const [saisie, setSaisie] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const confirmer = async () => {
    setOccupe(true);
    setErreur(null);
    try {
      await api('DELETE', `${URL}/imports/${cible.id}`, { ifMatch: cible.version });
      onFait();
    } catch (e) {
      setErreur(errorMessage(e));
    } finally {
      setOccupe(false);
    }
  };
  return (
    <Stack>
      <Alert color="red" title={`Supprimer l’import n° ${cible.numero}`}>
        <Text size="sm" id={`${id}-avertissement`}>
          L’import du rapport du {jour(cible.dateRapport)} disparaîtra définitivement : sa note, sa progression,{' '}
          {pluriel(cible.points, 'point de contrôle', 'points de contrôle')} et{' '}
          {pluriel(cible.objets, 'objet compté', 'objets comptés')}
          {cible.nomsConserves ? ', avec leurs noms' : ''}. Le journal d’audit reste (il ne contient aucun nom).
        </Text>
      </Alert>
      <TextInput
        label={`Saisissez ${MOT_SUPPRESSION} pour confirmer`}
        value={saisie}
        onChange={(e) => setSaisie(e.currentTarget.value)}
        disabled={occupe}
        autoComplete="off"
      />
      {erreur && (
        <Alert color="red" role="alert" title="Suppression refusée">
          {erreur}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onAnnuler} disabled={occupe}>
          Annuler
        </Button>
        <Button
          color="red"
          loading={occupe}
          disabled={saisie !== MOT_SUPPRESSION}
          aria-describedby={`${id}-avertissement`}
          onClick={() => void confirmer()}
        >
          Supprimer définitivement
        </Button>
      </Group>
    </Stack>
  );
}

/* ------------------------------------------------------------------ Page */
/** Contenu de la page à partir des données (sans requête, sauf les noms demandés sur clic). */
export function AnnuaireAdContenu({
  data,
  administrer,
  onChange,
}: {
  data: AnnuaireAdsDto;
  administrer: boolean;
  onChange: () => void;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  return (
    <Stack gap="lg">
      <NoteAds data={data} />
      {data.courant && (
        <>
          <ProgressionAds progression={data.courant.progression} conformes={data.courant.conformes} />
          <NiveauxTypesAds points={data.points} />
          <Stack gap="xs">
            <Title order={2} size="h4">
              Points de contrôle ouverts ({data.points.length})
            </Title>
            <Text size="sm" c="dimmed">
              Les noms des objets concernés se demandent point par point (« Voir les noms ») ; chaque consultation est
              inscrite au journal d’audit (sans les noms). Les noms ne quittent pas la plateforme.
            </Text>
            <PointsOuvertsAds points={data.points} ouvert={ouvert} onOuvrir={setOuvert} />
          </Stack>
          <CorrigesAds corriges={data.corriges} precedent={data.precedent} ouvert={ouvert} onOuvrir={setOuvert} />
        </>
      )}
      <HistoriqueAds historique={data.historique} administrer={administrer} onSupprime={onChange} />
      {administrer && <ImportAdsSection onFait={onChange} />}
    </Stack>
  );
}

export function AnnuaireAdPage() {
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: CLE, queryFn: () => get<AnnuaireAdsDto>(URL) });
  return (
    <Page>
      <EnteteVulnerabilites
        title="Active Directory"
        description="Rapport d’analyse de l’Active Directory par le service ADS de l’ANSSI (collecte ORADAD) : note globale, progression par niveau et points de contrôle non conformes. Le type d’un point est donné en numéro : 1 information, 2 avertissement, 3 vulnérabilité."
      />
      <ErrorAlert error={q.error} />
      {q.data && (
        <AnnuaireAdContenu
          data={q.data}
          administrer={can('vulnerabilites', 'administrer')}
          onChange={() => void qc.invalidateQueries({ queryKey: CLE })}
        />
      )}
    </Page>
  );
}
