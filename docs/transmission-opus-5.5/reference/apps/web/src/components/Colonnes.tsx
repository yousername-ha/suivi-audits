/* Colonnes des tableaux : par défaut, les colonnes secondaires apparaissent selon la largeur disponible
   (priorité 2 et 3, requêtes de conteneur) ; la personne peut choisir ses colonnes, mémorisées sur le serveur. */
import { Button, Checkbox, Menu } from '@mantine/core';
import { usePreferences } from '../session';

export interface Colonne {
  cle: string;
  libelle: string;
  /** 1 : toujours affichée ; 2 : tablette et plus ; 3 : grands écrans. */
  priorite: 1 | 2 | 3;
  /** Colonne principale : ne peut pas être masquée. */
  fixe?: boolean;
}

export function useColonnes(tableau: string, colonnes: Colonne[]) {
  const { prefs, save } = usePreferences();
  const choix = prefs.colonnes[tableau];
  const cls = (cle: string) => {
    const c = colonnes.find((x) => x.cle === cle);
    if (!c) return undefined;
    if (choix && !c.fixe) return choix.includes(cle) ? 'col-choisie' : 'col-masquee';
    return c.priorite === 1 ? undefined : `col-p${c.priorite}`;
  };
  const enregistrer = (liste: string[] | null) => {
    const next = { ...prefs.colonnes };
    if (liste) next[tableau] = liste;
    else delete next[tableau];
    void save({ colonnes: next });
  };
  const selecteur = (
    <Menu closeOnItemClick={false} position="bottom-end" withinPortal>
      <Menu.Target>
        <Button variant="default" size="xs">
          Colonnes
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Colonnes affichées</Menu.Label>
        {colonnes
          .filter((c) => !c.fixe)
          .map((c) => {
            const visible = choix ? choix.includes(c.cle) : c.priorite === 1;
            return (
              <Menu.Item key={c.cle}>
                <Checkbox
                  label={c.libelle}
                  checked={visible}
                  onChange={(e) => {
                    const base = choix ?? colonnes.filter((x) => !x.fixe && x.priorite === 1).map((x) => x.cle);
                    enregistrer(
                      e.currentTarget.checked ? [...new Set([...base, c.cle])] : base.filter((k) => k !== c.cle),
                    );
                  }}
                />
              </Menu.Item>
            );
          })}
        <Menu.Divider />
        <Menu.Item onClick={() => enregistrer(null)} disabled={!choix}>
          Automatique (selon la largeur de l’écran)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
  return { cls, selecteur };
}
