-- Contacts de crise issus des comptes de la plateforme (ADR 0105 ; décision du RSSI du 18/11/2026) : un administrateur
-- (administration:administrer) marque un compte comme contact de crise, avec son rôle de crise, deux téléphones, sa
-- disponibilité, la case « contact clé » (priorité dans la cellule de crise) et les périmètres couverts (tous, ou une liste
-- choisie) ; la personne met à jour elle-même ses téléphones et sa disponibilité (Mon compte), rien d'autre. Une ligne par
-- compte contact de crise : l'absence de ligne vaut « pas contact de crise ». La ligne suit le compte (suppression en
-- cascade) ; seuls les comptes actifs (ni désactivés ni expirés) sont montrés, par un calcul fait à chaque lecture.
-- Périmètres : identifiants de grc_smsis en tableau, sans clé étrangère (existence contrôlée par l'API à l'écriture ; un
-- périmètre supprimé ensuite ne se lit plus et le contact n'y apparaît plus).
-- Longueurs : celles des contacts de crise saisis à la main (ContactModification, packages/shared/src/suivi-crise.ts).
-- Concurrence : version et If-Match, comme les comptes. Journal : noms des champs modifiés, jamais les numéros.
-- Temps réel : déclencheur suivi_notify sur l'entité « users » (identifiant du compte seulement, aucun numéro), reçu par qui
-- lit l'administration, comme les rôles et les groupes d'un compte (003).
-- Migration additive, aucune donnée reprise (consigne du 14/11/2026) : une table nouvelle, aucune table existante modifiée,
-- aucun compte n'est contact de crise au départ.
-- Remise à vide (apps/api/src/remise-a-vide.ts) : avec la configuration, comme les comptes qu'elle complète.

CREATE TABLE contacts_crise_comptes (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_crise      text NOT NULL DEFAULT '' CHECK (char_length(role_crise) <= 200),
  telephone       text NOT NULL DEFAULT '' CHECK (char_length(telephone) <= 100),
  telephone2      text NOT NULL DEFAULT '' CHECK (char_length(telephone2) <= 100),
  disponibilite   text NOT NULL DEFAULT '' CHECK (char_length(disponibilite) <= 200),
  cle             boolean NOT NULL DEFAULT false,
  tous_perimetres boolean NOT NULL DEFAULT true,
  perimetres      uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(perimetres) <= 200),
  mis_a_jour      timestamptz NOT NULL DEFAULT now(),
  updated_by      text NOT NULL DEFAULT '',
  version         integer NOT NULL DEFAULT 1 CHECK (version > 0),
  -- Une liste choisie n'est jamais vide : sinon le compte ne serait contact de crise nulle part.
  CHECK (tous_perimetres OR cardinality(perimetres) > 0)
);

CREATE TRIGGER contacts_crise_comptes_notify AFTER INSERT OR UPDATE OR DELETE ON contacts_crise_comptes
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('users', 'user_id', '');
