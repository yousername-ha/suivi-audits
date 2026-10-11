import sys, asyncio
from playwright.async_api import async_playwright
URL=sys.argv[1];OUT=sys.argv[2]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
        for (w,h,tag) in [(390,844,'m'),(1280,800,'l')]:
            ctx=await b.new_context(viewport={'width':w,'height':h},device_scale_factor=2 if w<500 else 1)
            pg=await ctx.new_page();errs=[]
            pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto(URL);await pg.wait_for_timeout(1200)
            await pg.evaluate("()=>document.querySelector('[data-act=\"nav\"][data-sec=\"carto\"]').click()");await pg.wait_for_timeout(400)
            await pg.evaluate("()=>document.querySelector('.mb-empty [data-mb=\"wizard\"]').click()");await pg.wait_for_timeout(300)
            await pg.click('#mbDlg button[value="go"]');await pg.wait_for_timeout(700)
            el=await pg.query_selector('#mbVp [data-n="isms"]')
            if el: await el.click(); await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'{OUT}_{tag}.png')
            sw=await pg.evaluate("()=>[document.documentElement.scrollWidth,innerWidth]")
            print(tag,'scrollWidth',sw,'errors',errs)
            await ctx.close()
        await b.close()
asyncio.run(main())
