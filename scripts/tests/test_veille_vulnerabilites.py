"""Script isolé de la veille des vulnérabilités (scripts/veille-vulnerabilites.py, ADR 0100 points 3 à 5, lots V2 et V3)
contre un faux service HTTPS local : liste fermée des hôtes et des chemins, GET seulement, aucune redirection suivie,
certificat toujours vérifié, réponse bornée, JSON mal formé refusé, RSS piégé (déclaration de type, entités, balisage et
script dans un titre, texte démesuré, identifiant mal formé) refusé ou nettoyé. Fiches du CERT Santé (V23, V26) : mentions
structurées seulement, relecture sur changement de titre, bornes (nombre, durée, taille), chemin hors liste refusé, pages
piégées (libellé dans un commentaire, un attribut, un script ; mention contradictoire ; page démesurée). Mandataire sortant de l'établissement (ADR
0101, lot P1) contre un faux mandataire local (tunnel CONNECT) : passage par le tunnel, authentification simple exigée puis
acceptée, refus 407 expliqué, en-tête d'authentification absent de la requête reçue par la source, autorité « de
l'établissement » acceptée seulement si elle est fournie, nom vérifié, tunnel refusé, mandataire injoignable. Jeux d'essai : petits extraits au format
réel des sources (données publiques, scripts/tests/fixtures/veille) ou fictifs ; aucune source réelle n'est jointe."""
import base64
import http.server
import importlib.util
import json
from pathlib import Path
import socket
import socketserver
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
    entetes = []

    def log_message(self, *args):
        pass

    def traiter(self):
        Faux.recues.append((self.command, self.path))
        Faux.entetes.append({k.lower(): val for k, val in self.headers.items()})
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
    def test_json_trop_imbrique_est_refuse_avant_l_analyse(self):
        # Le refus ne dépend ni de la version ni de la construction de Python (RecursionError ou non).
        self.assertTrue(v.trop_imbrique(b"[" * 100000 + b"]" * 100000))
        self.assertTrue(v.trop_imbrique(b'{"a":' * 65 + b"1" + b"}" * 65))
        self.assertFalse(v.trop_imbrique(b'{"a":' * 64 + b"1" + b"}" * 64))
        # Crochets et accolades écrits dans une chaîne, guillemet échappé compris : ils ne comptent pas.
        self.assertFalse(v.trop_imbrique(b'{"texte": "' + b"[{" * 500 + b' \\" [[[", "n": [1, 2]}'))
        self.assertFalse(v.trop_imbrique(b""))

    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        d = Path(cls.dossier.name)
        cls.ca = certificat(d, "serveur")
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Faux)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
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
        self.patch(v, "FICHE_PAUSE", 0)

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
        # Produits touchés avec leur plage (lot V4a), tirés du seul champ « configurations » (jamais de « affected »).
        self.assertEqual(e["produitsTouches"], [{"partie": "a", "editeur": "dlib", "produit": "dlib", "version": None,
                                                 "debutInclus": None, "debutExclus": None, "finInclus": None,
                                                 "finExclus": "19.24.7", "vulnerable": True}])
        self.assertFalse(e["produitsTronques"])
        self.assertTrue(e["publieLe"].endswith("Z"))
        for p in (p for _, p in Faux.recues):
            self.assertNotIn("keyword", p)
            self.assertNotIn("cpeName", p)

    def test_nvd_affected_products_keep_ranges_exact_versions_and_the_vulnerable_flag(self):
        cpe = lambda produit, version="*", update="*": "cpe:2.3:a:editeur_fictif:%s:%s:%s:*:*:*:*:*:*" % (produit, version, update)
        configurations = [{"nodes": [{"operator": "AND", "cpeMatch": [
            {"vulnerable": True, "criteria": cpe("gestionnaire_fictif"), "versionStartIncluding": "10.0", "versionEndExcluding": "10.1.5"},
            {"vulnerable": True, "criteria": cpe("gestionnaire_fictif", "9.4.2")},
            {"vulnerable": True, "criteria": cpe("gestionnaire_fictif", "9.4.2")},
            {"vulnerable": False, "criteria": "cpe:2.3:o:systeme_fictif:noyau_fictif:-:*:*:*:*:*:*:*"},
            # Mise à jour précisée, borne illisible, bornes contradictoires : plage retirée (jamais écartée à tort).
            {"vulnerable": True, "criteria": cpe("agent_fictif", "2.0", "beta1")},
            {"vulnerable": True, "criteria": cpe("autre_fictif"), "versionEndExcluding": "<b>1</b>"},
            {"vulnerable": True, "criteria": cpe("borne_fictive"), "versionEndIncluding": 3},
            # CPE illisibles ou sans éditeur : écartés.
            {"vulnerable": True, "criteria": "cpe:2.3:x:editeur_fictif:produit:*:*:*:*:*:*:*:*"},
            {"vulnerable": True, "criteria": "cpe:2.3:a:*:produit:*:*:*:*:*:*:*:*"},
            {"vulnerable": True, "criteria": "cpe:/a:editeur:produit"},
            {"criteria": cpe("sans_drapeau")},
        ]}]}]
        touches, tronques = v.produits_touches(configurations)
        self.assertFalse(tronques)
        self.assertEqual([(t["produit"], t["vulnerable"]) for t in touches], [
            ("gestionnaire_fictif", True), ("gestionnaire_fictif", True), ("agent_fictif", True), ("autre_fictif", True),
            ("borne_fictive", True), ("noyau_fictif", False)])
        self.assertEqual((touches[0]["debutInclus"], touches[0]["finExclus"], touches[0]["version"]), ("10.0", "10.1.5", None))
        self.assertEqual(touches[1]["version"], "9.4.2")
        for t in touches[2:5]:
            self.assertEqual([t[k] for k in ("version", "debutInclus", "debutExclus", "finInclus", "finExclus")], [None] * 5)
        self.assertEqual((touches[5]["partie"], touches[5]["version"]), ("o", None))

    def test_nvd_affected_products_are_bounded_vulnerable_first_and_truncation_is_flagged(self):
        borne = v.BORNES["produitsTouches"]
        plateformes = [{"vulnerable": False, "criteria": "cpe:2.3:o:systeme_fictif:noyau_%d:*:*:*:*:*:*:*:*" % i} for i in range(5)]
        vulnerables = [{"vulnerable": True, "criteria": "cpe:2.3:a:editeur_fictif:produit_fictif:1.%d:*:*:*:*:*:*:*" % i}
                       for i in range(borne - 2)]
        touches, tronques = v.produits_touches([{"nodes": [{"cpeMatch": plateformes + vulnerables}]}])
        self.assertEqual(len(touches), borne)
        self.assertFalse(tronques)
        self.assertTrue(all(t["vulnerable"] for t in touches[: borne - 2]))
        touches, tronques = v.produits_touches([{"nodes": [{"cpeMatch": vulnerables * 1 + [
            {"vulnerable": True, "criteria": "cpe:2.3:a:editeur_fictif:produit_fictif:2.%d:*:*:*:*:*:*:*" % i} for i in range(3)]}]}])
        self.assertEqual(len(touches), borne)
        self.assertTrue(tronques)
        self.assertEqual(v.produits_touches(None), ([], False))
        self.assertEqual(v.produits_touches([{"nodes": "x"}, "y"]), ([], False))

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

    # ---------------------------------------------------------------- Fiches du CERT Santé (V23, V26)
    FICHE_7ZIP = "/alertes/7-zip-cve-2026-125742-2026-11-13"
    FICHE_CHECKPOINT = "/alertes/check-point-cve-2026-123039-2026-11-13"

    def test_cert_sante_reads_the_page_of_new_publications_and_keeps_only_structured_mentions(self):
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], jeu("certsante.xml"))
        self.repondre(self.FICHE_7ZIP, jeu("certsante-fiche.html"))
        sortie = self.collecter("cert-sante")
        self.assertTrue(sortie["ok"], sortie)
        a, b = sortie["elements"]
        self.assertEqual((a["identifiant"], a["produit"]), ("10351", "7-Zip"))
        # La page porte le libellé « exploitée » dans un script et dans le texte libre : seules les mentions structurées
        # comptent.
        self.assertEqual(a["fiche"], {"exploitee": "oui", "correctif": "oui", "contournement": "non",
                                      "preuveConcept": "disponible", "cvss31": 8.8})
        # Fiche introuvable (404) : l'élément est gardé sans fiche, l'échec est compté, la collecte réussit.
        self.assertEqual((b["produit"], b["fiche"]), ("Check Point", None))
        self.assertEqual(sortie["bilan"]["detailsEchoues"], 1)
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cert-sante"]["chemins"][0]), ("GET", self.FICHE_7ZIP),
                                       ("GET", self.FICHE_CHECKPOINT)])

    def test_cert_sante_known_pages_are_read_again_only_when_the_title_changes(self):
        titre = "Produit fictif - CVE-2026-0004"
        item = ("<title>%s</title><link>https://cyberveille.esante.gouv.fr/alertes/produit-fictif-cve-2026-0004</link>"
                "<guid>20001</guid><pubDate>Fri, 13 Nov 2026 02:06:47 +0000</pubDate>")
        sans_cve = "<title>Éditeur fictif - WSA-2026-01</title><link>https://cyberveille.esante.gouv.fr/alertes/wsa</link><guid>20002</guid>"
        self.repondre("/alertes/produit-fictif-cve-2026-0004", jeu("certsante-fiche.html"))
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss([item % titre, sans_cve]))
        # Déjà lue sous ce titre : pas relue.
        sortie = self.collecter("cert-sante", {"lues": {"20001": v.empreinte_titre(titre)}})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["fiche"] for e in sortie["elements"]], [None, None])
        self.assertEqual(sortie["bilan"]["detailsEchoues"], 0)
        self.assertEqual(len(Faux.recues), 1)
        # Titre modifié (« | modifié le … ») : relue. Une publication sans CVE n'est jamais lue.
        modifie = titre + " | modifié le 16-11-2026"
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss([item % modifie, sans_cve]))
        Faux.recues = []
        sortie = self.collecter("cert-sante", {"lues": {"20001": v.empreinte_titre(titre)}})
        a, b = sortie["elements"]
        self.assertEqual((a["titre"], a["produit"], a["fiche"]["exploitee"]), (modifie, "Produit fictif", "oui"))
        self.assertEqual((b["cves"], b["produit"], b["fiche"]), ([], None, None))
        self.assertEqual([c for _, c in Faux.recues], [v.SOURCES["cert-sante"]["chemins"][0], "/alertes/produit-fictif-cve-2026-0004"])
        # Liste reçue de l'application contrôlée : forme stricte, bornée, sinon rien n'est lu.
        Faux.recues = []
        for lues in ({"../1": "0" * 16}, {"20001": "pas-une-empreinte"}, ["20001"],
                     {str(i + 1): "0" * 16 for i in range(v.FICHES_LUES_MAX + 1)}):
            with self.subTest(lues=str(lues)[:30]):
                self.echec(self.collecter("cert-sante", {"lues": lues}), "fiches déjà lues illisible")
        self.assertEqual(Faux.recues, [])

    def test_cert_sante_page_reads_are_bounded_in_number_time_and_size(self):
        items = ["<title>Produit %d - CVE-2026-000%d</title><link>https://cyberveille.esante.gouv.fr/alertes/p-%d</link>"
                 "<guid>%d</guid>" % (i, i, i, 30000 + i) for i in range(1, 5)]
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss(items))
        for i in range(1, 5):
            self.repondre("/alertes/p-%d" % i, jeu("certsante-fiche.html"))
        attentes = []
        self.patch(v, "FICHE_PAUSE", 0.01)
        self.patch(v.time, "sleep", lambda d: attentes.append(d))
        self.patch(v, "BORNES", {**v.BORNES, "fichesCertSante": 2})
        sortie = self.collecter("cert-sante")
        self.assertEqual([e["fiche"] is not None for e in sortie["elements"]], [True, True, False, False])
        self.assertEqual(sortie["bilan"]["detailsEchoues"], 2)
        self.assertEqual(attentes, [0.01])
        # Durée de lecture des fiches dépassée : plus aucune fiche, le flux reste rapporté.
        self.patch(v, "FICHE_DUREE_MAX", -1)
        sortie = self.collecter("cert-sante")
        self.assertTrue(sortie["ok"])
        self.assertEqual([e["fiche"] for e in sortie["elements"]], [None] * 4)
        self.assertEqual(sortie["bilan"]["detailsEchoues"], 4)
        # Page démesurée : refusée (annoncée ou non), l'élément est gardé sans fiche.
        self.patch(v, "FICHE_DUREE_MAX", 150)
        self.patch(v, "FICHE_MAX", 1000)
        self.repondre("/alertes/p-1", jeu("certsante-fiche.html"))
        self.repondre("/alertes/p-2", jeu("certsante-fiche.html"), en_tetes=[("sans-longueur", "1")])
        sortie = self.collecter("cert-sante")
        self.assertTrue(sortie["ok"])
        self.assertEqual([e["fiche"] for e in sortie["elements"]][:2], [None, None])

    def test_cert_sante_page_paths_outside_the_closed_list_are_refused(self):
        client = v.Client("cert-sante")
        for chemin in ("/alertes/", "/alertes/../rss.xml", "/alertes/x/y", "/alertes/Majuscule", "/alertes/x?y=1",
                       "/alertes/x%2f", "/alertes/" + "x" * 201, "/alerte/x", "/alertes-et-vulnerabilites/x"):
            with self.subTest(chemin=chemin), self.assertRaises(v.Refus):
                client.lire(chemin)
        with self.assertRaises(v.Refus):
            client.lire("/alertes/x", "page=2")
        # Le motif des fiches ne vaut que pour le CERT Santé.
        with self.assertRaises(v.Refus):
            v.Client("cert-fr").lire("/alertes/x")
        self.assertEqual(Faux.recues, [])
        # Lien du flux hors de l'hôte ou du chemin des fiches : aucune lecture.
        items = ["<title>A - CVE-2026-0001</title><link>https://ailleurs.exemple.test/alertes/a</link><guid>1</guid>",
                 "<title>B - CVE-2026-0002</title><link>https://cyberveille.esante.gouv.fr/autre/b</link><guid>2</guid>"]
        self.repondre(v.SOURCES["cert-sante"]["chemins"][0], rss(items))
        sortie = self.collecter("cert-sante")
        self.assertEqual([e["fiche"] for e in sortie["elements"]], [None, None])
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cert-sante"]["chemins"][0])])

    def test_cert_sante_trapped_pages_never_produce_a_mention_by_keyword(self):
        def page(corps):
            return ("<html><head><title>t</title></head><body>%s</body></html>" % corps).encode("utf-8")

        def mention(libelle, valeur):
            return '<p><span class="fw-medium">%s : </span> %s</p>' % (libelle, valeur)
        rien = {"exploitee": None, "correctif": None, "contournement": None, "preuveConcept": None, "cvss31": None}
        # Libellés dans un commentaire, un attribut, un script, un style, un gabarit : rien.
        for corps in ("<!-- La faille est activement exploitée : Oui -->",
                      '<p title="La faille est activement exploitée : ">Oui</p>',
                      "<script>La faille est activement exploitée :</script><p>Oui</p>",
                      "<style>Un correctif existe :</style><p>Non</p>",
                      "<template>%s</template>" % mention("La faille est activement exploitée", "Oui"),
                      "<p>La faille est activement exploitée : Oui</p>",
                      "<p>La vulnérabilité exploitée est activement exploitée et une preuve de concept est disponible.</p>",
                      "<p>[Score CVSS v3.1 : 9.8] et plus</p>"):
            with self.subTest(corps=corps[:40]):
                self.assertEqual(v.lire_fiche(page(corps)), rien)
        # Mention répétée : gardée si elle concorde, non renseignée si elle se contredit ou prend une forme imprévue.
        self.assertEqual(v.lire_fiche(page(mention("Un correctif existe", "Oui") * 2))["correctif"], "oui")
        for corps in (mention("Un correctif existe", "Oui") + mention("Un correctif existe", "Non"),
                      mention("Un correctif existe", "Oui, partiellement"),
                      mention("Un correctif existe", "") + "<p>Oui</p>",
                      mention("Un correctif existe", "oui")):
            with self.subTest(corps=corps[:60]):
                self.assertIsNone(v.lire_fiche(page(corps))["correctif"])
        # Preuve de concept : seules les deux phrases observées ; une autre phrase, même affirmative, n'est pas lue.
        preuve = "<div><strong>Preuve de concept</strong><br>%s</div>"
        self.assertEqual(v.lire_fiche(page(preuve % "Une preuve de concept est disponible en sources ouvertes."))["preuveConcept"], "disponible")
        self.assertEqual(v.lire_fiche(page(preuve % "Actuellement, aucune preuve de concept n’est disponible en sources ouvertes."))["preuveConcept"], "indisponible")
        for phrase in ("Une preuve de concept serait disponible.", "Oui", ""):
            self.assertIsNone(v.lire_fiche(page(preuve % phrase))["preuveConcept"])
        # Score : forme exacte, dans l'échelle ; sinon non renseigné.
        for score, attendu in (("7.5", 7.5), ("10", 10.0), ("7,5", None), ("11.0", None), ("7.55", None), ("-1", None)):
            with self.subTest(score=score):
                self.assertEqual(v.lire_fiche(page("<a>[Score CVSS v3.1 : %s]</a>" % score))["cvss31"], attendu)
        self.assertIsNone(v.lire_fiche(page("<a>[Score CVSS v3.1 : 7.5]</a><a>[Score CVSS v3.1 : 9.8]</a>"))["cvss31"])
        # Page illisible : refusée.
        with self.assertRaises(v.Refus):
            v.lire_fiche(b"\xff\xfe<p>")
        with self.assertRaises(v.Refus):
            v.lire_fiche(("<p>x</p>" * (v.FICHE_FRAGMENTS_MAX + 1)).encode())

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


def autorite_et_feuille(dossier):
    """Autorité fictive « de l'établissement » et certificat de « localhost » signé par elle (extensions d'une vraie chaîne,
    pour la vérification stricte de Python)."""
    def openssl(*args):
        subprocess.run(["openssl", *args], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(dossier / "ca.key"), "-out", str(dossier / "ca.crt"),
            "-days", "2", "-subj", "/CN=Autorite fictive de l'etablissement",
            "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign")
    (dossier / "ext.cnf").write_text("basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n"
                                     "extendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost\n"
                                     "subjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n")
    openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", str(dossier / "feuille.key"), "-out", str(dossier / "feuille.csr"),
            "-subj", "/CN=localhost")
    openssl("x509", "-req", "-in", str(dossier / "feuille.csr"), "-CA", str(dossier / "ca.crt"), "-CAkey", str(dossier / "ca.key"),
            "-CAcreateserial", "-out", str(dossier / "feuille.crt"), "-days", "2", "-extfile", str(dossier / "ext.cnf"))
    return (dossier / "ca.crt").read_text(), str(dossier / "feuille.crt"), str(dossier / "feuille.key")


class FauxMandataire(socketserver.ThreadingTCPServer):
    """Faux mandataire HTTP : n'accepte que CONNECT, exige au besoin l'authentification simple (identifiant et mot de passe
    réglés par le test), puis relaie les octets dans les deux sens. Chaque demande reçue est gardée (lignes d'en-tête)."""

    daemon_threads = True
    allow_reuse_address = True

    def __init__(self):
        super().__init__(("127.0.0.1", 0), TraitementMandataire)
        self.demandes = []
        self.attendu = None
        self.schemas = ("Basic realm=\"fictif\"",)
        self.forcee = None


class TraitementMandataire(socketserver.BaseRequestHandler):
    def handle(self):
        srv, client = self.server, self.request
        brut = b""
        while b"\r\n\r\n" not in brut:
            d = client.recv(4096)
            if not d:
                return
            brut += d
        tete, _, reste = brut.partition(b"\r\n\r\n")
        lignes = tete.decode("latin-1").split("\r\n")
        entetes = {k.strip().lower(): val.strip() for k, _, val in (x.partition(":") for x in lignes[1:])}
        srv.demandes.append({"ligne": lignes[0], "entetes": entetes})
        methode, cible, _ = lignes[0].split(" ", 2)
        if srv.forcee:
            client.sendall(("HTTP/1.1 %s\r\nContent-Length: 0\r\n\r\n" % srv.forcee).encode())
            return
        if methode != "CONNECT":
            client.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
            return
        if srv.attendu is not None:
            jeton = "Basic " + base64.b64encode(("%s:%s" % srv.attendu).encode("utf-8")).decode("ascii")
            if entetes.get("proxy-authorization") != jeton:
                demande = "".join("Proxy-Authenticate: %s\r\n" % x for x in srv.schemas)
                client.sendall(("HTTP/1.1 407 Proxy Authentication Required\r\n%sContent-Length: 0\r\n\r\n" % demande).encode())
                return
        hote, port = cible.rsplit(":", 1)
        try:
            dest = socket.create_connection(("127.0.0.1" if hote == "localhost" else hote.strip("[]"), int(port)), timeout=10)
        except OSError:
            client.sendall(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
            return
        client.sendall(b"HTTP/1.1 200 Connection established\r\n\r\n")
        if reste:
            dest.sendall(reste)

        def copier(de, vers):
            try:
                while True:
                    d = de.recv(65536)
                    if not d:
                        break
                    vers.sendall(d)
            except OSError:
                pass
            finally:
                try:
                    vers.shutdown(socket.SHUT_WR)
                except OSError:
                    pass
        t = threading.Thread(target=copier, args=(dest, client), daemon=True)
        t.start()
        copier(client, dest)
        t.join(10)
        dest.close()


class Mandataire(unittest.TestCase):
    """Collecte par le mandataire de l'établissement : la source est un faux service HTTPS dont le certificat est signé par
    une autorité fictive « de l'établissement », inconnue du magasin du système. Le contexte n'est pas remplacé ici : seule
    l'autorité fournie dans les paramètres du mandataire la fait reconnaître."""

    IDENTIFIANT = "compte-veille"
    MOT_DE_PASSE = "Mdp-fictif:42-é"

    @classmethod
    def setUpClass(cls):
        cls.dossier = tempfile.TemporaryDirectory()
        cls.autorite, feuille, cle = autorite_et_feuille(Path(cls.dossier.name))
        cls.autre_autorite = Path(certificat(Path(cls.dossier.name), "autre")).read_text()
        cls.serveur = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Faux)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(feuille, cle)
        cls.serveur.socket = ctx.wrap_socket(cls.serveur.socket, server_side=True)
        cls.port = cls.serveur.server_address[1]
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()
        cls.mandataire = FauxMandataire()
        threading.Thread(target=cls.mandataire.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        for srv in (cls.serveur, cls.mandataire):
            srv.shutdown()
            srv.server_close()
        cls.dossier.cleanup()

    def setUp(self):
        Faux.reponses, Faux.recues, Faux.entetes = {}, [], []
        self.mandataire.demandes, self.mandataire.attendu, self.mandataire.forcee = [], None, None
        self.mandataire.schemas = ("Basic realm=\"fictif\"",)
        p = patch.object(v, "destination", lambda source: ("localhost", self.port))
        p.start()
        self.addCleanup(p.stop)
        Faux.reponses[v.SOURCES["cisa-kev"]["chemins"][0]] = (200, jeu("cisa-kev.json"), ())

    def parametres(self, **extra):
        m = {"hote": "127.0.0.1", "port": self.mandataire.server_address[1], "identifiant": "", "motDePasse": "",
             "autorite": self.autorite}
        m.update(extra)
        return m

    def collecter(self, mandataire):
        return v.executer({"source": "cisa-kev", "parametres": {}, "mandataire": mandataire})

    def echec(self, sortie, *attendus):
        self.assertFalse(sortie["ok"], sortie)
        self.assertEqual((sortie["elements"], sortie["bilan"]), ([], None))
        for attendu in attendus:
            self.assertIn(attendu, sortie["erreur"])
        self.assertNotIn("\n", sortie["erreur"])
        self.assertLessEqual(len(sortie["erreur"]), v.ERREUR_MAX)
        self.assertNotIn(self.MOT_DE_PASSE, json.dumps(sortie))

    def test_collect_goes_through_the_tunnel_with_basic_auth_sent_to_the_proxy_only(self):
        self.mandataire.attendu = (self.IDENTIFIANT, self.MOT_DE_PASSE)
        sortie = self.collecter(self.parametres(identifiant=self.IDENTIFIANT, motDePasse=self.MOT_DE_PASSE))
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(sortie["bilan"]["elements"], 2)
        # Une seule demande au mandataire : CONNECT vers l'hôte de la liste fermée (remplacé par le faux service), avec
        # l'authentification simple.
        self.assertEqual(len(self.mandataire.demandes), 1)
        d = self.mandataire.demandes[0]
        self.assertEqual(d["ligne"], "CONNECT localhost:%d HTTP/1.1" % self.port)
        jeton = base64.b64encode(("%s:%s" % (self.IDENTIFIANT, self.MOT_DE_PASSE)).encode("utf-8")).decode("ascii")
        self.assertEqual(d["entetes"]["proxy-authorization"], "Basic " + jeton)
        # La source ne reçoit qu'un GET sur le chemin de la liste fermée, sans l'en-tête d'authentification du mandataire.
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cisa-kev"]["chemins"][0])])
        self.assertEqual(len(Faux.entetes), 1)
        self.assertNotIn("proxy-authorization", Faux.entetes[0])
        self.assertNotIn(jeton, json.dumps(Faux.entetes))
        self.assertNotIn(self.MOT_DE_PASSE, json.dumps(sortie))

    def test_proxy_without_authentication_is_supported(self):
        sortie = self.collecter(self.parametres())
        self.assertTrue(sortie["ok"], sortie)
        self.assertNotIn("proxy-authorization", self.mandataire.demandes[0]["entetes"])

    def test_authentication_required_or_refused_is_explained_with_the_basic_only_limit(self):
        self.mandataire.attendu = (self.IDENTIFIANT, self.MOT_DE_PASSE)
        self.echec(self.collecter(self.parametres()), "exige une authentification (code 407)", "identifiant et le mot de passe",
                   "NTLM et Kerberos ne le sont pas")
        self.echec(self.collecter(self.parametres(identifiant=self.IDENTIFIANT, motDePasse="mauvais")),
                   "Authentification refusée par le mandataire (code 407)", "vérifiez l'identifiant",
                   "Seule l'authentification simple (Basic)")
        self.mandataire.schemas = ("NTLM", "Negotiate")
        self.echec(self.collecter(self.parametres(identifiant=self.IDENTIFIANT, motDePasse=self.MOT_DE_PASSE + "x")),
                   "code 407", "il demande NTLM, Negotiate", "NTLM et Kerberos ne le sont pas")
        self.assertEqual(Faux.recues, [])

    def test_establishment_authority_is_needed_and_added_to_the_system_store(self):
        # Sans l'autorité de l'établissement (magasin du système seul) ou avec une autre autorité : certificat refusé, et le
        # message dit quoi fournir.
        for autorite in ("", self.autre_autorite):
            with self.subTest(autorite=bool(autorite)):
                self.echec(self.collecter(self.parametres(autorite=autorite)), "Certificat de la source refusé à travers le mandataire",
                           "autorité de certification de l'établissement")
        self.assertEqual(Faux.recues, [])
        # Avec elle : acceptée, et la vérification du nom reste faite.
        self.assertTrue(self.collecter(self.parametres())["ok"])
        with patch.object(v, "destination", lambda source: ("127.0.0.1", self.port)):
            self.echec(self.collecter(self.parametres()), "Certificat de la source refusé")
        # Autorité illisible : rien n'est lu.
        self.mandataire.demandes = []
        self.echec(self.collecter(self.parametres(autorite="-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----")),
                   "Autorité de certification de l'établissement illisible")
        self.assertEqual(self.mandataire.demandes, [])

    def test_refused_tunnel_and_unreachable_proxy_are_explained(self):
        self.mandataire.forcee = "403 Forbidden"
        self.echec(self.collecter(self.parametres()), "Tunnel refusé par le mandataire vers localhost (code 403)")
        libre = socket.socket()
        libre.bind(("127.0.0.1", 0))
        port_ferme = libre.getsockname()[1]
        libre.close()
        self.echec(self.collecter(self.parametres(port=port_ferme)), "Mandataire injoignable", "connexion refusée",
                   "127.0.0.1:%d" % port_ferme)
        self.echec(self.collecter(self.parametres(hote="mandataire.invalid")), "Mandataire injoignable", "mandataire.invalid")
        self.assertEqual(Faux.recues, [])

    def test_closed_list_get_only_and_no_redirect_still_apply_through_the_proxy(self):
        Faux.reponses[v.SOURCES["cisa-kev"]["chemins"][0]] = (301, b"", (("Location", "https://ailleurs.exemple.test/"),))
        self.echec(self.collecter(self.parametres()), "Redirection refusée (code 301)")
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cisa-kev"]["chemins"][0])])
        self.assertEqual(len(self.mandataire.demandes), 1)
        self.assertTrue(self.mandataire.demandes[0]["ligne"].startswith("CONNECT localhost:"))

    def test_malformed_proxy_parameters_read_nothing(self):
        for m in ({"hote": "127.0.0.1"}, self.parametres(port=0), self.parametres(port="3128"), self.parametres(port=True),
                  self.parametres(hote="mandataire interne"), self.parametres(hote="999.1.1.1"),
                  self.parametres(identifiant="a:b"), self.parametres(identifiant="a\r\nX-Injecte: 1"),
                  self.parametres(motDePasse="x\r\ny"), self.parametres(autorite="pas un certificat"),
                  {**self.parametres(), "extra": 1}, "http://127.0.0.1:3128"):
            with self.subTest(m=str(m)[:60]):
                self.echec(self.collecter(m), "Paramètres du mandataire illisibles")
        self.assertEqual(self.mandataire.demandes, [])
        self.assertEqual(Faux.recues, [])
        # Adresse IPv6 admise (forme) : le mandataire n'écoute pas là, l'échec est celui de la connexion.
        self.assertIn("Mandataire injoignable", self.collecter(self.parametres(hote="::1", port=9))["erreur"])

    def test_without_proxy_the_source_is_joined_directly(self):
        """Non-régression : sans paramètres de mandataire, le mandataire n'est pas contacté (connexion directe)."""
        vrai = v.contexte

        def contexte():
            c = vrai()
            c.load_verify_locations(cadata=self.autorite)
            return c
        with patch.object(v, "contexte", contexte):
            sortie = v.executer({"source": "cisa-kev", "parametres": {}})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(self.mandataire.demandes, [])
        self.assertEqual(Faux.recues, [("GET", v.SOURCES["cisa-kev"]["chemins"][0])])

    def test_cert_sante_feed_and_pages_go_through_the_proxy(self):
        """Les lectures des fiches du CERT Santé passent par le mandataire comme les autres : un tunnel par lecture, vers
        l'hôte de la liste fermée, GET sur le flux puis sur la fiche."""
        Faux.reponses[v.SOURCES["cert-sante"]["chemins"][0]] = (200, jeu("certsante.xml"), ())
        Faux.reponses["/alertes/7-zip-cve-2026-125742-2026-11-13"] = (200, jeu("certsante-fiche.html"), ())
        self.mandataire.attendu = (self.IDENTIFIANT, self.MOT_DE_PASSE)
        with patch.object(v, "FICHE_PAUSE", 0):
            sortie = v.executer({"source": "cert-sante", "parametres": {},
                                 "mandataire": self.parametres(identifiant=self.IDENTIFIANT, motDePasse=self.MOT_DE_PASSE)})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(sortie["elements"][0]["fiche"]["exploitee"], "oui")
        self.assertEqual([c for _, c in Faux.recues], [v.SOURCES["cert-sante"]["chemins"][0],
                                                      "/alertes/7-zip-cve-2026-125742-2026-11-13",
                                                      "/alertes/check-point-cve-2026-123039-2026-11-13"])
        self.assertEqual([d["ligne"] for d in self.mandataire.demandes], ["CONNECT localhost:%d HTTP/1.1" % self.port] * 3)
        self.assertTrue(all("proxy-authorization" not in e for e in Faux.entetes))
        self.assertNotIn(self.MOT_DE_PASSE, json.dumps(sortie))

    def test_runs_isolated_with_proxy_parameters_on_stdin_only(self):
        self.mandataire.attendu = (self.IDENTIFIANT, self.MOT_DE_PASSE)
        # Le script lancé seul joint l'hôte réel de la liste fermée : on vérifie ici seulement que les paramètres du mandataire
        # sont lus sur l'entrée standard et que la demande part vers lui (le faux mandataire refuse ce tunnel).
        self.mandataire.forcee = "403 Forbidden"
        entree = json.dumps({"source": "cisa-kev", "parametres": {},
                             "mandataire": self.parametres(identifiant=self.IDENTIFIANT, motDePasse=self.MOT_DE_PASSE)})
        fait = subprocess.run([sys.executable, "-I", str(SCRIPT)], input=entree, capture_output=True, text=True, timeout=60,
                              env={"PATH": "/usr/bin:/bin", "LANG": "C.UTF-8"}, cwd="/")
        self.assertEqual(fait.returncode, 0, fait.stderr)
        sortie = json.loads(fait.stdout)
        self.assertFalse(sortie["ok"])
        self.assertIn("Tunnel refusé par le mandataire vers www.cisa.gov (code 403)", sortie["erreur"])
        self.assertEqual(self.mandataire.demandes[0]["ligne"], "CONNECT www.cisa.gov:443 HTTP/1.1")
        self.assertNotIn(self.MOT_DE_PASSE, fait.stdout + fait.stderr)


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
        # CONNECT n'est écrit qu'une fois, dans la demande de tunnel au mandataire ; l'en-tête d'authentification du
        # mandataire aussi, et jamais dans les en-têtes de la requête à la source. Aucune option qui coupe la vérification.
        self.assertEqual(texte.count('"CONNECT '), 1)
        self.assertEqual(texte.count('"Proxy-Authorization: Basic "'), 1)
        for interdit in ("CERT_NONE", "check_hostname = False", "_create_unverified_context", "set_tunnel"):
            self.assertNotIn(interdit, texte)


if __name__ == "__main__":
    unittest.main()
