-- Module Vulnérabilités (ADR 0100, lot SI1 ; décisions du RSSI du 19/11/2026) : import du rapport Silène de l'ANSSI (surface
-- exposée sur Internet, export JSON) déposé dans la carte « Intégrations » (connecteur « silene-fichier », sans adresse, sans
-- clé, sans flux, sans exécutant). Le fichier est lu dans le navigateur ; l'API reçoit un extrait en liste blanche, en JSON,
-- par lots (début, lots d'hôtes et de constats, fin), revalidé champ par champ (packages/shared/src/import-silene.ts).
-- Migration additive : tables nouvelles seulement, aucune table existante modifiée, aucune donnée reprise (consigne du
-- 14/11/2026). La contrainte de fréquence (migration 090) n'admet que NULL pour ce type : inchangée.
-- Jamais rangés : certificats et clés, en-têtes HTTP, sorties brutes des sondes, titres de pages, géolocalisation et système
-- autonome, nom de la base et filtre du rapport, passage précédent (`_prev`), nom du fichier.
-- Présence : comme pour AlgoLightHouse (080), chaque élément garde le numéro du dernier import qui l'a vu ; un import complet
-- fait avancer le numéro de référence (un import est l'état complet de la surface vue par Silène à la date du rapport :
-- ce qui n'y figure plus n'est plus présent). Rien n'est supprimé quand un élément disparaît : il n'est plus listé.
-- Droits (même logique que la surface externe d'AlgoLightHouse) : tout ce qu'une instance a importé hérite du périmètre de la
-- plateforme relié à l'instance (vulnerabilites_silene_perimetres, écran « Périmètres » du module) ; non reliée, elle n'est
-- lisible qu'avec vulnerabilites:administrer.
-- Bornes et formes alignées sur AlgoLightHouse (080, 085) : adresse `^[0-9a-f:.]+$` (45 caractères), noms de domaine en
-- minuscules, textes sans caractère de contrôle, port de 1 à 65535, protocole tcp ou udp.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : journal des imports (avec les notes) et état des numéros avec les
-- instances (portée « tout ») ; hôtes, noms, ports, produits, constats, lignes et liaison du périmètre avec le travail.

-- État des imports d'une instance : dernier numéro attribué, numéro du dernier import complet (qui fait foi).
CREATE TABLE vulnerabilites_silene_etat (
  integration_id uuid PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  numero         integer NOT NULL DEFAULT 0 CHECK (numero >= 0),
  numero_complet integer NOT NULL DEFAULT 0 CHECK (numero_complet >= 0 AND numero_complet <= numero),
  complete_le    timestamptz
);

-- Journal des imports (une ligne par exécution « importer ») et note du rapport : synthèse (note, sous-note réseau, nombres
-- par famille, dates du rapport sans fuseau), périmètre déclaré, nombres annoncés et reçus, éléments écartés. Gardé d'un
-- import à l'autre : la note des imports complets fait la tendance. Ni adresse d'hôte, ni nom de fichier.
CREATE TABLE vulnerabilites_silene_imports (
  execution_id       uuid PRIMARY KEY REFERENCES integration_executions(id) ON DELETE CASCADE,
  integration_id     uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  numero             integer NOT NULL CHECK (numero > 0),
  date_rapport       date,
  debut_rapport      text CHECK (debut_rapport IS NULL OR debut_rapport ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'),
  fin_rapport        text CHECK (fin_rapport IS NULL OR fin_rapport ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'),
  note               numeric(11,4) CHECK (note IS NULL OR note BETWEEN -1000000 AND 1000000),
  note_reseau        numeric(11,4) CHECK (note_reseau IS NULL OR note_reseau BETWEEN -1000000 AND 1000000),
  vulnreco           integer CHECK (vulnreco IS NULL OR vulnreco >= 0),
  warning            integer CHECK (warning IS NULL OR warning >= 0),
  info               integer CHECK (info IS NULL OR info >= 0),
  ok                 integer CHECK (ok IS NULL OR ok >= 0),
  perimetre_domaines text[] NOT NULL DEFAULT '{}' CHECK (cardinality(perimetre_domaines) <= 5000),
  perimetre_plages   text[] NOT NULL DEFAULT '{}' CHECK (cardinality(perimetre_plages) <= 5000),
  hotes_annonces     integer NOT NULL CHECK (hotes_annonces BETWEEN 0 AND 20000),
  constats_annonces  integer NOT NULL CHECK (constats_annonces BETWEEN 0 AND 5000),
  ecartes            jsonb NOT NULL CHECK (jsonb_typeof(ecartes) = 'object' AND octet_length(ecartes::text) <= 2048),
  lots               integer NOT NULL DEFAULT 0 CHECK (lots BETWEEN 0 AND 1000),
  hotes              integer NOT NULL DEFAULT 0 CHECK (hotes BETWEEN 0 AND 20000),
  constats           integer NOT NULL DEFAULT 0 CHECK (constats BETWEEN 0 AND 5000),
  hotes_disparus     integer NOT NULL DEFAULT 0 CHECK (hotes_disparus >= 0),
  constats_disparus  integer NOT NULL DEFAULT 0 CHECK (constats_disparus >= 0),
  complet            boolean NOT NULL DEFAULT false,
  maj_le             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, numero)
);
CREATE INDEX vulnerabilites_silene_imports_instance ON vulnerabilites_silene_imports (integration_id, numero DESC);

-- Périmètre de la plateforme relié à une instance (absent ou NULL : non reliée, lisible avec administrer seulement).
-- `version` ne change qu'avec la liaison (If-Match) ; un import ne la touche pas.
CREATE TABLE vulnerabilites_silene_perimetres (
  integration_id uuid PRIMARY KEY REFERENCES integrations(id) ON DELETE CASCADE,
  perimetre_id   uuid REFERENCES grc_smsis(id) ON DELETE SET NULL,
  version        integer NOT NULL DEFAULT 1 CHECK (version > 0),
  maj_le         timestamptz NOT NULL DEFAULT now(),
  maj_par        text
);
CREATE INDEX vulnerabilites_silene_perimetres_perimetre ON vulnerabilites_silene_perimetres (perimetre_id);

-- Hôtes : un par instance et par adresse ; contrôles qui le concernent (`categories`) et nombre de ports ouverts annoncé.
CREATE TABLE vulnerabilites_silene_hotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  adresse        text NOT NULL CHECK (char_length(adresse) BETWEEN 2 AND 45 AND adresse ~ '^[0-9a-f:.]+$'),
  ports_ouverts  integer CHECK (ports_ouverts IS NULL OR ports_ouverts BETWEEN 0 AND 131070),
  controles      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(controles) <= 100),
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, adresse)
);
CREATE INDEX vulnerabilites_silene_hotes_adresse ON vulnerabilites_silene_hotes (adresse);

-- Noms d'un hôte (nom de domaine en minuscules et type), remplacés à chaque import qui le revoit.
CREATE TABLE vulnerabilites_silene_noms (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hote_id uuid NOT NULL REFERENCES vulnerabilites_silene_hotes(id) ON DELETE CASCADE,
  nom     text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 253 AND nom ~ '^[a-z0-9_*:.-]+$'),
  type    text NOT NULL CHECK (type IN ('A', 'PTR', 'cert-san-dns', 'cert-subject-cn')),
  UNIQUE (hote_id, nom, type)
);
CREATE INDEX vulnerabilites_silene_noms_nom ON vulnerabilites_silene_noms (nom);

-- Ports ouverts d'un hôte (port, protocole, service, produit, tunnel), remplacés à chaque import qui le revoit.
CREATE TABLE vulnerabilites_silene_ports (
  hote_id   uuid NOT NULL REFERENCES vulnerabilites_silene_hotes(id) ON DELETE CASCADE,
  port      integer NOT NULL CHECK (port BETWEEN 1 AND 65535),
  protocole text NOT NULL CHECK (protocole IN ('tcp', 'udp')),
  service   text CHECK (service IS NULL OR (char_length(service) BETWEEN 1 AND 100 AND service !~ '[[:cntrl:]]')),
  produit   text CHECK (produit IS NULL OR (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:]]')),
  tunnel    text CHECK (tunnel IS NULL OR (char_length(tunnel) BETWEEN 1 AND 100 AND tunnel !~ '[[:cntrl:]]')),
  PRIMARY KEY (hote_id, port, protocole)
);

-- Produits vus sur un hôte (CPE : type, éditeur, produit, version), remplacés à chaque import qui le revoit.
CREATE TABLE vulnerabilites_silene_produits (
  hote_id uuid NOT NULL REFERENCES vulnerabilites_silene_hotes(id) ON DELETE CASCADE,
  rang    integer NOT NULL CHECK (rang BETWEEN 0 AND 199),
  type    text NOT NULL CHECK (type IN ('a', 'o', 'h')),
  editeur text NOT NULL CHECK (char_length(editeur) BETWEEN 1 AND 100 AND editeur !~ '[[:cntrl:]]'),
  produit text NOT NULL CHECK (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:]]'),
  version text CHECK (version IS NULL OR (char_length(version) BETWEEN 1 AND 100 AND version !~ '[[:cntrl:]]')),
  PRIMARY KEY (hote_id, rang)
);

-- Constats : un par instance et par identifiant ; contrôle qui le cite, classe (entier borné, sens non connu), points et
-- note du réseau.
CREATE TABLE vulnerabilites_silene_constats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  identifiant    text NOT NULL CHECK (identifiant ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$'),
  controle       text NOT NULL CHECK (controle ~ '^[A-Za-z][A-Za-z0-9]{0,63}$'),
  classe         integer NOT NULL CHECK (classe BETWEEN -1000 AND 1000),
  points         numeric(11,4) CHECK (points IS NULL OR points BETWEEN -1000000 AND 1000000),
  note           numeric(11,4) CHECK (note IS NULL OR note BETWEEN -1000000 AND 1000000),
  vu_numero      integer NOT NULL CHECK (vu_numero > 0),
  vu_le          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, identifiant)
);
CREATE INDEX vulnerabilites_silene_constats_controle ON vulnerabilites_silene_constats (integration_id, controle);

-- Hôtes concernés par un constat (`applicable_hosts`), remplacés à chaque import qui le revoit.
CREATE TABLE vulnerabilites_silene_constat_hotes (
  constat_id uuid NOT NULL REFERENCES vulnerabilites_silene_constats(id) ON DELETE CASCADE,
  adresse    text NOT NULL CHECK (char_length(adresse) BETWEEN 2 AND 45 AND adresse ~ '^[0-9a-f:.]+$'),
  PRIMARY KEY (constat_id, adresse)
);
CREATE INDEX vulnerabilites_silene_constat_hotes_adresse ON vulnerabilites_silene_constat_hotes (adresse);

-- Lignes du détail d'un constat (`listing`), par hôte : port, protocole, service, produit, nom d'hôte, type, échéance (sans
-- fuseau). Jamais le sujet ni les noms d'un certificat. Remplacées à chaque import qui revoit le constat.
CREATE TABLE vulnerabilites_silene_lignes (
  constat_id uuid NOT NULL REFERENCES vulnerabilites_silene_constats(id) ON DELETE CASCADE,
  rang       integer NOT NULL CHECK (rang BETWEEN 0 AND 4999),
  adresse    text NOT NULL CHECK (char_length(adresse) BETWEEN 2 AND 45 AND adresse ~ '^[0-9a-f:.]+$'),
  port       integer CHECK (port IS NULL OR port BETWEEN 1 AND 65535),
  protocole  text CHECK (protocole IS NULL OR protocole IN ('tcp', 'udp')),
  service    text CHECK (service IS NULL OR (char_length(service) BETWEEN 1 AND 100 AND service !~ '[[:cntrl:]]')),
  produit    text CHECK (produit IS NULL OR (char_length(produit) BETWEEN 1 AND 100 AND produit !~ '[[:cntrl:]]')),
  nom_hote   text CHECK (nom_hote IS NULL OR (char_length(nom_hote) BETWEEN 1 AND 253 AND nom_hote ~ '^[a-z0-9_*:.-]+$')),
  type       text CHECK (type IS NULL OR (char_length(type) BETWEEN 1 AND 100 AND type !~ '[[:cntrl:]]')),
  echeance   text CHECK (echeance IS NULL OR echeance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}$'),
  PRIMARY KEY (constat_id, rang)
);
