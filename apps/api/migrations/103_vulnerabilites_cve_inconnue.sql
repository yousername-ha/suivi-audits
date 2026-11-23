-- Module Vulnérabilités (ADR 0100, lot CVE-INC ; décisions du RSSI des 19, 20 et 22/11/2026) : CVE inconnue de la veille
-- (consultation de cve.org et NVD sur clic, contrôles Tenable Security Center à l'ouverture de la fiche) et deux sources
-- facultatives de la veille (préavis des CVE de Cloudflare Radar, résumés de tldrcve), désactivées au départ.
-- Migration additive : six tables nouvelles, vides ; aucune table existante modifiée, aucune donnée reprise (consigne du
-- 14/11/2026). Rien ne sort tant que le flux « veille-vulnerabilites » (ADR 0097) est fermé ; la recherche Security Center
-- suit le flux de l'intégration Tenable. Données publiques recalculables : la remise à vide les efface avec le travail.
-- Les bornes recopient CVE_INCONNUE_BORNES (packages/shared/src/cve-inconnue.ts) et ANNONCES_BORNES (annonces-veille.ts).

-- Consultation de cve.org et NVD pour une CVE, sur le clic d'une personne : à la fois la file (en_file, en_cours) et le
-- résultat gardé (une ligne par CVE). L'API inscrit, l'exécutant réclame (« suivi cve-inconnue-claim ») puis clôt
-- (« suivi cve-inconnue-finish »). `jeton` : identifiant de la demande remise, seul accepté à la clôture. `cveorg` : la
-- fiche gardée de cve.org (liste blanche, revalidée par l'API) ; la réponse de NVD est rangée dans la veille
-- (vulnerabilites_veille_cve), comme une collecte NVD. Une CVE n'est pas redemandée moins de 24 heures après une réponse.
-- Borne de `cveorg` : CVE_INCONNUE_BORNES.ficheOctets (une fiche valide en fait environ 140 000 au plus, 138 307 relevés).
CREATE TABLE vulnerabilites_cve_consultations (
  cve          text PRIMARY KEY CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  etat         text NOT NULL CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec')),
  jeton        uuid NOT NULL DEFAULT gen_random_uuid(),
  demande_le   timestamptz NOT NULL DEFAULT now(),
  debute_le    timestamptz,
  termine_le   timestamptz,
  erreur       text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  cveorg       jsonb CHECK (cveorg IS NULL OR (jsonb_typeof(cveorg) = 'object' AND octet_length(cveorg::text) <= 262144)),
  cveorg_etat  text CHECK (cveorg_etat IS NULL OR cveorg_etat IN ('trouvee', 'absente', 'echec')),
  nvd_etat     text CHECK (nvd_etat IS NULL OR nvd_etat IN ('trouvee', 'absente', 'echec')),
  obtenu_le    timestamptz,
  CHECK ((etat IN ('recu', 'echec')) = (termine_le IS NOT NULL)),
  CHECK ((etat = 'echec') = (erreur IS NOT NULL)),
  CHECK (etat <> 'en_cours' OR debute_le IS NOT NULL),
  CHECK ((cveorg IS NOT NULL) = (cveorg_etat IS NOT DISTINCT FROM 'trouvee'))
);
CREATE INDEX vulnerabilites_cve_consultations_file ON vulnerabilites_cve_consultations (demande_le) WHERE etat = 'en_file';

-- Fiche d'une CVE inconnue ouverte (une seule ligne, aucune personne désignée) : l'exécutant reste en veille active deux
-- minutes, pour qu'un clic parte en quelques secondes (témoin du poller, ADR 0097, addendum du 22/11/2026).
CREATE TABLE vulnerabilites_cve_ouverture (
  id      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  vue_le  timestamptz
);

-- Contrôles Tenable Security Center qui citent une CVE inconnue, par instance : file et résultat (une ligne par instance et
-- par CVE). Lecture seule de `GET /rest/plugin` par l'exécutant (« suivi cve-tenable-claim | -finish ») ; numéro, nom,
-- famille, exploit disponible et facteur de risque seulement (aucune donnée de machine). 50 contrôles au plus.
CREATE TABLE vulnerabilites_cve_tenable (
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  cve            text NOT NULL CHECK (cve ~ '^CVE-[12][0-9]{3}-[0-9]{4,9}$'),
  etat           text NOT NULL CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec')),
  jeton          uuid NOT NULL DEFAULT gen_random_uuid(),
  demande_le     timestamptz NOT NULL DEFAULT now(),
  debute_le      timestamptz,
  termine_le     timestamptz,
  erreur         text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  controles      jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(controles) = 'array' AND jsonb_array_length(controles) <= 50),
  tronque        boolean NOT NULL DEFAULT false,
  obtenu_le      timestamptz,
  PRIMARY KEY (integration_id, cve),
  CHECK ((etat IN ('recu', 'echec')) = (termine_le IS NOT NULL)),
  CHECK ((etat = 'echec') = (erreur IS NOT NULL)),
  CHECK (etat <> 'en_cours' OR debute_le IS NOT NULL)
);
CREATE INDEX vulnerabilites_cve_tenable_file ON vulnerabilites_cve_tenable (demande_le) WHERE etat = 'en_file';
CREATE INDEX vulnerabilites_cve_tenable_cve ON vulnerabilites_cve_tenable (cve);

-- Sources facultatives de la veille (Cloudflare Radar, tldrcve) : activation (désactivées au départ), fréquence en minutes,
-- état de la dernière collecte. `planifiee_le` : référence de la dernière demande automatique (lot F1). `version` : If-Match.
CREATE TABLE vulnerabilites_veille_annonces_sources (
  source            text PRIMARY KEY CHECK (source IN ('cloudflare-radar', 'tldrcve')),
  activee           boolean NOT NULL DEFAULT false,
  frequence_minutes integer CHECK (frequence_minutes IS NULL OR (source = 'cloudflare-radar' AND frequence_minutes IN (15, 30, 60, 120, 360, 1440))
                      OR (source = 'tldrcve' AND frequence_minutes IN (720, 1440))),
  planifiee_le      timestamptz,
  derniere_reussite timestamptz,
  dernier_essai     timestamptz,
  erreur            text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  version           integer NOT NULL DEFAULT 1 CHECK (version > 0)
);

-- File et journal des collectes des sources facultatives (« suivi veille-annonces-claim | -lot | -finish »), sur le modèle
-- de la veille réglementaire (migration 098).
CREATE TABLE vulnerabilites_veille_annonces_collectes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL CHECK (source IN ('cloudflare-radar', 'tldrcve')),
  origine     text NOT NULL CHECK (origine IN ('manuel', 'planifie')),
  etat        text NOT NULL DEFAULT 'en_file' CHECK (etat IN ('en_file', 'en_cours', 'recu', 'echec', 'expire')),
  demande_par text NOT NULL,
  demande_le  timestamptz NOT NULL DEFAULT now(),
  debute_le   timestamptz,
  termine_le  timestamptz,
  lots        integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 40),
  elements    integer NOT NULL DEFAULT 0 CHECK (elements BETWEEN 0 AND 20000),
  gardes      integer NOT NULL DEFAULT 0 CHECK (gardes BETWEEN 0 AND 20000),
  ecartes     integer NOT NULL DEFAULT 0 CHECK (ecartes >= 0),
  tronque     boolean NOT NULL DEFAULT false,
  erreur      text CHECK (erreur IS NULL OR (char_length(erreur) BETWEEN 1 AND 300 AND erreur !~ '[[:cntrl:]]')),
  CHECK ((etat IN ('recu', 'echec', 'expire')) = (termine_le IS NOT NULL)),
  CHECK ((etat IN ('echec', 'expire')) = (erreur IS NOT NULL)),
  CHECK (etat NOT IN ('en_cours', 'recu') OR debute_le IS NOT NULL)
);
CREATE INDEX vulnerabilites_veille_annonces_collectes_file ON vulnerabilites_veille_annonces_collectes (demande_le) WHERE etat IN ('en_file', 'en_cours');
CREATE INDEX vulnerabilites_veille_annonces_collectes_source ON vulnerabilites_veille_annonces_collectes (source, demande_le DESC);

-- Annonces gardées : préavis de Cloudflare (CVE critique ou produit surveillé cité) et résumés de tldrcve. Textes simples
-- bornés, lien en https sur l'hôte de la source. Une ligne par (source, identifiant) : une collecte rejouée met à jour.
-- Aucune notification, aucune alerte, aucun effet sur la priorité ; les CVE citées n'entrent pas dans la veille.
CREATE TABLE vulnerabilites_veille_annonces (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source         text NOT NULL CHECK (source IN ('cloudflare-radar', 'tldrcve')),
  identifiant    text NOT NULL CHECK (char_length(identifiant) BETWEEN 1 AND 300 AND identifiant !~ '[[:cntrl:]]'),
  cves           text[] NOT NULL CHECK (cardinality(cves) BETWEEN 1 AND 20),
  titre          text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 300 AND titre !~ '[[:cntrl:]]'),
  resume         text NOT NULL DEFAULT '' CHECK (char_length(resume) <= 1000 AND resume !~ '[[:cntrl:]]'),
  lien           text CHECK (lien IS NULL OR (char_length(lien) <= 500 AND lien !~ '[[:space:]<>"]' AND (
                   (source = 'cloudflare-radar' AND lien ~ '^https://radar\.cloudflare\.com/')
                   OR (source = 'tldrcve' AND lien ~ '^https://tldrcve\.com/')))),
  publie_le      timestamptz,
  gravite        text CHECK (gravite IS NULL OR (source = 'cloudflare-radar' AND gravite IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))),
  score          numeric(3,1) CHECK (score IS NULL OR (source = 'cloudflare-radar' AND score BETWEEN 0 AND 10)),
  version_cvss   text CHECK (version_cvss IS NULL OR version_cvss ~ '^[234]\.[01]$'),
  kev            boolean,
  critique       boolean NOT NULL DEFAULT false,
  produits_cites text[] NOT NULL DEFAULT '{}' CHECK (cardinality(produits_cites) <= 10),
  nature         text CHECK (nature IS NULL OR (source = 'tldrcve' AND nature IN ('nouvelle', 'mise_a_jour'))),
  verdict        text CHECK (verdict IS NULL OR (source = 'tldrcve' AND verdict IN ('patch-now', 'patch-now-if', 'next-cycle', 'watching'))),
  verdict_texte  text CHECK (verdict_texte IS NULL OR (char_length(verdict_texte) BETWEEN 1 AND 200 AND verdict_texte !~ '[[:cntrl:]]')),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, identifiant),
  CHECK (source = 'tldrcve' OR cardinality(cves) = 1),
  CHECK (source <> 'tldrcve' OR lien IS NOT NULL),
  CHECK ((verdict IS NULL) = (verdict_texte IS NULL))
);
CREATE INDEX vulnerabilites_veille_annonces_date ON vulnerabilites_veille_annonces (source, publie_le DESC NULLS LAST, id);
CREATE INDEX vulnerabilites_veille_annonces_cves ON vulnerabilites_veille_annonces USING gin (cves);
