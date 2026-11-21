"""Compare des rendus au même viewport, thème et échelle, sans inventer de seuil de succès."""
import argparse,json
from pathlib import Path

def key(x):return (x['page'],x['viewport']['width'],x['viewport']['height'],x['requestedTheme'])
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--avant',required=True);ap.add_argument('--apres',required=True);ap.add_argument('--out',required=True);a=ap.parse_args()
 before=json.loads(Path(a.avant).read_text());after=json.loads(Path(a.apres).read_text())
 old={key(x):x for x in before['layouts'] if x['mode']=='compacte'}
 new={key(x):x for x in after['layouts'] if x['mode']=='normale'}
 compact={key(x):x for x in after['layouts'] if x['mode']=='compacte'}
 report={'comparison':'Ancien compact / nouveau normal / nouveau compact, mêmes données, viewport, thème et préférence de taille',
         'sourceAvant':a.avant,'sourceApres':a.apres,'cas':[],'preuvesServeur':False}
 for k,b in old.items():
  if k not in new or k not in compact:continue
  n,c=new[k],compact[k]
  row={'page':k[0],'width':k[1],'height':k[2],'theme':k[3],
       'fontAvant':b['fontFamily'],'fontApres':n['fontFamily'],
       'racinePx':[b['rootFont'],n['rootFont'],c['rootFont']],
       'corpsPx':[b['bodyFont'],n['bodyFont'],c['bodyFont']],
       'tablePx':[b['tableFont'],n['tableFont'],c['tableFont']],
       'lignesEntierementVisibles':[b['fullyVisibleRows'],n['fullyVisibleRows'],c['fullyVisibleRows']],
       'hauteurs':{}}
  for part in ['header','navLink','tabs','pageHeader','firstRow','tableHeader','planning','radar']:
   if b.get(part) and n.get(part) and c.get(part):
    heights=[round(x[part]['height'],2) for x in [b,n,c]]
    row['hauteurs'][part]={'ancienCompact':heights[0],'nouveauNormal':heights[1],'nouveauCompact':heights[2],
        'gainNormalPct':round(100*(1-heights[1]/heights[0]),1) if heights[0] else None,
        'normalPlusPetit':heights[1]<heights[0]-.1,'compactPlusPetitOuEgal':heights[2]<=heights[1]+.1}
  row['boutonsCommuns']=[]
  for btn in b['controls']:
   label=btn['label']
   if not label:continue
   n_btn=next((x for x in n['controls'] if x['label']==label),None)
   c_btn=next((x for x in c['controls'] if x['label']==label),None)
   if n_btn and c_btn:
    row['boutonsCommuns'].append({'nom':label,'hauteurs':[round(x['height'],2) for x in [btn,n_btn,c_btn]],
      'largeurs':[round(x['width'],2) for x in [btn,n_btn,c_btn]]})
  report['cas'].append(row)
 Path(a.out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'casComparables':len(report['cas']),'rapport':a.out},ensure_ascii=False))
if __name__=='__main__':main()
