-- Assistant RSSI intégré (ADR 0086) : accès par défaut élargi, à la demande du RSSI (12/11/2026). Un profil lit par défaut
-- TOUS les périmètres (y compris ceux créés plus tard) et les documents de toute classification. L'assistant ne lit toujours
-- que ce que la personne (ou le référent de la ronde) peut lire elle-même, et reste inactif tant qu'il n'est pas réglé.
-- Migration additive et rejouable ; les profils déjà réglés à la main (périmètres choisis ou profil activé) ne sont pas
-- modifiés, à ceci près qu'ils gardent leur liste : « tous les périmètres » ne leur est pas appliqué.
ALTER TABLE assistant_profils ADD COLUMN IF NOT EXISTS tous_perimetres boolean NOT NULL DEFAULT true;
ALTER TABLE assistant_profils ALTER COLUMN actif SET DEFAULT true;
ALTER TABLE assistant_profils ALTER COLUMN documents SET DEFAULT true;
ALTER TABLE assistant_profils ALTER COLUMN classification_max SET DEFAULT 'confidentiel';
-- Profils déjà réglés : ils conservent leur liste explicite.
UPDATE assistant_profils SET tous_perimetres = false WHERE actif OR perimetres <> '{}';
-- Profils jamais réglés : nouveaux réglages par défaut.
UPDATE assistant_profils SET actif = true, documents = true, classification_max = 'confidentiel'
 WHERE tous_perimetres AND NOT actif AND perimetres = '{}';
