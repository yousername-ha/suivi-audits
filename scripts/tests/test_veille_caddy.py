"""Veille Caddy : faux « gh », aucun accès réseau ni écriture dans le dépôt."""
import base64
import datetime
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

REPO = pathlib.Path(__file__).resolve().parents[2]
GH = '''#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
case "$*" in
  "api repos/caddyserver/caddy/releases/latest"*) echo "v$FAKE_LATEST" ;;
  "api repos/caddyserver/caddy/contents/go.mod"*) printf '%s' "$FAKE_GOMOD" | base64 -w0 ;;
  "issue list"*) echo "${FAKE_OPEN:-0}" ;;
  "issue create"*) echo "https://example.invalid/issues/1" ;;
  *) echo "appel inattendu : $*" >&2; exit 9 ;;
esac
'''


class VeilleCaddy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='veille-caddy-')
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        (self.root / 'scripts/ci').mkdir(parents=True)
        (self.root / 'docker').mkdir()
        (self.root / 'bin').mkdir()
        shutil.copy(REPO / 'scripts/ci/veille-caddy.sh', self.root / 'scripts/ci/veille-caddy.sh')
        (self.root / 'docker/web.Dockerfile').write_text('RUN go mod download github.com/caddyserver/caddy/v2@v2.11.7 \\\n')
        gh = self.root / 'bin/gh'
        gh.write_text(GH)
        gh.chmod(0o755)
        self.log = self.root / 'gh.log'

    def exceptions(self, jours):
        date = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=jours)).strftime('%Y-%m-%d')
        (self.root / '.trivyignore.yaml').write_text(f'vulnerabilities:\n  - id: CVE-X\n    expired_at: {date}\n')

    def run_veille(self, latest, gomod='', ouvertes=0):
        env = {**os.environ, 'PATH': f'{self.root / "bin"}:{os.environ["PATH"]}', 'FAKE_LOG': str(self.log),
               'FAKE_LATEST': latest, 'FAKE_GOMOD': gomod, 'FAKE_OPEN': str(ouvertes)}
        result = subprocess.run(['bash', str(self.root / 'scripts/ci/veille-caddy.sh')], env=env, text=True, capture_output=True, timeout=30)
        calls = self.log.read_text() if self.log.exists() else ''
        return result, calls

    def test_no_newer_release_opens_nothing(self):
        self.exceptions(20)
        result, calls = self.run_veille('2.11.7')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('issue create', calls)

    def test_newer_release_still_requiring_the_library_opens_nothing(self):
        self.exceptions(20)
        result, calls = self.run_veille('2.12.0', 'require (\n\tgithub.com/go-jose/go-jose/v3 v3.0.5 // indirect\n)\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('exige encore', result.stdout)
        self.assertNotIn('issue create', calls)

    def test_newer_release_without_the_library_opens_one_request(self):
        self.exceptions(20)
        result, calls = self.run_veille('2.12.0', 'require (\n\tgithub.com/go-jose/go-jose/v4 v4.1.6\n)\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('issue create'), 1)
        self.assertIn("n'exige plus go-jose v3", calls)

    def test_existing_request_is_not_duplicated(self):
        self.exceptions(20)
        result, calls = self.run_veille('2.12.0', 'require ()\n', ouvertes=1)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('issue create', calls)

    def test_older_or_equal_release_is_ignored(self):
        self.exceptions(20)
        result, calls = self.run_veille('2.10.0', 'require ()\n')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('issue create', calls)

    def test_exception_expiring_soon_opens_a_request(self):
        self.exceptions(3)
        result, calls = self.run_veille('2.11.7')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(calls.count('issue create'), 1)
        self.assertIn('Exception Trivy à réexaminer', calls)

    def test_missing_pin_fails(self):
        (self.root / 'docker/web.Dockerfile').write_text('FROM scratch\n')
        self.exceptions(20)
        result, _ = self.run_veille('2.11.7')
        self.assertNotEqual(result.returncode, 0)


if __name__ == '__main__':
    unittest.main()
