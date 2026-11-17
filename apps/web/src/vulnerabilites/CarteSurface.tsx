/* Module Vulnérabilités (ADR 0100, lot ALH4) : carte « Lignes d'approche » de l'écran « Surface externe », d'après les
   maquettes retenues par le RSSI le 17/11/2026 (08d, 08e). Dessin SVG sans aucun style en ligne (CSP stricte, ADR 0006) :
   positions par attributs, déplacement et zoom par la viewBox, couleurs, traits et animations par les classes de
   packages/ui/src/neon-surface.css (jetons de la charte, clair et sombre ; animations coupées par le mouvement réduit).
   Mise en page calculée par des fonctions pures (carte-surface.ts). Chaque nœud est atteignable au clavier avec un nom
   lisible ; un clic ou Entrée ouvre la fiche existante (alerte, actif, machine) ou déplie une branche. Les onglets
   « Alertes » et « Actifs » en sont l'équivalent en tableau. Lot ALH6 : colonne « Service » (port/protocole · service, puis
   produit et version) ; libellés du typosquatting et des fuites hors des traits, sur trois lignes au plus. */
import { ActionIcon, Alert, Button, Checkbox, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import {
  type ActifCarteDto,
  type AlerteCarteDto,
  type CarteSurfaceDto,
  CRITICITES_ALH,
  type CriticiteAlh,
  ROLE_MACHINE_LIBELLES,
  TYPES_ALERTE_ALH,
  type TypeAlerteAlh,
} from '@suivi/shared';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  basculerCalmes,
  basculerGroupe,
  borner,
  type Camera,
  cameraInitiale,
  centrerSur,
  COLONNES,
  colonneService,
  construireModele,
  couperLibelle,
  deplacer,
  disposer,
  type EtatReplis,
  FILTRES_CARTE_VIDES,
  type FiltresCarte,
  filtrerModele,
  hauteurCamera,
  HAUT,
  INTERNET_CARACTERES,
  INTERNET_INTERLIGNE,
  INTERNET_MAX,
  libelleAlertes,
  libelleResume,
  LIGNES_MAX,
  MACHINES_PAR_LIGNE,
  MACHINE_H,
  nomMachineCarte,
  OPTIONS_REGROUPEMENT,
  type Rangee,
  recadrer,
  type Regroupement,
  REGROUPEMENT_DEFAUT,
  replisParDefaut,
  type Resume,
  type Scene,
  toutDeplier,
  toutReplier,
  viewBoxDe,
  X,
  yInternet,
  zoomer,
} from './carte-surface';
import { libelleCriticite, libelleTypeAlerte } from './surface';

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

/** Nœud activable (bouton SVG) : clic, Entrée ou Espace. */
function Bouton({
  nom,
  onActiver,
  className,
  children,
}: {
  nom: string;
  onActiver: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={nom}
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
}

/** Dessin d'une rangée (ligne d'un actif ou faisceau replié). */
function DessinRangee({
  r,
  actions,
  onBasculer,
}: {
  r: Rangee;
  actions: ActionsCarte;
  onBasculer: (r: Rangee) => void;
}) {
  if (r.type === 'faisceau') {
    const haute = criticiteHaute(r.resume);
    const tete = r.calmes
      ? pluriel(r.lignes, 'ligne sans alerte', 'lignes sans alerte')
      : r.resume.domaines
        ? pluriel(r.resume.domaines, 'domaine', 'domaines')
        : pluriel(r.resume.hotes, 'hôte', 'hôtes');
    const alertes = `${pluriel(r.resume.alertes, 'alerte', 'alertes')}${r.resume.parCriticite.critical ? ` (${r.resume.parCriticite.critical} crit.)` : ''}`;
    return (
      <g className="sc-faisceau">
        <Bouton
          nom={`Déplier ${r.calmes ? 'les lignes sans alerte' : 'la branche'} : ${tete} (${libelleResume(r.resume)})`}
          onActiver={() => onBasculer(r)}
        >
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
  const sv = colonneService(l);
  // Adresse IPv6 longue : sur deux lignes, coupées après un deux-points, pour ne pas déborder sur les colonnes voisines.
  const ip = l.hote ? couperIp(l.hote.valeur) : [];
  return (
    <g className={`sc-ligne${l.critique ? ' sc-ligne--critique' : ''}`}>
      {l.domaine && (
        <Bouton
          nom={`Domaine ${l.domaine.valeur}${l.domaine.adresse ? `, résout vers ${l.domaine.adresse}` : ''} : ouvrir sa fiche`}
          onActiver={() => actions.onActif(l.domaine!)}
        >
          <path
            d={losange(X.domaine, r.y, 8)}
            className={`sc-forme sc-domaine ${p ? classeCriticite(p.criticite) : 'sc-sans-alerte'}`}
          />
          <text x={X.domaine} y={r.y - 13} textAnchor="middle" className="sc-texte sc-texte--secondaire">
            {/* Nom de domaine complet : un libellé court comme « vpn » se lirait comme un nom de service. */}
            {tronque(l.domaine?.valeur ?? l.etiquette, 32)}
          </text>
        </Bouton>
      )}
      {l.hote && (
        <Bouton nom={`Hôte ${l.hote.valeur} : ouvrir sa fiche`} onActiver={() => actions.onActif(l.hote!)}>
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
        </Bouton>
      )}
      {sv &&
        (sv.connu ? (
          <Bouton
            nom={`${sv.nom} : ouvrir la fiche de ${(l.actifServices ?? l.domaine ?? l.hote)!.valeur}`}
            onActiver={() => actions.onActif((l.actifServices ?? l.domaine ?? l.hote)!)}
          >
            <rect x={X.service - 8} y={r.y - 4} width={16} height={8} rx={4} className="sc-forme sc-service" />
            <text x={X.service} y={r.y - 13} textAnchor="middle" className="sc-texte sc-texte--code">
              {tronque(sv.libelle, 24)}
            </text>
            {sv.produit && (
              <text x={X.service} y={r.y + 17} textAnchor="middle" className="sc-texte sc-texte--secondaire">
                {tronque(sv.produit, 24)}
              </text>
            )}
          </Bouton>
        ) : (
          <g role="img" aria-label={sv.nom}>
            <text x={X.service} y={r.y - 13} textAnchor="middle" className="sc-texte sc-texte--secondaire">
              {sv.libelle}
            </text>
          </g>
        ))}
      {p && (
        <Bouton
          nom={`${libelleAlertes(l)} : ${p.titre}${p.cves.length ? ` (${p.cves.slice(0, 3).join(', ')})` : ''}. Ouvrir la fiche de l’alerte`}
          onActiver={() => actions.onAlerte(p.id)}
        >
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
        const role = m.role ? ROLE_MACHINE_LIBELLES[m.role] : null;
        return (
          <Bouton
            key={m.id}
            nom={`Machine interne ${nomMachineCarte(m)}${role ? ` (${role})` : ''} : ouvrir sa fiche`}
            onActiver={() => actions.onMachine(m.id)}
          >
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
        <Bouton
          nom={`À relier à une machine interne${l.propositions ? ` (${pluriel(l.propositions, 'proposition', 'propositions')} à décider)` : ''} : ouvrir la fiche de ${(l.domaine ?? l.hote)!.valeur}`}
          onActiver={() => actions.onActif((l.hote && !l.domaine ? l.hote : l.domaine)!)}
        >
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

/** Vue d'ensemble : toute la carte en petit et le cadre de la zone affichée ; un clic y centre la vue (doublé par le
    clavier et les boutons, donc masqué des technologies d'assistance). */
function VueEnsemble({
  scene,
  camera,
  onCentrer,
}: {
  scene: Scene;
  camera: Camera;
  onCentrer: (x: number, y: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const centrer = (cx: number, cy: number) => {
    const s = ref.current;
    if (!s) return;
    const b = s.getBoundingClientRect();
    // viewBox de la scène entière, « meet » : la plus petite échelle des deux axes.
    const k = Math.max(scene.largeur / b.width, scene.hauteur / b.height);
    const ox = (b.width * k - scene.largeur) / 2;
    const oy = (b.height * k - scene.hauteur) / 2;
    onCentrer((cx - b.left) * k - ox, (cy - b.top) * k - oy);
  };
  return (
    <div className="sc-mini" aria-hidden="true">
      <span className="sc-mini__titre">Vue d’ensemble</span>
      <svg
        ref={ref}
        viewBox={`0 0 ${scene.largeur} ${scene.hauteur}`}
        className="sc-mini__svg"
        onPointerDown={(e) => centrer(e.clientX, e.clientY)}
      >
        {scene.liens.map((l) => (
          <path key={l.cle} d={l.d} className={`sc-mini__lien${l.critique ? ' sc-mini__lien--critique' : ''}`} />
        ))}
        <rect x={camera.x} y={camera.y} width={camera.w} height={hauteurCamera(camera)} className="sc-mini__cadre" />
      </svg>
    </div>
  );
}

export function CarteSurface({
  carte,
  peutModifier,
  actions,
}: {
  carte: CarteSurfaceDto;
  peutModifier: boolean;
  actions: ActionsCarte;
}) {
  const ids = useId();
  const [regroupement, setRegroupement] = useState<Regroupement>(REGROUPEMENT_DEFAUT);
  const [filtres, setFiltres] = useState<FiltresCarte>(FILTRES_CARTE_VIDES);
  const [replis, setReplis] = useState<EtatReplis | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const modele = useMemo(() => construireModele(carte, regroupement), [carte, regroupement]);
  const filtre = useMemo(() => filtrerModele(modele, filtres), [modele, filtres]);
  const etat = replis ?? replisParDefaut(filtre);
  const scene = useMemo(() => disposer(filtre, etat, { peutModifier }), [filtre, etat, peutModifier]);
  const cam = borner(camera ?? cameraInitiale(scene), scene);
  const svg = useRef<SVGSVGElement>(null);
  const vide = !carte.actifs.length && !carte.alertes.length;
  const courant = useRef({ cam, scene });
  courant.current = { cam, scene };
  const glisse = useRef<{ x: number; y: number; cam: Camera; actif: boolean; id: number } | null>(null);

  const changer = (f: Partial<FiltresCarte>) => {
    setFiltres({ ...filtres, ...f });
    setReplis(null);
  };
  // Molette : zoom seulement avec Ctrl (ou ⌘), pour ne pas piéger le défilement de la page.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const roue = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const { cam: c, scene: s } = courant.current;
      const b = el.getBoundingClientRect();
      const p = {
        x: c.x + ((e.clientX - b.left) / b.width) * c.w,
        y: c.y + ((e.clientY - b.top) / b.height) * hauteurCamera(c),
      };
      setCamera(zoomer(c, e.deltaY > 0 ? 1.15 : 1 / 1.15, s, p));
    };
    el.addEventListener('wheel', roue, { passive: false });
    return () => el.removeEventListener('wheel', roue);
  }, [vide]);

  const clavier = (e: KeyboardEvent<SVGSVGElement>) => {
    const pas = cam.w * 0.1;
    const actions: Record<string, () => Camera> = {
      ArrowLeft: () => deplacer(cam, -pas, 0, scene),
      ArrowRight: () => deplacer(cam, pas, 0, scene),
      ArrowUp: () => deplacer(cam, 0, -pas, scene),
      ArrowDown: () => deplacer(cam, 0, pas, scene),
      '+': () => zoomer(cam, 0.8, scene),
      '=': () => zoomer(cam, 0.8, scene),
      '-': () => zoomer(cam, 1.25, scene),
      '0': () => recadrer(scene),
    };
    const f = actions[e.key];
    if (!f) return;
    e.preventDefault();
    setCamera(f());
  };

  const basculer = (r: Rangee) => {
    if (r.type !== 'faisceau') return;
    setReplis(r.calmes ? basculerCalmes(etat, r.groupe) : basculerGroupe(etat, r.groupe));
  };
  const critiques = filtre.groupes.flatMap((g) => g.lignes.filter((l) => l.critique));
  const premiereCritique = critiques[0]?.retenues.find((a) => a.priorite === 'P1') ?? null;
  const deplies = scene.groupes.filter((g) => g.deplie).length;
  const toutes = filtre.groupes.flatMap((g) => g.lignes);
  const totalDomaines = new Set(toutes.flatMap((l) => (l.domaine ? [l.domaine.id] : []))).size;
  const totalHotes = new Set(toutes.flatMap((l) => (l.hote ? [l.hote.id] : []))).size;
  const totalMachines = new Set(toutes.flatMap((l) => l.machines.map((m) => m.id))).size;
  const resumeId = `${ids}-resume`;
  const aideId = `${ids}-aide`;
  const degrade = `${ids}-balayage`.replace(/[^a-zA-Z0-9_-]/g, '');

  if (vide)
    return (
      <Text size="sm" c="dimmed">
        Aucun actif exposé ni aucune alerte ouverte, parmi ceux que vous pouvez lire : la carte est vide. Elle se
        remplit après une synchronisation d’AlgoLightHouse.
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
      <Group align="flex-end" wrap="wrap" gap="sm">
        <TextInput
          label="Filtrer la carte"
          description="Domaine, adresse, CVE, port (443, 443/tcp) ou produit."
          maxLength={100}
          value={filtres.texte}
          onChange={(e) => changer({ texte: e.currentTarget.value })}
        />
        <Select
          label="Regrouper par"
          allowDeselect={false}
          value={regroupement}
          onChange={(v) => {
            setRegroupement((v as Regroupement | null) ?? REGROUPEMENT_DEFAUT);
            setReplis(null);
          }}
          data={OPTIONS_REGROUPEMENT}
          comboboxProps={{ withinPortal: false }}
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
      </Group>
      <Group align="center" wrap="wrap" gap="md">
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
        <Group gap="xs">
          <Button size="compact-sm" variant="default" onClick={() => setReplis(toutReplier())}>
            Tout replier
          </Button>
          <Button size="compact-sm" variant="default" onClick={() => setReplis(toutDeplier(filtre))}>
            Tout déplier
          </Button>
        </Group>
      </Group>
      <Text size="sm" id={resumeId} role="status">
        Lignes d’approche : {pluriel(totalDomaines, 'domaine', 'domaines')}, {pluriel(totalHotes, 'hôte', 'hôtes')},{' '}
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
      <div className="sc-scene">
        <div className="sc-cadre">
          <svg
            ref={svg}
            viewBox={viewBoxDe(cam)}
            preserveAspectRatio="xMinYMin meet"
            role="group"
            aria-label="Carte des lignes d’approche, de l’Internet aux machines internes"
            aria-describedby={`${resumeId} ${aideId}`}
            tabIndex={0}
            className="sc-svg"
            onKeyDown={clavier}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              glisse.current = { x: e.clientX, y: e.clientY, cam, actif: false, id: e.pointerId };
            }}
            onPointerMove={(e) => {
              const g = glisse.current;
              const el = svg.current;
              if (!g || !el) return;
              const dx = e.clientX - g.x;
              const dy = e.clientY - g.y;
              if (!g.actif) {
                if (Math.hypot(dx, dy) < 4) return;
                g.actif = true;
                el.setPointerCapture(g.id);
              }
              const k = g.cam.w / el.getBoundingClientRect().width;
              setCamera(deplacer(g.cam, -dx * k, -dy * k, scene));
            }}
            onPointerUp={() => {
              const g = glisse.current;
              if (g?.actif && svg.current?.hasPointerCapture(g.id)) svg.current.releasePointerCapture(g.id);
              glisse.current = null;
            }}
            onPointerCancel={() => {
              glisse.current = null;
            }}
          >
            <defs>
              <linearGradient id={degrade} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" className="sc-balayage__bord" />
                <stop offset="0.8" className="sc-balayage__coeur" />
                <stop offset="1" className="sc-balayage__bord" />
              </linearGradient>
            </defs>
            <rect
              x={-scene.largeur}
              y={-scene.hauteur}
              width={scene.largeur * 3}
              height={scene.hauteur * 3}
              className="sc-fond"
            />
            {COLONNES.map((c) => (
              <text key={c.cle} x={c.x} y={HAUT - 56} textAnchor="middle" className="sc-texte sc-colonne">
                {c.cle === 'groupe' && regroupement === 'perimetre' ? 'Périmètre' : c.libelle}
              </text>
            ))}
            <rect
              x={-scene.largeur / 10}
              y={HAUT - 24}
              width={scene.largeur / 10}
              height={scene.hauteur - HAUT}
              fill={`url(#${degrade})`}
              className="sc-balayage"
              aria-hidden="true"
            />
            <g className="sc-rempart" aria-hidden="true">
              <path d={`M${X.rempart - 4} ${HAUT - 20} L${X.rempart - 4} ${scene.hauteur - 16}`} />
              <path d={`M${X.rempart + 4} ${HAUT - 20} L${X.rempart + 4} ${scene.hauteur - 16}`} />
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
                  nom={`${g.deplie ? 'Replier' : 'Déplier'} la branche ${g.libelle} : ${libelleResume(g.resume)}${g.replieParBorne ? ' (repliée : borne d’affichage atteinte)' : ''}`}
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
              <DessinRangee key={r.cle} r={r} actions={actions} onBasculer={basculer} />
            ))}
          </svg>
        </div>
        <div className="sc-commandes">
          <ActionIcon
            variant="default"
            aria-label="Rapprocher (zoom avant)"
            onClick={() => setCamera(zoomer(cam, 0.8, scene))}
          >
            +
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Éloigner (zoom arrière)"
            onClick={() => setCamera(zoomer(cam, 1.25, scene))}
          >
            −
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label="Recadrer : toute la carte"
            onClick={() => setCamera(recadrer(scene))}
          >
            ⤢
          </ActionIcon>
        </div>
        <VueEnsemble scene={scene} camera={cam} onCentrer={(x, y) => setCamera(centrerSur(cam, x, y, scene))} />
      </div>
      <Text size="xs" c="dimmed" id={aideId}>
        Glisser pour se déplacer ; Ctrl (ou ⌘) et la molette pour zoomer ; au clavier, les flèches déplacent, + et −
        zooment, 0 recadre. Cliquez ou appuyez sur Entrée sur une branche pour la déplier ou la replier, sur un point
        pour ouvrir sa fiche. Les onglets « Alertes » et « Actifs » donnent les mêmes informations en tableau. Colonne «
        Service » : seuls les services portés par une alerte sont connus, car AlgoLightHouse ne publie pas la liste des
        ports ouverts ; un actif en alerte dont le détail ne donne aucun port affiche « port non communiqué ».
      </Text>
      <Legende />
    </Stack>
  );
}

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
  const icone = (forme: ReactNode) => (
    <svg viewBox="-10 -10 20 20" className="sc-legende__icone" aria-hidden="true">
      {forme}
    </svg>
  );
  const elements: [ReactNode, string][] = [
    ...CRITICITES_ALH.map((c): [ReactNode, string] => [
      icone(<circle r={6} className={`sc-forme ${classeCriticite(c)}`} />),
      libelleCriticite(c),
    ]),
    [icone(<path d={losange(0, 0, 7)} className="sc-forme sc-sans-alerte" />), 'Domaine (losange)'],
    [icone(<rect x={-5} y={-5} width={10} height={10} rx={2} className="sc-forme sc-hote" />), 'Hôte exposé (carré)'],
    [
      icone(<rect x={-8} y={-4} width={16} height={8} rx={4} className="sc-forme sc-service" />),
      'Service : port/protocole · service, puis produit et version (seuls les services portés par une alerte sont connus)',
    ],
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
