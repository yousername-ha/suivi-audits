-- Suivi des audits SMSI — préférences d'affichage par personne et écrans muraux (chantier 9 quater).

-- Préférences d'affichage (taille, densité, thème, colonnes des tableaux), appliquées sur tous les appareils.
ALTER TABLE users ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}';

-- Écrans muraux : affichage permanent en lecture seule (salle de réunion, bureau RSSI), sans compte nominatif.
-- Un administrateur crée l'écran et obtient un code d'activation à usage unique (24 h) ; l'appareil l'échange
-- contre un jeton de longue durée (cookie), limité à la vue /mur et révocable. Seules les empreintes sont stockées.
CREATE TABLE wall_screens (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  modules            text[] NOT NULL,
  activation_hash    bytea,
  activation_expires timestamptz,
  device_hash        bytea UNIQUE,
  activated_at       timestamptz,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  revoked_by         text,
  last_seen_at       timestamptz,
  last_ip            inet,
  version            integer NOT NULL DEFAULT 1,
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER wall_screens_notify AFTER INSERT OR UPDATE OR DELETE ON wall_screens
  FOR EACH ROW EXECUTE FUNCTION suivi_notify('wall_screens', 'id', 'version');
