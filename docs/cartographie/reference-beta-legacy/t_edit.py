import sys, asyncio
from playwright.async_api import async_playwright
URL=sys.argv[1];OUT=sys.argv[2]
async def cnt(pg,sel): return await pg.evaluate(f"()=>document.querySelectorAll('{sel}').length")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        pg=await (await b.new_context(viewport={'width':1600,'height':950})).new_page();errs=[]
        pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL);await pg.wait_for_timeout(1200)
        await pg.click('[data-act="nav"][data-sec="carto"]');await pg.wait_for_timeout(300)
        await pg.click('[data-mb="view"][data-v="process"]');await pg.wait_for_timeout(300)
        await pg.click('.mb-empty [data-mb="wizard"]');await pg.click('#mbDlg button[value="go"]');await pg.wait_for_timeout(500)
        n0=await cnt(pg,'#mbVp [data-n]');e0=await cnt(pg,'#mbVp [data-e]');print('nodes',n0,'edges',e0)
        await pg.click('[data-mb="edit"]');await pg.wait_for_timeout(200)
        # liaison PRM01 -> PRS02
        await pg.click('[data-mb="link"]');await pg.wait_for_timeout(200)
        await pg.click('#mbVp [data-n="process:PRM01"]',position={'x':20,'y':20});await pg.wait_for_timeout(200)
        await pg.click('#mbVp [data-n="process:PRS02"]',position={'x':20,'y':20});await pg.wait_for_timeout(300)
        await pg.select_option('#mbDlg select[name="type"]','depends_on');await pg.click('#mbDlg button[value="go"]');await pg.wait_for_timeout(300)
        print('edges after link',await cnt(pg,'#mbVp [data-e]'),'insp edge',await pg.evaluate("()=>document.querySelector('#mbInsp h4')?.textContent"))
        # retirer un noeud avec Suppr
        await pg.click('#mbVp [data-n="process:PRR02"]',position={'x':20,'y':20});await pg.wait_for_timeout(200)
        await pg.keyboard.press('Delete');await pg.wait_for_timeout(300)
        print('nodes after delete',await cnt(pg,'#mbVp [data-n]'))
        await pg.keyboard.press('Control+z');await pg.wait_for_timeout(300)
        print('nodes after undo',await cnt(pg,'#mbVp [data-n]'))
        await pg.keyboard.press('Control+y');await pg.wait_for_timeout(300)
        print('nodes after redo',await cnt(pg,'#mbVp [data-n]'))
        # ajouter depuis la plateforme
        await pg.click('[data-mb="add"]');await pg.wait_for_timeout(300)
        print('add list',await cnt(pg,'#mbDlg .mb-addl label'))
        await pg.fill('#mbDlg [data-filter]','support');await pg.wait_for_timeout(100)
        print('visible after filter',await pg.evaluate("()=>[...document.querySelectorAll('#mbDlg .mb-addl label')].filter(l=>!l.hidden).length"))
        await pg.check('#mbDlg .mb-addl input');await pg.click('#mbDlg button[value="go"]');await pg.wait_for_timeout(300)
        print('nodes after add',await cnt(pg,'#mbVp [data-n]'))
        # valider une proposition
        await pg.click('#mbVp [data-e^="m:"]',position=None) if False else None
        await pg.click('[data-mb="save"]');await pg.wait_for_timeout(200)
        # version
        await pg.click('[data-mb="versions"]');await pg.wait_for_timeout(200)
        await pg.fill('#mbDlg input[name="label"]','Test COPIL');await pg.click('#mbDlg button[value="new"]');await pg.wait_for_timeout(300)
        await pg.click('[data-mb="versions"]');await pg.wait_for_timeout(200)
        print('versions listed',await cnt(pg,'#mbDlg input[name="sel"]'));await pg.keyboard.press('Escape')
        await pg.click('[data-mb="edit"]');await pg.wait_for_timeout(300)
        # recherche
        await pg.fill('#mbQ','achat');await pg.wait_for_timeout(200);print('search',await pg.evaluate("()=>document.querySelector('#mbQn').textContent"))
        await pg.keyboard.press('Enter');await pg.wait_for_timeout(200)
        await pg.screenshot(path=OUT+'_edit.png')
        # lecture seule
        await pg.goto(URL+'?lecture');await pg.wait_for_timeout(1200)
        await pg.click('[data-act="nav"][data-sec="carto"]');await pg.wait_for_timeout(400)
        print('RO buttons edit/wizard/save',await cnt(pg,'[data-mb="edit"]'),await cnt(pg,'[data-mb="wizard"]'),await cnt(pg,'[data-mb="save"]'),'nodes',await cnt(pg,'#mbVp [data-n]'))
        await pg.screenshot(path=OUT+'_ro.png')
        print('errors',errs)
        await b.close()
asyncio.run(main())
