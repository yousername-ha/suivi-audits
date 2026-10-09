#!/usr/bin/env python3
"""Ajoute (ou met à jour) le module « Cartographie (bêta) » dans un build de l'outil historique.
Usage : apply_carto.py <entrée.html> <sortie.html>
Idempotent : les blocs sont délimités par des marqueurs MB-BEGIN / MB-END."""
import re, sys, pathlib
here = pathlib.Path(__file__).resolve().parent
JS = (here / 'carto.js').read_text(encoding='utf-8')
CSS = (here / 'carto.css').read_text(encoding='utf-8')
src, dst = sys.argv[1], sys.argv[2]
t = pathlib.Path(src).read_text(encoding='utf-8')

def once(t, a, b, label):
    n = t.count(a)
    if n != 1:
        raise SystemExit(f'Ancre « {label} » trouvée {n} fois')
    return t.replace(a, b, 1)

# Retirer une version précédente du module
t = re.sub(r'/\* MB-BEGIN \*/.*?/\* MB-END \*/\n?', '', t, flags=re.S)
already = "{id:'carto',label:'Cartographie'" in t

ICON = "  carto:'<circle cx=\"5\" cy=\"6\" r=\"2\"/><circle cx=\"19\" cy=\"6\" r=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2.4\"/><circle cx=\"6\" cy=\"19\" r=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\"/><path d=\"M6.6 7.2l3.6 3.4M17.4 7.2l-3.6 3.4M10.4 13.6l-3 3.8M13.6 13.6l3 3.8\"/>',\n"
NAV = ("  {id:'carto',label:'Cartographie',icon:'carto',items:[{id:'mb-ctx',label:'Vue contexte',tab:'carto',set:{mbView:'context'},hint:'Périmètre, parties intéressées, enjeux, SI et fournisseurs'},"
       "{id:'mb-proc',label:'Vue processus',tab:'carto',set:{mbView:'process'},hint:'Pilotage, réalisation, support et sous-processus'}],"
       "count:()=>({n:'β',t:'module en test (bêta)'})},\n")
if not already:
    t = once(t, "const ICONS={\n", "const ICONS={\n" + ICON, 'ICONS')
    t = once(t, "const NAV_DEF={", "const NAV_DEF={mbView:'context',", 'NAV_DEF')
    t = once(t, "  {id:'gap',label:'GAP',icon:'gap',groups:[", NAV + "  {id:'gap',label:'GAP',icon:'gap',groups:[", 'navDef')
    t = once(t, "function pageKey(){const v={", "function pageKey(){const v={carto:ui.mbView||'context',", 'pageKey')
    t = once(t, "const TABS=[\n", "const TABS=[\n  {id:'carto',label:()=>'Cartographie',view:()=>viewCarto(),after:()=>mbMount()},\n", 'TABS')
    t = once(t, "planView:ui.planView}))}catch(e){}}", "planView:ui.planView,mbView:ui.mbView,mbVp:ui.mbVp,mbStd:ui.mbStd,mbSec:ui.mbSec,mbGen:ui.mbGen,mbPre:ui.mbPre,mbLeftOff:ui.mbLeftOff}))}catch(e){}}", 'saveUI')
    t = once(t, "const xHtml=ui.tab!=='rapports'?", "const xHtml=ui.tab!=='rapports'&&ui.tab!=='carto'?", 'exppage')
t = once(t, "/* ---------- Rendu global ---------- */", "/* MB-BEGIN */\n" + JS + "\n/* MB-END */\n/* ---------- Rendu global ---------- */", 'module JS')
t = once(t, "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}\n</style>",
         "/* MB-BEGIN */\n" + CSS + "/* MB-END */\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}\n</style>", 'CSS')
pathlib.Path(dst).write_text(t, encoding='utf-8')
print('OK', dst, len(t))
