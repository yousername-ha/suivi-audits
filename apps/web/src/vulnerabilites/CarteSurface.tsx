import { BarreFiltres } from '../components/BarreFiltres';
/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de l'écran « Surface externe », d'après les
   maquettes retenues par le RSSI le 17/11/2026 (08d, 08e). Dessin SVG sans aucun style en ligne (CSP stricte, ADR 0006) :
   positions par attributs, couleurs, traits et animations par les classes de packages/ui/src/neon-surface.css (jetons de la
   charte, clair et sombre ; animations coupées par le mouvement réduit). Mise en page calculée par des fonctions pures
   (carte-surface.ts). Chaque nœud est atteignable au clavier avec un nom complet ; un clic ou Entrée ouvre la fiche
   existante (alerte, actif, machine, constats Silène) ou déplie une branche. Les onglets « Alertes » et « Actifs » en sont
   l'équivalent en tableau.
   Lot SI2 : deux sources (pastilles ALH et SIL sur chaque nœud et chaque service), constats Silène marqués sur l'adresse et
   sur le port, sans priorité ; noms qui résolvent vers une même adresse réunis sur un nœud, renvoi vers l'adresse déjà
   tracée dans une autre branche ; regroupement par nom de domaine, par adresse IP ou par périmètre ; filtre par nom.
   Décision du RSSI du 19/11/2026 : la carte est la page elle-même. Plus de cadre, de caméra, de zoom ni de vue d'ensemble :
   la scène entière est dessinée à la largeur utile et se parcourt par le défilement de la page ; la barre de regroupement
   et de filtre par nom et les titres des colonnes restent visibles (classe collante de la charte). Sur un écran étroit, où
   la chaîne à huit colonnes ne se lirait pas, la même scène est présentée empilée, branche par branche. L'état de la vue
   (regroupement, filtres, replis) peut être tenu par l'écran parent pour survivre au changement d'onglet. */
import { Alert, Anchor, Button, Checkbox, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import {
  type ActifCarteDto,
  type AlerteCarteDto,
  type CarteSurfaceDto,
  CRITICITES_ALH,
  type CriticiteAlh,
  type ProtocoleSilene,
  ROLE_MACHINE_LIBELLES,
  type SourceSurface,
  TYPES_ALERTE_ALH,
  type TypeAlerteAlh,
} from '@suivi/shared';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  basculerCalmes,
  basculerGroupe,
  COLONNES,
  construireModele,
  couperLibelle,
  deplierVers,
  disposer,
  DOMAINES_PAR_LIGNE,
  type EtatReplis,
  FILTRES_CARTE_VIDES,
  type FiltresCarte,
  filtrerModele,
  INTERNET_CARACTERES,
  INTERNET_INTERLIGNE,
  INTERNET_MAX,
  libelleAlertes,
  libelleColonneGroupe,
  libelleResume,
  type LigneDessinee,
  type LigneFiltree,
  LIGNES_MAX,
  MACHINES_PAR_LIGNE,
  MACHINE_H,
  nomMachineCarte,
  OPTIONS_REGROUPEMENT,
  type Rangee,
  type Regroupement,
  REGROUPEMENT_DEFAUT,
  replisParDefaut,
  type Resume,
  serviceAbsent,
  serviceDessine,
  SERVICES_PAR_LIGNE,
  texteSources,
  toutDeplier,
  toutReplier,
  X,
  yInternet,
} from './carte-surface';
import { PictosSources } from './PictoSource';
import { PICTOS_SOURCES, TRACES_FORMES } from './pictos-sources';
import { libelleCriticite, libelleTypeAlerte } from './surface';
import { PICTO_SURFACE, pictosSurface } from './surface-silene';

const tronque = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Adresse longue (IPv6 de plus de 20 caractères) sur deux lignes, coupée après un deux-points. */
function couperIp(ip: string): string[] {
  if (ip.length <= 20) return [ip];
  const i = ip.lastIndexOf(':', Math.ceil(ip.length / 2));
  return i > 0 ? [ip.slice(0, i + 1), ip.slice(i + 1)] : [ip];
}
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
const classeCriticite = (c: CriticiteAlh | null | undefined) => `sc-crit-${c ?? 'inconnue'}`;
const OPTIONS_TYPE = TYPES_ALERTE_ALH.map((t) => ({ value: t, label: libelleTypeAlerte(t) }));

/** Criticité la plus haute d'un résumé (null : aucune alerte). */
function criticiteHaute(r: Resume): CriticiteAlh | 'inconnue' | null {
  for (const c of CRITICITES_ALH) if (r.parCriticite[c]) return c;
  return r.parCriticite.inconnue ? 'inconnue' : null;
}

/* ------------------------------------------------------------------ Noms accessibles (communs aux deux présentations) */
const nomDomaine = (d: ActifCarteDto) =>
  `Nom de domaine ${d.valeur}${d.adresse ? `, résout vers ${d.adresse}` : ''}, ${texteSources(d.sources)} : ouvrir sa fiche`;
function nomAdresse(l: LigneFiltree): string {
  const ip = l.hote?.valeur ?? l.adresse ?? '';
  if (l.renvoi)
    return `Adresse IP ${ip}, déjà tracée sous la branche ${l.renvoi.libelle} avec ses services, ses alertes et ses machines : y aller`;
  if (!l.hote) return `Adresse IP ${ip}, connue par la résolution du nom (pas suivie comme hôte)`;
  const services = l.nombreServices ? `, ${pluriel(l.nombreServices, 'service connu', 'services connus')}` : '';
  return `IP publique ${ip}, ${texteSources(l.hote.sources)}${services} : ouvrir sa fiche`;
}
const nomConstats = (l: LigneFiltree) =>
  `${pluriel(l.nombreConstats, 'constat Silène', 'constats Silène')} sur ${l.hote?.valeur ?? ''}, sans priorité : les voir`;
const nomAlerte = (l: LigneFiltree, p: AlerteCarteDto) =>
  `${libelleAlertes(l)} : ${p.titre}${p.cves.length ? ` (${p.cves.slice(0, 3).join(', ')})` : ''}. Ouvrir la fiche de l’alerte`;
const nomMachine = (m: LigneFiltree['machines'][number]) => {
  const role = m.role ? ROLE_MACHINE_LIBELLES[m.role] : null;
  return `Machine interne ${nomMachineCarte(m)}${role ? ` (${role})` : ''} : ouvrir sa fiche`;
};
const nomARelier = (l: LigneFiltree) =>
  `À relier à une machine interne${l.propositions ? ` (${pluriel(l.propositions, 'proposition', 'propositions')} à décider)` : ''} : ouvrir la fiche de ${(l.hote ?? l.domaines[0])!.valeur}`;
/** Actif dont la fiche permet de relier la ligne : l'hôte d'AlgoLightHouse, sinon un nom d'AlgoLightHouse. */
const actifARelier = (l: LigneFiltree) =>
  (l.hote?.alhId ? l.hote : null) ?? l.domaines.find((d) => !!d.alhId) ?? l.hote ?? l.domaines[0]!;
const nomGroupe = (g: { deplie: boolean; libelle: string; resume: Resume; replieParBorne: boolean }) =>
  `${g.deplie ? 'Replier' : 'Déplier'} la branche ${g.libelle} : ${libelleResume(g.resume)}${g.replieParBorne ? ' (repliée : borne d’affichage atteinte)' : ''}`;
function teteFaisceau(r: Extract<Rangee, { type: 'faisceau' }>): string {
  if (r.calmes) return pluriel(r.lignes, 'ligne sans alerte', 'lignes sans alerte');
  if (r.resume.domaines) return pluriel(r.resume.domaines, 'nom de domaine', 'noms de domaine');
  return pluriel(r.resume.hotes, 'hôte', 'hôtes');
}
const nomFaisceau = (r: Extract<Rangee, { type: 'faisceau' }>) =>
  `Déplier ${r.calmes ? 'les lignes sans alerte' : 'la branche'} : ${teteFaisceau(r)} (${libelleResume(r.resume)})`;

/* ------------------------------------------------------------------ Dessin */
/** Nœud activable (bouton SVG) : clic, Entrée ou Espace. */
function Bouton({
  nom,
  onActiver,
  className,
  ancre,
  children,
}: {
  nom: string;
  onActiver: () => void;
  className?: string;
  /** Repère d'une adresse (aller à la ligne qui la porte depuis un renvoi). */
  ancre?: string;
  children: ReactNode;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={nom}
      data-ancre={ancre}
      className={`sc-bouton${className ? ` ${className}` : ''}`}
      onClick={onActiver}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onActiver();
        }
      }}
    >
      <title>{nom}</title>
      {children}
    </g>
  );
}

/** Largeur d'une pastille (unités de la viewBox) pour son texte. */
const largeurPastille = (texte: string) => texte.length * 6.4 + 16;

/** Étiquette encadrée (pastille) centrée sur un point. */
function Pastille({ x, y, texte, className }: { x: number; y: number; texte: string; className?: string }) {
  const l = largeurPastille(texte);
  return (
    <g className={`sc-pastille${className ? ` ${className}` : ''}`}>
      <rect x={x - l / 2} y={y - 10} width={l} height={20} rx={10} className="sc-pastille__fond" />
      <text x={x} y={y + 4} textAnchor="middle" className="sc-texte">
        {texte}
      </text>
    </g>
  );
}

/** Pastilles des sources dessinées dans la carte (formes et monogrammes du lot L1, à la moitié), centrées sur `x` ou
    alignées à droite de `x` (`fin`). Décoratives : le nom du nœud dit les sources. */
const PASTILLE_L = 22;
function SourcesSvg({ x, y, sources, fin = false }: { x: number; y: number; sources: SourceSurface[]; fin?: boolean }) {
  const total = sources.length * PASTILLE_L + (sources.length - 1) * 2;
  const x0 = fin ? x - total : x - total / 2;
  return (
    <g aria-hidden="true">
      {sources.map((s, i) => {
        const d = PICTOS_SOURCES[PICTO_SURFACE[s]];
        return (
          <g
            key={s}
            className={`ps ps--${d.teinte}`}
            transform={`translate(${x0 + i * (PASTILLE_L + 2)} ${y}) scale(0.5)`}
          >
            <path className="ps__forme" d={TRACES_FORMES[d.forme]} />
            <text className="ps__sigle" x={22} y={16.2} textAnchor="middle" fontSize={12}>
              {d.sigle}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Marque des constats Silène (étiquette sarcelle chiffrée), distincte des alertes d'AlgoLightHouse (ronds colorés). */
function MarqueConstats({ x, y, n }: { x: number; y: number; n: number }) {
  const texte = `${n} SIL`;
  const l = texte.length * 6.2 + 10;
  return (
    <g className="sc-constats">
      <path d={`M${x} ${y} L${x + 5} ${y - 7} L${x + l} ${y - 7} L${x + l} ${y + 7} L${x + 5} ${y + 7} Z`} />
      <text x={x + 5 + (l - 5) / 2} y={y + 4} textAnchor="middle" className="sc-constats__texte">
        {texte}
      </text>
    </g>
  );
}

const losange = (x: number, y: number, r: number) => `M${x} ${y - r} L${x + r} ${y} L${x} ${y + r} L${x - r} ${y} Z`;
const triangle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} L${x + r} ${y + r * 0.8} L${x - r} ${y + r * 0.8} Z`;

/** Écran d'une machine interne, à gauche de son nom. */
function Ecran({ x, y }: { x: number; y: number }) {
  return (
    <g className="sc-machine">
      <rect x={x} y={y - 8} width={20} height={13} rx={2} className="sc-forme" />
      <path d={`M${x + 6} ${y + 9} L${x + 14} ${y + 9}`} className="sc-forme" />
    </g>
  );
}

export interface ActionsCarte {
  onAlerte: (id: string) => void;
  onActif: (a: ActifCarteDto) => void;
  onMachine: (id: string) => void;
  /** Constats Silène d'un hôte (tous, ou ceux qui citent un port). */
  onConstats?: (hote: ActifCarteDto, port: { port: number; protocole: ProtocoleSilene | null } | null) => void;
}

/** Ce que les deux présentations font d'une rangée. */
interface Commandes {
  actions: ActionsCarte;
  basculer: (r: Rangee) => void;
  aller: (cle: string) => void;
}

/** Dessin d'une rangée (ligne d'une adresse ou faisceau replié). */
function DessinRangee({ r, c }: { r: Rangee; c: Commandes }) {
  const { actions } = c;
  if (r.type === 'faisceau') {
    const haute = criticiteHaute(r.resume);
    const tete = teteFaisceau(r);
    const alertes = `${pluriel(r.resume.alertes, 'alerte', 'alertes')}${r.resume.parCriticite.critical ? ` (${r.resume.parCriticite.critical} crit.)` : ''}`;
    return (
      <g className="sc-faisceau">
        <Bouton nom={nomFaisceau(r)} onActiver={() => c.basculer(r)}>
          <Pastille x={X.domaine + 40} y={r.y} texte={`▸ ${tete}`} className="sc-pastille--faisceau" />
        </Bouton>
        {r.resume.hotes > 0 && <Pastille x={X.hote} y={r.y} texte={pluriel(r.resume.hotes, 'hôte', 'hôtes')} />}
        {r.resume.services > 0 && (
          <Pastille x={X.service} y={r.y} texte={pluriel(r.resume.services, 'service connu', 'services connus')} />
        )}
        {r.resume.alertes > 0 && (
          <g>
            <circle
              cx={X.alerte + 12 - largeurPastille(alertes) / 2 - 10}
              cy={r.y}
              r={5}
              className={`sc-forme ${classeCriticite(haute === 'inconnue' ? null : haute)}`}
            />
            <Pastille x={X.alerte + 12} y={r.y} texte={alertes} />
          </g>
        )}
        {r.resume.machines > 0 && (
          <Pastille x={X.machine + 60} y={r.y} texte={pluriel(r.resume.machines, 'machine', 'machines')} />
        )}
      </g>
    );
  }
  const l = r.ligne;
  const p = l.principale;
  const ip = couperIp(l.hote?.valeur ?? l.adresse ?? '');
  const absent = serviceAbsent(l);
  const autresNoms = l.domaines.length - r.domainesY.length + l.domainesMasques;
  const autresServices = l.nombreServices - r.servicesY.length;
  return (
    <g className={`sc-ligne${l.critique ? ' sc-ligne--critique' : ''}`}>
      {r.domainesY.map((yd, i) => {
        const d = l.domaines[i]!;
        return (
          <Bouton key={d.id} nom={nomDomaine(d)} onActiver={() => actions.onActif(d)}>
            <path
              d={losange(X.domaine, yd, 8)}
              className={`sc-forme sc-domaine ${p ? classeCriticite(p.criticite) : 'sc-sans-alerte'}`}
            />
            <text x={X.domaine} y={yd - 13} textAnchor="middle" className="sc-texte sc-texte--secondaire">
              {/* Nom de domaine complet : un libellé court comme « vpn » se lirait comme un nom de service. */}
              {tronque(d.valeur, 32)}
            </text>
            <SourcesSvg x={X.domaine} y={yd + 10} sources={d.sources} />
          </Bouton>
        );
      })}
      {autresNoms > 0 && (
        <text
          x={X.domaine}
          y={(r.domainesY.at(-1) ?? r.y) + 34}
          textAnchor="middle"
          className="sc-texte sc-texte--secondaire"
        >
          et {pluriel(autresNoms, 'autre nom', 'autres noms')}
          {l.domainesMasques ? ' (filtre)' : ''}
        </text>
      )}
      {(l.hote || l.adresse) && (
        <Bouton
          nom={nomAdresse(l)}
          ancre={l.renvoi ? undefined : l.cle}
          className={l.renvoi ? 'sc-renvoi' : l.hote ? undefined : 'sc-adresse-seule'}
          onActiver={() => (l.renvoi ? c.aller(l.renvoi.cle) : l.hote ? actions.onActif(l.hote) : undefined)}
        >
          <rect x={X.hote - 6} y={r.y - 6} width={12} height={12} rx={2} className="sc-forme sc-hote" />
          {ip.map((morceau, i) => (
            <text
              key={morceau}
              x={X.hote}
              y={r.y - 13 - (ip.length - 1 - i) * 15}
              textAnchor="middle"
              className="sc-texte sc-texte--code"
            >
              {morceau}
            </text>
          ))}
          {l.renvoi ? (
            <text x={X.hote} y={r.y + 22} textAnchor="middle" className="sc-texte sc-texte--secondaire">
              {tronque(`↑ voir ${l.renvoi.libelle}`, 26)}
            </text>
          ) : (
            l.hote && <SourcesSvg x={X.hote} y={r.y + 10} sources={l.hote.sources} />
          )}
        </Bouton>
      )}
      {l.hote && !l.renvoi && l.nombreConstats > 0 && (
        <Bouton nom={nomConstats(l)} onActiver={() => actions.onConstats?.(l.hote!, null)}>
          <MarqueConstats x={X.hote + 27} y={r.y + 16} n={l.nombreConstats} />
        </Bouton>
      )}
      {r.servicesY.map((ys, i) => {
        const s = serviceDessine(l, l.ports[i]!);
        const port = l.ports[i]!;
        const actif = (l.actifServices ?? l.hote ?? l.domaines[0])!;
        return (
          <g key={`${port.port}/${port.protocole ?? ''}`}>
            <Bouton nom={`${s.nom} : ouvrir la fiche de ${actif.valeur}`} onActiver={() => actions.onActif(actif)}>
              <rect x={X.service - 8} y={ys - 4} width={16} height={8} rx={4} className="sc-forme sc-service" />
              <text x={X.service} y={ys - 13} textAnchor="middle" className="sc-texte sc-texte--code">
                {tronque(s.libelle, 24)}
              </text>
              {s.produit && (
                <text x={X.service} y={ys + 17} textAnchor="middle" className="sc-texte sc-texte--secondaire">
                  {tronque(s.produit, 24)}
                </text>
              )}
              <SourcesSvg x={X.service - 12} y={ys - 6} sources={s.sources} fin />
            </Bouton>
            {s.constats.length > 0 && l.hote && (
              <Bouton
                nom={`${pluriel(s.constats.length, 'constat Silène', 'constats Silène')} sur le port ${s.libelle} de ${l.hote.valeur}, sans priorité : les voir`}
                onActiver={() => actions.onConstats?.(l.hote!, { port: port.port, protocole: port.protocole })}
              >
                <MarqueConstats x={X.service + 12} y={ys} n={s.constats.length} />
              </Bouton>
            )}
          </g>
        );
      })}
      {autresServices > 0 && (
        <text
          x={X.service}
          y={(r.servicesY.at(-1) ?? r.y) + 32}
          textAnchor="middle"
          className="sc-texte sc-texte--secondaire"
        >
          et {pluriel(autresServices, 'autre service', 'autres services')}
        </text>
      )}
      {absent && (
        <g role="img" aria-label={absent.nom}>
          <text x={X.service} y={r.y - 13} textAnchor="middle" className="sc-texte sc-texte--secondaire">
            {absent.libelle}
          </text>
        </g>
      )}
      {p && (
        <Bouton nom={nomAlerte(l, p)} onActiver={() => actions.onAlerte(p.id)}>
          {l.critique && <circle cx={X.alerte} cy={r.y} r={13} className="sc-halo" />}
          <circle cx={X.alerte} cy={r.y} r={7} className={`sc-forme sc-alerte ${classeCriticite(p.criticite)}`} />
          <text x={X.alerte} y={r.y - 30} textAnchor="middle" className="sc-texte sc-texte--secondaire">
            {tronque(libelleTypeAlerte(p.type), 26)}
          </text>
          <text x={X.alerte} y={r.y - 15} textAnchor="middle" className="sc-texte">
            {tronque(libelleAlertes(l), 26)}
          </text>
        </Bouton>
      )}
      {l.machines.slice(0, MACHINES_PAR_LIGNE).map((m, i) => {
        const my = r.machinesY[i] ?? r.y;
        return (
          <Bouton key={m.id} nom={nomMachine(m)} onActiver={() => actions.onMachine(m.id)}>
            <Ecran x={X.machine} y={my} />
            <text x={X.machine + 28} y={my + 4} className="sc-texte">
              {tronque(nomMachineCarte(m), 24)}
            </text>
          </Bouton>
        );
      })}
      {l.machines.length > MACHINES_PAR_LIGNE && (
        <text
          x={X.machine + 28}
          y={(r.machinesY.at(-1) ?? r.y) + MACHINE_H - 4}
          className="sc-texte sc-texte--secondaire"
        >
          et {pluriel(l.machines.length - MACHINES_PAR_LIGNE, 'autre', 'autres')}
        </text>
      )}
      {!l.machines.length && l.autresMachines && (
        <g role="img" aria-label="Reliée à une machine que vous ne pouvez pas lire">
          <rect x={X.machine} y={r.y - 8} width={20} height={13} rx={2} className="sc-forme sc-machine-illisible" />
          <text x={X.machine + 28} y={r.y + 4} className="sc-texte sc-texte--secondaire">
            machine non lisible
          </text>
        </g>
      )}
      {r.aRelier && (
        <Bouton nom={nomARelier(l)} onActiver={() => actions.onActif(actifARelier(l))}>
          <circle cx={X.machine + 10} cy={r.y} r={8} className="sc-forme sc-a-relier" />
          <text x={X.machine + 10} y={r.y + 4} textAnchor="middle" className="sc-texte">
            ?
          </text>
          <text x={X.machine + 28} y={r.y + 4} className="sc-texte sc-texte--secondaire">
            {l.propositions ? 'à relier (proposée)' : 'à relier'}
          </text>
        </Bouton>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ Présentation empilée (écran étroit) */
/** Bouton HTML de la présentation empilée. */
function Lien({
  nom,
  onClick,
  children,
  ancre,
}: {
  nom: string;
  onClick: () => void;
  children: ReactNode;
  ancre?: string;
}) {
  return (
    <Anchor
      component="button"
      type="button"
      aria-label={nom}
      data-ancre={ancre}
      onClick={onClick}
      className="sc-pile__lien"
    >
      {children}
    </Anchor>
  );
}

/** Une ligne empilée : noms, adresse, services, alerte, limite du SI, machines. */
function LignePile({ r, c }: { r: LigneDessinee; c: Commandes }) {
  const l = r.ligne;
  const p = l.principale;
  const absent = serviceAbsent(l);
  const autresServices = l.nombreServices - Math.min(l.ports.length, SERVICES_PAR_LIGNE);
  const autresNoms = l.domaines.length - Math.min(l.domaines.length, DOMAINES_PAR_LIGNE) + l.domainesMasques;
  return (
    <li className={`sc-pile__ligne${l.critique ? ' sc-pile__ligne--critique' : ''}`}>
      {l.domaines.length > 0 && (
        <div className="sc-pile__etape">
          <span className="sc-pile__titre">Nom de domaine</span>
          {l.domaines.slice(0, DOMAINES_PAR_LIGNE).map((d) => (
            <span key={d.id} className="sc-pile__valeur">
              <Lien nom={nomDomaine(d)} onClick={() => c.actions.onActif(d)}>
                {d.valeur}
              </Lien>
              <PictosSources sources={pictosSurface(d.sources)} decoratif infobulle={false} />
            </span>
          ))}
          {autresNoms > 0 && (
            <Text size="xs" c="dimmed">
              et {pluriel(autresNoms, 'autre nom', 'autres noms')}
              {l.domainesMasques ? ' (filtre)' : ''}
            </Text>
          )}
        </div>
      )}
      {(l.hote || l.adresse) && (
        <div className="sc-pile__etape">
          <span className="sc-pile__titre">IP publique</span>
          <span className="sc-pile__valeur">
            {l.renvoi || l.hote ? (
              <Lien
                nom={nomAdresse(l)}
                ancre={l.renvoi ? undefined : l.cle}
                onClick={() => (l.renvoi ? c.aller(l.renvoi.cle) : c.actions.onActif(l.hote!))}
              >
                {l.hote?.valeur ?? l.adresse}
                {l.renvoi ? ` (voir ${l.renvoi.libelle})` : ''}
              </Lien>
            ) : (
              <span className="veille-code" role="img" aria-label={nomAdresse(l)}>
                {l.adresse}
              </span>
            )}
            {l.hote && !l.renvoi && (
              <PictosSources sources={pictosSurface(l.hote.sources)} decoratif infobulle={false} />
            )}
            {l.hote && !l.renvoi && l.nombreConstats > 0 && (
              <Lien nom={nomConstats(l)} onClick={() => c.actions.onConstats?.(l.hote!, null)}>
                {pluriel(l.nombreConstats, 'constat Silène', 'constats Silène')}
              </Lien>
            )}
          </span>
        </div>
      )}
      {(l.ports.length > 0 || absent) && (
        <div className="sc-pile__etape">
          <span className="sc-pile__titre">Service</span>
          {absent && (
            <Text size="sm" c="dimmed">
              {absent.libelle}
            </Text>
          )}
          {l.ports.slice(0, SERVICES_PAR_LIGNE).map((port) => {
            const s = serviceDessine(l, port);
            const actif = (l.actifServices ?? l.hote ?? l.domaines[0])!;
            return (
              <span key={`${port.port}/${port.protocole ?? ''}`} className="sc-pile__valeur">
                <Lien nom={`${s.nom} : ouvrir la fiche de ${actif.valeur}`} onClick={() => c.actions.onActif(actif)}>
                  {s.libelle}
                  {s.produit ? ` · ${s.produit}` : ''}
                </Lien>
                <PictosSources sources={pictosSurface(s.sources)} decoratif infobulle={false} />
              </span>
            );
          })}
          {autresServices > 0 && (
            <Text size="xs" c="dimmed">
              et {pluriel(autresServices, 'autre service', 'autres services')}
            </Text>
          )}
        </div>
      )}
      {p && (
        <div className="sc-pile__etape">
          <span className="sc-pile__titre">Alerte ouverte</span>
          <Lien nom={nomAlerte(l, p)} onClick={() => c.actions.onAlerte(p.id)}>
            {libelleAlertes(l)} · {libelleTypeAlerte(p.type)}
          </Lien>
        </div>
      )}
      {(l.machines.length > 0 || l.autresMachines || r.aRelier) && (
        <div className="sc-pile__etape sc-pile__etape--interne">
          <span className="sc-pile__titre">Machine interne (derrière la limite du SI)</span>
          {l.machines.map((m) => (
            <Lien key={m.id} nom={nomMachine(m)} onClick={() => c.actions.onMachine(m.id)}>
              {nomMachineCarte(m)}
            </Lien>
          ))}
          {!l.machines.length && l.autresMachines && (
            <Text size="sm" c="dimmed">
              machine non lisible
            </Text>
          )}
          {r.aRelier && (
            <Lien nom={nomARelier(l)} onClick={() => c.actions.onActif(actifARelier(l))}>
              {l.propositions ? 'à relier (proposée)' : 'à relier'}
            </Lien>
          )}
        </div>
      )}
    </li>
  );
}

/** Présentation empilée : branche par branche, chaque ligne en étapes de la chaîne (mêmes données, même repli). */
function Pile({
  scene,
  c,
  onGroupe,
}: {
  scene: ReturnType<typeof disposer>;
  c: Commandes;
  onGroupe: (cle: string) => void;
}) {
  return (
    <ol className="sc-pile" aria-label="Lignes d’approche, branche par branche">
      {scene.groupes.map((g) => (
        <li key={g.cle} className={`sc-pile__branche${g.resume.critique ? ' sc-pile__branche--critique' : ''}`}>
          <Button
            variant="subtle"
            size="compact-sm"
            aria-expanded={g.deplie}
            aria-label={nomGroupe(g)}
            onClick={() => onGroupe(g.cle)}
            className="sc-pile__tete"
          >
            {g.deplie ? '▾' : '▸'} {g.libelle}
          </Button>
          <Text size="xs" c="dimmed">
            {libelleResume(g.resume)}
          </Text>
          <ol className="sc-pile__lignes">
            {scene.rangees
              .filter((r) => r.groupe === g.cle)
              .map((r) =>
                r.type === 'ligne' ? (
                  <LignePile key={r.cle} r={r} c={c} />
                ) : r.calmes ? (
                  <li key={r.cle}>
                    <Lien nom={nomFaisceau(r)} onClick={() => c.basculer(r)}>
                      ▸ {teteFaisceau(r)}
                    </Lien>
                  </li>
                ) : null,
              )}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ Vue */
/** État de la vue, que l'écran parent peut tenir pour le garder pendant la navigation dans la page (onglets). Les replis
    sont gardés par regroupement ; null : repli par défaut. */
export interface VueCarte {
  regroupement: Regroupement;
  filtres: FiltresCarte;
  replis: Partial<Record<Regroupement, EtatReplis | null>>;
}
export const VUE_CARTE_INITIALE: VueCarte = {
  regroupement: REGROUPEMENT_DEFAUT,
  filtres: FILTRES_CARTE_VIDES,
  replis: {},
};

/** Phrase annoncée par le filtre par nom. */
export function annonceFiltreNom(saisie: string, c: { domaines: number; adresses: number }): string {
  if (!saisie.trim()) return '';
  if (!c.domaines && !c.adresses)
    return `Aucun nom de domaine ni aucune adresse IP ne correspond à « ${saisie.trim()} ».`;
  return `${pluriel(c.domaines, 'nom de domaine', 'noms de domaine')} et ${pluriel(c.adresses, 'adresse IP', 'adresses IP')} correspondent à « ${saisie.trim()} ».`;
}

export function CarteSurface({
  carte,
  peutModifier,
  actions,
  vue: vueTenue,
  onVue,
}: {
  carte: CarteSurfaceDto;
  peutModifier: boolean;
  actions: ActionsCarte;
  vue?: VueCarte;
  onVue?: (v: VueCarte) => void;
}) {
  const ids = useId();
  const [vueLocale, setVueLocale] = useState<VueCarte>(VUE_CARTE_INITIALE);
  const vue = vueTenue ?? vueLocale;
  const setVue = (v: VueCarte) => (onVue ? onVue(v) : setVueLocale(v));
  const { regroupement, filtres } = vue;
  const [cible, setCible] = useState<string | null>(null);
  const modele = useMemo(() => construireModele(carte, regroupement), [carte, regroupement]);
  const filtre = useMemo(() => filtrerModele(modele, filtres), [modele, filtres]);
  const replis = vue.replis[regroupement] ?? null;
  const etat = useMemo(() => replis ?? replisParDefaut(filtre), [replis, filtre]);
  const scene = useMemo(() => disposer(filtre, etat, { peutModifier }), [filtre, etat, peutModifier]);
  const vide = !carte.actifs.length && !carte.alertes.length;

  // Renvoi : après le dépliage, la ligne qui porte l'adresse reçoit le focus (la page défile jusqu'à elle).
  useEffect(() => {
    if (!cible) return;
    const el = [...document.querySelectorAll<HTMLElement | SVGElement>('[data-ancre]')].find(
      (x) => x.dataset.ancre === cible && x.getClientRects().length > 0,
    );
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'center' });
    }
    setCible(null);
  }, [cible, scene]);

  const setReplis = (e: EtatReplis | null) => setVue({ ...vue, replis: { ...vue.replis, [regroupement]: e } });
  // Un changement de filtre revient au repli par défaut du regroupement affiché.
  const changer = (f: Partial<FiltresCarte>) =>
    setVue({ ...vue, filtres: { ...filtres, ...f }, replis: { ...vue.replis, [regroupement]: null } });
  const commandes: Commandes = {
    actions,
    basculer: (r) => {
      if (r.type !== 'faisceau') return;
      setReplis(r.calmes ? basculerCalmes(etat, r.groupe) : basculerGroupe(etat, r.groupe));
    },
    aller: (cle) => {
      setReplis(deplierVers(filtre, etat, cle));
      setCible(cle);
    },
  };
  const critiques = filtre.groupes.flatMap((g) => g.lignes.filter((l) => l.critique));
  const premiereCritique = critiques[0]?.retenues.find((a) => a.priorite === 'P1') ?? null;
  const deplies = scene.groupes.filter((g) => g.deplie).length;
  const toutes = filtre.groupes.flatMap((g) => g.lignes);
  const totalDomaines = new Set(toutes.flatMap((l) => l.domaines.map((d) => d.id))).size;
  const totalHotes = new Set(toutes.flatMap((l) => (l.hote ? [l.hote.id] : []))).size;
  const totalMachines = new Set(toutes.flatMap((l) => l.machines.map((m) => m.id))).size;
  const resumeId = `${ids}-resume`;
  const aideId = `${ids}-aide`;
  const degrade = `${ids}-balayage`.replace(/[^a-zA-Z0-9_-]/g, '');

  if (vide)
    return (
      <Text size="sm" c="dimmed">
        Aucun actif exposé ni aucune alerte ouverte, parmi ceux que vous pouvez lire : la carte est vide. Elle se
        remplit après une synchronisation d’AlgoLightHouse ou un import de rapport Silène.
      </Text>
    );

  return (
    <Stack gap="sm" className="surface-carte">
      {premiereCritique && (
        <Alert color="red" title="Un actif exposé sur Internet porte une faille en priorité P1">
          <Group justify="space-between" wrap="wrap">
            <Text size="sm">
              {pluriel(critiques.length, 'chemin d’entrée critique', 'chemins d’entrée critiques')} : une alerte ouverte
              est en priorité P1 (CVE dont l’exploitation est avérée, ou priorité majorée parce que l’actif mène à une
              machine interne vulnérable), tracé en rouge pointillé jusqu’aux machines internes reliées. «{' '}
              {premiereCritique.titre} »
            </Text>
            <Button size="compact-sm" variant="light" color="red" onClick={() => actions.onAlerte(premiereCritique.id)}>
              Ouvrir la fiche de l’alerte
            </Button>
          </Group>
        </Alert>
      )}
      <BarreFiltres label="Carte de la surface externe">
        <TextInput
          label="Filtrer la carte"
          description="Domaine, adresse, CVE, port (443, 443/tcp) ou produit."
          maxLength={100}
          value={filtres.texte}
          onChange={(e) => changer({ texte: e.currentTarget.value })}
        />
        <Select
          label="Périmètre"
          placeholder="Tous"
          clearable
          value={filtres.perimetre || null}
          onChange={(v) => changer({ perimetre: v ?? '' })}
          data={modele.perimetres}
          comboboxProps={{ withinPortal: false }}
        />
        <Select
          label="Type d’alerte"
          placeholder="Tous"
          clearable
          value={filtres.typeAlerte || null}
          onChange={(v) => changer({ typeAlerte: (v ?? '') as TypeAlerteAlh | '' })}
          data={OPTIONS_TYPE}
          comboboxProps={{ withinPortal: false }}
        />

        <Checkbox.Group
          label="Criticité"
          value={filtres.criticites}
          onChange={(v) => changer({ criticites: v as CriticiteAlh[] })}
        >
          <Group gap="sm" mt="2xs">
            {CRITICITES_ALH.map((c) => (
              <Checkbox key={c} value={c} label={libelleCriticite(c)} />
            ))}
          </Group>
        </Checkbox.Group>
        <Switch
          label="Branches en alerte seulement"
          checked={filtres.enAlerteSeulement}
          onChange={(e) => changer({ enAlerteSeulement: e.currentTarget.checked })}
        />
      </BarreFiltres>

      {/* Repères collants pendant le défilement de la page : regroupement, filtre par nom, repli, titres des colonnes. */}
      <div className="sc-collant">
        <BarreFiltres
          label="Présentation de la surface externe"
          actions={
            <Group gap="xs">
              <Button size="compact-sm" variant="default" onClick={() => setReplis(toutReplier())}>
                Tout replier
              </Button>
              <Button size="compact-sm" variant="default" onClick={() => setReplis(toutDeplier(filtre))}>
                Tout déplier
              </Button>
            </Group>
          }
        >
          <Select
            label="Regrouper par"
            allowDeselect={false}
            value={regroupement}
            onChange={(v) => setVue({ ...vue, regroupement: (v as Regroupement | null) ?? REGROUPEMENT_DEFAUT })}
            data={OPTIONS_REGROUPEMENT}
            comboboxProps={{ withinPortal: false }}
          />
          <TextInput
            label="Nom de domaine ou adresse IP"
            description="Partie du nom (www, example.org) ou début de l’adresse (192.0.2.)."
            maxLength={100}
            value={filtres.nom}
            onChange={(e) => changer({ nom: e.currentTarget.value })}
          />
          <Button size="compact-sm" variant="default" disabled={!filtres.nom} onClick={() => changer({ nom: '' })}>
            Effacer le filtre par nom
          </Button>
        </BarreFiltres>
        <Text size="sm" role="status" aria-live="polite" className="sc-annonce">
          {annonceFiltreNom(filtres.nom, filtre.correspondances)}
        </Text>
        <svg
          viewBox={`0 0 ${scene.largeur} 26`}
          preserveAspectRatio="xMinYMin meet"
          className="sc-entetes"
          aria-hidden="true"
        >
          {COLONNES.map((c) => (
            <text key={c.cle} x={c.x} y={18} textAnchor="middle" className="sc-texte sc-colonne">
              {c.cle === 'groupe' ? libelleColonneGroupe(regroupement) : c.libelle}
            </text>
          ))}
        </svg>
      </div>
      <Text size="sm" id={resumeId} role="status">
        Lignes d’approche : {pluriel(totalDomaines, 'nom de domaine', 'noms de domaine')},{' '}
        {pluriel(totalHotes, 'hôte', 'hôtes')},{' '}
        {pluriel(
          new Set(toutes.flatMap((l) => l.retenues.map((a) => a.id))).size,
          'alerte ouverte',
          'alertes ouvertes',
        )}
        , {pluriel(totalMachines, 'machine interne reliée', 'machines internes reliées')} ;{' '}
        {pluriel(deplies, 'branche dépliée', 'branches dépliées')},{' '}
        {pluriel(scene.groupes.length - deplies, 'repliée', 'repliées')}.
        {scene.replieesParBorne > 0 &&
          ` Affichage borné à ${LIGNES_MAX} lignes : ${pluriel(scene.replieesParBorne, 'branche reste repliée', 'branches restent repliées')} en faisceau ; filtrez pour en voir le détail.`}
      </Text>
      {carte.tronquee && (
        <Text size="sm" role="status">
          Carte bornée : {Math.min(carte.actifs.length, carte.totaux.actifs)} actifs sur {carte.totaux.actifs} et{' '}
          {Math.min(carte.alertes.length, carte.totaux.alertes)} alertes ouvertes sur {carte.totaux.alertes} (ceux qui
          portent une alerte d’abord) ; les onglets « Alertes » et « Actifs » donnent la liste complète.
        </Text>
      )}
      <div className="sc-dessin">
        <svg
          viewBox={`0 0 ${scene.largeur} ${scene.hauteur}`}
          preserveAspectRatio="xMinYMin meet"
          role="group"
          aria-label="Carte des lignes d’approche, de l’Internet aux machines internes"
          aria-describedby={`${resumeId} ${aideId}`}
          className="sc-svg"
        >
          <defs>
            <linearGradient id={degrade} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" className="sc-balayage__bord" />
              <stop offset="0.8" className="sc-balayage__coeur" />
              <stop offset="1" className="sc-balayage__bord" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={scene.largeur} height={scene.hauteur} className="sc-fond" />
          <rect
            x={-scene.largeur / 10}
            y={HAUT_BALAYAGE}
            width={scene.largeur / 10}
            height={scene.hauteur - HAUT_BALAYAGE}
            fill={`url(#${degrade})`}
            className="sc-balayage"
            aria-hidden="true"
          />
          <g className="sc-rempart" aria-hidden="true">
            <path d={`M${X.rempart - 4} ${HAUT_BALAYAGE} L${X.rempart - 4} ${scene.hauteur - 16}`} />
            <path d={`M${X.rempart + 4} ${HAUT_BALAYAGE} L${X.rempart + 4} ${scene.hauteur - 16}`} />
          </g>
          <g aria-hidden="true">
            {scene.liens.map((l) => (
              <path
                key={l.cle}
                d={l.d}
                strokeWidth={l.epaisseur ?? undefined}
                className={`sc-lien${l.faisceau ? ' sc-lien--faisceau' : ''}${l.critique ? ' sc-lien--critique' : ''}`}
              />
            ))}
          </g>
          <g role="img" aria-label="Internet, point de départ">
            <circle cx={scene.origine.x} cy={scene.origine.y} r={12} className="sc-forme sc-origine" />
            <text x={scene.origine.x} y={scene.origine.y + 28} textAnchor="middle" className="sc-texte">
              Internet
            </text>
          </g>
          {scene.internet.map(({ alerte, y }) => (
            <AlerteInternet key={alerte.id} alerte={alerte} y={y} onOuvrir={actions.onAlerte} />
          ))}
          {[
            scene.internetAutres ? `+ ${scene.internetAutres} côté Internet` : null,
            filtre.sansActif.length ? `${filtre.sansActif.length} hors carte` : null,
          ]
            .filter((x): x is string => !!x)
            .map((texte, i) => (
              <text
                key={texte}
                x={X.internet}
                y={yInternet(Math.min(INTERNET_MAX, scene.internet.length)) - 4 + i * 14}
                textAnchor="middle"
                className="sc-texte sc-texte--secondaire"
              >
                {texte}
              </text>
            ))}
          {scene.groupes.map((g) => {
            const haute = criticiteHaute(g.resume);
            return (
              <Bouton
                key={g.cle}
                nom={nomGroupe(g)}
                onActiver={() => setReplis(basculerGroupe(etat, g.cle))}
                className={`sc-groupe${g.resume.critique ? ' sc-groupe--critique' : ''}`}
              >
                <rect
                  x={X.groupe}
                  y={g.y - 13}
                  width={X.groupeFin - X.groupe}
                  height={26}
                  rx={13}
                  className="sc-forme"
                />
                <text x={X.groupe + 12} y={g.y + 4} className="sc-texte">
                  {g.deplie ? '▾' : '▸'} {tronque(g.libelle, 25)}
                </text>
                {haute && (
                  <g>
                    <circle
                      cx={X.groupeFin - 30}
                      cy={g.y}
                      r={4}
                      className={`sc-forme ${classeCriticite(haute === 'inconnue' ? null : haute)}`}
                    />
                    <text x={X.groupeFin - 22} y={g.y + 4} className="sc-texte">
                      {g.resume.alertes}
                    </text>
                  </g>
                )}
              </Bouton>
            );
          })}
          {scene.rangees.map((r) => (
            <DessinRangee key={r.cle} r={r} c={commandes} />
          ))}
        </svg>
      </div>
      <div className="sc-empile">
        {scene.internet.length > 0 && (
          <Text size="sm">
            Côté Internet :{' '}
            {scene.internet.map(({ alerte }, i) => (
              <span key={alerte.id}>
                {i ? ', ' : ''}
                <Anchor component="button" type="button" onClick={() => actions.onAlerte(alerte.id)}>
                  {libelleTypeAlerte(alerte.type)} {alerte.cible?.valeur ?? alerte.titre}
                </Anchor>
              </span>
            ))}
            {scene.internetAutres ? `, et ${scene.internetAutres} autres` : ''}.
          </Text>
        )}
        <Pile scene={scene} c={commandes} onGroupe={(cle) => setReplis(basculerGroupe(etat, cle))} />
      </div>
      <Text size="xs" c="dimmed" id={aideId}>
        La carte se parcourt en faisant défiler la page ; au clavier, Tab passe d’un point à l’autre. Cliquez ou appuyez
        sur Entrée sur une branche pour la déplier ou la replier, sur un point pour ouvrir sa fiche. Les noms de domaine
        qui résolvent vers une même adresse IP la rejoignent ; une adresse déjà tracée dans une autre branche y renvoie
        (« voir … »). Pastilles : ALH pour AlgoLightHouse, SIL pour Silène ; une étiquette « n SIL » compte les constats
        Silène (sans priorité). Les onglets « Alertes » et « Actifs » donnent les mêmes informations en tableau. Colonne
        « Service » : les ports ouverts de chaque hôte selon Silène ; AlgoLightHouse ne publie pas la liste des ports
        ouverts, de lui seuls les services portés par une alerte sont connus ; un actif en alerte dont le détail ne
        donne aucun port affiche « port non communiqué ».
      </Text>
      <Legende />
    </Stack>
  );
}

/** Haut du rempart et du balayage. */
const HAUT_BALAYAGE = 16;

/** Alerte tracée côté Internet (typosquatting, fuite de données) : hors du périmètre de l'organisation. */
function AlerteInternet({
  alerte,
  y,
  onOuvrir,
}: {
  alerte: AlerteCarteDto;
  y: number;
  onOuvrir: (id: string) => void;
}) {
  const typo = alerte.type === 'typosquatting';
  const valeur = alerte.cible?.valeur ?? alerte.titre;
  const lignes = couperLibelle(valeur, INTERNET_CARACTERES);
  return (
    <Bouton
      nom={`${libelleTypeAlerte(alerte.type)}, ${libelleCriticite(alerte.criticite)} : ${valeur}. Ouvrir la fiche de l’alerte`}
      onActiver={() => onOuvrir(alerte.id)}
    >
      <path
        d={typo ? losange(X.internet, y, 8) : triangle(X.internet, y, 8)}
        className={`sc-forme ${typo ? 'sc-typo' : 'sc-fuite'}`}
      />
      {lignes.map((ligne, i) => (
        <text
          key={`${i}-${ligne}`}
          x={X.internet}
          y={y + 22 + i * INTERNET_INTERLIGNE}
          textAnchor="middle"
          className="sc-texte"
        >
          {ligne}
        </text>
      ))}
      <text
        x={X.internet}
        y={y + 22 + lignes.length * INTERNET_INTERLIGNE}
        textAnchor="middle"
        className="sc-texte sc-texte--secondaire"
      >
        {typo ? 'typosquatting' : 'fuite de données'}
      </text>
    </Bouton>
  );
}

/** Légende : formes et traits, chacun avec son libellé (l'information n'est jamais portée par la seule couleur). */
function Legende() {
  const icone = (forme: ReactNode, boite = '-10 -10 20 20') => (
    <svg viewBox={boite} className="sc-legende__icone" aria-hidden="true">
      {forme}
    </svg>
  );
  const elements: [ReactNode, string][] = [
    ...CRITICITES_ALH.map((c): [ReactNode, string] => [
      icone(<circle r={6} className={`sc-forme ${classeCriticite(c)}`} />),
      libelleCriticite(c),
    ]),
    [icone(<path d={losange(0, 0, 7)} className="sc-forme sc-sans-alerte" />), 'Nom de domaine (losange)'],
    [icone(<rect x={-5} y={-5} width={10} height={10} rx={2} className="sc-forme sc-hote" />), 'IP publique (carré)'],
    [
      icone(<rect x={-5} y={-5} width={10} height={10} rx={2} className="sc-forme sc-hote sc-legende__renvoi" />),
      'Adresse déjà tracée dans une autre branche (renvoi, pointillé)',
    ],
    [
      icone(<rect x={-8} y={-4} width={16} height={8} rx={4} className="sc-forme sc-service" />),
      'Service : port/protocole · service, puis produit et version',
    ],
    [
      icone(<SourcesSvg x={0} y={-6} sources={['alh', 'silene']} />, '-24 -10 48 20'),
      'Sources : ALH (AlgoLightHouse), SIL (Silène)',
    ],
    [icone(<MarqueConstats x={-14} y={0} n={2} />, '-16 -10 40 20'), 'Constats Silène (sans priorité)'],
    [
      icone(<rect x={-8} y={-6} width={16} height={11} rx={2} className="sc-forme sc-machine" />),
      'Machine interne reliée',
    ],
    [icone(<circle r={7} className="sc-forme sc-a-relier" />), '« ? » : à relier'],
    [
      icone(<path d="M-9 0 L9 0" className="sc-lien sc-lien--critique sc-legende__trait" />),
      'Pointillé rouge : chemin d’entrée critique (P1)',
    ],
    [
      icone(<path d="M-9 0 L9 0" className="sc-lien sc-lien--faisceau sc-legende__epais" />),
      'Trait épais : lignes repliées, selon leur nombre',
    ],
    [icone(<path d={losange(0, 0, 7)} className="sc-forme sc-typo" />), 'Typosquatting (côté Internet)'],
    [icone(<path d={triangle(0, 0, 7)} className="sc-forme sc-fuite" />), 'Fuite de données (côté Internet)'],
  ];
  return (
    <ul className="sc-legende" aria-label="Légende de la carte">
      {elements.map(([i, t]) => (
        <li key={t}>
          {i}
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
