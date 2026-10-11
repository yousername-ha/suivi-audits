"""Contrat des dispositions SVG : références métier, portée et versions."""
import math, re
TYPES = {'part_of','flows_to','depends_on','supports','interacts_with','impacts','applies_to','contains','related_to'}
FRAME = re.compile(r'^(isms|scope|lane:(pil|rea|sup|oth)|band:(int|ext)|zone:out)$')
def hashed(text):
    h = 5381
    for char in str(text).lower():
        n = ord(char)
        if n > 0xffff: n = 0xd800 + ((n - 0x10000) >> 10)
        h = ((h * 33) + n) & 0xffffffff
    digits, out = '0123456789abcdefghijklmnopqrstuvwxyz', ''
    while h: out = digits[h % 36] + out; h //= 36
    return out or '0'

def references(s):
    out = {}
    def add(ref, r, label): out.setdefault(ref, []).append((r, str(label or ref)))
    for prefix, kind in [('process','processes'),('pi','interested'),('sup','suppliers'),('app','appGaps')]:
        for row in s.get(kind, []): add(prefix+':'+row['id'],row,row.get('name') or row['id'])
    for row in s.get('objectives', []):
        for text in row.get('enjeux', []):
            text=str(text).strip();i=text.find(':');label=text[:i].strip() if 0<i<70 else text
            if label: add('issue:'+hashed(label),row,label)
    for row in s.get('swots', []):
        for k in ['S','W','O','T']:
            for text in row.get(k, []):
                text=str(text).strip()
                if text: add('issue:'+hashed(text),row,text)
    for row in s.get('perimeters', []):
        if row.get('type')=='Site': add('site:'+hashed(row['name']),row,row['name'])
        systems=row.get('systems', [])
        if isinstance(systems,str): systems=re.split(r'\n|;',systems)
        for text in systems:
            text=re.sub(r'^[-•*\s]+','',str(text)).strip()
            if text: add('infra:'+hashed(text),row,text)
    for key, prefix in [('sites','site'),('systems','infra')]:
        lines=s.get('scope',{}).get(key,[])
        if isinstance(lines,str): lines=re.split(r'\n|;',lines)
        for text in lines:
            text=re.sub(r'^[-•*\s]+','',str(text)).strip()
            if text: add(prefix+':'+hashed(text),{'perimeterIds':[]},text)
    return out

def allowed_ref(ref, refs, store, index, coverage, allowed=None):
    if FRAME.fullmatch(ref): return True
    for obj,_label in refs.get(ref,[]):
        scopes=store.scopes(obj,index)
        if not coverage:
            if allowed is None and not scopes: return True
        elif scopes and scopes <= coverage and (allowed is None or scopes <= allowed): return True
    return False

def project_maps(s, out, user, store):
    """Retirer une référence reclassée hors accès, également des versions."""
    refs,index,allowed=references(s),store.record_index(s),store.allowed(s,user)
    for row in out.setdefault('cartography',{'schema':1,'maps':[]}).get('maps',[]):
        coverage=store.allowed(s,{'perimeterIds':row.get('perimeterIds',[])})
        restricted=False
        for layout in [row]+[v.get('map',{}) for v in row.get('versions',[])]:
            denied={r for r in layout.get('nodes',{}) if r in refs and not allowed_ref(r,refs,store,index,coverage,allowed)}
            restricted |= bool(denied)
            layout['nodes']={r:n for r,n in layout.get('nodes',{}).items() if r not in denied}
            if 'edges' in layout: layout['edges']=[e for e in layout['edges'] if e.get('s') not in denied and e.get('t') not in denied]
            for k in ['hide','ignored','issueKind']:
                if k in layout: layout[k]={r:v for r,v in layout[k].items() if not any(ref in r for ref in denied)}
        if restricted: row['restricted']=True
    out['cartography']['schema']=1

def validate_maps(s, old, user, store, Problem):
    data=s.get('cartography',{'schema':1,'maps':[]})
    if isinstance(data,dict): data.setdefault('schema',1)
    if not isinstance(data,dict) or data.get('schema')!=1 or not isinstance(data.get('maps'),list): raise Problem(422,'Version de cartographie invalide.')
    if len(data['maps'])>2000: raise Problem(422,'Trop de dispositions enregistrées.')
    refs,index=references(s),store.record_index(s)
    previous={r['id']:r for r in (old or {}).get('cartography',{}).get('maps',[])}
    seen=set()
    for row in data['maps']:
        if not isinstance(row.get('id'),str) or not row['id']: raise Problem(422,'Identifiant de carte invalide.')
        if not set(row)<= {'id','internalId','name','view','perimeterIds','nodes','edges','hide','ignored','issueKind','versions','updatedAt','restricted'}: raise Problem(422,'La carte ne contient que des dispositions et leurs versions.')
        if row.get('view') not in ['context','process']: raise Problem(422,'Vue cartographique inconnue.')
        scope=tuple(sorted(row.get('perimeterIds',[])));slot=(scope,row['view'])
        if slot in seen: raise Problem(422,'Une disposition existe déjà pour cette vue et ces périmètres.')
        seen.add(slot)
        coverage=store.allowed(s,{'perimeterIds':list(scope)})
        before=previous.get(row['id'],{})
        if not scope and user['permission']!='admin' and row!=before: raise Problem(403,'Carte commune réservée à l’administration.')
        old_nodes={r:n for layout in [before]+[v.get('map',{}) for v in before.get('versions',[])] for r,n in layout.get('nodes',{}).items()}
        legacy=(old or s).get('maps',{})
        if not scope and row['id']=='MAP-legacy-'+row['view']:
            for layout in [legacy.get(row['view'],{})]+[v.get('map',{}) for v in legacy.get(row['view'],{}).get('versions',[])]: old_nodes.update(layout.get('nodes',{}))
        def check(layout):
            if not isinstance(layout,dict): raise Problem(422,'Disposition invalide.')
            nodes,edges=layout.get('nodes',{}),layout.get('edges',[])
            if not isinstance(nodes,dict) or len(nodes)>400 or not isinstance(edges,list) or len(edges)>4000: raise Problem(422,'Carte invalide ou trop volumineuse (400 objets maximum).')
            for ref,n in nodes.items():
                if not isinstance(ref,str) or len(ref)>600 or not isinstance(n,dict) or not set(n)<= {'x','y','w','h','label','hidden'}: raise Problem(422,'La carte ne conserve que la présentation des objets.')
                if 'hidden' in n and not isinstance(n['hidden'],bool): raise Problem(422,'Masquage cartographique invalide.')
                for k in ['x','y','w','h']:
                    value=n.get(k)
                    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or abs(value)>1000000 or k in ['w','h'] and value<20: raise Problem(422,'Position ou taille cartographique invalide.')
                if not isinstance(n.get('label',''),str) or len(n.get('label',''))>2000: raise Problem(422,'Libellé cartographique invalide.')
                if not allowed_ref(ref,refs,store,index,coverage):
                    if ref not in old_nodes or n.get('label','')!=old_nodes[ref].get('label',''): raise Problem(422,'Référence cartographique absente ou hors du périmètre sélectionné.')
            for e in edges:
                if not isinstance(e,dict) or not set(e)<= {'id','s','t','type','gen'} or not isinstance(e.get('id'),str) or e.get('s') not in nodes or e.get('t') not in nodes or e.get('s')==e.get('t') or e.get('type') not in TYPES: raise Problem(422,'Relation graphique invalide.')
            if len({e['id'] for e in edges})!=len(edges): raise Problem(422,'Relations graphiques dupliquées.')
            for k in ['hide','ignored','issueKind']:
                values=layout.get(k,{})
                if not isinstance(values,dict) or len(values)>4000: raise Problem(422,'Filtre cartographique invalide.')
                for ref,value in values.items():
                    if not isinstance(ref,str) or len(ref)>1500 or not re.fullmatch(r'[\w:.>\-]+',ref) or k=='issueKind' and value not in ['int','ext'] or k!='issueKind' and value not in [0,1,False,True]: raise Problem(422,'Valeur cartographique invalide.')
        check(row)
        versions=row.get('versions',[])
        if not isinstance(versions,list) or len(versions)>20 or any(not isinstance(v,dict) or not isinstance(v.get('id'),str) for v in versions) or len({v['id'] for v in versions})!=len(versions): raise Problem(422,'Historique limité à 20 versions distinctes.')
        old_versions={v['id']:v for v in before.get('versions',[])}
        for v in versions:
            if not isinstance(v.get('label',''),str) or len(v.get('label',''))>200: raise Problem(422,'Nom de version invalide.')
            if not set(v)<= {'id','at','label','map','author','authorId'} or not isinstance(v.get('map'),dict) or not set(v['map'])<= {'nodes','edges','hide','ignored','issueKind'}: raise Problem(422,'Une version ne contient que la disposition de la carte.')
            check(v['map'])
            if v['id'] in old_versions:
                if v!=old_versions[v['id']]: raise Problem(422,'Une version enregistrée ne peut être réécrite.')
            else: v['authorId']=user['id'];v['author']=user['name']
        row.pop('restricted',None)
