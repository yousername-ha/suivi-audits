/* Périmètre et contexte en dossier (dessin « Périmètre et contexte, en dossier », validé par le RSSI le 27/11/2026) : un
   périmètre n'a en pratique qu'une fiche de contexte ; elle se lit en dossier plutôt qu'en tableau d'une ligne. En tête,
   l'anneau de complétude (rubriques renseignées sur cinq), le nom, les pastilles du registre, le responsable et la date de
   mise à jour, puis « Historique de la fiche », « Autres actions » (menu du registre) et « Modifier la fiche ». Dessous,
   une case par rubrique de la fiche. Aucune donnée propre : les fiches, le menu, la création et les fenêtres sont ceux du
   registre (Registry.tsx), avec ses droits ; calculs dans contexte-dossier.ts. Pas de recherche ni de puces : moins de
   huit fiches (règle validée le 27/11/2026). */
import { ActionIcon, Badge, Button, Card, Text, Tooltip } from '@mantine/core';
import type { GrcObject } from '@suivi/shared';
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import type { VueFiche } from './RecordEditor';
import {
  apercuTexte,
  arcCompletude,
  completudeContexte,
  dateMiseAJour,
  ficheAffichee,
  libelleCompletude,
  rubriquesContexte,
} from './contexte-dossier';

const RAYON = 26;

function IconeCrayon() {
  return (
    <svg className="contexte-dossier__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function IconeHistorique() {
  return (
    <svg className="contexte-dossier__icone" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 12a9 9 0 103-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

function IconePoints() {
  return (
    <svg className="contexte-dossier__icone contexte-dossier__icone--pleine" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/** Anneau de complétude : dessin en attributs SVG (aucun style en ligne), couleurs par la feuille de styles. */
export function AnneauCompletude({ renseignees, total }: { renseignees: number; total: number }) {
  const { arc, circonference } = arcCompletude(renseignees, total, RAYON);
  return (
    <svg
      className="contexte-anneau"
      viewBox="0 0 68 68"
      role="img"
      aria-label={libelleCompletude(renseignees, total)}
      data-complet={renseignees === total || undefined}
    >
      <circle className="contexte-anneau__fond" cx="34" cy="34" r={RAYON} fill="none" strokeWidth="7" />
      {renseignees > 0 && (
        <circle
          className="contexte-anneau__arc"
          cx="34"
          cy="34"
          r={RAYON}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circonference}`}
          transform="rotate(-90 34 34)"
        />
      )}
      <text className="contexte-anneau__texte" x="34" y="34" textAnchor="middle" dominantBaseline="central">
        {renseignees}/{total}
      </text>
    </svg>
  );
}

export interface ProprietesDossier {
  /** Fiches de contexte du périmètre affiché, telles que chargées par le registre. */
  fiches: GrcObject[];
  chargement: boolean;
  /** Droit de modification du registre : sans lui, ni « Modifier », ni « Compléter », ni « Ajouter ». */
  writable: boolean;
  smsi: string;
  /** Nom du responsable, ou null quand la fiche n'en a pas. */
  responsable: (o: GrcObject) => string | null;
  /** État affiché par le registre, ou null quand la fiche n'en porte pas. */
  etat: (o: GrcObject) => string | null;
  onOpen: (o: GrcObject, vue?: VueFiche) => void;
  onCreate: () => void;
  /** Menu « Autres actions » du registre, ouvert par `cible` ; `avant` : entrées ajoutées en tête. */
  autresActions: (o: GrcObject, cible: ReactElement, avant?: ReactNode) => ReactNode;
  /** Entrée de menu « Ajouter une fiche de contexte » (création existante du registre), fournie par le registre. */
  entreeAjout?: ReactNode;
}

function Rubriques({
  fiche,
  writable,
  onOpen,
}: {
  fiche: GrcObject;
  writable: boolean;
  onOpen: ProprietesDossier['onOpen'];
}) {
  const id = useId();
  return (
    <div className="contexte-dossier__rubriques">
      {rubriquesContexte(fiche.data).map((r) => {
        const apercu = apercuTexte(r.texte);
        return (
          <article
            key={r.cle}
            className="contexte-rubrique"
            data-rubrique={r.cle}
            data-etat={r.renseignee ? 'renseigne' : 'a-completer'}
            data-etendue={r.etendue || undefined}
            aria-labelledby={`${id}-${r.cle}`}
          >
            <div className="contexte-rubrique__tete">
              <span className="contexte-rubrique__repere" aria-hidden="true" />
              <h3 id={`${id}-${r.cle}`} className="contexte-rubrique__titre">
                {r.libelle}
              </h3>
              <Badge
                variant="light"
                color={r.renseignee ? 'green' : 'orange'}
                className="contexte-etat"
                data-etat={r.renseignee ? 'renseigne' : 'a-completer'}
              >
                {r.renseignee ? 'Renseigné' : 'À compléter'}
              </Badge>
            </div>
            {r.renseignee ? (
              <p className="contexte-rubrique__texte">{apercu.texte}</p>
            ) : (
              <p className="contexte-rubrique__aide">{r.aide}</p>
            )}
            {r.renseignee && apercu.tronque && (
              <Button
                variant="subtle"
                size="compact-sm"
                className="contexte-rubrique__suite"
                aria-label={`Lire la suite : ${r.libelle}`}
                onClick={() => onOpen(fiche)}
              >
                Lire la suite
              </Button>
            )}
            {!r.renseignee && writable && (
              <Button
                variant="default"
                size="sm"
                className="contexte-rubrique__completer"
                leftSection={<IconeCrayon />}
                aria-label={`Compléter : ${r.libelle}`}
                onClick={() => onOpen(fiche, { champ: r.cle })}
              >
                Compléter
              </Button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** Dossier d'une fiche de contexte, précédé du choix de la fiche quand le périmètre en a plusieurs. */
export function ContexteDossier({
  fiches,
  chargement,
  writable,
  smsi,
  responsable,
  etat,
  onOpen,
  onCreate,
  autresActions,
  entreeAjout,
}: ProprietesDossier) {
  const titre = useId();
  const [choisie, setChoisie] = useState<string | null>(null);
  const fiche = ficheAffichee(fiches, choisie);

  if (!fiche)
    return chargement ? (
      <Card withBorder className="contexte-dossier">
        <Text role="status">Chargement du contexte…</Text>
      </Card>
    ) : (
      <Card withBorder component="section" className="contexte-dossier contexte-dossier--vide" aria-labelledby={titre}>
        <h2 id={titre} className="contexte-dossier__nom">
          Le contexte de ce périmètre n’est pas encore décrit
        </h2>
        <p className="contexte-dossier__intro">
          Une fiche de contexte décrit cinq rubriques, que l’auditeur relit (clause 4 de l’ISO/IEC 27001) :
        </p>
        <ol className="contexte-dossier__a-decrire">
          {rubriquesContexte({}).map((r) => (
            <li key={r.cle} data-rubrique={r.cle}>
              <span className="contexte-rubrique__repere" aria-hidden="true" />
              {r.libelle}
            </li>
          ))}
        </ol>
        {writable ? (
          <Button
            variant="filled"
            className="contexte-dossier__decrire"
            leftSection={<IconeCrayon />}
            onClick={onCreate}
          >
            Décrire le contexte
          </Button>
        ) : (
          <p className="contexte-dossier__intro">Consultation seule : aucune fiche de contexte à afficher.</p>
        )}
      </Card>
    );

  const { renseignees, total } = completudeContexte(fiche.data);
  const nomResponsable = responsable(fiche);
  const miseAJour = dateMiseAJour(fiche.updatedAt);
  const etatFiche = etat(fiche);
  return (
    <Card withBorder component="section" className="contexte-dossier" aria-labelledby={titre}>
      {fiches.length > 1 && (
        <div className="contexte-dossier__choix">
          <div role="group" aria-label="Fiches de contexte du périmètre" className="contexte-dossier__fiches">
            {fiches.map((f) => (
              <Button
                key={f.id}
                variant={f.id === fiche.id ? 'light' : 'default'}
                className="contexte-dossier__fiche"
                aria-pressed={f.id === fiche.id}
                onClick={() => setChoisie(f.id)}
              >
                {f.name}
              </Button>
            ))}
          </div>
          {writable && (
            <Button variant="default" className="contexte-dossier__ajouter" onClick={onCreate}>
              Ajouter une fiche de contexte
            </Button>
          )}
        </div>
      )}
      <div className="contexte-dossier__entete">
        <AnneauCompletude renseignees={renseignees} total={total} />
        <div className="contexte-dossier__identite">
          <h2 id={titre} className="contexte-dossier__nom">
            {fiche.name}
          </h2>
          <div className="contexte-dossier__meta">
            {fiche.id.startsWith('legacy:') && (
              <Badge variant="light" className="contexte-dossier__pastille" data-pastille="existant">
                Existant
              </Badge>
            )}
            {fiche.smsiId !== smsi && !fiche.id.startsWith('legacy:') && (
              <Badge variant="light" color="encre" className="contexte-dossier__pastille">
                Registre partagé avec ce périmètre
              </Badge>
            )}
            {etatFiche && (
              <Badge variant="light" color="encre" className="contexte-dossier__pastille">
                {etatFiche}
              </Badge>
            )}
            <span>{nomResponsable ? `Responsable : ${nomResponsable}` : 'Non attribué'}</span>
            <span aria-hidden="true">·</span>
            <span className="horodatage">
              {miseAJour ? `Mis à jour le ${miseAJour}` : 'Date de mise à jour non renseignée'}
            </span>
          </div>
        </div>
        <div className="contexte-dossier__commandes">
          <Tooltip label="Historique de la fiche">
            <ActionIcon
              variant="default"
              size="xl"
              radius="xl"
              aria-label="Historique de la fiche"
              onClick={() => onOpen(fiche, { onglet: 'history' })}
            >
              <IconeHistorique />
            </ActionIcon>
          </Tooltip>
          {autresActions(
            fiche,
            <ActionIcon variant="default" size="xl" radius="xl" aria-label={`Autres actions pour ${fiche.name}`}>
              <IconePoints />
            </ActionIcon>,
            fiches.length === 1 && writable ? entreeAjout : null,
          )}
          <Button
            className="contexte-dossier__modifier"
            variant={writable ? 'filled' : 'default'}
            leftSection={writable ? <IconeCrayon /> : undefined}
            onClick={() => onOpen(fiche)}
          >
            {writable ? 'Modifier la fiche' : 'Afficher la fiche'}
          </Button>
        </div>
      </div>
      <Rubriques fiche={fiche} writable={writable} onOpen={onOpen} />
    </Card>
  );
}
