"""Règles serveur du registre central ; aucune dépendance à une étude particulière."""
import copy, re, datetime, uuid

COLLECTIONS = ('risks','studies','assessments','scenarios','policies','treatments','measures','decisions')
METHODS = ('EBIOS RM','ISO 27005','MÉHARI','Personnalisée')

def validate_risks(s, old, u, store, Problem):
    current = s.setdefault('riskMgmt', {'schema':1})
    if current.get('schema',1) != 1: raise Problem(422,'Version du registre des risques inconnue.')
    previous = (old or {}).get('riskMgmt', {})
    indices = {k:{r['id']:r for r in current.get(k,[])} for k in COLLECTIONS}
    before = {k:{r['id']:r for r in previous.get(k,[])} for k in COLLECTIONS}
    def fail(text): raise Problem(422,text)
    def date(value, required=True):
        if not value and not required: return
        try:
            if not isinstance(value,str) or datetime.date.fromisoformat(value).isoformat()!=value: fail('Date de risque invalide.')
        except ValueError: fail('Date de risque invalide.')
    def covered(parent, child):
        return set(child) <= store.allowed(s, {'perimeterIds':parent})
    def risk_for(record):
        risk=indices['risks'].get(record.get('riskId'))
        if not risk or set(record.get('perimeterIds',[])) != set(risk['perimeterIds']): fail('Risque ou couverture de la relation invalide.')
        return risk
    for k in COLLECTIONS:
        if not set(before[k]) <= set(indices[k]): fail('Conservez les risques et leur historique ; utilisez l’archivage.')
    for k in ('assessments','decisions','policies'):
        for id,r in indices[k].items():
            if id in before[k] and {key:value for key,value in r.items() if key!='internalId'}!={key:value for key,value in before[k][id].items() if key!='internalId'}: fail('Évaluation, décision ou politique immuable : ajoutez une nouvelle version.')
    for p in indices['policies'].values():
        if p['id'] not in before['policies']:
            if not u['canValidate']: raise Problem(403,'Politique méthodologique réservée aux validateurs.')
            p['authorId']=u['id'];p['author']=u['name']
        if not isinstance(p.get('version'),int) or p['version']<1: fail('Version de politique invalide.')
        if p.get('previousId'):
            prior=indices['policies'].get(p['previousId'])
            if not prior or p['version']!=prior['version']+1: fail('Version précédente de la politique invalide.')
        if not p.get('title') or p.get('method') not in METHODS or p.get('calculation') not in ('manual','matrix') or not p.get('perimeterIds'): fail('Politique des risques invalide.')
        for key in ('impactScale','likelihoodScale','levels'):
            rows=p.get(key,[])
            if not 1<=len(rows)<=20 or len({r.get('id') for r in rows})!=len(rows) or any(not r.get('id') or not r.get('label') for r in rows): fail('Échelle de risque invalide.')
        if any(not re.fullmatch(r'#[0-9a-fA-F]{6}',r.get('color','')) for r in p['levels']): fail('Couleur de risque invalide.')
        if p['calculation']=='matrix':
            levels={r['id'] for r in p['levels']}
            if any(p.get('matrix',{}).get(i['id']+':'+v['id']) not in levels for i in p['impactScale'] for v in p['likelihoodScale']): fail('Matrice des risques incomplète.')
        p['normative']=False
    for r in indices['risks'].values():
        if not all(r.get(k) for k in ('title','description','perimeterIds')) or r.get('status') not in ('Ouvert','En traitement','Accepté','Transféré','Évité','Archivé'): fail('Fiche de risque incomplète.')
        date(r.get('reviewDate'),False)
        refs=r.setdefault('referenceEvaluationIds',{'initial':None,'residual':None})
        prior=before['risks'].get(r['id'],{})
        # Liens explicites vers le registre de mesures existant : contrôle des
        # changements, sans invalider les éventuels anciens liens inchangés.
        controls = {c['id']:c for c in s.get('items', [])}
        current_links = {ref.get('id') for ref in r.get('objectRefs', []) if ref.get('kind') == 'control'}
        previous_links = {ref.get('id') for ref in prior.get('objectRefs', []) if ref.get('kind') == 'control'}
        for control_id in current_links ^ previous_links:
            control = controls.get(control_id)
            if control_id in current_links and not control: fail('Mesure de référentiel inconnue.')
            if control:
                if u['permission'] != 'admin' and not store.visible(control, store.record_index(s), store.allowed(s, u)):
                    raise Problem(403, 'Mesure de référentiel hors périmètre.')
                reciprocal = any(ref.get('kind') == 'risk' and ref.get('id') == r['id'] for ref in control.get('objectRefs', []))
                if reciprocal != (control_id in current_links): fail('Le lien risque–mesure doit être bidirectionnel.')
        if (refs!=prior.get('referenceEvaluationIds',{'initial':None,'residual':None}) or r.get('acceptedDecisionId')!=prior.get('acceptedDecisionId')) and not u['canValidate']: raise Problem(403,'Choix de référence et acceptation réservés aux validateurs.')
        for stage,id in refs.items():
            if stage not in ('initial','residual'): fail('Type de référence invalide.')
            if id:
                a=indices['assessments'].get(id)
                if not a or a.get('riskId')!=r['id'] or a.get('stage')!=stage: fail('Évaluation de référence d’un autre risque ou niveau.')
        decision=indices['decisions'].get(r.get('acceptedDecisionId'))
        if r.get('acceptedDecisionId') and (not decision or decision.get('riskId')!=r['id'] or decision.get('kind')!='Accepter'): fail('Décision d’acceptation invalide.')
    for st in indices['studies'].values():
        if not st.get('title') or st.get('method') not in METHODS or not st.get('perimeterIds') or st.get('status') not in ('En cours','Clôturée','Archivée'): fail('Étude invalide.')
        date(st.get('date'))
        for rid in st.get('riskIds',[]):
            risk=indices['risks'].get(rid)
            if not risk or not covered(st['perimeterIds'],risk['perimeterIds']): fail('Risque hors périmètre de l’étude.')
        if not set(before['studies'].get(st['id'],{}).get('riskIds',[])) <= set(st.get('riskIds',[])): fail('Conservez les liens historiques de l’étude.')
    for sc in indices['scenarios'].values():
        if not sc.get('title') or not sc.get('description') or sc.get('type') not in ('Source de risque','Événement redouté','Stratégique','Opérationnel'): fail('Scénario invalide.')
        st=indices['studies'].get(sc.get('studyId'))
        if sc.get('studyId') and (not st or not covered(st['perimeterIds'],sc['perimeterIds'])): fail('Étude hors périmètre du scénario.')
        for rid in sc.get('riskIds',[]):
            risk=indices['risks'].get(rid)
            if not risk or not covered(sc['perimeterIds'],risk['perimeterIds']): fail('Risque hors périmètre du scénario.')
        parent=indices['scenarios'].get(sc.get('parentScenarioId'))
        if sc.get('parentScenarioId') and (not parent or not covered(parent['perimeterIds'],sc['perimeterIds']) or parent['id']==sc['id']): fail('Scénario parent invalide.')
        seen={sc['id']}
        while parent:
            if parent['id'] in seen: fail('Cycle entre scénarios.')
            seen.add(parent['id']); parent=indices['scenarios'].get(parent.get('parentScenarioId'))
    for a in indices['assessments'].values():
        risk=risk_for(a);p=indices['policies'].get(a.get('policyId'));st=indices['studies'].get(a.get('studyId'))
        if not p or not covered(p['perimeterIds'],risk['perimeterIds']) or a.get('method')!=p['method'] or a.get('stage') not in ('initial','residual') or not a.get('justification'): fail('Évaluation et politique incompatibles.')
        if a.get('studyId') and (not st or st.get('method')!=p['method'] or not covered(st['perimeterIds'],risk['perimeterIds'])): fail('Étude sans couverture du risque.')
        if a['id'] not in before['assessments']:
            if st and u['permission']!='admin' and not store.visible(st,store.record_index(s),store.allowed(s,u)):
                raise Problem(403,'Étude hors de vos habilitations.')
            if st and st['status']!='En cours': fail('Une étude clôturée/archivée n’accepte plus d’évaluations.')
            a['authorId']=u['id'];a['author']=u['name']
            if st and risk['id'] not in st.get('riskIds',[]):st.setdefault('riskIds',[]).append(risk['id'])
        date(a.get('date'))
        if a.get('impactId') not in {x['id'] for x in p['impactScale']} or a.get('likelihoodId') not in {x['id'] for x in p['likelihoodScale']} or a.get('levelId') not in {x['id'] for x in p['levels']}: fail('Résultat absent de l’échelle sélectionnée.')
        if p['calculation']=='matrix' and a['levelId']!=p['matrix'][a['impactId']+':'+a['likelihoodId']]: fail('Résultat différent de la matrice configurée.')
        for id in a.get('scenarioIds',[]):
            sc=indices['scenarios'].get(id)
            if not sc or risk['id'] not in sc.get('riskIds',[]) or a.get('studyId') and sc.get('studyId')!=a['studyId']: fail('Scénario sans relation avec cette évaluation.')
    for d in indices['decisions'].values():
        risk=risk_for(d);a=indices['assessments'].get(d.get('assessmentId'))
        if not a or a['riskId']!=risk['id'] or d.get('kind') not in ('Accepter','Réduire','Transférer','Éviter','Réévaluer') or not d.get('justification'): fail('Décision invalide.')
        if d['id'] not in before['decisions']:
            if not u['canValidate']: raise Problem(403,'Décision réservée aux validateurs.')
            d['authorId']=u['id'];d['author']=u['name']
        date(d.get('date'));date(d.get('validUntil'),False)
        if d.get('validUntil') and d['validUntil']<d['date']:fail('Validité antérieure à la décision.')
    for t in indices['treatments'].values():
        risk_for(t)
        if not t.get('title') or t.get('strategy') not in ('Réduire','Accepter','Transférer','Éviter'):fail('Traitement invalide.')
        date(t.get('due'),False)
    for m in indices['measures'].values():
        risk_for(m);t=indices['treatments'].get(m.get('treatmentId'))
        if not t or t['riskId']!=m['riskId'] or not m.get('title') or not m.get('description'):fail('Mesure sans plan de traitement valide.')
        if not set(m.get('controlIds',[])) <= {i['id'] for i in s.get('items',[])}:fail('Mesure de référentiel inconnue.')
        if m.get('actionId'):
            a=next((a for a in s.get('findings',[]) if a['id']==m['actionId']),None)
            if not a or a.get('riskMeasureId')!=m['id'] or set(a.get('perimeterIds',[]))!=set(m['perimeterIds']):fail('Action sans lien avec la mesure.')
        date(m.get('due'),False)
    # Historique métier produit par le serveur : ni réécriture ni auteur client.
    # Les snapshots ne contiennent pas les anciens historiques, pour éviter leur duplication.
    for key in ('risks','studies','scenarios','treatments','measures'):
        for record in indices[key].values():
            prior = before[key].get(record['id'])
            history = copy.deepcopy(prior.get('history', [])) if prior else []
            fields = sorted(k for k in (set(record) | set(prior or {})) - {'history','createdAt','updatedAt'}
                            if record.get(k) != (prior or {}).get(k))
            if fields:
                snapshot = copy.deepcopy(prior) if prior else None
                if snapshot: snapshot.pop('history', None)
                history.append({'id':str(uuid.uuid4()),'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                                'actorId':u['id'],'actor':u['name'],'operation':'Modification' if prior else 'Création',
                                'fields':fields,'snapshot':snapshot})
            record['history'] = history
