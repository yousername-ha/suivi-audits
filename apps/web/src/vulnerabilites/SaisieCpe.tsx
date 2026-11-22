/* Module Vulnérabilités (ADR 0100, lot CPE-1) : saisie assistée d'un produit surveillé par le dictionnaire CPE de la NVD.
   - À l'ouverture du formulaire, l'API note la saisie en cours (l'exécutant se tient prêt) et dit si la liste locale est
     chargée ; renouvelé au plus une fois par minute pendant la frappe.
   - Recherche dans la liste locale pendant la frappe (deux caractères au moins, temporisation), sans aucun appel extérieur ;
     l'ordre est celui du serveur (correspondance exacte d'abord).
   - Produit choisi : demande de ses versions, puis interrogation de la réponse ; le champ de la version reste libre pendant
     l'attente, et les versions connues se proposent quand elles arrivent (« * » : toutes versions).
   Composants de la charte et de Mantine, sous la CSP stricte (ADR 0006) : aucun style en ligne, aucune prop responsive. */
import { Autocomplete, Select, Stack, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import type { EtatSaisieCpeDto, IdentiteProduitCpe, ProduitCpeDto, VersionsCpeDto } from '@suivi/shared';
import { ErrorAlert } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, get } from '../api';
import {
  ATTENTE_MAX_VERSIONS_MS,
  DELAI_FRAPPE_CPE,
  identiteDepuisValeur,
  INTERVALLE_VERSIONS_MS,
  libelleProduitCpe,
  optionsVersionsCpe,
  RECHAUFFE_MS,
  urlProduitsCpe,
  URL_SAISIE_CPE,
  URL_VERSIONS_CPE,
  urlVersionsCpe,
  valeurProduitCpe,
} from './dictionnaire-cpe';

/** Ouverture de la saisie : état rendu par l'API, et `rechauffer()` à appeler pendant la frappe. */
export function useSaisieCpe() {
  const [etat, setEtat] = useState<EtatSaisieCpeDto | null>(null);
  const dernier = useRef(0);
  const rechauffer = (force = false) => {
    if (!force && Date.now() - dernier.current < RECHAUFFE_MS) return;
    dernier.current = Date.now();
    api<EtatSaisieCpeDto>('POST', URL_SAISIE_CPE)
      .then(setEtat)
      // Sans réponse (droit, module) : le formulaire fonctionne comme avant, sans liste.
      .catch(() => setEtat(null));
  };
  useEffect(() => {
    rechauffer(true);
  }, []);
  return { etat, rechauffer };
}

/** Versions d'un produit choisi dans la liste : demande (POST), puis interrogation tant que la réponse est en attente,
    une minute au plus. */
export function useVersionsCpe(identite: IdentiteProduitCpe | null) {
  const cle = identite ? valeurProduitCpe(identite) : null;
  const [initiale, setInitiale] = useState<VersionsCpeDto | null>(null);
  const [debut, setDebut] = useState(0);
  const [, setEchu] = useState(false);
  useEffect(() => {
    setInitiale(null);
    setEchu(false);
    if (!identite) return;
    let annule = false;
    setDebut(Date.now());
    api<VersionsCpeDto>('POST', URL_VERSIONS_CPE, { body: identite })
      .then((r) => !annule && setInitiale(r))
      .catch(
        (e: unknown) =>
          !annule &&
          setInitiale({ etat: 'indisponible', versions: [], tronque: false, obtenuLe: null, message: errorMessage(e) }),
      );
    // Fin de l'attente : nouveau rendu pour remplacer le message d'attente.
    const minuterie = setTimeout(() => !annule && setEchu(true), ATTENTE_MAX_VERSIONS_MS);
    return () => {
      annule = true;
      clearTimeout(minuterie);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  const suivi = useQuery({
    queryKey: ['vulnerabilites', 'cpe', 'versions', cle],
    queryFn: () => get<VersionsCpeDto>(urlVersionsCpe(identite!)),
    enabled: !!identite && initiale?.etat === 'en_attente',
    refetchInterval: (q) =>
      q.state.data?.etat !== 'pret' &&
      q.state.data?.etat !== 'indisponible' &&
      Date.now() - debut < ATTENTE_MAX_VERSIONS_MS
        ? INTERVALLE_VERSIONS_MS
        : false,
  });
  const reponse = initiale?.etat === 'en_attente' ? (suivi.data ?? initiale) : initiale;
  return { reponse, attenteMs: identite ? Date.now() - debut : 0 };
}

/** Recherche d'un produit dans la liste locale du dictionnaire (champ de recherche avec propositions). */
export function RechercheProduitCpe({
  onChoisir,
  onFrappe,
}: {
  onChoisir: (p: IdentiteProduitCpe) => void;
  onFrappe?: () => void;
}) {
  const [terme, setTerme] = useState('');
  const [attendu] = useDebouncedValue(terme, DELAI_FRAPPE_CPE);
  const url = urlProduitsCpe(attendu);
  const produits = useQuery({
    queryKey: ['vulnerabilites', 'cpe', 'produits', url],
    queryFn: () => get<ProduitCpeDto[]>(url!),
    enabled: !!url,
    staleTime: 60_000,
  });
  return (
    <Stack gap="2xs">
      <Select
        label="Rechercher dans le dictionnaire CPE (NVD)"
        description="Deux caractères au moins : éditeur, produit ou intitulé, sans tenir compte de la casse ni des accents. La recherche se fait dans la liste copiée sur le serveur, sans appel extérieur."
        placeholder="Par exemple : nom du produit"
        searchable
        clearable
        searchValue={terme}
        onSearchChange={(v) => {
          setTerme(v);
          onFrappe?.();
        }}
        value={null}
        onChange={(v) => {
          const i = identiteDepuisValeur(v);
          if (i) onChoisir(i);
        }}
        // Ordre et filtre du serveur (sans accent) : Mantine ne refiltre pas.
        filter={({ options }) => options}
        data={(produits.data ?? []).map((p) => ({ value: valeurProduitCpe(p), label: libelleProduitCpe(p) }))}
        nothingFoundMessage={url ? (produits.isFetching ? 'Recherche…' : 'Aucun produit') : 'Deux caractères au moins'}
        comboboxProps={{ withinPortal: false }}
      />
      <ErrorAlert error={produits.error} />
    </Stack>
  );
}

/** Champ de la version : toujours libre ; propose les versions connues quand elles arrivent. Sans état React. */
export function ChampVersionCpe({
  valeur,
  onChange,
  versions,
  message,
}: {
  valeur: string;
  onChange: (v: string) => void;
  versions: VersionsCpeDto | null;
  message: string | null;
}) {
  return (
    <Stack gap="2xs">
      <Autocomplete
        label="Version"
        required
        description="Obligatoire : c’est elle qui sert au rapprochement avec les failles publiées (par exemple 10.1.2). Même éditeur, même produit et même version : une seule fiche. « * » : toutes versions."
        maxLength={100}
        value={valeur}
        onChange={onChange}
        data={versions ? optionsVersionsCpe(versions) : []}
        limit={200}
        comboboxProps={{ withinPortal: false }}
      />
      {message && (
        <Text size="xs" c="dimmed" role="status">
          {message}
        </Text>
      )}
    </Stack>
  );
}
