-- Module Vulnérabilités (ADR 0100, lot AD-1 ; décisions du RSSI du 20/11/2026) : import du rapport d'analyse de l'Active
-- Directory (service ADS de l'ANSSI, à partir d'une collecte ORADAD). Le rapport JSON est lu dans le navigateur ; l'API reçoit
-- un extrait en liste blanche, en une requête, revalidé champ par champ (packages/shared/src/import-ads.ts).
-- Migration additive : tables nouvelles seulement, aucune table existante modifiée, aucune donnée reprise (consigne du
-- 14/11/2026). Aucun droit nouveau : les noms se lisent avec `vulnerabilites:lire` (droit « Analyste » branché sur l'accès
-- au module, décision du RSSI du 20/11/2026), par une route à part dont chaque appel est tracé.
-- Noms des objets (protections décidées par le RSSI) : seul le nom affichable court et la nature d'un objet sont rangés,
-- bornés (64 caractères, 200 noms par point, le surplus compté) ; jamais un SID, un chemin LDAP, un « domaine\nom », un mot
-- de passe, une empreinte ni un attribut de compte. Seuls les deux derniers imports gardent leurs noms : l'API efface ceux
-- des imports plus anciens à chaque import (noms_conserves passe à faux, les nombres restent). Les noms restent en clair
-- dans la base et dans ses sauvegardes (limite écrite dans l'ADR 0100, addendum AD-1).
-- Remise à vide (apps/api/src/remise-a-vide.ts) : les trois tables avec le travail.

-- Un import : synthèse du rapport (date sans heure, note globale de 1 à 5, progression par niveau, total des conformes),
-- nombres et éléments écartés. Ni nom de fichier, ni nom de domaine.
CREATE TABLE vulnerabilites_ad_imports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero         integer NOT NULL UNIQUE CHECK (numero > 0),
  date_rapport   date,
  note           smallint NOT NULL CHECK (note BETWEEN 1 AND 5),
  progression    jsonb NOT NULL CHECK (jsonb_typeof(progression) = 'array' AND jsonb_array_length(progression) <= 5
                   AND octet_length(progression::text) <= 2048),
  conformes      integer CHECK (conformes IS NULL OR conformes >= 0),
  points         integer NOT NULL CHECK (points BETWEEN 0 AND 300),
  objets         bigint NOT NULL CHECK (objets >= 0),
  ecartes        jsonb NOT NULL CHECK (jsonb_typeof(ecartes) = 'object' AND octet_length(ecartes::text) <= 1024),
  noms_conserves boolean NOT NULL DEFAULT true,
  version        integer NOT NULL DEFAULT 1 CHECK (version > 0),
  importe_par    text NOT NULL CHECK (char_length(importe_par) BETWEEN 1 AND 200),
  importe_le     timestamptz NOT NULL DEFAULT now()
);

-- Points de contrôle non conformes d'un import (les conformes ne sont pas listés par le rapport). Type gardé en numéro :
-- 1 information, 2 avertissement, 3 vulnérabilité.
CREATE TABLE vulnerabilites_ad_points (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id   uuid NOT NULL REFERENCES vulnerabilites_ad_imports(id) ON DELETE CASCADE,
  identifiant text NOT NULL CHECK (identifiant ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$'),
  reference   text NOT NULL CHECK (char_length(reference) BETWEEN 1 AND 64 AND reference !~ '[[:cntrl:]]'),
  type        smallint NOT NULL CHECK (type BETWEEN 1 AND 3),
  niveau      smallint NOT NULL CHECK (niveau BETWEEN 1 AND 5),
  titre       text NOT NULL CHECK (char_length(titre) BETWEEN 1 AND 200 AND titre !~ '[[:cntrl:]]'),
  objets      integer NOT NULL CHECK (objets >= 0),
  UNIQUE (import_id, identifiant)
);

-- Objets nommés d'un point : nom affichable court et nature, jamais un SID ni un chemin LDAP. Effacés pour les imports
-- plus anciens que les deux derniers.
CREATE TABLE vulnerabilites_ad_objets (
  point_id uuid NOT NULL REFERENCES vulnerabilites_ad_points(id) ON DELETE CASCADE,
  rang     smallint NOT NULL CHECK (rang BETWEEN 0 AND 199),
  nom      text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 64 AND nom !~ '[[:cntrl:]]'
             AND nom !~* '^S-1-[0-9]+(-[0-9]+)+$' AND nom !~* '(^|,)\s*(CN|OU|DC|O)\s*=' AND strpos(nom, E'\\') = 0),
  nature   text NOT NULL CHECK (nature IN ('utilisateur', 'service', 'groupe', 'ordinateur', 'controleur', 'gpo',
             'approbation', 'autre')),
  PRIMARY KEY (point_id, rang)
);
