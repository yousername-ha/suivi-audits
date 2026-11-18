-- Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille, lien avec une action du registre existant,
-- proposition « corrigée ». Migration additive : trois tables nouvelles, aucune table existante modifiée ; aucune donnée
-- reprise (consigne du 14/11/2026).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : les trois tables avec le travail. Ce sont des décisions des utilisateurs
-- sur des failles elles-mêmes effacées avec le travail (constats, rapprochements) ; l'historique, immuable, est effacé par
-- la seule remise à vide, qui suspend les déclencheurs le temps de la transaction.

-- État courant d'un objet suivi : un constat de Tenable (un contrôle, pour une instance) ou une faille déclarée (un
-- rapprochement entre un produit surveillé et une CVE). Ligne créée à la première décision, ou par la plateforme quand elle
-- propose « corrigée » ; sans ligne, l'objet est « nouvelle ». L'état suit l'historique dans la même transaction.
-- `proposition` : « corrigée » proposée par la plateforme quand la source ne rapporte plus la faille (a_confirmer), ou
-- refusée par une personne (refusee, gardée jusqu'à ce que la faille soit de nouveau rapportée).
-- `absente` : la source ne rapportait plus la faille au dernier passage (synchronisation complète, rapprochement retiré) ;
-- seule une faille « corrigée » et absente est remise « à traiter » quand elle réapparaît.
-- `revue_le` : date de revue facultative d'un risque accepté (signal calculé quand elle est passée, sans changement d'état).
-- `version` : If-Match des décisions (0 tant que rien n'a changé).
-- Un constat ou un rapprochement effacé efface son état courant ; son historique, sans clé étrangère, reste.
CREATE TABLE vulnerabilites_suivis (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nature           text NOT NULL CHECK (nature IN ('constat', 'declaree')),
  constat_id       uuid UNIQUE REFERENCES vulnerabilites_constats(id) ON DELETE CASCADE,
  rapprochement_id uuid UNIQUE REFERENCES vulnerabilites_rapprochements(id) ON DELETE CASCADE,
  etat             text NOT NULL DEFAULT 'nouvelle'
                     CHECK (etat IN ('nouvelle', 'a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee')),
  proposition      text NOT NULL DEFAULT 'aucune' CHECK (proposition IN ('aucune', 'a_confirmer', 'refusee')),
  absente          boolean NOT NULL DEFAULT false,
  revue_le         date,
  version          integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  maj_le           timestamptz,
  maj_par          text,
  CHECK ((nature = 'constat') = (constat_id IS NOT NULL) AND (nature = 'declaree') = (rapprochement_id IS NOT NULL)),
  CHECK (revue_le IS NULL OR etat = 'risque_accepte'),
  CHECK (proposition <> 'a_confirmer' OR etat <> 'corrigee')
);
CREATE INDEX vulnerabilites_suivis_etat ON vulnerabilites_suivis (etat);
CREATE INDEX vulnerabilites_suivis_proposition ON vulnerabilites_suivis (proposition) WHERE proposition = 'a_confirmer';

-- Historique des décisions et des événements du suivi, en ajout seul (décisions immuables) : ancien et nouvel état, auteur
-- (une personne, ou « système » pour une proposition, un retrait ou une réapparition), date, note. Repéré par la nature et
-- l'identifiant de l'objet, sans clé étrangère : il survit à l'objet.
CREATE TABLE vulnerabilites_suivi_historique (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nature      text NOT NULL CHECK (nature IN ('constat', 'declaree')),
  objet_id    uuid NOT NULL,
  evenement   text NOT NULL
                CHECK (evenement IN ('changement', 'action', 'proposition', 'refus', 'retrait_proposition', 'reapparition')),
  etat_avant  text CHECK (etat_avant IS NULL
                OR etat_avant IN ('nouvelle', 'a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee')),
  etat_apres  text NOT NULL
                CHECK (etat_apres IN ('nouvelle', 'a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee')),
  note        text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  revue_le    date,
  auteur      text NOT NULL CHECK (char_length(auteur) BETWEEN 1 AND 200),
  auteur_id   uuid,
  cree_le     timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (evenement <> 'refus' OR char_length(btrim(note)) >= 1),
  CHECK (evenement <> 'changement' OR etat_apres NOT IN ('risque_accepte', 'non_concernee') OR char_length(btrim(note)) >= 1)
);
CREATE INDEX vulnerabilites_suivi_historique_objet ON vulnerabilites_suivi_historique (nature, objet_id, cree_le);
CREATE TRIGGER vulnerabilites_suivi_historique_immutable BEFORE UPDATE OR DELETE ON vulnerabilites_suivi_historique
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE TRIGGER vulnerabilites_suivi_historique_no_truncate BEFORE TRUNCATE ON vulnerabilites_suivi_historique
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Actions du registre existant liées à un objet suivi (pas de second registre d'actions) : plusieurs par objet. Une action
-- effacée du registre efface le lien ; une action archivée reste liée et le dit. `cree_ici` : action créée depuis le module.
-- L'état de l'action se lit dans le registre, avec les droits de la personne ; sa clôture ne change pas l'état de la faille.
CREATE TABLE vulnerabilites_suivi_actions (
  suivi_id  uuid NOT NULL REFERENCES vulnerabilites_suivis(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES grc_objects(id) ON DELETE CASCADE,
  cree_ici  boolean NOT NULL,
  relie_par text NOT NULL,
  relie_le  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suivi_id, action_id)
);
CREATE INDEX vulnerabilites_suivi_actions_action ON vulnerabilites_suivi_actions (action_id);
