/* Fiches longues en parties (refonte Neon compacte et fiches sobres, 22/11/2026) : une fiche trop haute pour l'écran
   s'élargit d'abord (écran de bureau), puis se lit en parties nommées, sans défilement vertical ; le formulaire, ses
   valeurs et ses boutons restent ceux de l'écran métier.
   Cas vérifiés sur la pile réelle : fiche de risque (élargie, sections déclarées), intitulés ni génériques ni répétés,
   aucun champ tronqué ou recouvert, bouton d'enregistrement visible dans chaque partie, champ d'une autre partie
   atteint directement, valeurs conservées, clavier, redimensionnement (une seule vue sur un grand écran), fenêtre
   « Sécurité » sans champ tronqué, aide contextuelle d'un champ (repliée, associée au champ, ouverte, refermée par
   Échap sans fermer la fenêtre) et liste dynamique de la fiche d'un fournisseur. Aucune donnée créée : rien n'est
   enregistré. */
import { expect, test, type Page } from '@playwright/test';
import { sessionAdmin, watchPage } from '../helpers';

/** État de la fenêtre ouverte : découpage, intitulés, et champs de la partie affichée qui seraient tronqués, à cheval
    sur deux parties ou recouverts par un autre. */
async function etatFenetre(page: Page) {
  return page.evaluate(() => {
    const cadre = [...document.querySelectorAll<HTMLElement>('.mantine-Modal-content')].at(-1)!;
    const corps = cadre.querySelector<HTMLElement>(':scope > .mantine-Modal-body')!;
    const style = getComputedStyle(corps);
    const rc = cadre.getBoundingClientRect();
    const rb = corps.getBoundingClientRect();
    const decoupee = cadre.hasAttribute('data-fiche-paginee');
    const haut = rb.top + parseFloat(style.paddingTop) - 3;
    const bas = rb.bottom - parseFloat(style.paddingBottom) + 3;
    const pied = cadre.querySelector<HTMLElement>('[data-fiche-actions-fixes]');
    const visibles: { nom: string; r: DOMRect; e: HTMLElement }[] = [];
    const defauts: string[] = [];
    for (const e of corps.querySelectorAll<HTMLElement>(
      '.mantine-InputWrapper-root, .mantine-Button-root, .mantine-Checkbox-root, .mantine-Switch-root, summary',
    )) {
      if (pied?.contains(e)) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= rb.left || r.left >= rb.right) continue;
      const nom = (e.textContent ?? '').trim().slice(0, 40);
      if (decoupee && (r.top < haut || r.bottom > bas)) defauts.push(`tronqué : ${nom}`);
      if (decoupee && (r.left < rb.left - 3 || r.right > rb.right + 3)) defauts.push(`à cheval : ${nom}`);
      visibles.push({ nom, r, e });
    }
    for (const [i, a] of visibles.entries())
      for (const b of visibles.slice(i + 1))
        if (
          !a.e.contains(b.e) &&
          !b.e.contains(a.e) &&
          a.r.left < b.r.right - 3 &&
          b.r.left < a.r.right - 3 &&
          a.r.top < b.r.bottom - 3 &&
          b.r.top < a.r.bottom - 3
        )
          defauts.push(`recouvert : ${a.nom} / ${b.nom}`);
    return {
      decoupee,
      parties: [...cadre.querySelectorAll('.fiche-mini-menu button')].map((b) =>
        (b.textContent ?? '').replace(/^\d+/, '').trim(),
      ),
      courante: (cadre.querySelector('.fiche-mini-menu [aria-current="page"]')?.textContent ?? '')
        .replace(/^\d+/, '')
        .trim(),
      hauteur: Math.round(rc.height),
      largeur: Math.round(rc.width),
      etendue: cadre.hasAttribute('data-fiche-etendue'),
      repli: cadre.getAttribute('data-fiche-repli'),
      dansEcran: rc.top >= 0 && rc.bottom <= innerHeight + 1,
      defileVerticalement: corps.scrollHeight > corps.clientHeight + 2,
      alignee: decoupee
        ? Math.abs(
            corps.scrollLeft -
              Math.round(corps.scrollLeft / parseFloat(getComputedStyle(cadre).getPropertyValue('--fiche-pas'))) *
                parseFloat(getComputedStyle(cadre).getPropertyValue('--fiche-pas')),
          ) <= 1
        : true,
      defauts,
    };
  });
}

test('Fiches en parties : risque élargi, découpé, nommé, navigable ; aide d’un champ ; liste dynamique', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    viewport: { width: 1280, height: 720 },
    storageState: (await sessionAdmin(browser)).state,
  });
  const page = await ctx.newPage(),
    problems = watchPage(page);
  try {
    await page.goto('/pilotage/risques');
    await page.getByRole('button', { name: 'Ajouter un risque', exact: true }).click();
    const fiche = page.getByRole('dialog');
    const menu = fiche.getByRole('navigation', { name: 'Parties de la fiche' });
    await expect(menu.getByRole('button').first()).toBeVisible();

    // Intitulés : la première partie, la section déclarée « Analyse », rien de générique ni de répété.
    const depart = await etatFenetre(page);
    expect(depart.decoupee).toBe(true);
    // Écran de bureau : la fenêtre du formulaire s'est élargie avant d'être découpée.
    expect(depart.etendue).toBe(true);
    expect(depart.largeur).toBeGreaterThan(1000);
    expect(depart.parties.length).toBeGreaterThanOrEqual(2);
    expect(depart.parties[0]).toBe('Informations');
    expect(depart.parties).toContain('Analyse');
    expect(new Set(depart.parties).size).toBe(depart.parties.length);
    expect(depart.parties.filter((p) => /^Suite\b/i.test(p))).toEqual([]);

    // Chaque partie : fenêtre dans l'écran, aucun défilement vertical, aucun champ tronqué ni recouvert, bouton
    // d'enregistrement visible et dans la fenêtre.
    const enregistrer = fiche.getByRole('button', { name: 'Enregistrer la fiche', exact: true });
    for (const [i, nom] of depart.parties.entries()) {
      await menu.getByRole('button').nth(i).click();
      await expect(menu.getByRole('button').nth(i)).toHaveAttribute('aria-current', 'page');
      const etat = await etatFenetre(page);
      expect(etat.courante, `partie ${i + 1}`).toBe(nom);
      expect(etat.dansEcran, `partie « ${nom} » dans l’écran`).toBe(true);
      expect(etat.defileVerticalement, `partie « ${nom} » sans défilement vertical`).toBe(false);
      expect(etat.alignee, `partie « ${nom} » alignée`).toBe(true);
      expect(etat.defauts, `partie « ${nom} »`).toEqual([]);
      await expect(enregistrer).toBeInViewport({ ratio: 1 });
    }
    // La fenêtre reste dans la hauteur disponible (90 % de l'écran) : sa hauteur suit le contenu.
    expect(depart.hauteur).toBeLessThanOrEqual(Math.round(720 * 0.9));

    // Un champ d'une autre partie est atteint directement par son libellé : la fenêtre s'aligne sur sa partie.
    await menu.getByRole('button').first().click();
    await fiche.getByLabel('Menace', { exact: true }).fill('Menace fictive de recette');
    await expect(menu.getByRole('button', { name: /Analyse/ }).first()).toHaveAttribute('aria-current', 'page');
    expect((await etatFenetre(page)).alignee).toBe(true);
    await fiche.getByLabel('Nom de la fiche', { exact: true }).fill('Risque fictif de recette');
    await expect(menu.getByRole('button').first()).toHaveAttribute('aria-current', 'page');
    // Une liste déroulante d'une autre partie s'ouvre à sa place après l'alignement.
    await menu
      .getByRole('button', { name: /Analyse/ })
      .first()
      .click();
    await fiche.getByRole('combobox', { name: 'Responsable', exact: true }).click();
    await expect(menu.getByRole('button').first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('listbox').last()).toBeVisible();
    await page.keyboard.press('Escape');
    // Les valeurs saisies sont conservées d'une partie à l'autre (aucun champ démonté).
    await expect(fiche.getByLabel('Menace', { exact: true })).toHaveValue('Menace fictive de recette');
    await expect(fiche.getByLabel('Nom de la fiche', { exact: true })).toHaveValue('Risque fictif de recette');

    // Clavier : flèches, Début et Fin dans le menu des parties.
    await menu.getByRole('button').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(menu.getByRole('button').nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('button').nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByRole('button').last()).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Home');
    await expect(menu.getByRole('button').first()).toHaveAttribute('aria-current', 'page');

    // Redimensionnement : sur un grand écran, la fiche tient en une seule vue, sans menu de parties ni défilement,
    // toujours sans défaut, valeurs conservées.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(async () => (await etatFenetre(page)).parties.length).toBe(0);
    const grand = await etatFenetre(page);
    expect(grand.decoupee).toBe(false);
    expect(grand.dansEcran).toBe(true);
    expect(grand.defileVerticalement).toBe(false);
    expect(grand.defauts).toEqual([]);
    expect(new Set(grand.parties).size).toBe(grand.parties.length);
    await expect(fiche.getByLabel('Menace', { exact: true })).toHaveValue('Menace fictive de recette');
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => (await etatFenetre(page)).parties.length).toBe(depart.parties.length);

    // Fermeture puis réouverture : la fiche se rouvre sur sa première partie, sans rien d'enregistré.
    await fiche.getByRole('button', { name: 'Fermer la fiche de l’élément', exact: true }).click();
    await expect(fiche).toBeHidden();
    await page.getByRole('button', { name: 'Ajouter un risque', exact: true }).click();
    await expect(menu.getByRole('button').first()).toHaveAttribute('aria-current', 'page');
    await expect(fiche.getByLabel('Nom de la fiche', { exact: true })).toHaveValue('');
    await fiche.getByRole('button', { name: 'Fermer la fiche de l’élément', exact: true }).click();

    // Fenêtre « Sécurité » : de grandes cartes, qui se poursuivent d'une partie à l'autre. Aucun champ n'y est tronqué
    // ou recouvert, la fenêtre ne retombe pas sur le défilement et la case du poivre répond au clic.
    await page.goto('/systeme/securite');
    const securite = page.getByRole('dialog', { name: 'Sécurité' });
    await expect(securite.getByRole('heading', { name: 'Poivre des mots de passe' })).toBeAttached();
    const etatSecurite = await etatFenetre(page);
    expect(etatSecurite.defauts).toEqual([]);
    expect(etatSecurite.repli).toBeNull();
    expect(etatSecurite.decoupee).toBe(true);
    expect(etatSecurite.defileVerticalement).toBe(false);
    const coffre = securite.getByLabel('J’ai enregistré ce poivre dans le coffre-fort de l’organisation');
    await coffre.check();
    await expect(coffre).toBeChecked();
    await coffre.uncheck();

    // Aide contextuelle d'un champ : repliée dans une fiche, mais toujours associée au champ pour les lecteurs
    // d'écran ; le bouton l'ouvre sous le champ, Échap la referme sans fermer la fenêtre, la saisie est conservée.
    const fin = securite.getByLabel('Les 8 derniers caractères du poivre');
    const texteAide = securite.getByText('Recopiez-les depuis le coffre-fort pour prouver l’enregistrement.');
    await expect(texteAide).toBeHidden();
    await expect(fin).toHaveAccessibleDescription(/Recopiez-les depuis le coffre-fort/);
    await fin.fill('ABCD-EFGH');
    const aide = securite
      .locator('.mantine-InputWrapper-root', { has: fin })
      .getByRole('button', { name: 'Aide sur ce champ' });
    await expect(aide).toHaveAttribute('aria-expanded', 'false');
    await aide.focus();
    await page.keyboard.press('Enter');
    await expect(aide).toHaveAttribute('aria-expanded', 'true');
    await expect(texteAide).toBeVisible();
    await expect(fin).toHaveAccessibleDescription(/Recopiez-les depuis le coffre-fort/);
    expect((await etatFenetre(page)).defauts).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(texteAide).toBeHidden();
    await expect(aide).toHaveAttribute('aria-expanded', 'false');
    await expect(securite).toBeVisible();
    await expect(fin).toHaveValue('ABCD-EFGH');
    // L'erreur du champ, elle, reste affichée sans action.
    await expect(securite.getByText('Ne correspond pas à la fin du poivre.')).toBeVisible();
    await fin.fill('');

    // Liste dynamique : dans la fiche d'un fournisseur (créé par le parcours Pilotage), un certificat et trois
    // contrôles ajoutés s'affichent dans leur partie, sans champ tronqué ni recouvert ; rien n'est enregistré.
    await page.goto('/pilotage/fournisseurs');
    const ouvrir = page.getByRole('button', { name: /^Fiche du fournisseur / }).first();
    await expect(ouvrir, 'un fournisseur créé par le parcours Pilotage').toBeVisible();
    await ouvrir.click();
    const fournisseur = page.getByRole('dialog');
    await expect(fournisseur.getByText('Certificats', { exact: true })).toBeAttached();
    const avant = await fournisseur.locator('.mantine-InputWrapper-root').count();
    await fournisseur.getByRole('button', { name: 'Ajouter un certificat' }).click();
    for (let i = 0; i < 3; i++) await fournisseur.getByRole('button', { name: /Ajouter un contrôle/ }).click();
    await expect.poll(() => fournisseur.locator('.mantine-InputWrapper-root').count()).toBeGreaterThan(avant);
    const etatFournisseur = await etatFenetre(page);
    expect(etatFournisseur.repli).toBeNull();
    expect(etatFournisseur.dansEcran).toBe(true);
    for (let i = 0; i < Math.max(1, etatFournisseur.parties.length); i++) {
      if (etatFournisseur.parties.length) await fournisseur.locator('.fiche-mini-menu button').nth(i).click();
      const partie = await etatFenetre(page);
      expect(partie.defileVerticalement, `fournisseur, partie ${i + 1}`).toBe(false);
      expect(partie.defauts, `fournisseur, partie ${i + 1}`).toEqual([]);
    }
    await page.keyboard.press('Escape');

    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
