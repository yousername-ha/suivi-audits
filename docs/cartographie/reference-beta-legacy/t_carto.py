import sys, json, asyncio
from playwright.async_api import async_playwright
URL = sys.argv[1]; OUT = sys.argv[2]; W = int(sys.argv[3]) if len(sys.argv) > 3 else 1600; H = int(sys.argv[4]) if len(sys.argv) > 4 else 950

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width': W, 'height': H}, accept_downloads=True)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        pg.on('console', lambda m: errs.append('CONSOLE ' + m.text) if m.type == 'error' else None)
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        # fermer d'éventuels dialogues d'accueil
        for _ in range(3):
            d = await pg.query_selector('dialog[open]')
            if not d: break
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        await pg.click('[data-act="nav"][data-sec="carto"]'); await pg.wait_for_timeout(500)
        await pg.screenshot(path=OUT + '_0_vide.png')
        await pg.click('.mb-empty [data-mb="wizard"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + '_1_wizard.png')
        await pg.click('#mbDlg button[value="go"]'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT + '_2_contexte.png')
        # sélectionner un processus
        el = await pg.query_selector('#mbVp [data-n^="process:"]')
        if el:
            await el.click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + '_3_insp.png')
        # mode édition + déplacement
        await pg.click('[data-mb="edit"]'); await pg.wait_for_timeout(300)
        el = await pg.query_selector('#mbVp [data-n="isms"]')
        bb = await el.bounding_box()
        await pg.mouse.move(bb['x'] + 30, bb['y'] + 30); await pg.mouse.down(); await pg.mouse.move(bb['x'] + 90, bb['y'] + 70, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(300)
        bb2 = await (await pg.query_selector('#mbVp [data-n="isms"]')).bounding_box()
        print('drag delta', round(bb2['x']-bb['x']), round(bb2['y']-bb['y']), 'dirty badge', bool(await pg.query_selector('.mb-dirty')))
        await pg.click('[data-mb="save"]'); await pg.wait_for_timeout(400)
        await pg.click('[data-mb="edit"]'); await pg.wait_for_timeout(400)
        print('saved maps keys', await pg.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('suivi-audits-smsi:v1')).maps||{})"))
        # vue processus
        await pg.click('[data-mb="view"][data-v="process"]'); await pg.wait_for_timeout(400)
        await pg.click('.mb-empty [data-mb="wizard"]'); await pg.wait_for_timeout(300)
        await pg.click('#mbDlg button[value="go"]'); await pg.wait_for_timeout(800)
        await pg.screenshot(path=OUT + '_4_processus.png')
        el = await pg.query_selector('#mbVp [data-n="process:PRS01"]')
        if el:
            await el.click(); await pg.wait_for_timeout(300)
        await pg.screenshot(path=OUT + '_5_proc_insp.png')
        # export PNG / PDF
        for k in ['xpng', 'xpdf', 'xsvg']:
            try:
                await pg.click('.mb-dd summary')
                async with pg.expect_download(timeout=8000) as dl:
                    await pg.click(f'[data-mb="{k}"]')
                d = await dl.value
                path = OUT + '_export.' + k[1:]
                await d.save_as(path); print('export', k, path)
            except Exception as e:
                print('export fail', k, e)
        await pg.click('[data-mb="save"]'); await pg.wait_for_timeout(300)
        # recharger et vérifier la persistance
        await pg.reload(); await pg.wait_for_timeout(1500)
        for _ in range(3):
            d = await pg.query_selector('dialog[open]')
            if not d: break
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        print('after reload', await pg.evaluate("()=>{const S=JSON.parse(localStorage.getItem('suivi-audits-smsi:v1'));const u=JSON.parse(localStorage.getItem('suivi-audits-smsi:ui'));return {tab:u.tab,view:u.mbView,maps:Object.keys(S.maps||{}),n:S.maps&&S.maps.context&&Object.keys(S.maps.context.nodes).length,isms:S.maps&&S.maps.context&&S.maps.context.nodes.isms,nodesOnScreen:document.querySelectorAll('#mbVp [data-n]').length}}"))
        await pg.screenshot(path=OUT + '_6_reload.png')
        print('\n'.join(errs) or 'NO ERRORS')
        await b.close()
asyncio.run(main())
