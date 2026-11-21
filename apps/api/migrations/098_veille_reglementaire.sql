-- Veille réglementaire (ADR 0110, lot VR-1) : module de droits « veille_reglementaire », état des sources, file et journal
-- des collectes, publications et leur qualification. Migration additive : trois tables nouvelles et la contrainte des modules
-- recréée pour admettre le nouveau module (comme 072 et 073) ; aucun compte, rôle ni groupe n'est touché. Le droit réservé
-- « DPO » (`veille_reglementaire:dpo`) est défini dans le code (packages/shared/src/permissions.ts) et ne s'accorde que par un
-- rôle personnalisé : aucun rôle prédéfini ne le reçoit. Sans
-- reprise de données (consigne du 14/11/2026) : la veille démarre vide, son flux est fermé, chaque source est désactivée.
-- ANS et Légifrance : valeurs prévues, sans collecteur (aucun flux public connu) ; elles ne s'activent pas.
-- La liste des sources est fermée et écrite dans le code (packages/shared/src/veille-reglementaire.ts) ; la base la fige
-- aussi. Concordance des listes vérifiée par apps/api/test/veille-reglementaire.test.ts.

ALTER TABLE module_activation DROP CONSTRAINT IF EXISTS module_activation_disabled_connus;
ALTER TABLE module_activation ADD CONSTRAINT module_activation_disabled_connus
  CHECK (disabled <@ ARRAY['audit','ecarts','plan_audit','pilotage','fournisseurs','conformite','incidents','cartographie','vulnerabilites','veille_reglementaire','documents','import_export','tableau_de_bord','assistant','integrations']::text[]);


-- État de chaque source : activation (fermée par défaut ; Légifrance et l'ANS n'ont pas de collecteur et ne s'activent pas),
-- fréquence en liste fermée (NULL : vingt-quatre heures, valeur par défaut lue dans le code), référence de la dernière
-- demande automatique, dernière réussite, dernier essai, erreur sur une ligne, version (If-Match du réglage). EUR-Lex : liste
-- des mots-clés du filtre (NULL : liste par défaut lue dans le code), tableau de 1 à 60 objets { mot, domaine } validés par
-- l'API.
CREATE TABLE veille_reglementaire_sources (
  source            text PRIMARY KEY CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi', 'ans', 'legifrance')),
  activee           boolean NOT NULL DEFAULT false CHECK (NOT activee OR source NOT IN ('legifrance', 'ans')),
  frequence_heures  integer CHECK (frequence_heures IS NULL OR frequence_heures IN (4, 12, 24, 168)),
  planifiee_le      timestamptz,
  derniere_reussite timestamptz,
  dernier_essai     timestamptz,
  erreur            text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  mots_cles         jsonb CHECK (mots_cles IS NULL OR (source = 'eur-lex' AND jsonb_typeof(mots_cles) = 'array'
                      AND jsonb_array_length(mots_cles) BETWEEN 1 AND 60)),
  version           integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

-- File et journal des collectes : l'API inscrit (planification ou « Collecter maintenant »), l'exécutant réclame
-- (« suivi veille-reglementaire-claim »), rapporte par lots (« -lot ») puis termine (« -finish »). Même forme que
-- vulnerabilites_veille_collectes (migration 074), sans fenêtre de dates.
CREATE TABLE veille_reglementaire_collectes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi')),
  origine     text NOT NULL CHECK (origine IN ('manuel', 'planifie')),
  etat        text NOT NULL DEFAULT 'en_file' CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec', 'expire')),
  demande_par text NOT NULL,
  demande_le  timestamptz NOT NULL DEFAULT now(),
  debute_le   timestamptz,
  termine_le  timestamptz,
  lots        integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 40),
  elements    integer NOT NULL DEFAULT 0 CHECK (elements BETWEEN 0 AND 20000),
  ecartes     integer NOT NULL DEFAULT 0 CHECK (ecartes >= 0),
  tronque     boolean NOT NULL DEFAULT false,
  erreur      text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  CHECK ((etat IN ('recu', 'echec', 'expire')) = (termine_le IS NOT NULL)),
  CHECK ((etat IN ('echec', 'expire')) = (erreur IS NOT NULL)),
  CHECK (etat NOT IN ('en_cours', 'recu') OR debute_le IS NOT NULL)
);
CREATE INDEX veille_reglementaire_collectes_file ON veille_reglementaire_collectes (demande_le) WHERE etat IN ('en_file', 'en_cours');
CREATE INDEX veille_reglementaire_collectes_source ON veille_reglementaire_collectes (source, demande_le DESC);

-- Publications : une ligne par (source, identifiant du flux), mise à jour sans doublon par une collecte rejouée (la
-- qualification est gardée). Textes nettoyés et bornés ; résumé interdit pour l'ANSSI ; lien en https sur l'hôte de la
-- source (aucun pour l'ANS et Légifrance, sans collecteur). Qualification : statut, date et auteur (compte supprimé : auteur effacé, date gardée), version (If-Match).
CREATE TABLE veille_reglementaire_publications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL CHECK (source IN ('cnil', 'cepd', 'eur-lex', 'anssi', 'ans', 'legifrance')),
  domaine      text NOT NULL CHECK (domaine IN ('securite', 'donnees-personnelles')),
  identifiant  text NOT NULL CHECK (char_length(identifiant) BETWEEN 1 AND 300 AND identifiant !~ '[[:cntrl:]]'),
  titre        text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300 AND titre !~ '[[:cntrl:]]'),
  resume       text CHECK (resume IS NULL OR (source IN ('cnil', 'cepd', 'eur-lex')
                 AND char_length(resume) BETWEEN 1 AND 1000 AND resume !~ '[[:cntrl:]]')),
  lien         text NOT NULL CHECK (char_length(lien) <= 500 AND lien !~ '[[:space:]<>"]' AND (
                 (source = 'cnil' AND lien ~ '^https://www\.cnil\.fr/')
                 OR (source = 'cepd' AND lien ~ '^https://www\.edpb\.europa\.eu/')
                 OR (source = 'eur-lex' AND lien ~ '^https://eur-lex\.europa\.eu/')
                 OR (source = 'anssi' AND lien ~ '^https://cyber\.gouv\.fr/'))),
  publie_le    timestamptz NOT NULL,
  collecte_le  timestamptz NOT NULL DEFAULT now(),
  maj_le       timestamptz NOT NULL DEFAULT now(),
  statut       text NOT NULL DEFAULT 'a-qualifier' CHECK (statut IN ('a-qualifier', 'sans-objet', 'a-suivre', 'impactant')),
  qualifie_le  timestamptz,
  qualifie_par uuid REFERENCES users(id) ON DELETE SET NULL,
  version      integer NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (source, identifiant),
  CHECK ((statut = 'a-qualifier') = (qualifie_le IS NULL)),
  CHECK (qualifie_le IS NOT NULL OR qualifie_par IS NULL)
);
CREATE INDEX veille_reglementaire_publications_date ON veille_reglementaire_publications (publie_le DESC, id DESC);
CREATE INDEX veille_reglementaire_publications_statut ON veille_reglementaire_publications (domaine, statut);
