/* Import et rapports : importation d'un référentiel (simulation puis confirmation humaine), export d'un référentiel,
   rapport de pilotage et d'audit, modèles fictifs. Style « Verre » (dessin DocImports validé par le RSSI le 28/11/2026,
   ImportsVerre.tsx) : mêmes appels, mêmes droits, même confirmation ; les autres styles gardent le rendu ci-dessous. */
import { Alert, Button, Card, FileInput, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { APropos } from '@suivi/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition, GrcObject } from '@suivi/shared';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { exampleFramework } from './Publication';
import { frameworkWorkbook, readFrameworkWorkbook, saveWorkbook } from './workbook';
import { committeeReport } from './report';
import { useCan, useMe } from '../session';
import type { SimulationImport } from './imports-verre';
import { ImportsVerre } from './ImportsVerre';

const GUIDE_IMPORT =
  'Gabarit Excel : trois feuilles Métadonnées (Champ/Valeur ; source en JSON), Domaines (id/label), Exigences (id/domain/title/description/applicability/measureRefs en JSON). Conserver les noms des feuilles et colonnes. Remplacer toute formule par sa valeur. 8 Mo compressés / 20 Mo décompressés, 10 000 exigences. Indiquer la source officielle, sa version et les droits de reproduction. Les exemples PSSI sont fictifs et organisationnels. Simuler, corriger les erreurs et doublons, puis confirmer IMPORTER. Aucun texte ISO sous licence n’est livré.';

export function Imports({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    verre = useMe().appearance.style === 'verre',
    [text, setText] = useState(''),
    [preview, setPreview] = useState<SimulationImport | null>(null),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    // Style « Verre » : fichier choisi, heure de la simulation et refus de la simulation, montrés dans le bloc d'import.
    [fichier, setFichier] = useState<{ nom: string; taille: number } | null>(null),
    [simuleA, setSimuleA] = useState<Date | null>(null),
    [erreurSimulation, setErreurSimulation] = useState<unknown>(null);
  const frameworks = useQuery({
    queryKey: ['grc', smsi, 'frameworks-export'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=framework`),
    enabled: can('conformite', 'lire'),
  });
  const simulate = async () => {
    try {
      setError(null);
      setErreurSimulation(null);
      setPreview(await api('POST', `/api/grc/${smsi}/import/preview`, { body: { data: JSON.parse(text) } }));
      setSimuleA(new Date());
    } catch (e) {
      setError(e);
      setErreurSimulation(e);
    }
  };
  const choisirFichier = async (file: File | null) => {
    try {
      setError(null);
      setErreurSimulation(null);
      setPreview(null);
      setConfirm(false);
      if (!file) {
        setFichier(null);
        return;
      }
      if (file.size > 8 * 1024 * 1024) throw new Error('Fichier limité à 8 Mo.');
      setText(
        file.name.toLowerCase().endsWith('.xlsx')
          ? JSON.stringify(readFrameworkWorkbook(new Uint8Array(await file.arrayBuffer())), null, 2)
          : await file.text(),
      );
      setFichier({ nom: file.name, taille: file.size });
    } catch (e) {
      setError(e);
    }
  };
  const saisir = (v: string) => {
    setText(v);
    setPreview(null);
    setConfirm(false);
  };
  const confirmer = async () => {
    try {
      await api('POST', `/api/grc/${smsi}/import/commit`, {
        body: { data: JSON.parse(text), previewId: preview!.previewId, confirm: 'IMPORTER' },
      });
      setConfirm(false);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['grc', smsi] });
    } catch (e) {
      setError(e);
    }
  };
  const exportSelected = async (excel = false) => {
    try {
      await get(`/api/grc/${smsi}/export/authorize?kind=frameworks`);
      const f = frameworks.data?.items.find((f) => f.id === selected);
      if (!f) throw new Error('Choisissez un référentiel.');
      const definition = f.data.definition as FrameworkDefinition;
      if (excel) saveWorkbook('referentiel.xlsx', frameworkWorkbook(definition));
      else saveBlob('referentiel.json', JSON.stringify({ definition }, null, 2));
    } catch (e) {
      setError(e);
    }
  };
  const rapport = async () => {
    try {
      const report = await get(`/api/grc/${smsi}/report`);
      saveBlob('rapport-comite-smsi.html', committeeReport(report), 'text/html');
    } catch (e) {
      setError(e);
    }
  };
  const rapportJson = async () => {
    try {
      saveBlob('rapport-comite-smsi.json', JSON.stringify(await get(`/api/grc/${smsi}/report`), null, 2));
    } catch (e) {
      setError(e);
    }
  };
  const exempleJson = () => saveBlob('exemple-fictif.json', JSON.stringify({ definition: exampleFramework }, null, 2));
  const gabarit = () => saveWorkbook('exemple-fictif.xlsx', frameworkWorkbook(exampleFramework));
  const guide = () => saveBlob('guide-import.txt', GUIDE_IMPORT, 'text/plain');
  const referentiels = (frameworks.data?.items ?? []).map((f) => ({ value: f.id, label: f.name }));

  if (verre)
    return (
      <ImportsVerre
        peutImporter={can('import_export', 'modifier')}
        peutExporter={can('import_export', 'exporter')}
        peutExporterReferentiel={can('conformite', 'exporter')}
        // Le refus de la simulation est montré dans le bloc d'import, avec ses motifs.
        erreur={
          <ErrorAlert error={error && error === erreurSimulation ? frameworks.error : (error ?? frameworks.error)} />
        }
        fichier={fichier}
        texte={text}
        onTexte={saisir}
        onFichier={(f) => void choisirFichier(f)}
        simulation={preview}
        simuleA={simuleA}
        erreurSimulation={erreurSimulation}
        onSimuler={() => void simulate()}
        onAppliquer={() => setConfirm(true)}
        confirmation={confirm}
        onConfirmer={() => void confirmer()}
        referentiels={referentiels}
        referentiel={selected}
        onReferentiel={setSelected}
        onExporter={(excel) => void exportSelected(excel)}
        onRapport={() => void rapport()}
        onRapportJson={() => void rapportJson()}
        onExempleJson={exempleJson}
        onGabarit={gabarit}
        onGuide={guide}
      />
    );
  return (
    <Stack>
      <APropos>
        Les fichiers sont lus localement dans le navigateur, puis validés par le serveur de cette installation. Aucune
        donnée n’est envoyée à un service tiers. Une simulation puis une confirmation humaine sont obligatoires.
      </APropos>
      <Group>
        <Button variant="light" onClick={exempleJson}>
          Exemple fictif JSON
        </Button>
        <Button variant="light" onClick={gabarit}>
          Gabarit et exemple Excel
        </Button>
        <Button variant="subtle" onClick={guide}>
          Guide d’importation
        </Button>
      </Group>
      <ErrorAlert error={error ?? frameworks.error} />
      {can('import_export', 'modifier') && (
        <>
          <FileInput label="Fichier JSON ou Excel" accept=".json,.xlsx" onChange={(f) => void choisirFichier(f)} />
          <Textarea
            label="Contenu à simuler"
            minRows={10}
            value={text}
            onChange={(e) => saisir(e.currentTarget.value)}
          />
          <Button onClick={() => void simulate()}>Simuler l’importation</Button>
          {preview && (
            <Card withBorder>
              <Text>
                {preview.domains} domaines · {preview.requirements} exigences
              </Text>
              {preview.duplicate && <Alert>Identifiant de référentiel déjà présent : importation refusée.</Alert>}
              <Button disabled={!preview.canImport} onClick={() => setConfirm(true)}>
                Importer le contenu simulé
              </Button>
            </Card>
          )}
          {confirm && (
            <Alert>
              <Text>Confirmez l’importation atomique dans le périmètre sélectionné.</Text>
              <Button onClick={() => void confirmer()}>Confirmer l’importation</Button>
            </Alert>
          )}
        </>
      )}
      <Select
        allowDeselect={false}
        label="Référentiel à exporter"
        data={referentiels}
        value={selected}
        onChange={setSelected}
      />
      {can('import_export', 'exporter') && (
        <Group>
          <Button disabled={!can('conformite', 'exporter')} onClick={() => void exportSelected()}>
            Exporter JSON
          </Button>
          <Button disabled={!can('conformite', 'exporter')} variant="light" onClick={() => void exportSelected(true)}>
            Exporter Excel
          </Button>
          <Button variant="light" onClick={() => void rapport()}>
            Rapport de pilotage / audit
          </Button>
          <Button variant="subtle" onClick={() => void rapportJson()}>
            Données du rapport JSON
          </Button>
        </Group>
      )}
    </Stack>
  );
}
