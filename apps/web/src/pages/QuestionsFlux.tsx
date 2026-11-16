/* Assistant d'installation, dernière étape : « Flux vers l'extérieur » (ADR 0097, point 5 et lot 3). Proposée une seule fois,
   à la première connexion complète du compte administrateur créé par l'installation : c'est là que la personne est
   authentifiée (second facteur enrôlé) avec le droit administration:administrer, si bien que chaque ouverture passe par les
   mêmes routes, droits, validation explicite et journal d'audit que les gestes d'activation du lot 1. Pour chaque module :
   « Activer » (contenu de validation et case obligatoire) ou « Plus tard » (aucun appel, le flux reste fermé) ; l'étape
   entière peut se passer d'un coup. Règles dans ../installation-flux. */
import { Alert, Anchor, Badge, Button, Card, Group, List, Loader, Stack, Text, TextInput, Title } from '@mantine/core';
import {
  FLUX_EXTERNES,
  FLUX_MODULES,
  fluxExterne,
  type FluxExternesOut,
  type FluxModule,
  type QuestionsFluxOut,
  type ReglagesAssistantDto,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { api, get, post } from '../api';
import { ASSISTANT_GLOBAL } from '../assistant/cles';
import { corpsActivationAssistant } from '../assistant/reglages-corps';
import { ErrorAlert } from '../components/common';
import { CLE_FLUX_EXTERNES } from '../components/FluxExternes';
import { Destinations, DetailValidationFlux } from '../components/ValidationFlux';
import { LIEN_FLUX_EXTERNES, pareFeuAOuvrir } from '../flux-externes';
import {
  aReglerEnsuite,
  appelOuverture,
  manques,
  modeInstallation,
  ouvertures,
  retourSur,
  SAISIE_VIDE,
  type ChoixFlux,
  type ModeInstallation,
  type SaisieQuestions,
} from '../installation-flux';
import { useCan } from '../session';

export const CLE_QUESTIONS_FLUX = ['installation', 'flux-externes'] as const;

/** Contenu de l'étape, sans requête : rendu seul dans les tests. */
export function EtapeFluxExterieur({
  ouvert,
  mode,
  saisie,
  onSaisie,
  envoi,
  erreur,
  onTerminer,
  onPasser,
}: {
  ouvert: (m: FluxModule) => boolean;
  mode: (m: FluxModule) => ModeInstallation;
  saisie: SaisieQuestions;
  onSaisie: (s: SaisieQuestions) => void;
  envoi: boolean;
  erreur: unknown;
  onTerminer: () => void;
  onPasser: () => void;
}) {
  const choisir = (m: FluxModule, c: ChoixFlux) =>
    onSaisie({ ...saisie, choix: { ...saisie.choix, [m]: c }, valides: { ...saisie.valides, [m]: false } });
  const manquants = manques(FLUX_MODULES, saisie, mode, ouvert);
  return (
    <Stack>
      <Text>
        Dernière étape de l’installation. Par défaut, aucun flux ne sort du serveur. Pour chaque module qui communique
        avec l’extérieur, choisissez « Activer » ou « Plus tard ». Activer ouvre son flux après votre validation
        explicite (destinations, ports, données qui sortent), inscrite au journal d’audit. Plus tard laisse le flux
        fermé : tout se change ensuite depuis la page de chaque module.
      </Text>
      {FLUX_EXTERNES.map((f) => {
        const id = `question-flux-${f.id}`;
        const choix = saisie.choix[f.id];
        const deja = ouvert(f.id);
        const m = mode(f.id);
        return (
          <Card key={f.id} withBorder component="section" aria-labelledby={id}>
            <Stack>
              <Group justify="space-between">
                <Title order={2} size="h4" id={id}>
                  {f.libelle}
                </Title>
                <Badge variant="light" color={deja ? 'green' : 'gray'}>
                  {deja ? 'Ouvert' : 'Fermé'}
                </Badge>
              </Group>
              <Text size="sm">{f.role}</Text>
              {deja ? (
                <Text size="sm">
                  Flux déjà ouvert : il se règle et se referme depuis{' '}
                  <Anchor component={Link} to={f.reglage.lien}>
                    sa page
                  </Anchor>
                  .
                </Text>
              ) : (
                <>
                  <Group>
                    <Button
                      variant={choix === 'activer' ? 'filled' : 'default'}
                      aria-pressed={choix === 'activer'}
                      onClick={() => choisir(f.id, 'activer')}
                    >
                      Activer
                    </Button>
                    <Button
                      variant={choix === 'plus-tard' ? 'filled' : 'default'}
                      aria-pressed={choix === 'plus-tard'}
                      onClick={() => choisir(f.id, 'plus-tard')}
                    >
                      Plus tard
                    </Button>
                  </Group>
                  {choix === 'plus-tard' && (
                    <Text size="sm" c="dimmed">
                      Le flux reste fermé. {f.siFerme}
                    </Text>
                  )}
                  {choix === 'activer' && m === 'direct' && (
                    <Stack>
                      {f.id === 'assistant' && (
                        <>
                          <TextInput
                            label="Adresse du service de modèle"
                            description="Adresse HTTPS d’une API compatible OpenAI, par exemple https://api.mistral.ai/v1 : c’est la destination du flux."
                            value={saisie.fournisseur.adresse}
                            onChange={(e) =>
                              onSaisie({
                                ...saisie,
                                fournisseur: { ...saisie.fournisseur, adresse: e.currentTarget.value },
                              })
                            }
                          />
                          <TextInput
                            label="Nom du modèle"
                            description="Tel que le fournisseur le nomme. Le modèle doit gérer l’appel d’outils."
                            value={saisie.fournisseur.modele}
                            onChange={(e) =>
                              onSaisie({
                                ...saisie,
                                fournisseur: { ...saisie.fournisseur, modele: e.currentTarget.value },
                              })
                            }
                          />
                          <Text size="sm" c="dimmed">
                            La clé du fournisseur et les profils de l’assistant se règlent ensuite dans{' '}
                            {f.reglage.libelle} : tant qu’aucune clé n’est enregistrée, rien ne sort.
                          </Text>
                        </>
                      )}
                      <DetailValidationFlux
                        module={f.id}
                        valide={saisie.valides[f.id] === true}
                        onValide={(v) => onSaisie({ ...saisie, valides: { ...saisie.valides, [f.id]: v } })}
                      />
                    </Stack>
                  )}
                  {choix === 'activer' && m === 'page' && (
                    <Stack gap="xs">
                      <Text size="sm">
                        Ce module s’active dans sa page ({f.reglage.libelle}), avec ses propres réglages : sans eux,
                        l’ouvrir ici n’aurait pas de sens. Le geste « {f.activation.geste} » y affiche la même
                        validation, avec sa case obligatoire. Le lien vous est proposé à la fin de cette étape ; d’ici
                        là, le flux reste fermé.
                      </Text>
                      <Destinations f={f} />
                      <Text size="sm">Ce qui sortira du serveur : {f.donnees}</Text>
                    </Stack>
                  )}
                </>
              )}
            </Stack>
          </Card>
        );
      })}
      {manquants.length > 0 && (
        <Alert color="orange" role="status" title="Avant de terminer">
          <List size="sm">
            {manquants.map((t) => (
              <List.Item key={t}>{t}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      <ErrorAlert error={erreur} />
      <Group>
        <Button loading={envoi} disabled={manquants.length > 0} onClick={onTerminer}>
          Terminer
        </Button>
        <Button variant="default" disabled={envoi} onClick={onPasser}>
          Passer l’étape : tout plus tard
        </Button>
      </Group>
    </Stack>
  );
}

export function QuestionsFluxPage() {
  const can = useCan();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = retourSur(params.get('next'));
  const admin = can('administration', 'administrer');
  const peutAssistant = can('assistant', 'administrer');
  const q = useQuery({
    queryKey: CLE_QUESTIONS_FLUX,
    queryFn: () => get<QuestionsFluxOut>('/api/installation/flux-externes'),
    enabled: admin,
    staleTime: Infinity,
  });
  const etats = useQuery({
    queryKey: CLE_FLUX_EXTERNES,
    queryFn: () => get<FluxExternesOut>('/api/admin/flux-externes'),
    enabled: admin,
  });
  const [phase, setPhase] = useState<'choix' | 'fin'>('choix');
  const [saisie, setSaisie] = useState<SaisieQuestions>(SAISIE_VIDE);
  const [ouverts, setOuverts] = useState<FluxModule[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<unknown>(null);

  // L'étape n'est proposée qu'une fois, au compte créé par l'installation : sinon, retour à la page demandée.
  if (!admin || (phase === 'choix' && q.data && !q.data.aProposer)) return <Navigate to={next} replace />;
  const mode = (m: FluxModule) => modeInstallation(fluxExterne(m), peutAssistant);
  const ouvert = (m: FluxModule) => etats.data?.modules.some((e) => e.module === m && e.ouvert) ?? false;

  const actualiser = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: CLE_FLUX_EXTERNES }),
      qc.invalidateQueries({ queryKey: [ASSISTANT_GLOBAL] }),
      qc.invalidateQueries({ queryKey: ['assistant'] }),
    ]);
  const terminer = async () => {
    setEnvoi(true);
    setErreur(null);
    const faits: FluxModule[] = [];
    try {
      // « Plus tard » et les modules sans case cochée ne figurent pas dans la liste : aucun appel pour eux.
      for (const m of ouvertures(FLUX_MODULES, saisie, mode, ouvert)) {
        if (m === 'assistant') {
          const d = await get<ReglagesAssistantDto>('/api/assistant/reglages');
          await api('PUT', '/api/assistant/reglages', { body: corpsActivationAssistant(d, saisie.fournisseur) });
        } else {
          const a = appelOuverture(m);
          await api('PUT', a.url, { body: a.corps });
        }
        faits.push(m);
      }
      await post('/api/installation/flux-externes/vues', {});
      setPhase('fin');
    } catch (e) {
      setErreur(e);
    } finally {
      setOuverts((avant) => [...avant, ...faits]);
      setEnvoi(false);
      await actualiser();
    }
  };
  const passer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await post('/api/installation/flux-externes/vues', {});
      nav(next, { replace: true });
    } catch (e) {
      setErreur(e);
      setEnvoi(false);
    }
  };

  if (!q.data || !etats.data)
    return (
      <Stack className="page">
        <Title order={1}>Flux vers l’extérieur</Title>
        <ErrorAlert error={q.error || etats.error} />
        {!q.error && !etats.error && <Loader aria-label="Chargement des flux vers l’extérieur" />}
      </Stack>
    );

  if (phase === 'fin') {
    const reste = aReglerEnsuite(FLUX_MODULES, saisie, mode, ouverts);
    const pareFeu = pareFeuAOuvrir(
      FLUX_EXTERNES,
      ouverts.map((module) => ({ module, ouvert: true })),
    );
    return (
      <Stack className="page">
        <Title order={1}>Flux vers l’extérieur : installation terminée</Title>
        {ouverts.length > 0 ? (
          <Stack gap="xs">
            <Text>Flux ouverts, inscrits au journal d’audit :</Text>
            <List>
              {ouverts.map((m) => (
                <List.Item key={m}>{fluxExterne(m).libelle}</List.Item>
              ))}
            </List>
            <Text size="sm">
              L’exécutant d’exploitation les applique à son prochain passage (en général moins d’une minute).
            </Text>
          </Stack>
        ) : (
          <Text>Aucun flux n’a été ouvert.</Text>
        )}
        {pareFeu.length > 0 && (
          <Alert color="blue" title="Pare-feu de l’hôte et du réseau">
            À faire autoriser par l’équipe infrastructure : {pareFeu.flatMap((p) => p.regles).join(' ')}
          </Alert>
        )}
        {reste.length > 0 && (
          <Stack gap="xs">
            <Title order={2} size="h4">
              À terminer dans la page du module
            </Title>
            <List>
              {reste.map((r) => (
                <List.Item key={r.module}>
                  <Anchor component={Link} to={r.lien}>
                    {r.libelle}
                  </Anchor>{' '}
                  : {r.quoi}
                </List.Item>
              ))}
            </List>
          </Stack>
        )}
        <Text size="sm">
          Les autres flux restent fermés. Tout se change ensuite depuis la page de chaque module ; le résumé est dans{' '}
          <Anchor component={Link} to={LIEN_FLUX_EXTERNES}>
            Configuration système, Flux vers l’extérieur
          </Anchor>
          .
        </Text>
        <Group>
          <Button onClick={() => nav(next, { replace: true })}>Continuer</Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack className="page">
      <Title order={1}>Flux vers l’extérieur</Title>
      <EtapeFluxExterieur
        ouvert={ouvert}
        mode={mode}
        saisie={saisie}
        onSaisie={setSaisie}
        envoi={envoi}
        erreur={erreur}
        onTerminer={() => void terminer()}
        onPasser={() => void passer()}
      />
    </Stack>
  );
}
