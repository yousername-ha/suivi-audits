/* Assistant et module Vulnérabilités (ADR 0100, V14, V25, V29, V30) à l'écran :
   - texte du modèle dont les repères de machines sont remplacés par le serveur pour la personne qui regarde : une machine
     nommée est soulignée en pointillés, avec une info-bulle qui dit que c'est une machine et son repère ; un repère d'une
     machine que la personne ne lit pas reste tel quel ; un repère inconnu (inventé par le modèle) est signalé ;
   - propositions d'action sur une faille, déposées en conversation : carte dans « Pour vous », puis décision (périmètre,
     intitulé, description, échéance, note). La confirmation crée l'action côté serveur, noms des machines à la place des
     repères et actifs touchés ajoutés ; rien ne repart vers le modèle.
   Éléments natifs et classes de la charte de l'assistant (packages/ui, neon-assistant.css) : ni style ni script en ligne. */
import {
  ETAT_PROPOSITION_VULN_LIBELLES,
  PROPOSITION_VULN_DESCRIPTION_MAX,
  PROPOSITION_VULN_TITRE_MAX,
  type PropositionVulnerabiliteDto,
  type SegmentTexte,
} from '@suivi/shared';
import { useState } from 'react';
import { IconeAssistant } from './IdentiteAssistant';

const dateJour = (v: string | null) =>
  v
    ? new Date(`${v}T12:00:00`).toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Non définie';

/** Nature d'un repère : machine (« M-… ») ou actif exposé sur Internet (« E-… », lot ALH2). */
const nature = (repere: string) => (repere.startsWith('E-') ? 'Actif exposé' : 'Machine');

/** Texte affiché avec ses machines et ses actifs exposés marqués. */
export function TexteMachines({ segments }: { segments: readonly SegmentTexte[] }) {
  return (
    <>
      {segments.map((s, i) =>
        'texte' in s ? (
          <span key={i}>{s.texte}</span>
        ) : 'machine' in s ? (
          <span key={i} className="as-machine" title={`${nature(s.repere)} (repère ${s.repere} pour l’assistant)`}>
            {s.machine}
          </span>
        ) : s.etat === 'non_lisible' ? (
          <span
            key={i}
            className="as-repere"
            title={`${nature(s.repere)} que vous ne pouvez pas lire : son repère reste affiché`}
          >
            {s.repere}
          </span>
        ) : (
          <mark
            key={i}
            className="as-repere-inconnu"
            title="Repère non reconnu : il ne désigne aucune machine ni aucun actif connu"
          >
            {s.repere} (repère non reconnu)
          </mark>
        ),
      )}
    </>
  );
}

/** Carte d'une proposition dans la boîte « Pour vous ». */
export function CartePropositionVulnerabilite({
  proposition: p,
  onExaminer,
}: {
  proposition: PropositionVulnerabiliteDto;
  onExaminer: () => void;
}) {
  return (
    <article className="as-inbox-card" data-kind="proposal">
      <div className="as-card-kicker">
        <IconeAssistant nom="action" />
        Proposition d’action · Vulnérabilités
      </div>
      <h3>
        <TexteMachines segments={p.titreSegments} />
      </h3>
      <p>{p.faille.libelle}</p>
      <dl>
        <div>
          <dt>Échéance proposée</dt>
          <dd>{dateJour(p.echeance)}</dd>
        </div>
        <div>
          <dt>État</dt>
          <dd>{ETAT_PROPOSITION_VULN_LIBELLES[p.etat]}</dd>
        </div>
      </dl>
      {p.etat === 'en_attente' ? (
        <>
          <button type="button" className="as-small-button" onClick={onExaminer}>
            Examiner la proposition <IconeAssistant nom="arrow" />
          </button>
          <p className="as-card-meta">L’action n’est créée qu’après votre confirmation, avec les noms des machines.</p>
        </>
      ) : p.etat === 'retiree' ? (
        <p className="as-card-meta">Remplacée par une proposition plus récente de l’assistant.</p>
      ) : (
        <p className="as-success">Décision enregistrée{p.decidedBy ? ` par ${p.decidedBy}` : ''}.</p>
      )}
    </article>
  );
}

/** Corps de la décision envoyé au serveur. Le texte affiché (noms à la place des repères) est renvoyé tel quel : le serveur
    remplace les repères qui resteraient. */
export function corpsDecisionVulnerabilite(
  decision: 'confirmer' | 'rejeter',
  v: { perimetreId: string; titre: string; description: string; echeance: string; note: string },
) {
  return decision === 'rejeter'
    ? { decision, note: v.note.trim() }
    : {
        decision,
        perimetreId: v.perimetreId,
        titre: v.titre.trim(),
        description: v.description.trim(),
        echeance: v.echeance || null,
        note: v.note.trim(),
      };
}

/** Décision sur une proposition : périmètre (ceux où la personne écrit), intitulé, description, échéance, note. */
export function DecisionPropositionVulnerabilite({
  proposition: p,
  perimetres,
  peutDecider,
  busy,
  decide,
}: {
  proposition: PropositionVulnerabiliteDto;
  perimetres: readonly { id: string; nom: string }[];
  /** Droit de décider (assistant) et de modifier les vulnérabilités. */
  peutDecider: boolean;
  busy: boolean;
  decide: (body: ReturnType<typeof corpsDecisionVulnerabilite>) => void;
}) {
  const [perimetreId, setPerimetre] = useState(''),
    [titre, setTitre] = useState(p.titre),
    [description, setDescription] = useState(p.description),
    [echeance, setEcheance] = useState(p.echeance ?? ''),
    [note, setNote] = useState('');
  const valeurs = { perimetreId, titre, description, echeance, note };
  const actif = peutDecider && !busy;
  return (
    <>
      <span className="rr-kicker">Proposition · Vulnérabilités</span>
      <h3>Examiner avant de décider</h3>
      <p>{p.faille.libelle}</p>
      <p>
        À la confirmation, l’action est créée sous votre nom dans le périmètre choisi et liée à la faille. Les repères
        de machines sont remplacés par leurs noms, et la plateforme ajoute les machines et applications touchées que
        vous pouvez lire. Rien n’est renvoyé à l’assistant.
      </p>
      {p.machines.length > 0 && (
        <div>
          <strong>Machines concernées</strong>
          <ul className="as-machines">
            {p.machines.map((m) => (
              <li key={m.repere}>
                {m.nom ? (
                  <span className="as-machine" title={`Machine (repère ${m.repere} pour l’assistant)`}>
                    {m.nom}
                  </span>
                ) : (
                  <span className="as-repere" title="Machine que vous ne pouvez pas lire : son repère reste affiché">
                    {m.repere}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        className="as-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (actif && perimetreId && titre.trim()) decide(corpsDecisionVulnerabilite('confirmer', valeurs));
        }}
      >
        <label>
          Périmètre de l’action
          <select required value={perimetreId} onChange={(e) => setPerimetre(e.target.value)} disabled={!actif}>
            <option value="">Choisir un périmètre où vous pouvez écrire</option>
            {perimetres.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Titre de l’action
          <input
            maxLength={PROPOSITION_VULN_TITRE_MAX}
            required
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            disabled={!actif}
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Description"
            rows={4}
            maxLength={PROPOSITION_VULN_DESCRIPTION_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!actif}
          />
        </label>
        <label>
          Échéance proposée
          <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} disabled={!actif} />
        </label>
        <label>
          Note de décision
          <textarea
            aria-label="Note de décision"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!actif}
          />
        </label>
        {!peutDecider && (
          <p className="as-inline-error">
            Décider demande le droit de décider des propositions et celui de modifier les vulnérabilités.
          </p>
        )}
        <div className="as-card-actions">
          <button className="as-small-button" disabled={!actif || !perimetreId || !titre.trim()}>
            <IconeAssistant nom="check" />
            Confirmer l’action
          </button>
          <button
            type="button"
            className="as-small-button"
            data-variant="quiet"
            disabled={!actif}
            onClick={() => {
              if (actif) decide(corpsDecisionVulnerabilite('rejeter', valeurs));
            }}
          >
            Rejeter
          </button>
        </div>
      </form>
    </>
  );
}
