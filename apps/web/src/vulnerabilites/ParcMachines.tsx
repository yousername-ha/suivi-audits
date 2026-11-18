/* Module Vulnérabilités (ADR 0100, point 16 ; lot PC2) : écran « Machines », mode « Parc », d'après les maquettes 04-machines
   et 04b-machines-grand-ecran de docs/unification/maquettes-vulnerabilites. Une tuile par machine lisible (icône
   d'ordinateur selon le rôle, nom, rang, failles présentes par gravité, priorité la plus haute en couleur ET en texte,
   marques zero-day et exploitable), rangée dans la zone de son rôle : front, back applicatif, base de données, puis rôle non
   indiqué. Les zones sont séparées par des murs à bandes diagonales animées (rouge entre le front et le back, violet entre le
   back et les bases, comme la maquette) ; ces frontières séparent les rôles indiqués et ne prouvent pas un cloisonnement du
   réseau. Mode réduit : les plus prioritaires de chaque zone et une tuile « et n autres » qui déplie la zone ; grand écran :
   tout le parc reçu, tuiles denses, zones élargies selon leur nombre de tuiles. Chaque tuile est un bouton (clic ou Entrée :
   fiche de la machine) au nom accessible complet. Sous la CSP stricte (ADR 0006) : aucun style en ligne ; couleurs, traits
   et animations par les classes de packages/ui/src/neon-parc.css (jetons de la charte, clair et sombre ; animations coupées
   par le mouvement réduit et à l'impression). */
import { VisuallyHidden } from '@mantine/core';
import {
  type EchelleParc,
  type MachineMarqueeDto,
  PARC_REDUIT,
  type ParcMachinesDto,
  ROLES_MACHINE,
  visiblesZone,
  ZONE_PARC_LIBELLES,
  type ZoneParc,
  type ZoneParcDto,
} from '@suivi/shared';
import { useId, useState } from 'react';
import { libelleMachine } from './failles';
import {
  LEGENDE_EXPLOITABLE,
  LEGENDE_ZERO_DAY,
  libellePrioriteMachine,
  MARQUE_EXPLOITABLE,
  MARQUE_ZERO_DAY,
  nomAccessibleMachine,
  poidsZones,
} from './parc';

/* ------------------------------------------------------------------ Icônes */
/** Icône d'ordinateur selon le rôle : poste avec un globe (front), serveur en baie (back applicatif), base de données
    (cylindre), poste avec un point d'interrogation (rôle non indiqué). Décorative : le rôle est dit par la zone et le nom
    accessible. */
export function IconeMachine({ zone }: { zone: ZoneParc }) {
  return (
    <svg className="parc-appareil" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {zone === 'front' && (
        <>
          <rect className="parc-appareil__voile" x="5" y="7" width="38" height="24" rx="2.5" />
          <rect x="5" y="7" width="38" height="24" rx="2.5" />
          <path d="M5 13h38" />
          <circle className="parc-appareil__plein" cx="9.5" cy="10" r="1" />
          <circle className="parc-appareil__plein" cx="13" cy="10" r="1" />
          <circle cx="24" cy="22" r="5.5" />
          <path d="M18.5 22h11M24 16.5c2.4 2.6 2.4 8.4 0 11M24 16.5c-2.4 2.6-2.4 8.4 0 11" />
          <path d="M19 31v6m10-6v6M13 39h22" />
        </>
      )}
      {zone === 'back' && (
        <>
          <rect className="parc-appareil__voile" x="9" y="5" width="30" height="38" rx="2.5" />
          <rect x="9" y="5" width="30" height="38" rx="2.5" />
          <path d="M9 17h30M9 29h30" />
          <circle className="parc-appareil__plein" cx="14.5" cy="11" r="1.4" />
          <circle className="parc-appareil__plein" cx="14.5" cy="23" r="1.4" />
          <circle className="parc-appareil__plein" cx="14.5" cy="35" r="1.4" />
          <path d="M21 11h12M21 23h12M21 35h12" />
        </>
      )}
      {zone === 'bdd' && (
        <>
          <path className="parc-appareil__voile" d="M9 11v26c0 3.3 6.7 6 15 6s15-2.7 15-6V11Z" />
          <ellipse cx="24" cy="11" rx="15" ry="6" />
          <path d="M9 11v26c0 3.3 6.7 6 15 6s15-2.7 15-6V11" />
          <path d="M9 20c0 3.3 6.7 6 15 6s15-2.7 15-6M9 29c0 3.3 6.7 6 15 6s15-2.7 15-6" />
        </>
      )}
      {zone === 'aucun' && (
        <>
          <rect className="parc-appareil__voile" x="6" y="8" width="36" height="24" rx="2.5" />
          <rect x="6" y="8" width="36" height="24" rx="2.5" />
          <path d="M19 32v6m10-6v6M13 40h22" />
          <path d="M20.5 17.5a3.6 3.6 0 1 1 5.2 3.2c-1 .6-1.7 1.2-1.7 2.6" />
          <circle className="parc-appareil__plein" cx="24" cy="27" r="1" />
        </>
      )}
    </svg>
  );
}

/** Marque « zero-day » : triangle d'avertissement. L'infobulle porte le libellé exact. */
export function MarqueZeroDay() {
  return (
    <span className="parc-marque parc-marque--zd" title={MARQUE_ZERO_DAY}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3 2 20h20Z" />
        <path d="M12 10v4M12 17.2v.1" />
      </svg>
    </span>
  );
}

/** Marque « exploitable » : éclair. */
export function MarqueExploitable() {
  return (
    <span className="parc-marque parc-marque--ex" title={MARQUE_EXPLOITABLE}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13.5 2 4 13.5h6L8.5 22 20 9.5h-6.5Z" />
      </svg>
    </span>
  );
}

/** Marques d'une machine (liste et tuile), avec un texte lisible par les lecteurs d'écran quand `texte` est vrai. */
export function MarquesMachine({ marques, texte = false }: { marques: MachineMarqueeDto['marques']; texte?: boolean }) {
  if (!marques.exploitationAveree && !marques.exploitable) return null;
  return (
    <span className="parc-marques">
      {marques.exploitationAveree && <MarqueZeroDay />}
      {marques.exploitable && <MarqueExploitable />}
      {texte && (
        <VisuallyHidden>
          {[marques.exploitationAveree ? MARQUE_ZERO_DAY : '', marques.exploitable ? MARQUE_EXPLOITABLE : '']
            .filter(Boolean)
            .join(' ; ')}
        </VisuallyHidden>
      )}
    </span>
  );
}

/** Légende des marques et des tuiles (mode « Parc » et mode « Liste »). */
export function LegendeMarques({ parc = false }: { parc?: boolean }) {
  return (
    <ul className="parc-legende" aria-label="Légende des marques">
      <li>
        <MarqueZeroDay />
        <span>{LEGENDE_ZERO_DAY}</span>
      </li>
      <li>
        <MarqueExploitable />
        <span>{LEGENDE_EXPLOITABLE}</span>
      </li>
      {parc && (
        <li>
          <span>
            Sur chaque tuile : le numéro est le rang (calculé par la plateforme) ; P1 à P4, la priorité la plus haute de
            ses failles présentes ; les chiffres, ses failles présentes critiques, élevées, moyennes et faibles.
          </span>
        </li>
      )}
    </ul>
  );
}

/* ------------------------------------------------------------------ Tuile */
export function TuileMachine({ m, onOuvrir }: { m: MachineMarqueeDto; onOuvrir: (m: MachineMarqueeDto) => void }) {
  const p = m.marques.priorite ?? 'aucune';
  const c = m.compteurs;
  return (
    <button
      type="button"
      className={`parc-tuile parc-p--${p}${m.marques.exploitationAveree ? ' parc-tuile--zd' : ''}`}
      aria-label={nomAccessibleMachine(m)}
      onClick={() => onOuvrir(m)}
    >
      <span className="parc-tuile__rang parc-mono" aria-hidden="true">
        {m.rang.position}
      </span>
      <MarquesMachine marques={m.marques} />
      <IconeMachine zone={m.role ?? 'aucun'} />
      <strong className="parc-tuile__nom">{libelleMachine(m)}</strong>
      <span className="parc-tuile__prio" aria-hidden="true">
        {libellePrioriteMachine(m.marques.priorite)}
      </span>
      <span className="parc-tuile__gravites parc-mono" aria-hidden="true">
        <b className={`parc-g parc-g--c${c.critique ? '' : ' parc-g--zero'}`}>{c.critique}</b>
        <b className={`parc-g parc-g--e${c.elevee ? '' : ' parc-g--zero'}`}>{c.elevee}</b>
        <b className={`parc-g parc-g--m${c.moyenne ? '' : ' parc-g--zero'}`}>{c.moyenne}</b>
        <b className={`parc-g parc-g--f${c.faible ? '' : ' parc-g--zero'}`}>{c.faible}</b>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ Zone et murs */
const ETIQUETTE_ZONE: Record<ZoneParc, string> = {
  front: '1re ligne · exposée',
  back: '2e ligne',
  bdd: '3e ligne',
  aucun: 'À classer',
};

export function ZoneMachines({
  dto,
  echelle,
  deplie,
  poids,
  onDeplier,
  onOuvrir,
  onVoirListe,
}: {
  dto: ZoneParcDto;
  echelle: EchelleParc;
  deplie: boolean;
  poids: number;
  onDeplier: (z: ZoneParc, deplie: boolean) => void;
  onOuvrir: (m: MachineMarqueeDto) => void;
  onVoirListe: (z: ZoneParc) => void;
}) {
  const id = useId();
  const { visibles, autres } = visiblesZone(dto.zone, dto.machines, dto.total, echelle, deplie);
  // Mode réduit : un seul bouton, à la même place, déplie puis replie la zone (machines reçues de la route).
  const bascule = echelle === 'reduit' && dto.machines.length > PARC_REDUIT[dto.zone];
  // Au-delà de ce que la route a rendu (borne par zone), la liste filtrée sur la zone montre le reste.
  const nonRecues = dto.total - dto.machines.length;
  return (
    <section className={`parc-zone parc-zone--${dto.zone} parc-zone--poids-${poids}`} aria-labelledby={id}>
      <header className="parc-zone__tete">
        <p className="parc-etiquette">{ETIQUETTE_ZONE[dto.zone]}</p>
        <h3 id={id} className="parc-zone__titre">
          {ZONE_PARC_LIBELLES[dto.zone]}
        </h3>
        <p className="parc-zone__compte">
          {dto.total} machine{dto.total > 1 ? 's' : ''}
          {dto.exploitationAveree > 0 && ` · ${dto.exploitationAveree} avec une exploitation avérée`}
        </p>
      </header>
      {dto.total === 0 ? (
        <p className="parc-zone__vide">
          {dto.zone === 'aucun' ? 'Aucune machine lue sans rôle.' : 'Aucune machine lue avec ce rôle.'}
        </p>
      ) : (
        <ul className="parc-grille">
          {visibles.map((m) => (
            <li key={m.id}>
              <TuileMachine m={m} onOuvrir={onOuvrir} />
            </li>
          ))}
          {bascule && (
            <li key="bascule">
              <button
                type="button"
                className="parc-plus"
                aria-expanded={deplie}
                onClick={() => onDeplier(dto.zone, !deplie)}
              >
                {deplie ? (
                  <span>Replier : les {PARC_REDUIT[dto.zone]} plus prioritaires</span>
                ) : (
                  <>
                    <b className="parc-mono">+{autres}</b>
                    <span>
                      et {autres} autre{autres > 1 ? 's' : ''} : tout montrer
                    </span>
                  </>
                )}
              </button>
            </li>
          )}
          {nonRecues > 0 && (echelle === 'grand' || deplie) && (
            <li key="liste">
              <button type="button" className="parc-plus" onClick={() => onVoirListe(dto.zone)}>
                <b className="parc-mono">+{nonRecues}</b>
                <span>
                  et {nonRecues} autre{nonRecues > 1 ? 's' : ''} : voir la liste
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** Mur entre deux zones : bandes diagonales animées (décoratives) et nom de la frontière, lisible. */
export function MurParc({ teinte, nom }: { teinte: 'rouge' | 'violet'; nom: string }) {
  return (
    <div className={`parc-mur parc-mur--${teinte}`}>
      <i className="parc-mur__hachures" aria-hidden="true" />
      <span className="parc-mur__nom">{nom}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ Parc */
export function ParcMachines({
  parc,
  echelle,
  onOuvrir,
  onVoirListe,
}: {
  parc: ParcMachinesDto;
  echelle: EchelleParc;
  onOuvrir: (m: MachineMarqueeDto) => void;
  onVoirListe: (z: ZoneParc) => void;
}) {
  const [deplies, setDeplies] = useState<ReadonlySet<ZoneParc>>(new Set());
  const deplier = (z: ZoneParc, oui: boolean) => {
    const s = new Set(deplies);
    if (oui) s.add(z);
    else s.delete(z);
    setDeplies(s);
  };
  const zone = (z: ZoneParc) =>
    parc.zones.find((x) => x.zone === z) ?? { zone: z, total: 0, exploitationAveree: 0, machines: [] };
  const montrees = Object.fromEntries(
    ROLES_MACHINE.map((r) => {
      const d = zone(r);
      return [r, visiblesZone(r, d.machines, d.total, echelle, deplies.has(r)).visibles.length];
    }),
  ) as Record<(typeof ROLES_MACHINE)[number], number>;
  const poids = echelle === 'grand' ? poidsZones(montrees) : { front: 1, back: 1, bdd: 1 };
  const rendre = (z: ZoneParc) => (
    <ZoneMachines
      dto={zone(z)}
      echelle={echelle}
      deplie={deplies.has(z)}
      poids={z === 'aucun' ? 1 : (poids[z] ?? 1)}
      onDeplier={deplier}
      onOuvrir={onOuvrir}
      onVoirListe={onVoirListe}
    />
  );
  return (
    <div className={`parc parc--${echelle}`}>
      <div className="parc__lignes">
        {rendre('front')}
        <MurParc teinte="rouge" nom="Frontière front · back" />
        {rendre('back')}
        <MurParc teinte="violet" nom="Frontière back · bases" />
        {rendre('bdd')}
      </div>
      {rendre('aucun')}
      <p className="parc__note">
        Le numéro est le rang, calculé par la plateforme : exploitation avérée, puis rôle (front avant back avant base),
        puis nombre de failles critiques et élevées. Les frontières séparent les rôles indiqués ; elles ne prouvent pas
        un cloisonnement du réseau.
      </p>
    </div>
  );
}
