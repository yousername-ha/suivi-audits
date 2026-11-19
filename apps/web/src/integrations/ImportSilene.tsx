/* Module Vulnérabilités (ADR 0100, lot SI1) : fenêtre « Importer un rapport » d'une instance « Silène, import de fichier »,
   dans la carte « Intégrations » de la page Plateforme. Le rapport JSON est lu sur le poste (silene.ts) ; seul l'extrait en
   liste blanche part, par lots (hôtes, puis constats), avec la progression annoncée. Si un lot échoue, l'import s'arrête et
   est clos côté serveur (en échec) : le rapport précédent reste celui qui fait foi. Refus avant tout envoi (limite horaire,
   autre refus) dit comme pour Nessus (lot N2). Le nom du fichier n'est jamais envoyé. CSP stricte (ADR 0006). */
import { Alert, Button, FileInput, Group, Progress, Stack, Text } from '@mantine/core';
import {
  type BilanImportSilene,
  type DebutImportSileneDto,
  type IntegrationDto,
  type LotImportSilene,
  type ResultatLotSileneDto,
  SILENE_BORNES,
} from '@suivi/shared';
import { useId, useState } from 'react';
import { api, errorMessage } from '../api';
import { RefusImport } from './ImportNessus';
import {
  decouperEnLotsSilene,
  ErreurImportSilene,
  erreurTailleSilene,
  extraireSilene,
  type ExtraitSilene,
  libelleEcartsSilene,
  lireJson,
  resumeBilanSilene,
  resumeExtraitSilene,
} from './silene';

type Etape =
  | { nom: 'choix' }
  | { nom: 'lecture' }
  | { nom: 'pret'; extrait: ExtraitSilene; lots: LotImportSilene[] }
  | { nom: 'envoi'; extrait: ExtraitSilene; lots: LotImportSilene[]; faits: number }
  | { nom: 'fini'; bilan: BilanImportSilene }
  | { nom: 'refus'; erreur: string; extrait: ExtraitSilene; lots: LotImportSilene[] }
  | { nom: 'arret'; erreur: string; faits: number; lots: number };

/** Progression annoncée : lot courant. */
export function texteProgressionSilene(faits: number, lots: number): string {
  return `Lot ${Math.min(faits + 1, lots)} sur ${lots} envoyé${faits > 1 ? 's' : ''} : ${faits} rangé${faits > 1 ? 's' : ''}.`;
}

/** Contenu de la fenêtre d'import (l'appelant fournit la fenêtre) ; `onOccupe` empêche la fermeture pendant l'envoi. */
export function ImportSilene({
  instance,
  onOccupe,
  onFait,
}: {
  instance: Pick<IntegrationDto, 'id' | 'nom'>;
  onOccupe?: (occupe: boolean) => void;
  onFait?: () => void;
}) {
  const id = useId();
  const [etape, setEtape] = useState<Etape>({ nom: 'choix' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const base = `/api/integrations/instances/${instance.id}/silene/imports`;

  const lire = async (f: File | null) => {
    setFichier(f);
    setErreur(null);
    if (!f) {
      setEtape({ nom: 'choix' });
      return;
    }
    const e = erreurTailleSilene(f.size);
    if (e) {
      setErreur(e);
      setEtape({ nom: 'choix' });
      return;
    }
    setEtape({ nom: 'lecture' });
    try {
      const extrait = extraireSilene(lireJson(await f.text()));
      if (!extrait.hotes.length && !extrait.constats.length)
        throw new ErreurImportSilene(
          `Aucun hôte ni constat à importer (écartés : ${libelleEcartsSilene(extrait.ecartes)}).`,
        );
      setEtape({ nom: 'pret', extrait, lots: decouperEnLotsSilene(extrait) });
    } catch (x) {
      setErreur(x instanceof ErreurImportSilene ? x.message : `Fichier illisible : ${errorMessage(x)}`);
      setEtape({ nom: 'choix' });
    }
  };

  const envoyer = async (extrait: ExtraitSilene, lots: LotImportSilene[]) => {
    setErreur(null);
    onOccupe?.(true);
    let debut: DebutImportSileneDto | null = null;
    let faits = 0;
    setEtape({ nom: 'envoi', extrait, lots, faits });
    try {
      debut = await api<DebutImportSileneDto>('POST', base, {
        body: {
          rapport: extrait.rapport,
          perimetre: extrait.perimetre,
          hotes: extrait.hotes.length,
          constats: extrait.constats.length,
          ecartes: extrait.ecartes,
        },
      });
      for (const lot of lots) {
        await api<ResultatLotSileneDto>('POST', `${base}/${debut.id}/lots`, { body: lot });
        faits += 1;
        setEtape({ nom: 'envoi', extrait, lots, faits });
      }
      const bilan = await api<BilanImportSilene>('POST', `${base}/${debut.id}/fin`, { body: {} });
      setEtape({ nom: 'fini', bilan });
    } catch (x) {
      if (!debut) {
        setEtape({ nom: 'refus', erreur: errorMessage(x), extrait, lots });
        return;
      }
      // Arrêt : l'import est clos (en échec) ; le rapport précédent reste celui qui fait foi.
      await api('POST', `${base}/${debut.id}/fin`, { body: {} }).catch(() => undefined);
      setEtape({ nom: 'arret', erreur: errorMessage(x), faits, lots: lots.length });
    } finally {
      onOccupe?.(false);
      onFait?.();
    }
  };

  const enCours = etape.nom === 'envoi' || etape.nom === 'lecture';
  return (
    <Stack>
      <Text size="sm" c="dimmed" className="lecture">
        Exportez le rapport depuis Silène au format JSON, puis choisissez-le ici. Le fichier est lu dans votre
        navigateur : seuls la note, le périmètre déclaré, les hôtes (adresse IP, noms, ports ouverts, produits) et les
        constats partent vers le serveur. Ne partent jamais : certificats et clés, en-têtes HTTP, sorties des sondes,
        titres de pages, géolocalisation et système autonome, passage précédent, nom du fichier. Chaque import est
        l’état complet de la surface vue par Silène à la date du rapport : ce qui n’y figure plus n’est plus présent.
      </Text>
      <FileInput
        label="Rapport Silène (JSON)"
        description={`Export JSON d’un rapport Silène, ${SILENE_BORNES.fichierMo} Mo au plus.`}
        placeholder="Choisir un fichier"
        accept=".json,application/json"
        value={fichier}
        onChange={(f) => void lire(f)}
        disabled={enCours}
        clearable={!enCours}
        error={erreur ?? undefined}
        clearButtonProps={{ 'aria-label': 'Retirer le fichier' }}
      />
      {etape.nom === 'lecture' && (
        <Text size="sm" role="status">
          Lecture du rapport sur votre poste…
        </Text>
      )}
      {(etape.nom === 'pret' || etape.nom === 'refus') && (
        <Stack gap="xs">
          <Text size="sm" role="status">
            {resumeExtraitSilene(etape.extrait)} Envoi en {etape.lots.length} lot{etape.lots.length > 1 ? 's' : ''}.
          </Text>
          <Text size="xs" c="dimmed">
            Écartés sur votre poste : {libelleEcartsSilene(etape.extrait.ecartes)}.
          </Text>
          {etape.nom === 'refus' && (
            <RefusImport id={`${id}-refus`} erreur={etape.erreur} rien="Aucun hôte ni constat n’a été importé." />
          )}
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
            {texteProgressionSilene(etape.faits, etape.lots.length)}
          </Text>
        </Stack>
      )}
      {etape.nom === 'fini' && (
        <Alert color="teal" role="status" title="Import terminé">
          {resumeBilanSilene(etape.bilan)}
        </Alert>
      )}
      {etape.nom === 'arret' && (
        <Alert color="red" role="alert" title="Import interrompu">
          <Stack gap="xs">
            <Text size="sm">{etape.erreur}</Text>
            <Text size="sm">
              {etape.faits} lot{etape.faits > 1 ? 's' : ''} sur {etape.lots} rangé{etape.faits > 1 ? 's' : ''}. Le
              rapport précédent reste celui qui fait foi : réimportez le fichier.
            </Text>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
