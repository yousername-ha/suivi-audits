/* Encadré « Le contexte en bref » de Périmètre et contexte (décision du RSSI du 27/11/2026, maquette « Organisation ·
   Contexte de l'organisation ») : trois tuiles qui mènent aux onglets Parties intéressées, SWOT par processus et PESTEL,
   puis le rappel de la clause 4. Lecture seule, par les API existantes du périmètre affiché (porte de lecture comprise) :
   registres des parties et des SWOT (les données existantes de l'outil de suivi ne sont lues que sur le périmètre commun,
   comme dans les onglets), cartes des processus et PESTEL, aux mêmes clés de cache que leurs onglets. Calcul dans
   contexte-bref.ts. */
import { Card, Title } from '@mantine/core';
import { jourParis, type GrcObject, type ProcessusCartes, type VuePestel } from '@suivi/shared';
import { useQuery } from '@tanstack/react-query';
import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import { CARTES_PROCESSUS_KEY } from '../processus/CartesProcessus';
import { chiffresContexte, detailsContexte } from './contexte-bref';

const SOCLE = '00000000-0000-4000-8000-000000000001';
type Page = { items: GrcObject[]; total: number; nextOffset: number | null };

/** Toutes les pages d'une liste paginée : le décompte ne dépend pas de la page affichée. */
async function toutesLesPages(url: string) {
  const items: GrcObject[] = [],
    vus = new Set<number>();
  let offset: number | null = 0;
  while (offset !== null) {
    if (vus.has(offset)) throw new Error('La liste n’a pas pu être chargée entièrement.');
    vus.add(offset);
    const page: Page = await get(`${url}${url.includes('?') ? '&' : '?'}offset=${offset}`);
    items.push(...page.items);
    offset = page.nextOffset;
  }
  return items;
}

function Tuile({ to, chiffre, libelle, detail }: { to: string; chiffre: ReactNode; libelle: string; detail: string }) {
  return (
    <Link className="contexte-bref__tuile" to={to}>
      <span className="contexte-bref__chiffre">{chiffre}</span>
      <span className="contexte-bref__texte">
        <span className="contexte-bref__libelle">{libelle}</span>
        <span className="contexte-bref__detail">{detail}</span>
      </span>
    </Link>
  );
}

export function ContexteEnBref({ smsi }: { smsi: string }) {
  const titre = useId(),
    commun = smsi === SOCLE;
  const partiesNatives = useQuery({
    queryKey: ['grc', smsi, 'contexte-bref', 'parties'],
    queryFn: () => toutesLesPages(`/api/grc/${smsi}/objects?kind=stakeholder`),
  });
  const partiesExistantes = useQuery({
    queryKey: ['grc', smsi, 'contexte-bref', 'parties-existantes'],
    queryFn: () => toutesLesPages(`/api/grc/${smsi}/pilotage/legacy/interested`),
    enabled: commun,
  });
  const swotNatifs = useQuery({
    queryKey: ['grc', smsi, 'contexte-bref', 'swot'],
    queryFn: () => get<Page>(`/api/grc/${smsi}/objects?kind=swot&offset=0`),
  });
  const swotExistants = useQuery({
    queryKey: ['grc', smsi, 'contexte-bref', 'swot-existants'],
    queryFn: () => get<Page>(`/api/grc/${smsi}/pilotage/legacy/swots?offset=0`),
    enabled: commun,
  });
  const cartes = useQuery({
    queryKey: CARTES_PROCESSUS_KEY(smsi),
    queryFn: () => get<ProcessusCartes>(`/api/grc/${smsi}/pilotage/processus-cartes`),
  });
  const pestel = useQuery({
    queryKey: ['grc', smsi, 'pestel'],
    queryFn: () => get<VuePestel>(`/api/grc/${smsi}/pilotage/pestel`),
  });

  const existantes = commun ? partiesExistantes.data : [];
  const swotsExistants = commun ? swotExistants.data?.total : 0;
  const c = chiffresContexte({
    aujourdhui: jourParis(),
    parties: partiesNatives.data && existantes ? [...partiesNatives.data, ...existantes] : undefined,
    analysesSwot: swotNatifs.data && swotsExistants !== undefined ? swotNatifs.data.total + swotsExistants : undefined,
    processus: cartes.data?.processus,
    pestel: pestel.data,
  });
  const d = detailsContexte(c);
  const attente = (erreur: boolean) => (erreur ? '—' : '…');

  return (
    <Card withBorder component="aside" className="contexte-bref" aria-labelledby={titre}>
      <Title order={2} size="h4" id={titre} className="contexte-bref__titre">
        Le contexte en bref
      </Title>
      <div className="contexte-bref__tuiles">
        <Tuile
          to="/pilotage/parties"
          chiffre={c.parties?.total ?? attente(partiesNatives.isError || partiesExistantes.isError)}
          libelle="Parties intéressées"
          detail={c.parties || partiesNatives.isError || partiesExistantes.isError ? d.parties : 'Chargement…'}
        />
        <Tuile
          to="/pilotage/swot"
          chiffre={c.swot?.analyses ?? attente(swotNatifs.isError || swotExistants.isError || cartes.isError)}
          libelle="SWOT par processus"
          detail={c.swot || swotNatifs.isError || swotExistants.isError || cartes.isError ? d.swot : 'Chargement…'}
        />
        <Tuile
          to="/pilotage/pestel"
          chiffre={c.pestel?.enjeux ?? attente(pestel.isError)}
          libelle="Enjeux PESTEL"
          detail={c.pestel || pestel.isError ? d.pestel : 'Chargement…'}
        />
      </div>
      <div className="contexte-bref__rappel" role="note">
        <span className="contexte-bref__rappel-titre">Clause 4 de l’ISO 27001</span>
        <span>Contexte, parties intéressées et périmètre sont relus à chaque revue de direction.</span>
      </div>
    </Card>
  );
}

/** Périmètre et contexte : la liste des fiches, et l'encadré à sa droite (dessous quand la place manque). Ailleurs, le
    registre est rendu tel quel. */
export function DispositionContexte({ actif, smsi, children }: { actif: boolean; smsi: string; children: ReactNode }) {
  if (!actif) return <>{children}</>;
  return (
    <div className="contexte-disposition">
      <div className="contexte-disposition__liste">{children}</div>
      <ContexteEnBref smsi={smsi} />
    </div>
  );
}
