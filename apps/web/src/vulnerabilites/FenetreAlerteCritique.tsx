/* Module Vulnérabilités (ADR 0100, point 21 et lot V6) : fenêtre d'alerte critique, sur toutes les pages, pour les personnes
   qui lisent le module, tant qu'une alerte critique (faille exploitée présente chez nous, P1) n'est pas prise en compte.
   Grande fenêtre rouge centrée d'après la maquette 07 (bandes diagonales animées, onde du pictogramme ; animations coupées
   par le mouvement réduit), sous la CSP stricte : aucun style en ligne, classes de packages/ui/src/neon-surface.css.
   Accessibilité : role="alertdialog", nom et description accessibles, focus piégé puis rendu à l'élément qui l'avait ;
   Échap ne ferme pas (une décision est attendue). Elle s'affiche au-dessus de la page sans la démonter : une saisie en cours
   garde son état.
   - Rôle RSSI de la plateforme (lot V6b, décision B du 18/11/2026 ; le serveur en juge) : « Pris en compte » (pour tout le
     monde, tracé, If-Match), « Plus tard » et « Ouvrir la fiche » (la fenêtre est écartée pour la session, la fiche s'ouvre).
   - Toute autre personne, même avec le droit de modifier le module : « Fermer pour cette session » (elle réapparaît à la
     connexion suivante tant que l'alerte n'est pas prise en compte) et « Ouvrir la fiche ».
   Plusieurs alertes : une seule fenêtre, la plus récente en tête, les autres listées (bornées). Aucun nom de machine, de
   domaine, d'adresse ni de périmètre : des nombres que la personne lit, et un drapeau sans nombre pour le reste. */
import { Button, FocusTrap, Group, Portal } from '@mantine/core';
import {
  type AlerteVulnerabiliteDto,
  type FenetreAlertesDto,
  PRISE_EN_COMPTE_RESERVEE,
  resumeNombreLisible,
} from '@suivi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusReturn } from '@mantine/hooks';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, errorMessage, get } from '../api';
import { useCan, useMe } from '../session';
import {
  CLE_ALERTES,
  CLE_FENETRE,
  ecarter,
  ecartees,
  heureAlerte,
  libelleExploitation,
  libelleFaille,
  libellePresences,
  lienFicheAlerte,
  marqueAlerte,
  urlFenetre,
  urlPriseEnCompte,
} from './alertes';
import { PictosSources } from './PictoSource';
import { pictosExploitation } from './pictos-sources';

/** Fait principal de la présence, en nombre que la personne lit. */
function presence(a: AlerteVulnerabiliteDto): { libelle: string; valeur: string; detail: string } {
  if (a.machines.lisibles || a.machines.horsLecture)
    return {
      libelle: 'Machines touchées',
      valeur: String(a.machines.lisibles),
      detail: a.machines.horsLecture ? 'que vous pouvez lire, et d’autres hors de vos droits' : libellePresences(a),
    };
  if (a.actifs.lisibles || a.actifs.horsLecture)
    return {
      libelle: 'Actifs exposés',
      valeur: String(a.actifs.lisibles),
      detail: a.actifs.horsLecture ? 'que vous pouvez lire, et d’autres hors de vos droits' : libellePresences(a),
    };
  return { libelle: 'Présence', valeur: 'Avérée', detail: libellePresences(a) };
}

export interface FenetreAlerteCritiqueVueProps {
  alertes: AlerteVulnerabiliteDto[];
  /** Alertes critiques ouvertes non prises en compte (au-delà de celles listées comprises). */
  total: number;
  peutPrendreEnCompte: boolean;
  envoi?: boolean;
  erreur?: string | null;
  onPrendreEnCompte: (a: AlerteVulnerabiliteDto) => void;
  onPlusTard: () => void;
  onOuvrir: (a: AlerteVulnerabiliteDto) => void;
}

/** Contenu de la fenêtre (sans état) : rendu testable hors navigateur. */
export function FenetreAlerteCritiqueVue({
  alertes,
  total,
  peutPrendreEnCompte,
  envoi = false,
  erreur = null,
  onPrendreEnCompte,
  onPlusTard,
  onOuvrir,
}: FenetreAlerteCritiqueVueProps) {
  const id = useId();
  const a = alertes[0];
  if (!a) return null;
  const autres = alertes.slice(1);
  const restantes = Math.max(0, total - alertes.length);
  const p = presence(a);
  const h = heureAlerte(a);
  return (
    <div
      className="alerte-critique"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-titre`}
      aria-describedby={`${id}-description`}
      data-alerte-critique
    >
      <div className="ac-fenetre">
        <div className="ac-bande" aria-hidden="true" />
        <div className="ac-corps">
          <span className="ac-signal" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l10 18H2z" />
              <path d="M12 10v5M12 18h0" />
            </svg>
          </span>
          <div>
            <p className="ac-kicker">Alerte critique · priorité {a.priorite.niveau}</p>
            <h2 className="ac-titre" id={`${id}-titre`}>
              Faille exploitée présente chez nous
            </h2>
            <p className="ac-sous" id={`${id}-description`}>
              <b lang={a.cve ? 'en' : undefined}>{a.titre}</b> · <span className="veille-code">{libelleFaille(a)}</span>
              {a.produit ? ` · produit : ${a.produit}` : ''}
              {total > 1 ? ` · ${total} alertes critiques en attente` : ''}
            </p>
          </div>
        </div>
        <dl className="ac-faits">
          <div>
            <dt>{p.libelle}</dt>
            <dd>
              <strong>{p.valeur}</strong>
              <small>{p.detail}</small>
            </dd>
          </div>
          <div>
            <dt>Exploitation</dt>
            <dd>
              <strong>Avérée</strong>
              <small>
                <PictosSources sources={pictosExploitation(a.exploitation)} decoratif /> {libelleExploitation(a)}
              </small>
            </dd>
          </div>
          <div>
            <dt>Reçue</dt>
            <dd>
              <strong className="horodatage">{h.heure}</strong>
              <small className="horodatage">{h.jour}</small>
            </dd>
          </div>
        </dl>
        {(autres.length > 0 || restantes > 0) && (
          <div className="ac-autres">
            <strong>Autres alertes critiques en attente</strong>
            <ul>
              {autres.map((x) => (
                <li key={x.id}>
                  {x.titre} · {libelleFaille(x)}
                  {x.machines.lisibles || x.machines.horsLecture
                    ? ` · machines : ${resumeNombreLisible(x.machines)}`
                    : ''}
                </li>
              ))}
              {restantes > 0 && <li>et {restantes} autres, dans l’onglet « Alertes » du module Vulnérabilités</li>}
            </ul>
          </div>
        )}
        {erreur && (
          <p className="ac-erreur" role="alert">
            {erreur}
          </p>
        )}
        <div className="ac-pied">
          <p>
            {peutPrendreEnCompte
              ? `Cette fenêtre reste affichée tant que l’alerte n’est pas prise en compte. ${PRISE_EN_COMPTE_RESERVEE} La prise en compte vaut pour tout le monde et elle est tracée. « Plus tard » la masque jusqu’à votre prochaine connexion.`
              : `${PRISE_EN_COMPTE_RESERVEE} Fermée pour cette session, la fenêtre réapparaît à votre prochaine connexion tant que l’alerte n’est pas prise en compte.`}
          </p>
          <Group gap="xs">
            {peutPrendreEnCompte ? (
              <>
                <Button variant="default" loading={envoi} onClick={() => onPrendreEnCompte(a)}>
                  Pris en compte
                </Button>
                <Button variant="subtle" color="red" onClick={onPlusTard}>
                  Plus tard
                </Button>
              </>
            ) : (
              <Button variant="default" onClick={onPlusTard}>
                Fermer pour cette session
              </Button>
            )}
            <Button color="red" onClick={() => onOuvrir(a)} data-autofocus>
              Ouvrir la fiche
            </Button>
          </Group>
        </div>
        <div className="ac-bande" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Fenêtre montée une fois pour toutes les pages (Layout) : lit la fenêtre de l'API, garde les mises à l'écart de la
    session, piège le focus et le rend à la fermeture. */
export function FenetreAlerteCritique() {
  const me = useMe();
  const can = useCan();
  const qc = useQueryClient();
  const nav = useNavigate();
  const utilisateur = me.user?.id ?? '';
  const lire = me.stage === 'ok' && can('vulnerabilites', 'lire');
  const q = useQuery({
    queryKey: CLE_FENETRE,
    queryFn: () => get<FenetreAlertesDto>(urlFenetre()),
    enabled: lire,
    refetchInterval: 60_000,
    retry: false,
  });
  const [ecart, setEcart] = useState<Set<string>>(() => ecartees(utilisateur));
  useEffect(() => setEcart(ecartees(utilisateur)), [utilisateur]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const visibles = lire ? (q.data?.alertes ?? []).filter((a) => !ecart.has(marqueAlerte(a))) : [];
  const ouverte = visibles.length > 0;
  // Focus rendu à l'élément qui l'avait avant l'ouverture (crochet de Mantine, comme ses fenêtres).
  useFocusReturn({ opened: ouverte });
  if (!ouverte || !q.data) return null;
  const ecarterTout = () => {
    const marques = visibles.map(marqueAlerte);
    ecarter(utilisateur, marques);
    setEcart(new Set([...ecart, ...marques]));
    setErreur(null);
  };
  const prendre = async (a: AlerteVulnerabiliteDto) => {
    setEnvoi(true);
    setErreur(null);
    try {
      await api('POST', urlPriseEnCompte(a.id), { ifMatch: a.version });
    } catch (e) {
      setErreur(
        e instanceof ApiError && e.status === 412
          ? 'L’alerte a changé depuis son affichage : vérifiez-la, puis recommencez.'
          : errorMessage(e),
      );
    } finally {
      setEnvoi(false);
      await qc.invalidateQueries({ queryKey: CLE_ALERTES });
    }
  };
  return (
    <Portal>
      <FocusTrap active>
        <div>
          <FenetreAlerteCritiqueVue
            alertes={visibles}
            total={Math.max(visibles.length, q.data.total - (q.data.alertes.length - visibles.length))}
            peutPrendreEnCompte={q.data.peutPrendreEnCompte}
            envoi={envoi}
            erreur={erreur}
            onPrendreEnCompte={(a) => void prendre(a)}
            onPlusTard={ecarterTout}
            onOuvrir={(a) => {
              ecarterTout();
              nav(lienFicheAlerte(a.id));
            }}
          />
        </div>
      </FocusTrap>
    </Portal>
  );
}
