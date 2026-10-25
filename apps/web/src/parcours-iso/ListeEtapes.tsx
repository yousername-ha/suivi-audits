/* Vue Liste : les mêmes étapes, sous-actions et identifiants que l'arbre (une seule source de contenu), avec recherche. */
import { Badge, Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { BRANCHE_LABELS, BRANCHES_PARCOURS, etapesAffichees, type EtapeParcours } from '@suivi/shared';
import { SousActionDetail } from './SousActionDetail';
import { LIBELLE_PRESENCE, presence, type TravauxDuType } from './travaux';

const norme = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('fr');

export function ListeEtapes({
  smsi,
  hds,
  travaux,
  onOuvrirEtape,
}: {
  smsi: string;
  hds: boolean;
  travaux: Record<string, TravauxDuType>;
  onOuvrirEtape: (etape: EtapeParcours, sousAction?: string) => void;
}) {
  const [recherche, setRecherche] = useState('');
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const etapes = useMemo(() => {
    const q = norme(recherche.trim());
    return etapesAffichees(hds).filter(
      (e) =>
        !q ||
        norme(
          [e.titre, e.sousTitre, e.reference, e.module, ...e.sousActions.flatMap((s) => [s.titre, s.description])].join(
            ' ',
          ),
        ).includes(q),
    );
  }, [recherche, hds]);
  const bascule = (id: string) =>
    setOuvertes((o) => {
      const n = new Set(o);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  return (
    <Stack>
      <TextInput
        label="Rechercher une étape ou une sous-action"
        placeholder="par exemple : risques, périmètre, audit"
        value={recherche}
        onChange={(e) => setRecherche(e.currentTarget.value)}
      />
      {!etapes.length && <Text c="dimmed">Aucune étape ne correspond à cette recherche.</Text>}
      {BRANCHES_PARCOURS.map((b) => {
        const liste = etapes.filter((e) => e.branche === b);
        if (!liste.length) return null;
        return (
          <section key={b} aria-label={BRANCHE_LABELS[b].nom} className="parcours-liste__branche" data-branche={b}>
            <Title order={2} size="h4">
              {BRANCHE_LABELS[b].nom}
            </Title>
            <Text size="sm" c="dimmed">
              {BRANCHE_LABELS[b].sousTitre}
            </Text>
            {liste.map((e) => {
              const pres = presence(
                travaux,
                e.sousActions.flatMap((s) => s.kinds),
              );
              return (
                <Card key={e.id} withBorder className="parcours-liste__etape" data-etape={e.id}>
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap" align="flex-start">
                      <div>
                        <Title order={3} size="h5">
                          {e.titre}
                        </Title>
                        <Text size="sm" c="dimmed">
                          {e.sousTitre} · {e.reference}
                        </Text>
                      </div>
                      <Badge
                        variant="light"
                        color={pres === 'presents' ? 'teal' : pres === 'indisponible' ? 'orange' : 'gray'}
                      >
                        {LIBELLE_PRESENCE[pres]}
                      </Badge>
                    </Group>
                    {e.sousActions.map((s) => (
                      <SousActionDetail
                        key={s.id}
                        smsi={smsi}
                        etape={e}
                        sousAction={s}
                        travaux={travaux}
                        ouverte={ouvertes.has(s.id)}
                        onBascule={() => bascule(s.id)}
                        idPrefixe="liste"
                      />
                    ))}
                    <Group>
                      <Button variant="default" size="compact-sm" onClick={() => onOuvrirEtape(e)}>
                        Ouvrir la fiche de l’étape
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </section>
        );
      })}
    </Stack>
  );
}
