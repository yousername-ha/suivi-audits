/* Fiches longues en parties (refonte Neon compacte, 22/11/2026) : une fiche trop haute pour l'écran se lit en parties
   nommées, sans défilement vertical ; le formulaire, ses valeurs et ses boutons restent ceux de l'écran métier.
   Cas vérifiés sur la pile réelle : fiche de risque (sections déclarées), intitulés ni génériques ni répétés, aucun
   champ tronqué ou recouvert, bouton d'enregistrement visible dans chaque partie, champ d'une autre partie atteint
   directement, valeurs conservées, clavier, redimensionnement, et repli sur le défilement habituel d'une fenêtre dont
   un bloc ne peut pas être découpé. Aucune donnée créée : la fiche n'est pas enregistrée. */
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

test('Fiches en parties : risque découpé, nommé, navigable, sans champ tronqué ; repli sûr', async ({ browser }) => {
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
    // La fenêtre ne s'étire pas sur toute la hauteur disponible : sa hauteur suit le contenu.
    expect(depart.hauteur).toBeLessThan(Math.round(720 * 0.9));

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

    // Redimensionnement : sur un grand écran, moins de parties, toujours sans défaut, valeurs conservées.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect
      .poll(async () => (await etatFenetre(page)).parties.length)
      .toBeLessThanOrEqual(depart.parties.length - 1);
    const grand = await etatFenetre(page);
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

    // Repli : la fenêtre « Sécurité » contient des cartes qui ne se découpent pas. Qu'elle soit découpée ou non selon
    // la place, aucun champ n'y est tronqué ou recouvert et la case du poivre répond au clic.
    await page.goto('/systeme/securite');
    const securite = page.getByRole('dialog', { name: 'Sécurité' });
    await expect(securite.getByRole('heading', { name: 'Poivre des mots de passe' })).toBeAttached();
    const etatSecurite = await etatFenetre(page);
    expect(etatSecurite.defauts).toEqual([]);
    expect(etatSecurite.decoupee || etatSecurite.defileVerticalement).toBe(true);
    const coffre = securite.getByLabel('J’ai enregistré ce poivre dans le coffre-fort de l’organisation');
    await coffre.check();
    await expect(coffre).toBeChecked();
    await coffre.uncheck();

    expect(problems).toEqual([]);
  } finally {
    await ctx.close();
  }
});
