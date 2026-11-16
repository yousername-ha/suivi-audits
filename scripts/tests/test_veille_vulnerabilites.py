"""Script isolé de la veille des vulnérabilités (scripts/veille-vulnerabilites.py, ADR 0100 points 3 à 5, lots V2 et V3)
contre un faux service HTTPS local : liste fermée des hôtes et des chemins, GET seulement, aucune redirection suivie,
certificat toujours vérifié, réponse bornée, JSON mal formé refusé, RSS piégé (déclaration de type, entités, balisage et
script dans un titre, texte démesuré, identifiant mal formé) refusé ou nettoyé. Jeux d'essai : petits extraits au format
réel des sources (données publiques, scripts/tests/fixtures/veille) ou fictifs ; aucune source réelle n'est jointe."""
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

SCRIPT = Path(__file__).resolve().parents[1] / "veille-vulnerabilites.py"
JEUX = Path(__file__).resolve().parent / "fixtures" / "veille"
SPEC = importlib.util.spec_from_file_location("veille_vulnerabilites", SCRIPT)
v = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(v)


def certificat(dossier, nom):
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(dossier / (nom + ".key")),
         "-out", str(dossier / (nom + ".crt")), "-days", "2", "-subj", "/CN=localhost",
         "-addext", "subjectAltName=DNS:localhost"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return str(dossier / (nom + ".crt"))


def jeu(nom):
    return (JEUX / nom).read_bytes()


def rss(items, entete=""):
    corps = "".join("<item>%s</item>" % i for i in items)
    return ('<?xml version="1.0" encoding="utf-8"?>%s<rss version="2.0"><channel><title>Flux fictif</title>%s</channel></rss>' % (entete, corps)).encode("utf-8")


class Faux(http.server.BaseHTTPRequestHandler):
    """Faux service : chaque chemin (requête comprise) reçoit la réponse réglée par le test, 404 sinon."""

    protocol_version = "HTTP/1.0"
    reponses = {}
    recues = []

    def log_message(self, *args):
        pass

    def traiter(self):
        Faux.recues.append((self.command, self.path))
        chemin = self.path.split("?", 1)[0]
        code, corps, en_tetes = Faux.reponses.get(self.path) or Faux.reponses.get(chemin) or (404, b"", ())
        self.send_response(code)
        for k, val in en_tetes:
            self.send_header(k, val)
        if not any(k.lower() == "content-length" for k, _ in en_tetes) and not dict(en_tetes).get("sans-longueur"):
            self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    do_GET = do_POST = do_PUT = do_DELETE = traiter


class Veille(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        d = Path(cls.dossier.name)
        cls.ca = certificat(d, "serveur")
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Faux)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cls.ca, str(d / "serveur.key"))
        cls.serveur.socket = ctx.wrap_socket(cls.serveur.socket, server_side=True)
        cls.port = cls.serveur.server_address[1]
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()
        cls.serveur.server_close()
        cls.dossier.cleanup()

    def setUp(self):
        Faux.reponses = {}
        Faux.recues = []
        # Les hôtes de la liste fermée sont remplacés par le faux service (localhost, port libre) ; son autorité est ajoutée
        # au contexte, qui reste vérifié (nom et certificat) en TLS 1.2 au minimum. Pas d'attente entre deux lectures.
        self.patch(v, "destination", lambda source: ("localhost", self.port))
        vrai = self.contexte_systeme = v.contexte
        ca = self.ca

        def contexte():
            c = vrai()
            c.load_verify_locations(ca)
            return c
        self.patch(v, "contexte", contexte)
        self.patch(v, "NVD_PAUSE", 0)
        self.patch(v, "EPSS_PAUSE", 0)
        self.patch(v, "CERTFR_PAUSE", 0)

    def patch(self, objet, nom, valeur):
        p = patch.object(objet, nom, valeur)
        p.start()
        self.addCleanup(p.stop)

    def repondre(self, chemin, corps, code=200, en_tetes=()):
        Faux.reponses[chemin] = (code, corps, tuple(en_tetes))

    def collecter(self, source, parametres=None):
        return v.executer({"source": source, "parametres": parametres or {}})

    def echec(self, sortie, attendu):
        self.assertFalse(sortie["ok"], sortie)
        self.assertEqual((sortie["elements"], sortie["bilan"]), ([], None))
        self.assertIn(attendu, sortie["erreur"])
        self.assertNotIn("\n", sortie["erreur"])
        self.assertLessEqual(len(sortie["erreur"]), v.ERREUR_MAX)

    # ---------------------------------------------------------------- Formes réelles
    def test_kev_real_format_is_normalized_to_structured_fields(self):
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], jeu("cisa-kev.json"))
        sortie = self.collecter("cisa-kev")
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(sortie["bilan"], {"elements": 2, "ecartes": 0, "tronque": False, "detailsEchoues": 0})
        e = sortie["elements"][0]
        self.assertEqual(set(e), {"cve", "editeur", "produit", "nom", "description", "action", "ajoutLe", "echeance", "rancongiciel"})
        self.assertRegex(e["cve"], v.CVE_ID)
        self.assertRegex(e["ajoutLe"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn(e["rancongiciel"], (True, False, None))
        # Champs de la source non retenus (notes et liens, CWE) : rien d'autre ne sort.
        self.assertNotIn("notes", json.dumps(sortie))
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cisa-kev"]["chemins"][0])])

    def test_nvd_is_read_by_modification_window_only_and_paginated(self):
        corps = json.loads(jeu("nvd.json"))
        corps["totalResults"] = 3
        self.repondre("/rest/json/cves/2.0", json.dumps(corps).encode())
        sortie = self.collecter("nvd", {"depuis": "2026-11-13T00:00:00.000Z", "jusqua": "2026-11-14T00:00:00.000Z"})
        self.assertTrue(sortie["ok"], sortie)
        # Deux pages lues (la source annonce trois failles, chaque page en rend deux) : même fenêtre, index suivant.
        self.assertEqual([p for _, p in Faux.recues], [
            "/rest/json/cves/2.0?lastModStartDate=2026-11-13T00:00:00.000Z&lastModEndDate=2026-11-14T00:00:00.000Z&resultsPerPage=2000&startIndex=0",
            "/rest/json/cves/2.0?lastModStartDate=2026-11-13T00:00:00.000Z&lastModEndDate=2026-11-14T00:00:00.000Z&resultsPerPage=2000&startIndex=2",
        ])
        self.assertEqual([e["cve"] for e in sortie["elements"]], ["CVE-2025-4637", "CVE-2025-13353"])
        e = sortie["elements"][0]
        self.assertEqual(e["cvss31"]["vecteur"], "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H")
        self.assertTrue(e["cvss40"]["vecteur"].startswith("CVSS:4.0/"))
        self.assertEqual((e["editeurs"], e["produits"]), (["dlib"], ["dlib"]))
        self.assertTrue(e["publieLe"].endswith("Z"))
        for p in (p for _, p in Faux.recues):
            self.assertNotIn("keyword", p)
            self.assertNotIn("cpeName", p)

    def test_nvd_window_is_checked_and_a_truncated_collect_is_reported(self):
        for parametres in ({"depuis": "2026-01-01T00:00:00.000Z", "jusqua": "2026-11-14T00:00:00.000Z"},
                           {"depuis": "2026-11-14T00:00:00.000Z", "jusqua": "2026-11-13T00:00:00.000Z"},
                           {"depuis": "hier", "jusqua": "2026-11-14T00:00:00.000Z"}):
            with self.subTest(parametres=parametres):
                self.echec(self.collecter("nvd", parametres), "Fenêtre de dates")
        self.assertEqual(Faux.recues, [])
        corps = json.loads(jeu("nvd.json"))
        corps["totalResults"] = 100000
        self.repondre("/rest/json/cves/2.0", json.dumps(corps).encode())
        sortie = self.collecter("nvd", {"depuis": "2026-11-13T00:00:00.000Z", "jusqua": "2026-11-14T00:00:00.000Z"})
        self.assertTrue(sortie["ok"])
        self.assertTrue(sortie["bilan"]["tronque"])
        self.assertEqual(len(Faux.recues), v.NVD_PAGES_MAX)

    def test_epss_is_asked_only_for_the_listed_cves_in_batches(self):
        self.repondre("/data/v1/epss", jeu("epss.json"))
        cves = ["CVE-2026-114713", "CVE-2025-4637", "CVE-2026-54831"]
        sortie = self.collecter("epss", {"cves": cves})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(Faux.recues, [("GET", "/data/v1/epss?cve=" + ",".join(cves))])
        self.assertEqual(sorted(e["cve"] for e in sortie["elements"]), sorted(cves))
        for e in sortie["elements"]:
            self.assertTrue(0 <= e["score"] <= 1 and 0 <= e["centile"] <= 1)
        # Un score pour une faille non demandée est écarté ; plus de cent failles : plusieurs demandes.
        Faux.recues = []
        sortie = self.collecter("epss", {"cves": ["CVE-2026-0001"] + ["CVE-2026-%05d" % i for i in range(10000, 10150)]})
        self.assertEqual(len(Faux.recues), 2)
        self.assertEqual(sortie["elements"], [])
        self.assertEqual(sortie["bilan"]["ecartes"], 6)
        # Aucune faille : aucune demande. Liste mal formée : rien n'est lu.
        Faux.recues = []
        self.assertEqual(self.collecter("epss", {"cves": []})["elements"], [])
        for cves in (["produit fictif"], "CVE-2026-0001", ["CVE-2026-0001"] * (v.BORNES["epss"] + 1)):
            self.echec(self.collecter("epss", {"cves": cves}), "Liste de failles illisible")
        self.assertEqual(Faux.recues, [])

    def test_cert_fr_feeds_then_json_export_for_new_advisories_only(self):
        self.repondre("/avis/feed/", jeu("certfr-avis.xml"))
        self.repondre("/alerte/feed/", rss([]))
        self.repondre("/avis/CERTFR-2026-AVI-1500/json/", jeu("certfr-avis.json"))
        sortie = self.collecter("cert-fr", {"connus": ["CERTFR-2026-AVI-1501"]})
        self.assertTrue(sortie["ok"], sortie)
        a, b = sortie["elements"]
        self.assertEqual((a["identifiant"], a["nature"], a["cvesLues"]), ("CERTFR-2026-AVI-1500", "avis", True))
        self.assertEqual(a["cves"], ["CVE-2026-109163", "CVE-2026-106023", "CVE-2026-63292", "CVE-2026-119618"])
        # Adresse recomposée sur l'hôte joint, à partir de l'identifiant contrôlé (le flux cite un autre nom d'hôte).
        self.assertEqual(a["adresse"], "https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-1500/")
        self.assertEqual(a["publieLe"], "2026-11-12T00:00:00.000Z")
        # Avis déjà lu : son export n'est pas relu, ses CVE sont gardées par l'application.
        self.assertEqual((b["identifiant"], b["cves"], b["cvesLues"]), ("CERTFR-2026-AVI-1501", [], False))
        self.assertEqual([p for _, p in Faux.recues], ["/alerte/feed/", "/avis/feed/", "/avis/CERTFR-2026-AVI-1500/json/"])
        self.assertTrue(all(m == "GET" for m, _ in Faux.recues))

    def test_cert_fr_unreadable_export_keeps_the_advisory_without_cves(self):
        self.repondre("/avis/feed/", jeu("certfr-avis.xml"))
        self.repondre("/alerte/feed/", rss([]))
        self.repondre("/avis/CERTFR-2026-AVI-1500/json/", b"{pas du json")
        self.repondre("/avis/CERTFR-2026-AVI-1501/json/", json.dumps({"reference": "CERTFR-2026-AVI-9999", "cves": []}).encode())
        sortie = self.collecter("cert-fr")
        self.assertTrue(sortie["ok"])
        self.assertEqual([(e["cves"], e["cvesLues"]) for e in sortie["elements"]], [([], False), ([], False)])
        self.assertEqual(sortie["bilan"]["detailsEchoues"], 2)

    def test_cert_sante_real_format(self):
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], jeu("certsante.xml"))
        sortie = self.collecter("cert-sante")
        self.assertTrue(sortie["ok"], sortie)
        e = sortie["elements"][0]
        self.assertEqual((e["identifiant"], e["nature"], e["cves"]), ("10351", "alerte", ["CVE-2026-125742"]))
        self.assertEqual(e["adresse"], "https://cyberveille.esante.gouv.fr/alertes/7-zip-cve-2026-125742-2026-11-13")
        # Le résumé de la source est du HTML échappé : il en sort du texte simple.
        self.assertNotIn("<", e["resume"])
        self.assertNotIn("&lt;", e["resume"])
        self.assertIn("décodeur LZX de 7-Zip, utilisé", e["resume"])

    # ---------------------------------------------------------------- Réseau
    def test_hosts_and_paths_outside_the_closed_list_are_refused_before_any_call(self):
        client = v.Client("cert-fr")
        for chemin in ("/avis/CERTFR-2026-AVI-1500/", "/alerte/../avis/feed/", "/avis/json/", "/avis/CERTFR-2026-XYZ-1/json/",
                       "/avis/feed/?x=1", "https://ailleurs.exemple.test/avis/feed/", "/rest/json/cves/2.0"):
            with self.subTest(chemin=chemin), self.assertRaises(v.Refus):
                client.lire(chemin)
        with self.assertRaises(v.Refus):
            v.Client("nvd").lire("/rest/json/cves/2.0", "keywordSearch=produit fictif")
        self.assertEqual(Faux.recues, [])
        self.echec(self.collecter("ailleurs"), "Source inconnue")
        # Hôtes : la liste fermée seule ; aucune adresse n'est reçue de l'application.
        self.assertEqual(sorted(s["hote"] for s in v.SOURCES.values()),
                         ["api.first.org", "cert.cyber.gouv.fr", "cyberveille.esante.gouv.fr", "services.nvd.nist.gov", "www.cisa.gov"])
        sortie = self.collecter("cisa-kev", {"hote": "ailleurs.exemple.test", "chemin": "/autre"})
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cisa-kev"]["chemins"][0])])
        self.assertFalse(sortie["ok"])

    def test_a_redirect_is_never_followed(self):
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], b"", 301, [("Location", "https://localhost/ailleurs.json")])
        self.echec(self.collecter("cisa-kev"), "Redirection refusée (code 301)")
        self.assertEqual(len(Faux.recues), 1)

    def test_an_invalid_certificate_is_refused(self):
        # Contexte du script tel quel (magasin du système) : le certificat du faux service n'y est pas reconnu.
        self.patch(v, "contexte", self.contexte_systeme)
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], jeu("cisa-kev.json"))
        self.echec(self.collecter("cisa-kev"), "Certificat de la source refusé")
        self.assertEqual(Faux.recues, [])

    def test_tls_context_always_verifies_with_tls_1_2_minimum(self):
        ctx = self.contexte_systeme()
        self.assertEqual(ctx.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(ctx.check_hostname)
        self.assertEqual(ctx.minimum_version, ssl.TLSVersion.TLSv1_2)

    def test_an_oversized_response_is_refused(self):
        self.patch(v, "REPONSE_MAX", {**v.REPONSE_MAX, "cisa-kev": 1000})
        gros = b'{"vulnerabilities": [' + b'{},' * 600 + b'{}]}'
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], gros)
        self.echec(self.collecter("cisa-kev"), "Réponse trop volumineuse")
        # Sans longueur annoncée : la lecture est bornée quand même.
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], gros, en_tetes=[("sans-longueur", "1")])
        self.echec(self.collecter("cisa-kev"), "Réponse trop volumineuse")

    def test_malformed_json_or_unexpected_shape_is_refused(self):
        for corps, attendu in ((b"{pas du json", "JSON attendu"), (b"\xff\xfe", "JSON attendu"), (b"[]", "Catalogue KEV illisible"),
                               (b'{"vulnerabilities": "x"}', "Catalogue KEV illisible"), (b"[" * 100000 + b"]" * 100000, "JSON attendu")):
            with self.subTest(corps=corps[:20]):
                self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], corps)
                self.echec(self.collecter("cisa-kev"), attendu)
        self.repondre("/rest/json/cves/2.0", b'{"vulnerabilities": []}')
        self.echec(self.collecter("nvd", {"depuis": "2026-11-13T00:00:00.000Z", "jusqua": "2026-11-14T00:00:00.000Z"}), "NVD illisible")
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], b"{}", 503)
        self.echec(self.collecter("cisa-kev"), "code 503")
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], b"{}", 429)
        self.echec(self.collecter("cisa-kev"), "code 429")

    def test_malformed_identifiers_are_discarded(self):
        corps = json.loads(jeu("cisa-kev.json"))
        corps["vulnerabilities"] += [{**corps["vulnerabilities"][0], "cveID": "CVE-2026-1<script>"},
                                     {**corps["vulnerabilities"][0], "cveID": "CVE-2026-0001", "dateAdded": "13/11/2026"}, "x"]
        self.repondre(v.SOURCES["cisa-kev"]["chemins"][0], json.dumps(corps).encode())
        sortie = self.collecter("cisa-kev")
        self.assertEqual((len(sortie["elements"]), sortie["bilan"]["ecartes"]), (2, 3))

    # ---------------------------------------------------------------- RSS piégé
    def test_rss_with_doctype_or_entity_declaration_is_refused_before_parsing(self):
        bombe = '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>'
        for entete in (bombe, '<!doctype rss SYSTEM "file:///etc/passwd">', '<!ENTITY x "y">'):
            with self.subTest(entete=entete[:20]):
                self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss(["<title>&lol2;</title><guid>1</guid>"], entete))
                self.echec(self.collecter("cert-sante"), "déclaration de type de document ou d'entité")
        with self.assertRaises(v.Refus):
            v.lire_rss(rss([], "<!DocType rss>"))

    def test_rss_undefined_entity_depth_and_element_count_are_refused(self):
        for corps, attendu in ((rss(["<title>&inconnue;</title><guid>1</guid>"]), "Flux RSS illisible"),
                               (rss(["<title>" + "<a>" * 20 + "x" + "</a>" * 20 + "</title><guid>1</guid>"]), "trop profond"),
                               (rss(["<guid>%d</guid><title>t</title>" % (i + 1) for i in range(v.RSS_ELEMENTS_MAX)]), "trop d'éléments"),
                               (b"\xff\xfe<rss/>", "UTF-8 attendu"),
                               (b"<rss><channel><item><title>non ferm", "Flux RSS illisible")):
            with self.subTest(attendu=attendu):
                self.repondre(v.SOURCES["cert-sante"]["chemins"][0], corps)
                self.echec(self.collecter("cert-sante"), attendu)

    def test_markup_script_and_oversized_text_in_titles_are_cleaned_and_bounded(self):
        titre = ("&lt;script&gt;alert(1)&lt;/script&gt;&lt;b&gt;Produit&lt;/b&gt; - CVE-2026-0001 "
                 "<![CDATA[<img src=x onerror=alert(2)>]]>‮​ Suivez https://ailleurs.exemple.test")
        items = [
            "<title>%s</title><link>https://cyberveille.esante.gouv.fr/alertes/x-2026</link><guid>11</guid><description>%s</description>" % (titre, "&lt;p&gt;" + "mot " * 5000 + "&lt;/p&gt;"),
            "<title>Lien hors de l'hôte - CVE-2026-0002</title><link>https://ailleurs.exemple.test/alertes/x</link><guid>12</guid>",
            "<title>Lien en http - CVE-2026-0003</title><link>http://cyberveille.esante.gouv.fr/alertes/x</link><guid>13</guid>",
            "<title>Identifiant mal formé</title><guid>../14</guid>",
            "<title></title><guid>15</guid>",
            "<title>Titre démesuré %s</title><guid>16</guid>" % ("x" * 100000),
        ]
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss(items))
        sortie = self.collecter("cert-sante")
        self.assertTrue(sortie["ok"], sortie)
        par_id = {e["identifiant"]: e for e in sortie["elements"]}
        self.assertEqual(sorted(par_id), ["11", "12", "13", "16"])
        self.assertEqual(sortie["bilan"]["ecartes"], 2)
        e = par_id["11"]
        for interdit in ("<", ">", "script", "alert(1)", "onerror", "‮", "​"):
            self.assertNotIn(interdit, e["titre"])
        self.assertIn("Produit - CVE-2026-0001", e["titre"])
        self.assertEqual(e["cves"], ["CVE-2026-0001"])
        self.assertLessEqual(len(e["resume"]), v.BORNES["resume"])
        self.assertTrue(e["resume"].endswith("…"))
        # Adresse gardée seulement en https sur l'hôte de la source.
        self.assertEqual(e["adresse"], "https://cyberveille.esante.gouv.fr/alertes/x-2026")
        self.assertIsNone(par_id["12"]["adresse"])
        self.assertIsNone(par_id["13"]["adresse"])
        self.assertEqual(len(par_id["16"]["titre"]), v.BORNES["titre"])
        for x in sortie["elements"]:
            self.assertNotRegex(x["titre"], r"[\x00-\x1f\x7f]")

    def test_cert_fr_items_with_malformed_or_mismatched_references_are_discarded(self):
        items = [
            "<title>Avis fictif</title><link>https://cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-ABC/</link>",
            "<title>Avis fictif</title><link>https://ailleurs.exemple.test/</link><guid>x</guid>",
            "<title>Alerte rangée dans les avis</title><link>https://www.cert.cyber.gouv.fr/alerte/CERTFR-2026-ALE-015/</link>",
            "<title>Avis &lt;i&gt;valide&lt;/i&gt;</title><link>https://www.cert.cyber.gouv.fr/avis/CERTFR-2026-AVI-0001/</link>",
        ]
        self.repondre("/avis/feed/", rss(items))
        self.repondre("/alerte/feed/", rss([]))
        sortie = self.collecter("cert-fr", {"connus": ["CERTFR-2026-AVI-0001"]})
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["CERTFR-2026-AVI-0001"])
        self.assertEqual(sortie["elements"][0]["titre"], "Avis valide")
        self.assertEqual(sortie["bilan"]["ecartes"], 3)
        self.echec(self.collecter("cert-fr", {"connus": ["../etc"]}), "avis connus illisible")


class Texte(unittest.TestCase):
    def test_external_text_becomes_plain_bounded_single_line_text(self):
        self.assertEqual(v.texte("<p>Un <b>avis</b></p>\n<p>fictif</p>", 100), "Un avis fictif")
        self.assertEqual(v.texte("versions < 2.4 et > 2.0", 100), "versions < 2.4 et > 2.0")
        self.assertEqual(v.texte("&amp;lt;script&amp;gt;x&amp;lt;/script&amp;gt;fin", 100), "fin")
        self.assertEqual(v.texte("a\u0000b‮c d", 100), "a b c d")
        # Balise reconstituée après un premier retrait : jamais de « < » suivi d'une lettre, d'une barre ou de « ! ».
        self.assertNotRegex(v.texte("<<script>script>x", 100), r"<[A-Za-z/!?]")
        self.assertNotRegex(v.texte("<scr<script>ipt>alert(1)</scr</script>ipt>", 100), r"<[A-Za-z/!?]")
        self.assertEqual(len(v.texte("x" * 5000, 300)), 300)
        self.assertEqual(v.texte(None, 10), "")


class Isolement(unittest.TestCase):
    def test_runs_isolated_reads_stdin_and_writes_one_normalized_object(self):
        """Lancé comme par l'exécutant (python -I, environnement minimal) : entrée standard seulement, sortie JSON normalisée ;
        demande illisible ou trop grosse refusée sans rien lire."""
        for entree in ("{", "x" * (v.ENTREE_MAX + 2), json.dumps({"source": "nvd", "parametres": {"depuis": "x"}})):
            fait = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=entree, capture_output=True, text=True,
                                  timeout=30, env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}, cwd="/")
            self.assertEqual(fait.returncode, 0, fait.stderr)
            sortie = json.loads(fait.stdout)
            self.assertEqual(set(sortie), {"ok", "elements", "bilan", "erreur"})
            self.assertFalse(sortie["ok"])

    def test_standard_library_only_and_no_redirect_handler(self):
        import ast
        arbre = ast.parse(SCRIPT.read_text(encoding="utf8"))
        modules = {a.name.split(".")[0] for n in ast.walk(arbre) if isinstance(n, ast.Import) for a in n.names}
        modules |= {n.module.split(".")[0] for n in ast.walk(arbre) if isinstance(n, ast.ImportFrom) and n.module}
        self.assertTrue(modules <= set(sys.stdlib_module_names), modules - set(sys.stdlib_module_names))
        self.assertNotIn("urllib", modules)
        self.assertNotIn("subprocess", modules)
        # GET seulement : aucune autre méthode n'est écrite dans le script.
        texte = SCRIPT.read_text(encoding="utf8")
        self.assertEqual(set(__import__("re").findall(r'request\("([A-Z]+)"', texte)), {"GET"})


if __name__ == "__main__":
    unittest.main()
