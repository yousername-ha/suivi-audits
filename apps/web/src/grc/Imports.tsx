import { Alert, Button, Card, FileInput, Group, Select, Stack, Text, Textarea } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FrameworkDefinition, GrcObject } from '@suivi/shared';
import { api, get, saveBlob } from '../api';
import { ErrorAlert } from '../components/common';
import { exampleFramework } from './Publication';
import { frameworkWorkbook, readFrameworkWorkbook, saveWorkbook } from './workbook';
import { committeeReport } from './report';
import { useCan } from '../session';
export function Imports({ smsi }: { smsi: string }) {
  const can = useCan(),
    qc = useQueryClient(),
    [text, setText] = useState(''),
    [preview, setPreview] = useState<{
      previewId: string;
      canImport: boolean;
      duplicate: boolean;
      requirements: number;
      domains: number;
      mappings: number;
    } | null>(null),
    [error, setError] = useState<unknown>(null),
    [confirm, setConfirm] = useState(false),
    [selected, setSelected] = useState<string | null>(null);
  const frameworks = useQuery({
    queryKey: ['grc', smsi, 'frameworks-export'],
    queryFn: () => get<{ items: GrcObject[] }>(`/api/grc/${smsi}/objects?kind=framework`),
    enabled: can('conformite', 'lire'),
  });
  const simulate = async () => {
    try {
      setError(null);
      setPreview(await api('POST', `/api/grc/${smsi}/import/preview`, { body: { data: JSON.parse(text) } }));
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
      else saveBlob('referentiel.json', JSON.stringify({ definition, mappings: [] }, null, 2));
    } catch (e) {
      setError(e);
    }
  };
  return (
    <Stack>
      <Alert>
        Les fichiers sont lus localement dans le navigateur, puis validés par le serveur de cette installation. Aucune
        donnée n’est envoyée à un service tiers. Une simulation puis une confirmation humaine sont obligatoires.
      </Alert>
      <Group>
        <Button
          variant="light"
          onClick={() =>
            saveBlob('exemple-fictif.json', JSON.stringify({ definition: exampleFramework, mappings: [] }, null, 2))
          }
        >
          Exemple fictif JSON
        </Button>
        <Button
          variant="light"
          onClick={() => saveWorkbook('exemple-fictif.xlsx', frameworkWorkbook(exampleFramework))}
        >
          Gabarit et exemple Excel
        </Button>
        <Button
          variant="subtle"
          onClick={() =>
            saveBlob(
              'guide-import.txt',
              'Gabarit Excel : quatre feuilles Métadonnées (Champ/Valeur ; source en JSON), Domaines (id/label), Exigences (id/domain/title/description/applicability/measureRefs en JSON), Correspondances (source/target en JSON avec frameworkId/version/requirementId, type/justification/coverage/origin/status/sourceUrl/reviewNote). Les cibles doivent déjà être publiées dans ce périmètre ; les mappings sont toujours proposés. Conserver les noms des feuilles et colonnes. Remplacer toute formule par sa valeur. 8 Mo compressés / 20 Mo décompressés, 10 000 exigences. Indiquer la source officielle, sa version et les droits de reproduction. Les exemples PSSI sont fictifs et organisationnels. Les correspondances importées restent proposées et exigent une revue humaine. Simuler, corriger les erreurs et doublons, puis confirmer IMPORTER. Aucun texte ISO sous licence n’est livré.',
              'text/plain',
            )
          }
        >
          Guide d’importation
        </Button>
      </Group>
      <ErrorAlert error={error ?? frameworks.error} />
      {can('import_export', 'modifier') && (
        <>
          <FileInput
            label="Fichier JSON ou Excel"
            accept=".json,.xlsx"
            onChange={async (file) => {
              try {
                setError(null);
                setPreview(null);
                setConfirm(false);
                if (!file) return;
                if (file.size > 8 * 1024 * 1024) throw new Error('Fichier limité à 8 Mo.');
                setText(
                  file.name.toLowerCase().endsWith('.xlsx')
                    ? JSON.stringify(readFrameworkWorkbook(new Uint8Array(await file.arrayBuffer())), null, 2)
                    : await file.text(),
                );
              } catch (e) {
                setError(e);
              }
            }}
          />
          <Textarea
            label="Contenu à simuler"
            minRows={10}
            value={text}
            onChange={(e) => {
              setText(e.currentTarget.value);
              setPreview(null);
              setConfirm(false);
            }}
          />
          <Button onClick={() => void simulate()}>Simuler l’importation</Button>
          {preview && (
            <Card withBorder>
              <Text>
                {preview.domains} domaines · {preview.requirements} exigences · {preview.mappings} propositions de
                correspondance
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
              <Button
                onClick={async () => {
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
                }}
              >
                Confirmer l’importation
              </Button>
            </Alert>
          )}
        </>
      )}
      <Select
        label="Référentiel à exporter"
        data={(frameworks.data?.items ?? []).map((f) => ({ value: f.id, label: f.name }))}
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
          <Button
            variant="light"
            onClick={async () => {
              try {
                const report = await get(`/api/grc/${smsi}/report`);
                saveBlob('rapport-comite-smsi.html', committeeReport(report), 'text/html');
              } catch (e) {
                setError(e);
              }
            }}
          >
            Rapport de pilotage / audit
          </Button>
          <Button
            variant="subtle"
            onClick={async () => {
              try {
                saveBlob('rapport-comite-smsi.json', JSON.stringify(await get(`/api/grc/${smsi}/report`), null, 2));
              } catch (e) {
                setError(e);
              }
            }}
          >
            Données du rapport JSON
          </Button>
        </Group>
      )}
    </Stack>
  );
}
