/* Fiche illustrée d'une faille (ADR 0100, point 19 et décision V10 ; lot PC4, maquette 02-fiche). Une seule présentation,
   placée en tête des fiches existantes (constat de Tenable, faille déclarée, CVE de la veille, alerte d'AlgoLightHouse) :
   - en-tête : composant et CVE, priorité et faits (les mêmes pour tous), marques « zero-day » et « exploitable » du lot PC2,
     alerte ouverte de la plateforme, présence lue (nombres lus seulement, drapeau sans nombre pour le reste) ; lot S1 :
     délai de correction (état, âge, échéance) et exception d'un constat ou d'une faille déclarée ;
   - « Vecteur d'attaque, en clair » : une icône et un libellé par métrique (terme technique exact et traduction), effets sur
     la cible, phrase composée par la plateforme, vecteur brut et sa version, source qui parle ; schéma SVG composé à partir
     du vecteur et de la présence (nom accessible en une phrase, équivalent texte dessous) ; sans vecteur lisible : « vecteur
     non communiqué », sans schéma ;
   - « Recommandations des sources » : par source, sans mélange, toujours en texte (React échappe tout ; aucun HTML
     interprété) ; rien n'est rédigé par l'assistant ni par la plateforme.
   Lot S3 : en tête, l'état du correctif (disponible, aucun correctif connu, non renseigné) et la source qui parle ; à côté
   de la marque zero-day, la précision « exploitée, sans correctif connu » (ou « correctif disponible », « correctif non
   renseigné ») ; la mention « Fin de support » avec sa source.
   Sous la CSP stricte (ADR 0006) : aucun style en ligne ; classes de packages/ui/src/neon-fiche.css (jetons de la charte,
   clair et sombre), positions du schéma par attributs SVG.
   Lot L1 : pastilles des sources reprises par la fiche dans l'en-tête, pastille de la source sur chaque recommandation. */
import { Anchor, Group, Loader, Stack, Text } from '@mantine/core';
import {
  ETAT_CORRECTIF_LIBELLES,
  libelleEtatCorrectif,
  SITUATION_EXPLOITATION_LIBELLES,
  estZeroDay,
  libelleMarqueExploitation,
  SOURCE_CORRECTIFS_REGROUPES,
  SOURCE_FIN_SUPPORT_LIBELLES,
  conditionsTraduites,
  decoderVecteurCvss,
  DIMENSION_LIBELLES,
  DIMENSIONS_IMPACT,
  type DefautAlh,
  type FicheFailleDto,
  type IconeMetrique,
  impactsTraduits,
  libellePresence,
  libelleSourceVecteur,
  libelleVersionsNvd,
  type MetriqueTraduite,
  type NatureFicheFaille,
  NIVEAU_ALERTE_LIBELLES,
  phraseVecteur,
  schemaVecteur,
  SOURCE_VECTEUR_LIBELLES,
  vecteurRetenu,
  VERSION_CVSS_LIBELLES,
} from '@suivi/shared';
import { ErrorAlert, StatusChip } from '@suivi/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useId } from 'react';
import { Link } from 'react-router';
import { get } from '../api';
import {
  ETAT_DELAI_PUCE,
  fmtJourCivil,
  libelleEtatDelai,
  libelleStatutException,
  lignesDelai,
  STATUT_EXCEPTION_PUCE,
} from './delais';
import { ETAT_CORRECTIF_PUCE } from './correctifs';
import { ETAT_PRIORITE, faitsPrioriteComplets } from './failles';
import {
  DETAIL,
  faitsCorrectifRegroupe,
  fmtJour,
  LIGNE,
  PICTO,
  schemaEtroit,
  schemaLarge,
  TITRE,
  urlFicheFaille,
  type MiseEnPageSchema,
} from './fiche-faille';
import { MARQUE_EXPLOITABLE } from './parc';
import { MarqueExploitable, MarqueZeroDay } from './ParcMachines';
import { PictoSource, PictosSources } from './PictoSource';
import { type SourcePicto, sourcesFiche } from './pictos-sources';
import { libelleMention } from './sources';

/* ------------------------------------------------------------------ Icônes (24 × 24, trait) */
const TRACES: Record<IconeMetrique, string[]> = {
  reseau: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18', 'M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18'],
  adjacent: ['M2 9a15 15 0 0 1 20 0', 'M5 12.5a10 10 0 0 1 14 0', 'M8.5 16a5 5 0 0 1 7 0', 'M12 19.5v.1'],
  local: ['M4 4h16v16H4z', 'M7 9l3 3-3 3M12 15h5'],
  physique: ['M9 2v5M15 2v5', 'M6 7h12v4a6 6 0 0 1-12 0z', 'M12 17v5'],
  simple: ['M4 18a8 8 0 1 1 16 0', 'M12 18 7.5 13'],
  complexe: ['M4 18a8 8 0 1 1 16 0', 'M12 18l4.5-5'],
  conditions: ['M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M12 2v3M12 19v3M2 12h3M19 12h3'],
  'sans-compte': ['M8 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M11 12l8-8M16 7l2 2', 'M3 3l18 18'],
  compte: ['M8 11a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M11 12l8-8M16 7l2 2'],
  'compte-admin': ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', 'M9 12l2 2 4-4'],
  'sans-victime': ['M12 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M5 21a7 7 0 0 1 14 0', 'M3 3l18 18'],
  victime: ['M10 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6', 'M3 21a7 7 0 0 1 12-5', 'M15 13l6 3-3 1-1 3z'],
  portee: ['M3 12h11M10 8l4 4-4 4', 'M18 4v16'],
  confidentialite: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6'],
  integrite: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  disponibilite: ['M12 3v9', 'M7 6a8 8 0 1 0 10 0'],
  composant: ['M4 4h16v6H4zM4 14h16v6H4z', 'M8 7h.1M8 17h.1'],
};

/** Pictogramme d'une métrique, décoratif (le texte voisin porte le sens). */
export function IconeFiche({ icone }: { icone: IconeMetrique }) {
  return (
    <svg className="ff-icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACES[icone].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
/** Le même pictogramme, posé dans le schéma (coin haut gauche en x, y ; taille t en unités de la viewBox). */
function IconeSchema({ icone, x, y, t }: { icone: IconeMetrique; x: number; y: number; t: number }) {
  return (
    <g className="ff-s-icone" transform={`translate(${x} ${y}) scale(${t / 24})`} aria-hidden="true">
      {TRACES[icone].map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ Délai et exception (lot S1) */
function DelaiFiche({ f }: { f: FicheFailleDto }) {
  const d = f.delai!;
  const l = lignesDelai(d, new Date());
  return (
    <Group gap="xs" role="group" aria-label="Délai de correction">
      <StatusChip etat={ETAT_DELAI_PUCE[d.etat]}>Délai : {libelleEtatDelai(d.etat)}</StatusChip>
      <Text size="xs" c="dimmed">
        {l.age} · {l.regle}
        {l.echeance ? (
          <>
            {' '}
            · échéance <span className="horodatage">{l.echeance}</span>
          </>
        ) : null}
      </Text>
      {f.exception && (
        <StatusChip etat={STATUT_EXCEPTION_PUCE[f.exception.statut]}>
          Exception : {libelleStatutException(f.exception.statut)}
          {f.exception.echeance ? ` (échéance ${fmtJourCivil(f.exception.echeance)})` : ''}
        </StatusChip>
      )}
    </Group>
  );
}

/* ------------------------------------------------------------------ État du correctif et fin de support (lot S3) */
function CorrectifFiche({ f }: { f: FicheFailleDto }) {
  return (
    <Stack gap="2xs" role="group" aria-label="Correctif et fin de support">
      <Group gap="xs">
        <StatusChip etat={ETAT_CORRECTIF_PUCE[f.correctif.etat]}>
          {ETAT_CORRECTIF_LIBELLES[f.correctif.etat]}
        </StatusChip>
        {f.situationExploitation && (
          <StatusChip etat={f.situationExploitation === 'sans_correctif' ? 'erreur' : 'neutre'}>
            {SITUATION_EXPLOITATION_LIBELLES[f.situationExploitation]}
          </StatusChip>
        )}
        {f.finSupport && (
          <span className="parc-mention parc-mention--fds">
            {f.finSupport.etat === 'atteinte' ? 'Fin de support' : 'Fin de support annoncée'}
            {f.finSupport.le ? ` le ${fmtJour(f.finSupport.le)}` : ''}
          </span>
        )}
      </Group>
      <Text size="xs" c="dimmed">
        {libelleEtatCorrectif(f.correctif, fmtJour)}
        {f.finSupport ? ` ${SOURCE_FIN_SUPPORT_LIBELLES[f.finSupport.source]}.` : ''}
      </Text>
    </Stack>
  );
}

/* ------------------------------------------------------------------ En-tête */
function EnTete({ f }: { f: FicheFailleDto }) {
  const cible = [
    f.cves.length
      ? `${f.cves.join(', ')}${f.nombreCves > f.cves.length ? ` et ${f.nombreCves - f.cves.length} autres` : ''}`
      : 'Sans CVE',
    f.composant,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="ff-tete">
      <p className="pc-etiquette ff-tete__cible">
        Cible · <span className="pc-mono">{cible}</span>
      </p>
      {sourcesFiche(f).length > 0 && (
        <div className="ff-tete__sources">
          <span className="pc-etiquette">Sources</span>
          <PictosSources sources={sourcesFiche(f)} libelle="Sources reprises par la fiche" />
        </div>
      )}
      <div className="ff-tete__ligne">
        <div className="ff-tete__priorite">
          {f.priorite ? (
            <>
              <StatusChip etat={ETAT_PRIORITE[f.priorite.niveau]}>
                Priorité {f.priorite.niveau.slice(1)} ({f.priorite.niveau})
              </StatusChip>
              <Text size="xs" c="dimmed">
                {faitsPrioriteComplets(f.priorite).join(' · ')}
              </Text>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Aucune priorité calculée : aucune CVE n’est citée.
            </Text>
          )}
          <Text size="xs" c="dimmed">
            Priorité et faits calculés par la plateforme, les mêmes pour tous.
          </Text>
        </div>
        {(f.marques.zeroDay || f.marques.exploitable) && (
          <ul className="ff-tete__marques" aria-label="Marques de la faille">
            {f.marques.zeroDay && (
              <li>
                {/* Lot PRIO-1 : « zero-day » seulement sans correctif connu, sinon « exploitation avérée ». */}
                <MarqueZeroDay zeroDay={estZeroDay(f.situationExploitation)} />
                <span>{libelleMarqueExploitation(f.situationExploitation)}</span>
              </li>
            )}
            {f.marques.exploitable && (
              <li>
                <MarqueExploitable />
                <span>{MARQUE_EXPLOITABLE}</span>
              </li>
            )}
          </ul>
        )}
      </div>
      <Text size="sm">Présence : {libellePresence(f.presence)}.</Text>
      <CorrectifFiche f={f} />
      {f.delai && <DelaiFiche f={f} />}
      {f.alerte && (
        <p className={`ff-alerte ff-f--${f.alerte.niveau === 'critique' ? 'fort' : 'moyen'}`} role="status">
          {NIVEAU_ALERTE_LIBELLES[f.alerte.niveau]} ouverte sur cette faille ({f.alerte.priorite}) :{' '}
          <Anchor component={Link} to={`/vulnerabilites/alertes?alerte=${encodeURIComponent(f.alerte.id)}`} size="sm">
            ouvrir l’alerte
          </Anchor>
          .
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Vecteur */
function Metrique({ m }: { m: MetriqueTraduite }) {
  return (
    <li className={`ff-porte ff-f--${m.force}`}>
      <IconeFiche icone={m.icone} />
      <span>
        <strong>{m.clair}</strong>
        <small>
          {m.terme} · <span className="pc-mono">{`${m.code}:${m.valeur}`}</span>
        </small>
      </span>
    </li>
  );
}

function Impacts({ titre, liste }: { titre: string; liste: MetriqueTraduite[] }) {
  return (
    <div className="ff-impacts">
      <p className="pc-etiquette">{titre}</p>
      <ul>
        {liste.map((m, i) => (
          <li key={m.code} className={`ff-impact ff-f--${m.force}`}>
            <IconeFiche icone={m.icone} />
            <span>
              <strong>{DIMENSION_LIBELLES[DIMENSIONS_IMPACT[i]!]}</strong>
              <small>{m.clair}</small>
            </span>
            <b title={m.terme}>
              {m.terme.slice(m.terme.lastIndexOf(':') + 2)}
              <span className="ff-impact__code pc-mono">{` ${m.code}:${m.valeur}`}</span>
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dessin({ p, nom, classe }: { p: MiseEnPageSchema; nom: string; classe: string }) {
  const pointe = `${classe}-${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <svg
      className={`ff-schema__svg ${classe}`}
      viewBox={`-4 -4 ${p.largeur + 8} ${p.hauteur + 8}`}
      role="img"
      aria-label={nom}
      preserveAspectRatio="xMidYMin meet"
    >
      <defs>
        <marker id={pointe} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 10 5 0 10z" className="ff-s-pointe" />
        </marker>
      </defs>
      {p.fleches.map((f) => (
        <line
          key={`${f.x1}-${f.y1}`}
          x1={f.x1}
          y1={f.y1}
          x2={f.x2}
          y2={f.y2}
          className="ff-s-fleche"
          markerEnd={`url(#${pointe})`}
        />
      ))}
      {p.boites.map((b) => (
        <g key={b.cle}>
          <rect x={b.x} y={b.y} width={b.l} height={b.h} rx={6} className={`ff-s-boite ff-f--${b.force}`} />
          {b.titres.map((t, i) => (
            <text key={`t${i}`} x={b.x + 10} y={b.y + 22 + i * TITRE} fontSize={11} className="ff-s-titre">
              {t}
            </text>
          ))}
          {b.icone && (
            <>
              <IconeSchema icone={b.icone} x={b.x + b.l / 2 - 15} y={b.y + b.tete + 2} t={30} />
              {b.lignes.map((l, i) => (
                <text
                  key={`l${i}`}
                  x={b.x + b.l / 2}
                  y={b.y + b.tete + PICTO + 4 + i * LIGNE}
                  textAnchor="middle"
                  fontSize={15}
                  className="ff-s-libelle"
                >
                  {l}
                </text>
              ))}
              {b.details.map((l, i) => (
                <text
                  key={`d${i}`}
                  x={b.x + b.l / 2}
                  y={b.y + b.tete + PICTO + 4 + b.lignes.length * LIGNE + 2 + i * DETAIL}
                  textAnchor="middle"
                  fontSize={11.5}
                  className="ff-s-detail"
                >
                  {l}
                </text>
              ))}
            </>
          )}
          {b.rangees.map((r) => {
            const effet = b.cle === 'effets';
            const haut = (effet ? p.rangeeEffet : p.rangee) - 6;
            return (
              <g key={r.detail} className={`ff-f--${r.force}`}>
                <rect x={b.x + 8} y={r.y} width={b.l - 16} height={haut} rx={4} className="ff-s-rangee" />
                <IconeSchema icone={r.icone} x={b.x + 14} y={r.y + haut / 2 - 10} t={20} />
                {effet && p.effetsSurDeuxLignes ? (
                  <>
                    <text x={b.x + 40} y={r.y + 16} fontSize={12.5} className="ff-s-libelle">
                      {r.titre}
                    </text>
                    <text x={b.x + 40} y={r.y + 31} fontSize={11} className="ff-s-niveau">
                      {r.libelle.toUpperCase()}
                    </text>
                  </>
                ) : (
                  <>
                    <text x={b.x + 40} y={r.y + 19} fontSize={13} className="ff-s-libelle">
                      {effet ? r.titre : r.libelle}
                    </text>
                    <text
                      x={b.x + b.l - 14}
                      y={r.y + 19}
                      textAnchor="end"
                      fontSize={effet ? 11 : 10.5}
                      className={effet ? 'ff-s-niveau' : 'ff-s-code'}
                    >
                      {effet ? r.libelle.toUpperCase() : r.detail}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function SchemaFaille({ f, brut }: { f: FicheFailleDto; brut: string }) {
  const v = decoderVecteurCvss(brut)!;
  const s = schemaVecteur(v, f.composant, f.presence);
  const large = schemaLarge(s);
  const etroit = schemaEtroit(s);
  const id = useId();
  return (
    <figure className="ff-schema" aria-labelledby={`${id}-legende`}>
      <Dessin p={large} nom={s.nom} classe="ff-schema__large" />
      <Dessin p={etroit} nom={s.nom} classe="ff-schema__etroit" />
      <figcaption id={`${id}-legende`} className="ff-schema__texte">
        <Text size="xs" fw={600} component="span">
          Schéma composé par la plateforme à partir du vecteur et de ce que vous lisez :
        </Text>
        <ol>
          <li>
            {s.origine.titre} : {s.origine.libelle} ({s.origine.detail}).
          </li>
          <li>Ce qu’il faut à l’attaquant : {s.prerequis.map((x) => `${x.libelle} (${x.detail})`).join(', ')}.</li>
          <li>
            {s.composant.titre} : {s.composant.libelle} — {s.composant.detail}.
          </li>
          <li>Ce qui est atteint : {s.effets.map((x) => `${x.titre} ${x.libelle} (${x.detail})`).join(', ')}.</li>
        </ol>
      </figcaption>
    </figure>
  );
}

function VecteurAttaque({ f }: { f: FicheFailleDto }) {
  const { retenu, autres, illisibles } = vecteurRetenu(f.vecteurs);
  const id = useId();
  return (
    <section className="ff-vecteur" aria-labelledby={`${id}-titre`}>
      <div className="ff-vecteur__tete">
        <h3 id={`${id}-titre`}>Vecteur d’attaque, en clair</h3>
        {retenu && (
          <span className="ff-vecteur__brut">
            <code className="pc-mono">{retenu.decode.brut}</code>
            <small>{VERSION_CVSS_LIBELLES[retenu.decode.version]}</small>
          </span>
        )}
      </div>
      {retenu ? (
        <>
          <div className="ff-chemin">
            <div className="ff-portes">
              <p className="pc-etiquette">Ce qu’il faut à l’attaquant</p>
              <ul>
                {conditionsTraduites(retenu.decode).map((m) => (
                  <Metrique key={m.code} m={m} />
                ))}
              </ul>
            </div>
            <Impacts titre="Effet sur la cible" liste={impactsTraduits(retenu.decode).cible} />
            {retenu.decode.impactsAval && (
              <Impacts titre="Effet sur les systèmes en aval" liste={impactsTraduits(retenu.decode).aval} />
            )}
          </div>
          <p className="ff-en-clair">
            <strong>En clair : </strong>
            {phraseVecteur(retenu.decode)}{' '}
            <span>Phrase composée par la plateforme à partir du vecteur publié (table fixe, sans assistant).</span>
          </p>
          <SchemaFaille f={f} brut={retenu.decode.brut} />
          <Text size="xs" c="dimmed">
            {libelleSourceVecteur(retenu, autres.length + 1)}
          </Text>
          {autres.length > 0 && (
            <div className="ff-autres">
              <Text size="xs" c="dimmed">
                Autres vecteurs publiés :
              </Text>
              <ul>
                {autres.map((a) => (
                  <li key={`${a.publie.source}-${a.publie.cve}-${a.publie.brut}`}>
                    <Text size="xs" c="dimmed" span>
                      {SOURCE_VECTEUR_LIBELLES[a.publie.source]}
                      {a.publie.cve ? ` (${a.publie.cve})` : ''}, {VERSION_CVSS_LIBELLES[a.decode.version]}
                      {a.publie.score !== null ? `, score ${a.publie.score.toLocaleString('fr-FR')}` : ''} :{' '}
                    </Text>
                    <code className="pc-mono ff-autres__brut">{a.publie.brut}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <Text size="sm">
          Vecteur non communiqué : aucune source rangée (NVD, Tenable) ne publie de vecteur CVSS lisible pour cette
          faille. La plateforme ne traduit rien et ne trace aucun schéma.
        </Text>
      )}
      {illisibles > 0 && (
        <Text size="xs" c="dimmed">
          {illisibles === 1
            ? 'Un vecteur publié n’a pas pu être lu'
            : `${illisibles} vecteurs publiés n’ont pas pu être lus`}{' '}
          (forme inconnue ou mal formée) : il n’est pas traduit.
        </Text>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Recommandations */
/** Défauts et résolutions de l'éditeur d'AlgoLightHouse, en texte (aucun HTML interprété). */
export function RecommandationsEditeur({ defauts }: { defauts: DefautAlh[] }) {
  return (
    <Stack gap="xs">
      {defauts.map((d, i) => (
        <div key={`${i}-${d.nom}`} role="group" aria-label={`Défaut : ${d.nom}`} className="ff-defaut">
          <Text size="sm" fw={600} className="veille-texte">
            {d.nom}
          </Text>
          {d.description && (
            <Text size="sm" className="veille-texte">
              {d.description}
            </Text>
          )}
          {d.resolutions.length > 0 && (
            <ul className="ff-resolutions">
              {d.resolutions.map((r, j) => (
                <li key={`${j}-${r.nom}`}>
                  <Text size="sm" fw={600} span className="veille-texte">
                    {r.nom}
                  </Text>
                  {(r.facilite || r.gain) && (
                    <Text size="xs" c="dimmed" span>
                      {` (${[r.facilite ? `facilité : ${r.facilite}` : null, r.gain ? `gain : ${r.gain}` : null]
                        .filter(Boolean)
                        .join(' · ')})`}
                    </Text>
                  )}
                  {r.description && (
                    <Text size="sm" className="veille-texte">
                      {r.description}
                    </Text>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Stack>
  );
}

function Reco({
  etiquette,
  source,
  urgent = false,
  children,
}: {
  etiquette: string;
  source: SourcePicto;
  urgent?: boolean;
  children: ReactNode;
}) {
  return (
    <li className={`ff-reco${urgent ? ' ff-reco--urgent' : ''}`}>
      <div className="ff-reco__tete">
        <PictoSource source={source} decoratif />
        <p className="pc-etiquette ff-reco__source">{etiquette}</p>
      </div>
      {children}
    </li>
  );
}

function Recommandations({ f }: { f: FicheFailleDto }) {
  const r = f.recommandations;
  const id = useId();
  const rien =
    !r.tenable &&
    !r.tenableRegroupes.length &&
    !r.kev.length &&
    !r.versionsNvd.length &&
    !r.certSante &&
    !r.avis.length &&
    !r.alh.length;
  return (
    <section className="ff-recos" aria-labelledby={`${id}-titre`}>
      <div className="ff-recos__tete">
        <h3 id={`${id}-titre`}>Recommandations des sources</h3>
        <Text size="xs" c="dimmed">
          Textes repris des sources, tels quels et bornés ; rien n’est rédigé par la plateforme ni par l’assistant.
        </Text>
      </div>
      {rien ? (
        <Text size="sm">
          Aucune recommandation connue : aucune source rangée n’en publie pour cette faille. La plateforme n’en invente
          aucune.
        </Text>
      ) : (
        <ul className="ff-recos__liste">
          {r.kev.map((k) => (
            <Reco
              key={k.cve}
              etiquette={`Catalogue KEV de la CISA · ${k.echeance ? `échéance ${fmtJour(k.echeance)}` : 'sans échéance'}`}
              source="cisa-kev"
              urgent
            >
              <Text size="sm" fw={600} lang="en" className="veille-texte">
                {k.action}
              </Text>
              <Text size="xs" c="dimmed">
                Action exigée par le catalogue des failles exploitées, pour <span className="pc-mono">{k.cve}</span>.
              </Text>
            </Reco>
          ))}
          {r.tenable && (
            <Reco etiquette="Tenable · correctif du contrôle" source="tenable">
              {r.tenable.correctif ? (
                <Text size="sm" fw={600} lang="en" className="veille-texte">
                  {r.tenable.correctif}
                </Text>
              ) : (
                <Text size="sm">Aucun correctif indiqué par Tenable.</Text>
              )}
              <Text size="xs" c="dimmed">
                Texte de Tenable en anglais, tel quel
                {r.tenable.publieLe ? ` ; correctif publié le ${fmtJour(r.tenable.publieLe)}` : ''}.
              </Text>
            </Reco>
          )}
          {r.tenableRegroupes.length > 0 && (
            <Reco etiquette="Tenable · Correctif recommandé par Tenable" source="tenable">
              <ul className="ff-reco__lignes">
                {r.tenableRegroupes.map((c) => (
                  <li key={c.identifiant}>
                    <Text size="sm" fw={600} lang="en" className="veille-texte">
                      {c.solution}
                    </Text>
                    <Text size="xs" c="dimmed">
                      <span className="pc-mono">{c.identifiant}</span> · {faitsCorrectifRegroupe(c)}
                    </Text>
                  </li>
                ))}
              </ul>
              <Text size="xs" c="dimmed">
                {`Source : ${SOURCE_CORRECTIFS_REGROUPES}. Un correctif regroupé est un texte de solution qui corrige plusieurs contrôles ; texte de Tenable en anglais, tel quel.`}
              </Text>
            </Reco>
          )}
          {r.versionsNvd.length > 0 && (
            <Reco etiquette="NVD · versions touchées" source="nvd">
              <ul className="ff-reco__lignes">
                {r.versionsNvd.map((v) => (
                  <li key={`${v.cve}-${v.editeur}-${v.produit}-${v.debutInclus}-${v.finExclus}-${v.finInclus}`}>
                    <Text size="sm" className="veille-texte">
                      {libelleVersionsNvd(v)}
                    </Text>
                    <Text size="xs" c="dimmed" className="pc-mono">
                      {v.cve}
                    </Text>
                  </li>
                ))}
              </ul>
              <Text size="xs" c="dimmed">
                Bornes publiées par NVD ; la plateforme n’en tire aucun conseil.
                {r.versionsNvdTronquees ? ' D’autres plages existent : seules les premières sont montrées.' : ''}
              </Text>
            </Reco>
          )}
          {r.certSante && (
            <Reco etiquette="CERT Santé · fiche" source="cert-sante">
              <Text size="sm">
                Un correctif existe : {libelleMention(r.certSante.correctif)} · une mesure de contournement existe :{' '}
                {libelleMention(r.certSante.contournement)}.
              </Text>
              <Text size="xs" c="dimmed">
                Mentions de la fiche du CERT Santé, telles quelles.
              </Text>
            </Reco>
          )}
          {r.avis.map((a) => (
            <Reco
              key={`${a.source}-${a.identifiant}`}
              etiquette={`${a.source === 'cert-fr' ? 'CERT-FR' : 'CERT Santé'} · ${a.nature === 'alerte' ? 'alerte' : 'avis'}`}
              source={a.source}
              urgent={a.source === 'cert-fr' && a.nature === 'alerte'}
            >
              <Text size="sm" fw={600} className="veille-texte">
                {a.titre}
              </Text>
              <Text size="xs" c="dimmed">
                <span className="pc-mono">{a.identifiant}</span> · {fmtJour(a.le)}
                {a.adresse ? ' · ' : ''}
                {a.adresse && (
                  <Anchor
                    href={a.adresse}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    size="xs"
                  >
                    lire l’avis (source externe)
                  </Anchor>
                )}
              </Text>
            </Reco>
          ))}
          {r.alh.map((a) => (
            <Reco key={a.alerteId} etiquette="AlgoLightHouse · Recommandations de l’éditeur" source="algolighthouse">
              <Text size="xs" c="dimmed" className="veille-texte">
                Alerte : {a.titre}
              </Text>
              <RecommandationsEditeur defauts={a.defauts} />
              <Text size="xs" c="dimmed">
                Textes de l’éditeur tels quels (anglais ou français), sans mise en forme.
              </Text>
            </Reco>
          ))}
        </ul>
      )}
      {(r.kevTronque || r.avisTronques || r.alhTronquees) && (
        <Text size="xs" c="dimmed">
          D’autres recommandations existent (catalogue KEV, avis ou alertes) : seules les premières sont montrées.
        </Text>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Fiche */
/** Fiche illustrée (sans état) : rendu testable hors navigateur. */
export function FicheFailleIllustree({ f }: { f: FicheFailleDto }) {
  return (
    <div className="ff">
      <EnTete f={f} />
      <VecteurAttaque f={f} />
      <Recommandations f={f} />
    </div>
  );
}

/** Fiche illustrée lue par la route commune, placée en tête de chaque fiche existante. */
export function FicheFaille({ nature, id }: { nature: NatureFicheFaille; id: string }) {
  const q = useQuery({
    queryKey: ['vulnerabilites', 'fiche-faille', nature, id],
    queryFn: () => get<FicheFailleDto>(urlFicheFaille(nature, id)),
  });
  if (q.error) return <ErrorAlert error={q.error} />;
  if (!q.data)
    return (
      <Stack align="center" role="status" aria-label="Chargement de la fiche illustrée">
        <Loader size="sm" />
      </Stack>
    );
  return <FicheFailleIllustree f={q.data} />;
}
