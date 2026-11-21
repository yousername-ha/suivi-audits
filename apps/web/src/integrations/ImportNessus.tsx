/* Module Vulnérabilités (ADR 0100, lot N1) : fenêtre « Importer un scan » d'une instance « Nessus, import de fichier », dans
   la carte « Intégrations » de la page Plateforme (toute action de connecteur vit là, jamais dans les écrans du module).
   Le fichier est lu sur le poste (nessus.ts) ; seul l'extrait en liste blanche part, par lots de machines entières, avec la
   progression annoncée. Si un lot échoue, l'import s'arrête, l'écran dit quelles machines sont importées et lesquelles ne le
   sont pas, et l'import est clos côté serveur (en échec, les machines importées le restent). Le nom du fichier n'est jamais
   envoyé. CSP stricte (ADR 0006) : ni style ni script en ligne.
   Lot N2 : un import refusé avant tout envoi (limite horaire des imports commencés, 429, ou autre refus du serveur) est dit
   dans une alerte « Import refusé », reliée au bouton « Importer » ; la fenêtre reste ouverte et le fichier reste choisi. */
import { Alert, Button, FileInput, Group, List, Progress, Stack, Text } from '@mantine/core';
import {
  type BilanImportNessus,
  type DebutImportDto,
  GRAVITES_PAR_DEFAUT,
  GRAVITES_TENABLE,
  type GraviteTenable,
  type IntegrationDto,
  type LotImportNessus,
  NESSUS_BORNES,
  type ResultatLotImportDto,
} from '@suivi/shared';
import { useId, useState } from 'react';
import { api, errorMessage } from '../api';
import {
  decouperEnLots,
  ErreurImport,
  erreurTaille,
  extraireNessus,
  type ExtraitNessus,
  libelleEcartes,
  libelleGravitesImport,
  listeBornee,
  lireDocument,
  nomAffiche,
  resumeBilanImport,
  resumeExtrait,
} from './nessus';

/** Gravités retenues par l'instance (critiques et élevées par défaut). */
export const gravitesInstance = (i: Pick<IntegrationDto, 'configuration'>): GraviteTenable[] => {
  const g = i.configuration.gravites;
  return Array.isArray(g) ? GRAVITES_TENABLE.filter((x) => g.includes(x)) : [...GRAVITES_PAR_DEFAUT];
};

type Etape =
  | { nom: 'choix' }
  | { nom: 'lecture' }
  | { nom: 'pret'; extrait: ExtraitNessus; lots: LotImportNessus[] }
  | { nom: 'envoi'; extrait: ExtraitNessus; lots: LotImportNessus[]; faits: number; machines: number }
  | { nom: 'fini'; bilan: BilanImportNessus }
  | { nom: 'refus'; erreur: string; extrait: ExtraitNessus; lots: LotImportNessus[] }
  | { nom: 'arret'; erreur: string; importees: string[]; restantes: string[] };

/** Progression annoncée (texte et valeur) : lot courant, machines importées. */
export function texteProgression(faits: number, lots: number, machines: number, total: number): string {
  return `Lot ${Math.min(faits + 1, lots)} sur ${lots} : ${machines.toLocaleString('fr-FR')} machine${machines > 1 ? 's' : ''} importée${machines > 1 ? 's' : ''} sur ${total.toLocaleString('fr-FR')}.`;
}

/** Refus d'un import avant tout envoi (lot N2) : message du serveur tel quel (par exemple la limite horaire des imports
    commencés), rien n'est importé. `id` relie le texte de l'alerte au bouton « Importer » (description accessible). */
export function RefusImport({
  id,
  erreur,
  rien = 'Aucune machine n’a été importée.',
}: {
  id: string;
  erreur: string;
  /** Ce qui n'a pas été importé (lot SI1 : « Aucun hôte ni constat n'a été importé. » pour Silène). */
  rien?: string;
}) {
  return (
    <Alert color="red" role="alert" title="Import refusé">
      <Stack gap="xs" id={id}>
        <Text size="sm">{erreur}</Text>
        <Text size="sm">{rien} Le fichier reste choisi : relancez l’import plus tard.</Text>
      </Stack>
    </Alert>
  );
}

/** Contenu de la fenêtre d'import (l'appelant fournit la fenêtre) ; `onOccupe` empêche la fermeture pendant l'envoi. */
export function ImportNessus({
  instance,
  onOccupe,
  onFait,
}: {
  instance: Pick<IntegrationDto, 'id' | 'nom' | 'configuration'>;
  onOccupe?: (occupe: boolean) => void;
  onFait?: () => void;
}) {
  const id = useId();
  const [etape, setEtape] = useState<Etape>({ nom: 'choix' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const gravites = gravitesInstance(instance);

  const lire = async (f: File | null) => {
    setFichier(f);
    setErreur(null);
    if (!f) {
      setEtape({ nom: 'choix' });
      return;
    }
    const e = erreurTaille(f.size);
    if (e) {
      setErreur(e);
      setEtape({ nom: 'choix' });
      return;
    }
    setEtape({ nom: 'lecture' });
    try {
      const extrait = extraireNessus(lireDocument(await f.text()), gravites);
      const lots = decouperEnLots(extrait);
      if (!extrait.machines.length)
        throw new ErreurImport(`Aucune machine à importer (écartés : ${libelleEcartes(extrait.ecartes)}).`);
      setEtape({ nom: 'pret', extrait, lots });
    } catch (x) {
      setErreur(x instanceof ErreurImport ? x.message : `Fichier illisible : ${errorMessage(x)}`);
      setEtape({ nom: 'choix' });
    }
  };

  const envoyer = async (extrait: ExtraitNessus, lots: LotImportNessus[]) => {
    setErreur(null);
    onOccupe?.(true);
    let debut: DebutImportDto | null = null;
    let faits = 0;
    let machines = 0;
    setEtape({ nom: 'envoi', extrait, lots, faits, machines });
    try {
      debut = await api<DebutImportDto>('POST', `/api/integrations/instances/${instance.id}/imports`, {
        body: { machines: extrait.machines.length, detections: extrait.detections, ecartes: extrait.ecartes },
      });
      if (debut.gravites.join() !== extrait.gravites.join())
        throw new ErreurImport(
          `La configuration de l’instance a changé pendant la lecture (gravités retenues : ${libelleGravitesImport(debut.gravites)}) : rouvrez la fenêtre et choisissez de nouveau le fichier.`,
        );
      for (const lot of lots) {
        const r = await api<ResultatLotImportDto>(
          'POST',
          `/api/integrations/instances/${instance.id}/imports/${debut.id}/lots`,
          { body: lot },
        );
        faits += 1;
        machines = r.machines;
        setEtape({ nom: 'envoi', extrait, lots, faits, machines });
      }
      const bilan = await api<BilanImportNessus>(
        'POST',
        `/api/integrations/instances/${instance.id}/imports/${debut.id}/fin`,
        { body: {} },
      );
      setEtape({ nom: 'fini', bilan });
    } catch (x) {
      // Refus avant tout envoi (limite horaire, instance occupée…) : rien n'est commencé, la fenêtre le dit.
      if (!debut) {
        setEtape({ nom: 'refus', erreur: errorMessage(x), extrait, lots });
        return;
      }
      // Arrêt : les lots déjà rangés le restent ; l'import est clos (en échec) pour libérer l'instance.
      await api('POST', `/api/integrations/instances/${instance.id}/imports/${debut.id}/fin`, { body: {} }).catch(
        () => undefined,
      );
      const noms = lots.flatMap((l) => l.machines.map(nomAffiche));
      const n = lots.slice(0, faits).reduce((s, l) => s + l.machines.length, 0);
      setEtape({
        nom: 'arret',
        erreur: x instanceof ErreurImport ? x.message : errorMessage(x),
        importees: noms.slice(0, n),
        restantes: noms.slice(n),
      });
    } finally {
      onOccupe?.(false);
      onFait?.();
    }
  };

  const enCours = etape.nom === 'envoi' || etape.nom === 'lecture';
  return (
    <Stack>
      <Text size="sm" c="dimmed" className="lecture">
        Exportez le scan depuis Nessus au format « .nessus », puis choisissez-le ici. Le fichier est lu dans votre
        navigateur : seuls les champs utiles des machines et des failles partent vers le serveur (ni sortie brute des
        contrôles, ni description longue, ni politique du scan ni comptes de scan, ni nom du fichier). Gravités retenues
        : {libelleGravitesImport(gravites)} (réglage « Configurer »). Pour chaque machine du fichier, une faille qui n’y
        figure plus est considérée comme disparue ; les machines absentes du fichier ne changent pas.
      </Text>
      <FileInput
        label="Fichier .nessus"
        description={`Export d’un scan Nessus (XML « NessusClientData_v2 »), ${NESSUS_BORNES.fichierMo} Mo au plus.`}
        placeholder="Choisir un fichier"
        accept=".nessus,application/xml,text/xml"
        value={fichier}
        onChange={(f) => void lire(f)}
        disabled={enCours}
        clearable={!enCours}
        error={erreur ?? undefined}
        clearButtonProps={{ 'aria-label': 'Retirer le fichier' }}
      />
      {etape.nom === 'lecture' && (
        <Text size="sm" role="status">
          Lecture du fichier sur votre poste…
        </Text>
      )}
      {(etape.nom === 'pret' || etape.nom === 'refus') && (
        <Stack gap="xs">
          <Text size="sm" role="status">
            {resumeExtrait(etape.extrait)} Envoi en {etape.lots.length} lot{etape.lots.length > 1 ? 's' : ''}.
          </Text>
          <Text size="xs" c="dimmed">
            Écartés sur votre poste : {libelleEcartes(etape.extrait.ecartes)}.
          </Text>
          {etape.nom === 'refus' && <RefusImport id={`${id}-refus`} erreur={etape.erreur} />}
          <Group justify="flex-end">
            <Button
              onClick={() => void envoyer(etape.extrait, etape.lots)}
              aria-describedby={etape.nom === 'refus' ? `${id}-refus` : undefined}
            >
              Importer
            </Button>
          </Group>
        </Stack>
      )}
      {etape.nom === 'envoi' && (
        <Stack gap="xs">
          <Progress.Root size="lg">
            <Progress.Section
              value={Math.round((etape.faits / Math.max(etape.lots.length, 1)) * 100)}
              aria-label="Progression de l’import"
              aria-describedby={`${id}-progression`}
              animated
            />
          </Progress.Root>
          <Text size="sm" role="status" aria-live="polite" id={`${id}-progression`}>
            {texteProgression(etape.faits, etape.lots.length, etape.machines, etape.extrait.machines.length)}
          </Text>
        </Stack>
      )}
      {etape.nom === 'fini' && (
        <Alert color="teal" role="status" title="Import terminé">
          {resumeBilanImport(etape.bilan)}
        </Alert>
      )}
      {etape.nom === 'arret' && (
        <Alert color="red" role="alert" title="Import interrompu">
          <Stack gap="xs">
            <Text size="sm">{etape.erreur}</Text>
            <List size="sm">
              <List.Item>
                Machines importées ({etape.importees.length}) : {listeBornee(etape.importees)}.
              </List.Item>
              <List.Item>
                Machines non importées ({etape.restantes.length}) : {listeBornee(etape.restantes)}.
              </List.Item>
            </List>
            <Text size="sm">
              Les machines importées le restent. Réimportez le fichier pour les autres : une machine déjà importée est
              simplement mise à jour.
            </Text>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
