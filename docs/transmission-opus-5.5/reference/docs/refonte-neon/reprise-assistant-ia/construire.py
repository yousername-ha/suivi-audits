"""Assemble seulement le portage Assistant IA, puis vérifie sources, patchs et ZIP.

Aucun build, service, appel Mistral ou fichier applicatif modifié.
Usage : python3 docs/refonte-neon/reprise-assistant-ia/construire.py --sortie /chemin/livraisons
"""
from pathlib import Path, PurePosixPath
from tempfile import TemporaryDirectory
from zoneinfo import ZoneInfo
import argparse
import datetime
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

SOURCE = '04a310fe14efaf9878268bd3c20589c87fcd127c'
BACKEND = '460060a1e3b3597556bba0d64633d13146982c2b'
NOM = 'assistant-ia-implementation-2026-11-12'
GUIDES = [
    '00-LIRE-MOI.md', '01-PROMPT-IMPLEMENTATION-IA.md', '02-DECISIONS-ET-CHARTE.md',
    '03-CONTRATS-API.md', '04-PLAN-INTEGRATION.md', '05-RECETTE-ET-PREUVES.md',
    '06-RESUME-MODIFICATIONS-IA.md', '07-FICHIERS-ET-DEPENDANCES.md',
]
SOURCES = [
    'apps/web/src/assistant/AssistantGlobal.tsx',
    'apps/web/src/assistant/IdentiteAssistant.tsx',
    'apps/web/src/assistant/contrats.ts',
    'packages/ui/src/neon-assistant.css',
]
UNITAIRE = 'apps/web/test/assistant-global.test.ts'
PARTAGES = ['apps/web/src/components/Layout.tsx', 'apps/web/src/main.tsx', 'packages/ui/src/neon.css']
VERIFIER = '''"""Vérification locale en lecture seule du dossier extrait. Python 3, sans dépendance."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import sys
root = Path(__file__).resolve().parent
try:
    manifest = json.loads((root / 'MANIFESTE.json').read_text(encoding='utf-8'))
    expected = manifest['fichiers']
    errors = []
    for name, info in expected.items():
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts:
            errors.append('Chemin interdit : ' + name)
            continue
        target = root / name
        if not target.is_file() or target.is_symlink() or not target.resolve().is_relative_to(root):
            errors.append('Fichier absent ou lien interdit : ' + name)
        elif hashlib.sha256(target.read_bytes()).hexdigest() != info['sha256']:
            errors.append('Empreinte différente : ' + name)
    actual = {str(p.relative_to(root).as_posix()) for p in root.rglob('*') if p.is_file()}
    extras = actual - set(expected) - {'MANIFESTE.json'}
    if extras:
        errors.append('Fichiers supplémentaires : ' + ', '.join(sorted(extras)))
    print(json.dumps({'fichiersVerifies': len(expected), 'erreurs': errors, 'reussi': not errors}, ensure_ascii=False))
    sys.exit(1 if errors else 0)
except (OSError, ValueError, KeyError) as error:
    print('Vérification impossible : ' + str(error), file=sys.stderr)
    sys.exit(1)
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sortie', required=True, type=Path)
    args = parser.parse_args()
    guides = Path(__file__).resolve().parent
    repo = guides.parents[2]
    output = args.sortie.resolve()
    output.mkdir(parents=True, exist_ok=True)
    final_folder, final_zip = output / NOM, output / (NOM + '.zip')
    sidecar = output / (NOM + '.zip.sha256')
    if any(p.exists() for p in [final_folder, final_zip, sidecar]):
        raise SystemExit('Sortie déjà présente : choisir un autre répertoire, aucun fichier écrasé.')

    def git(*arguments):
        return subprocess.run(['git', *arguments], cwd=repo, check=True, stdout=subprocess.PIPE).stdout

    base = git('rev-parse', SOURCE + '^').decode().strip()
    created = datetime.datetime.now(ZoneInfo('Europe/Paris')).isoformat()
    origin = {}
    with TemporaryDirectory(prefix='.assistant-ia-', dir=output) as work_name:
        work = Path(work_name)
        stage = work / NOM
        stage.mkdir()

        def write(name, content, reference):
            target = stage / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content.encode('utf-8') if isinstance(content, str) else content)
            origin[name] = reference

        def from_git(path, name):
            write(name, git('show', SOURCE + ':' + path), {'commit': SOURCE, 'cheminDepot': path})

        for name in GUIDES:
            write(name, (guides / name).read_bytes(), {'guide': 'docs/refonte-neon/reprise-assistant-ia/' + name})
        for path in SOURCES:
            from_git(path, 'sources/' + path)
        from_git(UNITAIRE, 'tests/' + UNITAIRE)
        for path in ['tests/e2e/interface/assistant-fixture.ts', 'tests/e2e/interface/assistant-global.spec.ts', 'tests/e2e/fixtures/assistant-global.json']:
            from_git(path, 'references/tests-e2e/' + path.removeprefix('tests/e2e/'))
        write('references/tests-e2e/LIRE-AVANT-UTILISATION.md',
              '# Références E2E, pas un projet autonome\n\n'
              'Sources originales des dix scénarios Assistant validés sur le frontend 04a310f. '
              'Elles nécessitent le dépôt hôte, Playwright/Axe et, dans leur version originale, '
              '`interface/fournisseurs-fixture.ts` et `fixtures/fournisseurs-studio.json`. '
              'Ces supports de présentation ne sont pas livrés dans le paquet Assistant uniquement. '
              'Adapter le support aux pages/fixtures du dépôt cible selon le guide 05, sans porter Fournisseurs '
              'ni copier des données de démonstration en production. Aucun test de ce sous-dossier n’est relancé '
              'lors de l’assemblage.\n', {'genere': 'Note de dépendances explicites'})
        from_git('docs/refonte-neon/preuves/assistant-global/assistant-integre-hd.png', 'visuels/assistant-integre-hd.png')
        from_git('docs/refonte-neon/propositions/assistant-global/assistant-global-hd.png', 'visuels/assistant-valide-hd.png')
        from_git('docs/refonte-neon/preuves/assistant-global/controles.json', 'references/controles-integration-historiques.json')
        report = git('show', SOURCE + ':docs/refonte-neon/ASSISTANT-RSSI-GLOBAL-INTEGRE.md').decode('utf-8')
        report = report.replace('(propositions/assistant-global/README.md)', '(../visuels/assistant-valide-hd.png)')
        report = report.replace('(preuves/assistant-global/assistant-integre-hd.png)', '(../visuels/assistant-integre-hd.png)')
        report = report.replace('(preuves/assistant-global/controles.json)', '(controles-integration-historiques.json)')
        write('references/RAPPORT-INTEGRATION-HISTORIQUE.md',
              '> Rapport historique du portage 04a310f. Liens locaux adaptés au paquet ; '
              'résultats antérieurs, pas de nouvelle recette du backend. Les mentions de Fournisseurs '
              'décrivent la non-régression alors exécutée, pas un module livré ici.\n\n' + report,
              {'commit': SOURCE, 'cheminDepot': 'docs/refonte-neon/ASSISTANT-RSSI-GLOBAL-INTEGRE.md', 'adaptation': 'Liens de consultation et préambule uniquement'})
        new_patch = 'patches/01-assistant-nouveaux-fichiers.patch'
        hooks_patch = 'patches/02-raccordement-global-reference.patch'
        write(new_patch, git('diff', '--binary', base, SOURCE, '--', *SOURCES, UNITAIRE), {'diff': [base, SOURCE], 'chemins': SOURCES + [UNITAIRE]})
        write(hooks_patch, git('diff', '--binary', base, SOURCE, '--', *PARTAGES), {'diff': [base, SOURCE], 'chemins': PARTAGES, 'usage': 'Référence à adapter, pas un écrasement de fichiers partagés'})
        write('verifier.py', VERIFIER, {'genere': 'Vérificateur de conditionnement, lecture seule'})

        # Vérifier les patchs et leur résultat dans une copie minimale isolée de leur base exacte.
        checkout = work / 'base-reference'
        checkout.mkdir()
        for path in PARTAGES:
            target = checkout / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git('show', base + ':' + path))
        patch_checks = []
        for name in [new_patch, hooks_patch]:
            patch = stage / name
            subprocess.run(['git', 'apply', '--check', str(patch)], cwd=checkout, check=True, capture_output=True)
            subprocess.run(['git', 'apply', str(patch)], cwd=checkout, check=True, capture_output=True)
            patch_checks.append({'patch': name, 'base': base, 'checkEtApplicationIsolee': 'Réussis'})
        for path in SOURCES + [UNITAIRE] + PARTAGES:
            if (checkout / path).read_bytes() != git('show', SOURCE + ':' + path):
                raise RuntimeError('Résultat de patch différent de la source : ' + path)
        for path in SOURCES:
            if (stage / 'sources' / path).read_bytes() != git('show', SOURCE + ':' + path):
                raise RuntimeError('Source différente : ' + path)
        verification = {
            'dateParis': created, 'type': 'Conditionnement documentaire uniquement',
            'sourceFrontend': SOURCE, 'basePatchs': base, 'referenceBackendLue': BACKEND,
            'identiteSourcesAuCommit': 'Réussie', 'patchs': patch_checks,
            'fichiersReconstruitsIdentiques': len(SOURCES + [UNITAIRE] + PARTAGES),
            'compatibilitePatchBrancheAssistantCourante': 'Non testée ; adapter les raccordements selon les guides',
            'dependancesE2EExternes': ['interface/fournisseurs-fixture.ts', 'fixtures/fournisseurs-studio.json', 'configuration Playwright du dépôt hôte'],
            'controleAvantLivraison': ['Vérificateur SHA-256 local exécuté', 'CRC et unicité des entrées du ZIP vérifiés', 'Chaque entrée relue comparée au fichier du dossier'],
            'nonExecutesPourCePaquet': ['Build/tests applicatifs', 'Backend/DB/Mistral', 'Notifications réelles', 'Docker/Windows', 'Fusion/push/déploiement'],
        }
        write('VERIFICATIONS-LIVRAISON.json', json.dumps(verification, ensure_ascii=False, indent=2) + '\n', {'genere': 'Contrôles du conditionnement ; livraison seulement si toutes les assertions réussissent'})
        names = sorted(origin)
        manifest = {
            'nom': NOM, 'dateParis': created, 'perimetre': 'Assistant IA RSSI uniquement',
            'frontend': SOURCE, 'backendNonEmbarque': {'branche': 'claude/assistant-rssi', 'referenceLue': BACKEND},
            'nombreFichiersHorsManifeste': len(names),
            'fichiers': {name: {'sha256': hashlib.sha256((stage / name).read_bytes()).hexdigest(), 'octets': (stage / name).stat().st_size, 'origine': origin[name]} for name in names},
        }
        (stage / 'MANIFESTE.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        result = subprocess.run([sys.executable, str(stage / 'verifier.py')], check=True, capture_output=True, text=True)
        zip_path = work / (NOM + '.zip')
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for path in sorted(stage.rglob('*')):
                if path.is_file():
                    archive.write(path, path.relative_to(work).as_posix())
        with zipfile.ZipFile(zip_path) as archive:
            members = archive.namelist()
            if len(members) != len(set(members)) or archive.testzip() is not None:
                raise RuntimeError('CRC ou entrées ZIP invalides')
            if len(members) != len(names) + 1:
                raise RuntimeError('Nombre de fichiers ZIP inattendu')
            for name in members:
                posix = PurePosixPath(name)
                if posix.is_absolute() or '..' in posix.parts or posix.parts[0] != NOM:
                    raise RuntimeError('Chemin ZIP interdit : ' + name)
                source = work / name
                if archive.read(name) != source.read_bytes():
                    raise RuntimeError('Contenu ZIP différent : ' + name)
                if '/sources/' in name and name.removeprefix(NOM + '/sources/') not in SOURCES:
                    raise RuntimeError('Source hors assistant : ' + name)
        sha = hashlib.sha256(zip_path.read_bytes()).hexdigest()
        size = zip_path.stat().st_size
        # Ne publier dans le répertoire de sortie qu’après réussite de tous les contrôles.
        shutil.move(str(stage), str(final_folder))
        shutil.move(str(zip_path), str(final_zip))
        sidecar.write_text(sha + '  ' + final_zip.name + '\n', encoding='utf-8')
    print(json.dumps({'dossier': str(final_folder), 'zip': str(final_zip), 'octets': size, 'fichiers': len(names) + 1, 'sha256': sha, 'verificateur': json.loads(result.stdout), 'patchsVerifiesSurBaseIsolee': len(patch_checks)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
