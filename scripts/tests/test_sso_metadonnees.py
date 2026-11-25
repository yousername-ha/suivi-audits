"""Connexion unique SAML (ADR 0114) : script isolé de lecture des métadonnées (scripts/sso-metadonnees.py) contre un faux
fournisseur HTTPS local, et lecture par l'exécutant d'exploitation (scripts/exploitation-worker.py, file « sso-metadonnees »).
HTTPS seulement, certificat toujours vérifié, aucune redirection suivie, réponse bornée, erreur sur une ligne ; l'exécutant
ne lance rien si le flux est fermé ou la demande invalide, et lance le script sans privilège. Données fictives (localhost,
example.org, identifiants à zéros) ; aucun service réel."""
import base64
import http.server
import importlib.util
import json
from pathlib import Path
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "sso-metadonnees.py"
spec = importlib.util.spec_from_file_location("sso_metadonnees", SCRIPT)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
spec_w = importlib.util.spec_from_file_location("exploitation_sso", ROOT / "scripts" / "exploitation-worker.py")
w = importlib.util.module_from_spec(spec_w)
spec_w.loader.exec_module(w)

METADONNEES = b'<?xml version="1.0"?><md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://sso.example.org/realms/fictif"/>'
UUID_FICTIF = "00000000-0000-4000-8000-0000000000aa"


class Gestionnaire(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == "/redirection":
            self.send_response(302)
            self.send_header("Location", "https://evil.example.org/")
            self.end_headers()
            return
        if self.path == "/gros":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"x" * (s.REPONSE_MAX + 10))
            return
        if self.path != "/realms/fictif/protocol/saml/descriptor":
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/samlmetadata+xml")
        self.end_headers()
        self.wfile.write(METADONNEES)


class Script(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        p = Path(cls.dossier.name)
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(p / "key"), "-out", str(p / "cert"),
                        "-days", "2", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.autorite = (p / "cert").read_text()
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Gestionnaire)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(p / "cert"), str(p / "key"))
        cls.serveur.socket = ctx.wrap_socket(cls.serveur.socket, server_side=True)
        cls.port = cls.serveur.server_address[1]
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()
        cls.dossier.cleanup()

    def lancer(self, demande):
        fait = subprocess.run([sys.executable, "-I", "-c", SCRIPT.read_text(encoding="utf8")], input=json.dumps(demande),
                              capture_output=True, text=True, timeout=60, cwd="/")
        return json.loads(fait.stdout)

    def url(self, chemin="/realms/fictif/protocol/saml/descriptor"):
        return "https://localhost:%d%s" % (self.port, chemin)

    def test_lit_le_document_en_https_avec_l_autorite_du_fournisseur(self):
        r = self.lancer({"type": "keycloak", "url": self.url(), "autorite": self.autorite})
        self.assertEqual(r, {"ok": True, "contenu": base64.b64encode(METADONNEES).decode()})

    def test_certificat_toujours_verifie(self):
        r = self.lancer({"type": "keycloak", "url": self.url(), "autorite": None})
        self.assertFalse(r["ok"])
        self.assertIn("Certificat", r["erreur"])

    def test_aucune_redirection_suivie_reponse_bornee_code_inattendu(self):
        for chemin, attendu in (("/redirection", "Redirection refusée"), ("/gros", "trop volumineuses"), ("/absent", "code 404")):
            with self.subTest(chemin=chemin):
                r = self.lancer({"type": "saml", "url": self.url(chemin), "autorite": self.autorite})
                self.assertFalse(r["ok"])
                self.assertIn(attendu, r["erreur"])
                self.assertNotIn("\n", r["erreur"])

    def test_adresses_refusees_avant_tout_appel(self):
        for url, attendu in (("http://localhost/x", "https://"),
                             ("https://user:secret@localhost/x", "https://"),
                             ("https://login.example.org/x", "Entra"),
                             ("https://login.microsoftonline.com:8443/x", "Entra"),
                             ("https://LOCAL_HOST/x", "hôte")):
            with self.subTest(url=url):
                type_ = "entra" if "Entra" in attendu else "keycloak"
                with patch.object(s.http.client, "HTTPSConnection") as connexion, self.assertRaises(s.Refus) as e:
                    s.lire_demande(json.dumps({"type": type_, "url": url, "autorite": None}))
                connexion.assert_not_called()
                self.assertIn(attendu, str(e.exception))
        self.assertEqual(s.lire_demande(json.dumps({"type": "entra", "autorite": None,
                                                    "url": "https://login.microsoftonline.com/00000000-0000-4000-8000-0000000000aa/federationmetadata/2007-06/federationmetadata.xml?appid=00000000-0000-4000-8000-0000000000bb"}))["hote"],
                         "login.microsoftonline.com")
        for brut in ("pas du json", json.dumps({"type": "inconnu", "url": self.url(), "autorite": None}), json.dumps({"url": self.url()})):
            with self.assertRaises(s.Refus):
                s.lire_demande(brut)


class Executant(unittest.TestCase):
    def setUp(self):
        self.worker = w.Worker.__new__(w.Worker)
        self.appels = []
        self.demande = {"id": UUID_FICTIF, "type": "entra", "autorite": None,
                        "url": "https://login.microsoftonline.com/00000000-0000-4000-8000-0000000000aa/federationmetadata/2007-06/federationmetadata.xml"}

        def cli(nom, *args, value=None):
            self.appels.append((nom, args, value))
            return json.dumps(self.demande) if nom == "sso-metadonnees-claim" and self.demande is not None else ""
        self.worker.cli = cli

    def fin(self):
        return [a for a in self.appels if a[0] == "sso-metadonnees-finish"]

    def test_lance_le_script_sans_privilege_et_rapporte_le_contenu(self):
        sortie = {"ok": True, "contenu": base64.b64encode(METADONNEES).decode()}
        with patch.object(w.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout=json.dumps(sortie), stderr="")) as run:
            self.assertTrue(self.worker.sso_lecture(frozenset({"sso-saml"})))
        kw = run.call_args.kwargs
        self.assertEqual((kw["user"], kw["group"]), (65534, 65534))
        self.assertIn("-I", run.call_args.args[0])
        self.assertEqual(kw["env"], {"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"})
        self.assertEqual(json.loads(kw["input"]), {"type": "entra", "url": self.demande["url"], "autorite": None})
        self.assertEqual(self.fin(), [("sso-metadonnees-finish", (UUID_FICTIF,), sortie)])

    def test_flux_ferme_ou_demande_invalide_rien_n_est_lance(self):
        for demande, voulus, attendu in (({}, frozenset({"courriel"}), "fermé"),
                                         ({}, None, "fermé"),
                                         ({"url": "http://login.microsoftonline.com/x"}, frozenset({"sso-saml"}), "refusée"),
                                         ({"url": "https://login.example.org/x"}, frozenset({"sso-saml"}), "refusée"),
                                         ({"type": "inconnu"}, frozenset({"sso-saml"}), "refusée"),
                                         ({"champ": "en trop"}, frozenset({"sso-saml"}), "refusée")):
            with self.subTest(demande=demande, voulus=voulus):
                self.appels.clear()
                base = {"id": UUID_FICTIF, "type": "entra", "autorite": None, "url": "https://login.microsoftonline.com/x"}
                self.demande = {**base, **demande}
                with patch.object(w.subprocess, "run") as run:
                    self.assertTrue(self.worker.sso_lecture(voulus))
                run.assert_not_called()
                r = self.fin()[0][2]
                self.assertFalse(r["ok"])
                self.assertIn(attendu, r["erreur"])
        self.demande = {"id": "pas-un-uuid"}
        with self.assertRaises(w.Failure):
            self.worker.sso_lecture(frozenset({"sso-saml"}))
        self.demande = None
        self.assertFalse(self.worker.sso_lecture(frozenset({"sso-saml"})))

    def test_sortie_inattendue_et_echecs_ramenes_a_une_ligne(self):
        for effet, attendu in ((subprocess.TimeoutExpired("x", 1), "Délai dépassé"), (PermissionError(), "privilèges"), (ValueError(), "illisible")):
            with self.subTest(attendu=attendu):
                self.appels.clear()
                with patch.object(w.subprocess, "run", side_effect=effet):
                    self.worker.sso_lecture(frozenset({"sso-saml"}))
                self.assertIn(attendu, self.fin()[0][2]["erreur"])
        for sortie, attendu in (({"ok": True, "contenu": "x", "extra": 1}, "forme inattendue"),
                                ({"ok": False, "erreur": "ligne 1\nligne 2" + "x" * 400}, "ligne 1 ligne 2")):
            self.appels.clear()
            with patch.object(w.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout=json.dumps(sortie), stderr="")):
                self.worker.sso_lecture(frozenset({"sso-saml"}))
            r = self.fin()[0][2]
            self.assertFalse(r["ok"])
            self.assertIn(attendu, r["erreur"])
            self.assertLessEqual(len(r["erreur"]), w.SSO_ERREUR_MAX)

    def test_debit_borne_par_passage(self):
        with patch.object(w.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, stdout=json.dumps({"ok": False, "erreur": "x"}), stderr="")):
            self.assertEqual(self.worker.sso_lectures(frozenset({"sso-saml"})), w.SSO_MAX_PAR_PASSAGE)


if __name__ == "__main__":
    unittest.main()
