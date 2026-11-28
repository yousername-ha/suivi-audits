/* Import et rapports en style « Verre » (dessin DocImports validé par le RSSI le 28/11/2026) : à gauche, « Importer un
   fichier » en trois étapes visibles (choisir, simuler, appliquer), fichier choisi, contenu à simuler, résultat de la
   simulation et motifs d'un refus, puis la confirmation humaine ; à droite, trois cartes : exporter un référentiel,
   rapport de pilotage et d'audit, modèles pour préparer un fichier. Composant de présentation : Imports.tsx garde les
   appels à l'API, les droits et la confirmation, à l'identique du rendu classique. Seuls les chiffres rendus par la
   simulation sont affichés (domaines, exigences, doublon, avertissement) : ni fiches créées, mises à jour ou rejetées,
   ni détail par feuille, que l'API ne fournit pas. */
import { FileButton, Select, Textarea } from '@mantine/core';
import type { ReactNode } from 'react';
import { fmtSize } from '../components/common';
import { errorMessage } from '../api';
import { etapesImport, heureSimulation, motifsRefus, type SimulationImport } from './imports-verre';

const ETATS: Record<string, string> = {
  fait: 'faite',
  'en-cours': 'en cours',
  'a-venir': 'à venir',
  bloque: 'bloquée',
};

function IconeFichier() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6z M14 3v4h4" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export interface ImportsVerreProps {
  peutImporter: boolean;
  /** Export d'un référentiel et rapports (droit d'exporter les imports et exports). */
  peutExporter: boolean;
  /** Export d'un référentiel : droit d'exporter la conformité. */
  peutExporterReferentiel: boolean;
  erreur: ReactNode;
  fichier: { nom: string; taille: number } | null;
  texte: string;
  onTexte: (v: string) => void;
  onFichier: (f: File | null) => void;
  simulation: SimulationImport | null;
  simuleA: Date | null;
  erreurSimulation: unknown;
  onSimuler: () => void;
  onAppliquer: () => void;
  confirmation: boolean;
  onConfirmer: () => void;
  referentiels: { value: string; label: string }[];
  referentiel: string | null;
  onReferentiel: (v: string | null) => void;
  onExporter: (excel: boolean) => void;
  onRapport: () => void;
  onRapportJson: () => void;
  onExempleJson: () => void;
  onGabarit: () => void;
  onGuide: () => void;
}

export function ImportsVerre(p: ImportsVerreProps) {
  const etapes = etapesImport(!!p.texte.trim(), p.simulation);
  const motifs = p.erreurSimulation ? motifsRefus(errorMessage(p.erreurSimulation)) : [];
  const s = p.simulation;
  return (
    <div className="impv" data-import={p.peutImporter || undefined}>
      {p.erreur}
      {p.peutImporter && (
        <section className="impv-import" aria-labelledby="impv-titre">
          <div className="impv-tete">
            <h2 id="impv-titre">Importer un fichier</h2>
            <span className="impv-sec">JSON ou Excel</span>
          </div>
          <ol className="impv-etapes" aria-label="Étapes de l’importation">
            {etapes.map((e, i) => (
              <li
                key={e.cle}
                className="impv-etape"
                data-etat={e.etat}
                aria-current={e.etat === 'en-cours' ? 'step' : undefined}
              >
                <span className="impv-etape__pastille" aria-hidden="true">
                  {e.etat === 'fait' ? '✓' : e.etat === 'bloque' ? '✕' : i + 1}
                </span>
                <span className="impv-etape__libelle">
                  {e.libelle}
                  <span className="sr-only"> : étape {ETATS[e.etat]}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="impv-fichier">
            <IconeFichier />
            <div className="impv-fichier__corps">
              {p.fichier ? (
                <>
                  <span className="impv-fichier__nom">{p.fichier.nom}</span>
                  <span className="impv-sec">
                    {[fmtSize(p.fichier.taille), s && p.simuleA ? `simulé à ${heureSimulation(p.simuleA)}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </>
              ) : (
                <span className="impv-sec">
                  Choisissez un fichier JSON ou Excel (8 Mo au plus), ou collez son contenu.
                </span>
              )}
            </div>
            <FileButton accept=".json,.xlsx" onChange={p.onFichier}>
              {(props) => (
                <button type="button" className="impv-gelule" {...props}>
                  {p.fichier ? 'Changer de fichier' : 'Choisir un fichier'}
                </button>
              )}
            </FileButton>
          </div>
          <Textarea
            label="Contenu à simuler"
            minRows={6}
            maxRows={14}
            autosize
            value={p.texte}
            onChange={(e) => p.onTexte(e.currentTarget.value)}
          />
          <div className="impv-ligne">
            <button type="button" className="impv-gelule" onClick={p.onSimuler}>
              Simuler l’importation
            </button>
          </div>
          {(s || motifs.length > 0) && (
            <section className="impv-resultat" aria-labelledby="impv-resultat">
              <h3 id="impv-resultat" className="impv-cle">
                Résultat de la simulation · rien n’est encore enregistré
              </h3>
              {s && (
                <>
                  {s.definition?.name && (
                    <p className="impv-referentiel">
                      {s.definition.name}
                      {s.definition.identifier && <span className="impv-sec"> · {s.definition.identifier}</span>}
                    </p>
                  )}
                  <ul className="impv-chiffres" aria-label="Contenu simulé">
                    <li>
                      <span className="impv-sec">Domaines</span>
                      <strong>{s.domains}</strong>
                    </li>
                    <li data-ton="ok">
                      <span className="impv-sec">Exigences</span>
                      <strong>{s.requirements}</strong>
                    </li>
                  </ul>
                  {s.warning && <p className="impv-avertissement">{s.warning}</p>}
                </>
              )}
              {(motifs.length > 0 || s?.duplicate) && (
                <>
                  <h3 className="impv-cle">Motifs du refus</h3>
                  <ul className="impv-refus">
                    {s?.duplicate && <li>Identifiant de référentiel déjà présent : importation refusée.</li>}
                    {motifs.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          <div className="impv-ligne impv-ligne--pied">
            <button
              type="button"
              className="impv-gelule impv-gelule--primaire"
              disabled={!s?.canImport}
              onClick={p.onAppliquer}
            >
              Appliquer l’importation
            </button>
            {!s && (
              <span className="impv-sec">
                Simulez d’abord le contenu : rien n’est enregistré avant la confirmation.
              </span>
            )}
          </div>
          {p.confirmation && (
            <div className="impv-confirmation" role="alert">
              <p>Confirmez l’importation atomique dans le périmètre sélectionné.</p>
              <button type="button" className="impv-gelule impv-gelule--primaire" onClick={p.onConfirmer}>
                Confirmer l’importation
              </button>
            </div>
          )}
        </section>
      )}
      <div className="impv-cartes">
        <section className="impv-carte" aria-labelledby="impv-export">
          <h3 id="impv-export">Exporter un référentiel</h3>
          <p className="impv-sec">Le même format que l’import : à garder ou à reprendre ailleurs.</p>
          <Select
            allowDeselect={false}
            label="Référentiel à exporter"
            data={p.referentiels}
            value={p.referentiel}
            onChange={p.onReferentiel}
          />
          {p.peutExporter && (
            <div className="impv-ligne">
              <button
                type="button"
                className="impv-gelule"
                disabled={!p.peutExporterReferentiel}
                onClick={() => p.onExporter(false)}
              >
                Exporter en JSON
              </button>
              <button
                type="button"
                className="impv-gelule"
                disabled={!p.peutExporterReferentiel}
                onClick={() => p.onExporter(true)}
              >
                Exporter en Excel
              </button>
            </div>
          )}
        </section>
        {p.peutExporter && (
          <section className="impv-carte" aria-labelledby="impv-rapport">
            <h3 id="impv-rapport">Rapport de pilotage et d’audit</h3>
            <p className="impv-sec">Synthèse imprimable du périmètre affiché.</p>
            <div className="impv-ligne">
              <button type="button" className="impv-gelule impv-gelule--primaire" onClick={p.onRapport}>
                Produire le rapport
              </button>
              <button type="button" className="impv-gelule" onClick={p.onRapportJson}>
                Données en JSON
              </button>
            </div>
          </section>
        )}
        <section className="impv-carte" aria-labelledby="impv-modeles">
          <h3 id="impv-modeles">Pour bien préparer un fichier</h3>
          <p className="impv-sec">
            Modèles fictifs, sans aucune donnée réelle. Les fichiers sont lus dans le navigateur, puis validés par le
            serveur de cette installation : aucune donnée n’est envoyée à un service tiers.
          </p>
          <ul className="impv-modeles">
            {[
              { libelle: 'Gabarit et exemple Excel', format: 'XLSX', action: p.onGabarit },
              { libelle: 'Exemple fictif', format: 'JSON', action: p.onExempleJson },
              { libelle: 'Guide d’importation', format: 'TXT', action: p.onGuide },
            ].map((m) => (
              <li key={m.format}>
                <button type="button" className="impv-modele" onClick={m.action}>
                  <IconeFichier />
                  <span className="impv-modele__libelle">{m.libelle}</span>
                  <span className="impv-sec">{m.format}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
