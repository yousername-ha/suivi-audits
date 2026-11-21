/* Module Vulnérabilités (ADR 0100, point 17 et V12 ; lot PC3) : onglet « Périmètres », poste de commandement vu par
   périmètre, d'après la maquette 05-perimetre de docs/unification/maquettes-vulnerabilites.
   - Liste : une carte par périmètre que la personne lit (nom, machines lues, priorité la plus haute en couleur ET en texte,
     failles présentes par gravité, marques zero-day et exploitable avec leur nombre de machines, actifs exposés sur
     Internet rattachés), du plus critique au moins critique ; carte « Sans périmètre » pour qui administre le module.
     Chaque carte est un bouton (clic ou Entrée) qui ouvre le détail ; l'adresse `?perimetre=` se partage.
   - Détail : chiffres clés, bandeau quand une machine de première ligne porte une faille à exploitation avérée, puis les
     machines « Par ligne » (zones front, back applicatif, base de données, rôle non indiqué, séparées par les murs du lot
     PC2 : même composant ParcMachines, mêmes tuiles, mêmes marques, même fiche) ou « Vue globale » (toutes ensemble dans
     l'ordre du rang, réduit puis « et n autres »). Une machine reliée par une liaison confirmée à des actifs exposés
     lisibles porte la mention « Exposée sur Internet » et la liste des actifs suit le parc.
   - Aucun trait entre machines : le lien front → back → base entre machines n'existe pas en données (point ouvert 5).
   Sous la CSP stricte (ADR 0006) : aucun style en ligne ; classes de packages/ui/src/neon-commandement.css (poste) et
   neon-parc.css (parc, cartes), jetons de la charte, clair et sombre ; `lockScroll={false}` sur la fenêtre. */
import { Alert, Anchor, Group, Modal, SegmentedControl, Text } from '@mantine/core';
import {
  type CartePerimetreDto,
  type DetailPerimetreDto,
  type EchelleParc,
  machinesGlobal,
  type MachineMarqueeDto,
  PERIMETRE_GLOBAL_REDUIT,
  type PerimetresVulnerabilitesDto,
  type PresentationPerimetre,
  visiblesGlobal,
  type ZoneParc,
} from '@suivi/shared';
import { ErrorAlert, Page, PageHeader } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { get } from '../api';
import { useCan } from '../session';
import { libelleMachine } from './failles';
import { FicheMachine } from './Machines';
import { libellePrioriteMachine } from './parc';
import { LegendeMarques, MarqueExploitable, MarqueZeroDay, ParcMachines, TuileMachine } from './ParcMachines';
import {
  adresseListeMachines,
  ADRESSE_PERIMETRES,
  bandeauPremiereLigne,
  CLE_PERIMETRES,
  libelleExpositionTuile,
  lireAdresse,
  nomAccessibleCarte,
  nomPerimetre,
  parametresPerimetre,
  URL_PERIMETRES,
  urlDetailPerimetre,
} from './perimetres';
import { deuxChiffres } from './vue-ensemble';

/* ------------------------------------------------------------------ Carte d'un périmètre */
export function CartePerimetre({ c, onOuvrir }: { c: CartePerimetreDto; onOuvrir: (c: CartePerimetreDto) => void }) {
  const p = c.priorite ?? 'aucune';
  const f = c.failles;
  return (
    <button
      type="button"
      className={`perim-carte parc-p--${p}${c.id === null ? ' perim-carte--sans' : ''}`}
      aria-label={nomAccessibleCarte(c)}
      onClick={() => onOuvrir(c)}
    >
      <span className="parc-etiquette" aria-hidden="true">
        {c.id === null ? 'Machines sans périmètre' : 'Périmètre'}
      </span>
      <span className="perim-carte__tete" aria-hidden="true">
        <strong className="perim-carte__nom">{nomPerimetre(c)}</strong>
        <span className="parc-tuile__prio">{libellePrioriteMachine(c.priorite)}</span>
      </span>
      <span className="perim-carte__ligne" aria-hidden="true">
        <span className="parc-mono perim-carte__chiffre">{deuxChiffres(c.machines)}</span>
        <span>
          machine{c.machines > 1 ? 's' : ''} lue{c.machines > 1 ? 's' : ''}
        </span>
      </span>
      <span className="perim-carte__gravites" aria-hidden="true">
        <span className="perim-g">
          <b className={`parc-g parc-g--c${f.critique ? '' : ' parc-g--zero'} parc-mono`}>{f.critique}</b>
          critiques
        </span>
        <span className="perim-g">
          <b className={`parc-g parc-g--e${f.elevee ? '' : ' parc-g--zero'} parc-mono`}>{f.elevee}</b>
          élevées
        </span>
        <span className="perim-g">
          <b className={`parc-g parc-g--m${f.moyenne ? '' : ' parc-g--zero'} parc-mono`}>{f.moyenne}</b>
          moyennes
        </span>
        <span className="perim-g">
          <b className={`parc-g parc-g--f${f.faible ? '' : ' parc-g--zero'} parc-mono`}>{f.faible}</b>
          faibles
        </span>
      </span>
      <span className="perim-carte__marques" aria-hidden="true">
        {c.machinesExploitationAveree > 0 && (
          <span className="perim-marque">
            <MarqueZeroDay />
            {c.machinesExploitationAveree} à exploitation avérée
          </span>
        )}
        {c.machinesExploitables > 0 && (
          <span className="perim-marque">
            <MarqueExploitable />
            {c.machinesExploitables} exploitable{c.machinesExploitables > 1 ? 's' : ''}
          </span>
        )}
        <span className="perim-marque">
          {c.actifsExposes} actif{c.actifsExposes > 1 ? 's' : ''} exposé{c.actifsExposes > 1 ? 's' : ''} sur Internet
        </span>
      </span>
    </button>
  );
}

/** Liste des cartes (sans état). */
export function ListePerimetres({
  liste,
  onOuvrir,
}: {
  liste: PerimetresVulnerabilitesDto;
  onOuvrir: (c: CartePerimetreDto) => void;
}) {
  const cartes = [...liste.perimetres, ...(liste.sansPerimetre ? [liste.sansPerimetre] : [])];
  if (!cartes.length) return <Text c="dimmed">Aucun périmètre que vous puissiez lire.</Text>;
  return (
    <ul className="perim-cartes" aria-label="Périmètres, du plus critique au moins critique">
      {cartes.map((c) => (
        <li key={c.id ?? 'aucun'}>
          <CartePerimetre c={c} onOuvrir={onOuvrir} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Détail */
/** Chiffres clés du périmètre (comme la maquette, plus les actifs exposés rattachés). */
export function BilanPerimetre({ c }: { c: CartePerimetreDto }) {
  const tuiles: [string, number, string][] = [
    ['Machines du périmètre', c.machines, 'bleu'],
    ['Failles critiques', c.failles.critique, 'rouge'],
    ['Machines avec exploitation avérée', c.machinesExploitationAveree, 'rouge'],
    ['Machines sans rôle', c.machinesSansRole, 'gris'],
    ['Actifs exposés rattachés', c.actifsExposes, 'violet'],
  ];
  return (
    <ul className="perim-bilan" aria-label="Chiffres clés du périmètre">
      {tuiles.map(([libelle, n, teinte]) => (
        <li key={libelle} className={`pc-tuile pc-teinte--${teinte}`}>
          <span className="pc-etiquette">{libelle}</span>
          <b className="pc-mono">{deuxChiffres(n)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Présentation « Vue globale » : toutes les machines ensemble, dans l'ordre du rang, réduites puis « et n autres ». */
export function GlobalPerimetre({
  detail,
  echelle,
  onOuvrir,
  onVoirListe,
  expositions,
}: {
  detail: DetailPerimetreDto;
  echelle: EchelleParc;
  onOuvrir: (m: MachineMarqueeDto) => void;
  onVoirListe: () => void;
  expositions: ReadonlyMap<string, string>;
}) {
  const [deplie, setDeplie] = useState(false);
  const id = useId();
  const recues = machinesGlobal(detail.parc);
  const { visibles, autres } = visiblesGlobal(recues, detail.parc.total, deplie);
  const bascule = recues.length > PERIMETRE_GLOBAL_REDUIT;
  const nonRecues = detail.parc.total - recues.length;
  return (
    <div className={`parc parc--${echelle}`}>
      <section className="parc-zone parc-zone--global" aria-labelledby={id}>
        <header className="parc-zone__tete">
          <p className="parc-etiquette">Toutes les lignes</p>
          <h3 id={id} className="parc-zone__titre">
            Machines du périmètre
          </h3>
          <p className="parc-zone__compte">
            {detail.parc.total} machine{detail.parc.total > 1 ? 's' : ''}, de la plus prioritaire à la moins prioritaire
          </p>
        </header>
        {detail.parc.total === 0 ? (
          <p className="parc-zone__vide">Aucune machine lue dans ce périmètre.</p>
        ) : (
          <ul className="parc-grille">
            {visibles.map((m) => (
              <li key={m.id}>
                <TuileMachine m={m} onOuvrir={onOuvrir} exposition={expositions.get(m.id)} />
              </li>
            ))}
            {bascule && (
              <li key="bascule">
                <button type="button" className="parc-plus" aria-expanded={deplie} onClick={() => setDeplie(!deplie)}>
                  {deplie ? (
                    <span>Replier : les {PERIMETRE_GLOBAL_REDUIT} plus prioritaires</span>
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
            {nonRecues > 0 && (deplie || !bascule) && (
              <li key="liste">
                <button type="button" className="parc-plus" onClick={onVoirListe}>
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
      <p className="parc__note">
        Le numéro est le rang, calculé par la plateforme parmi les machines que vous lisez. La vue globale ne trace
        aucun lien entre machines : aucune source ne dit quel front s’appuie sur quel back ou quelle base.
      </p>
    </div>
  );
}

/** Actifs exposés reliés aux machines du périmètre (liaisons confirmées, actifs lisibles seulement). */
export function ExpositionsPerimetre({ detail }: { detail: DetailPerimetreDto }) {
  const noms = new Map(detail.parc.zones.flatMap((z) => z.machines.map((m) => [m.id, libelleMachine(m)] as const)));
  const lignes = detail.expositions.filter((e) => noms.has(e.machineId));
  if (!lignes.length)
    return (
      <Text size="sm" c="dimmed">
        Aucune machine de ce périmètre n’est reliée, par une liaison confirmée, à un actif exposé sur Internet que vous
        pouvez lire.
      </Text>
    );
  return (
    <ul className="perim-expositions">
      {lignes.map((e) => (
        <li key={e.machineId}>
          <strong className="parc-mono">{noms.get(e.machineId)}</strong> : {libelleExpositionTuile(e)}
        </li>
      ))}
    </ul>
  );
}

/** Détail d'un périmètre (sans requête) : bilan, bandeau, présentation et machines, expositions. */
export function DetailPerimetre({
  detail,
  presentation,
  onPresentation,
  onOuvrir,
  onVoirListe,
}: {
  detail: DetailPerimetreDto;
  presentation: PresentationPerimetre;
  onPresentation: (p: PresentationPerimetre) => void;
  onOuvrir: (m: MachineMarqueeDto) => void;
  onVoirListe: (z?: ZoneParc) => void;
}) {
  const c = detail.carte;
  const front = detail.parc.zones.find((z) => z.zone === 'front')?.exploitationAveree ?? 0;
  const bandeau = bandeauPremiereLigne(front);
  const expositions = new Map(detail.expositions.map((e) => [e.machineId, libelleExpositionTuile(e)]));
  const idExpo = useId();
  return (
    <div className="poste">
      <p className="poste__tete">
        <span className="pc-etiquette">Périmètre · {nomPerimetre(c)}</span>
        <span className="pc-etiquette">
          {front > 0
            ? 'Première ligne touchée'
            : c.priorite
              ? `Priorité la plus haute : ${c.priorite}`
              : 'Aucune faille présente'}
        </span>
      </p>
      <Group justify="space-between" align="center" gap="sm">
        <Anchor component={Link} to={ADRESSE_PERIMETRES} size="sm">
          Tous les périmètres
        </Anchor>
        <SegmentedControl
          value={presentation}
          onChange={(v) => onPresentation(v as PresentationPerimetre)}
          data={[
            { value: 'lignes', label: 'Par ligne' },
            { value: 'global', label: 'Vue globale' },
          ]}
          aria-label="Présentation du périmètre"
        />
      </Group>
      {bandeau && (
        <div className="pc-bandeau" role="status">
          <svg viewBox="0 0 24 24" className="pc-bandeau__icone" aria-hidden="true">
            <path d="M12 3 2 20h20Z" />
            <path d="M12 10v4M12 17.2v.1" />
          </svg>
          <p>
            <strong>{bandeau}</strong> Leurs tuiles portent le triangle « exploitation avérée » ; la fiche de chacune
            dit lesquelles, et lesquelles sont sans correctif connu (zero-day).
          </p>
        </div>
      )}
      <BilanPerimetre c={c} />
      <LegendeMarques parc />
      {presentation === 'lignes' ? (
        <ParcMachines
          parc={detail.parc}
          echelle="reduit"
          onOuvrir={onOuvrir}
          onVoirListe={(z) => onVoirListe(z)}
          expositions={expositions}
        />
      ) : (
        <GlobalPerimetre
          detail={detail}
          echelle="reduit"
          onOuvrir={onOuvrir}
          onVoirListe={() => onVoirListe()}
          expositions={expositions}
        />
      )}
      <section aria-labelledby={idExpo} className="perim-section">
        <h2 className="pc-etiquette" id={idExpo}>
          Exposition sur Internet (liaisons confirmées)
        </h2>
        <ExpositionsPerimetre detail={detail} />
      </section>
      <p className="poste__note">
        « Vue globale » montre toutes les machines du périmètre ensemble. « Par ligne » les range selon le rôle indiqué
        : front, back applicatif, bases de données, puis rôle non indiqué. Les murs séparent les rôles ; ils ne prouvent
        pas un cloisonnement du réseau, et aucun trait ne relie deux machines : aucune source ne dit quel front s’appuie
        sur quel back ou quelle base.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Page */
export function PerimetresPage() {
  const can = useCan();
  const lire = can('vulnerabilites', 'lire');
  const modifier = can('vulnerabilites', 'modifier');
  const navigate = useNavigate();
  const [adresse, setAdresse] = useSearchParams();
  const { perimetre, presentation } = lireAdresse(adresse);
  const [ouverte, setOuverte] = useState<MachineMarqueeDto | null>(null);
  const liste = useQuery({
    queryKey: [...CLE_PERIMETRES],
    queryFn: () => get<PerimetresVulnerabilitesDto>(URL_PERIMETRES),
    enabled: lire && !perimetre,
  });
  const detail = useQuery({
    queryKey: [...CLE_PERIMETRES, perimetre],
    queryFn: () => get<DetailPerimetreDto>(urlDetailPerimetre(perimetre!)),
    enabled: lire && !!perimetre,
    retry: false,
  });
  if (!lire)
    return (
      <Page>
        <Alert>Vous ne disposez pas du droit de lire les vulnérabilités.</Alert>
      </Page>
    );
  const d = detail.data;
  return (
    <Page>
      <PageHeader
        title={perimetre ? (d ? nomPerimetre(d.carte) : 'Périmètre') : 'Périmètres'}
        description={
          perimetre
            ? 'Machines du périmètre que vous pouvez lire, par ligne (front, back applicatif, base de données) ou toutes ensemble. Priorité et marques sont calculées par la plateforme, les mêmes pour tout le monde.'
            : 'Un périmètre par carte, du plus critique au moins critique : machines que vous pouvez lire, priorité la plus haute, failles présentes par gravité, machines à exploitation avérée ou exploitables, actifs exposés sur Internet rattachés. Ouvrez une carte pour voir ses machines.'
        }
      />
      {!perimetre && (
        <>
          <ErrorAlert error={liste.error} />
          {liste.data && <ListePerimetres liste={liste.data} onOuvrir={(c) => setAdresse(parametresPerimetre(c.id))} />}
        </>
      )}
      {perimetre && (
        <>
          <ErrorAlert error={detail.error} />
          {detail.error && (
            <Anchor component={Link} to={ADRESSE_PERIMETRES} size="sm">
              Tous les périmètres
            </Anchor>
          )}
          {d && (
            <DetailPerimetre
              detail={d}
              presentation={presentation}
              onPresentation={(p) => setAdresse(parametresPerimetre(d.carte.id, p), { replace: true })}
              onOuvrir={setOuverte}
              onVoirListe={(z) => void navigate(adresseListeMachines(d.carte.id, z))}
            />
          )}
        </>
      )}
      <Modal
        closeButtonProps={{ 'aria-label': 'Fermer la fenêtre' }}
        opened={!!ouverte}
        onClose={() => setOuverte(null)}
        title={ouverte ? libelleMachine(ouverte) : 'Machine'}
        size="lg"
        centered
        lockScroll={false}
      >
        {ouverte && <FicheMachine machine={ouverte} modifier={modifier} />}
      </Modal>
    </Page>
  );
}
