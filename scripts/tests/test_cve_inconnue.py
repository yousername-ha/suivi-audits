"""CVE inconnue de la veille et sources facultatives (ADR 0100, lot CVE-INC) dans le script isolé
scripts/veille-vulnerabilites.py, contre le faux service HTTPS local de test_veille_vulnerabilites.py : enregistrement CVE
JSON 5 de cve.org réduit à la liste blanche (titre, description, dates, CNA, références https, produits déclarés, SSVC et KEV
du conteneur ADP de la CISA), absent (404) ou illisible, puis NVD (paramètre cveId) ; préavis de Cloudflare Radar (JSON
Feed, requête fixe, clés inconnues ignorées, lien hors hôte écarté) ; résumés de tldrcve (RSS 2.0, verdict, nature, CVE
citées, lien hors hôte écarté, RSS piégé refusé) ; contrôles Tenable d'une CVE dans scripts/integration-http.py (requête
fixe, liste blanche, citation exacte de la CVE). Réponses fictives écrites à la main ; aucun service réel n'est joint."""
import http.server
import importlib.util
import json
from pathlib import Path
import re
import ssl
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from test_veille_vulnerabilites import Faux, certificat, v

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("integration_http_cve", ROOT / "scripts/integration-http.py")
h = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(h)

CVE = "CVE-2026-90001"
# Délai du passage court de l'exécutant, lu dans son script (une seule source).
CVE_DELAI_COURT = int(re.search(r"^CVE_DELAI_COURT = (\d+)$", (ROOT / "scripts/exploitation-worker.py").read_text(), re.M).group(1))
CVE_DELAI = int(re.search(r"^CVE_DELAI = (\d+)$", (ROOT / "scripts/exploitation-worker.py").read_text(), re.M).group(1))


def enregistrement(cve=CVE, **extra):
    """Enregistrement CVE JSON 5 fictif, avec des champs que le script doit écarter."""
    r = {
        "dataType": "CVE_RECORD", "dataVersion": "5.1",
        "cveMetadata": {"cveId": cve, "assignerOrgId": "00000000-0000-4000-8000-000000000000", "assignerShortName": "exemple",
                        "state": "PUBLISHED", "datePublished": "2026-11-20T10:00:00.000Z", "dateUpdated": "2026-11-21T10:00:00",
                        "dateReserved": "2026-11-01T00:00:00.000Z"},
        "containers": {
            "cna": {
                "title": "Débordement <b>fictif</b> dans un serveur imaginaire",
                "descriptions": [{"lang": "fr", "value": "ignorée"}, {"lang": "en", "value": "A fictitious overflow.\x07"}],
                "affected": [{"vendor": "Éditeur fictif", "product": "Serveur imaginaire", "defaultStatus": "unaffected",
                              "versions": [{"version": "1.0", "status": "affected", "lessThan": "1.4", "versionType": "semver"},
                                           {"version": "< 2", "status": "bizarre"}]},
                             {"vendor": "", "product": ""}],
                "references": [{"url": "https://editeur.exemple.invalid/avis/1", "name": "Avis fictif"},
                               {"url": "http://non-chiffre.exemple.invalid/"},
                               {"url": "https://editeur.exemple.invalid/a\"b"},
                               {"url": "https://editeur.exemple.invalid/avis/1"}],
                "problemTypes": [{"descriptions": [{"cweId": "CWE-787"}]}],
                "x_generator": {"engine": "ignoré"},
            },
            "adp": [
                {"providerMetadata": {"shortName": "AUTRE-ADP"},
                 "metrics": [{"other": {"type": "ssvc", "content": {"options": [{"Exploitation": "active"}]}}}]},
                {"providerMetadata": {"shortName": "CISA-ADP"}, "title": "CISA ADP Vulnrichment",
                 "metrics": [{"other": {"type": "ssvc", "content": {"timestamp": "2026-11-21T12:00:00.123456Z", "id": cve,
                                                                    "options": [{"Exploitation": "POC"}, {"Automatable": "no"},
                                                                                {"Technical Impact": "total"}],
                                                                    "role": "CISA Coordinator", "version": "2.0.3"}}},
                             {"other": {"type": "kev", "content": {"dateAdded": "2026-11-21", "reference": "https://www.cisa.gov/x"}}}]},
            ],
        },
    }
    r.update(extra)
    return json.dumps(r).encode()


def nvd_vide():
    return json.dumps({"resultsPerPage": 0, "startIndex": 0, "totalResults": 0, "vulnerabilities": []}).encode()


def nvd_une(cve=CVE):
    return json.dumps({"resultsPerPage": 1, "startIndex": 0, "totalResults": 1, "vulnerabilities": [{"cve": {
        "id": cve, "published": "2026-11-20T10:00:00.000", "lastModified": "2026-11-21T10:00:00.000",
        "descriptions": [{"lang": "en", "value": "A fictitious overflow."}],
        "metrics": {"cvssMetricV31": [{"type": "Primary", "cvssData": {"version": "3.1", "baseScore": 9.8,
                                        "vectorString": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "baseSeverity": "CRITICAL"}}]},
        "configurations": []}}]}).encode()


class CveInconnue(unittest.TestCase):
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
        Faux.reponses, Faux.recues = {}, []
        vrai, ca = v.contexte, self.ca

        def contexte():
            c = vrai()
            c.load_verify_locations(ca)
            return c
        self.destinations = []

        def destination(source):
            self.destinations.append(v.TOUTES_SOURCES[source]["hote"])
            return "localhost", self.port
        for nom, valeur in (("destination", destination), ("contexte", contexte)):
            p = patch.object(v, nom, valeur)
            p.start()
            self.addCleanup(p.stop)

    def repondre(self, chemin, corps, code=200):
        Faux.reponses[chemin] = (code, corps, ())

    def consulter(self, cve=CVE):
        return v.executer({"source": "cve-inconnue", "parametres": {"cve": cve}})

    def test_liste_fermee_et_hotes(self):
        self.assertEqual(v.SOURCES_CVE_INCONNUE, {"cve-org": {"hote": "cveawg.mitre.org", "chemins": ["/api/cve/{cve}"]}})
        self.assertTrue(v.chemin_admis("cve-org", "/api/cve/" + CVE))
        for refuse in ("/api/cve/CVE-26-1", "/api/cve/" + CVE + "/x", "/api/cve/", "/api/cves/" + CVE):
            self.assertFalse(v.chemin_admis("cve-org", refuse), refuse)
        self.assertEqual(v.SOURCES_ANNONCES["cloudflare-radar"]["hote"], "radar.cloudflare.com")
        self.assertEqual(v.SOURCES_ANNONCES["tldrcve"]["hote"], "tldrcve.com")
        self.assertFalse(v.chemin_admis("cloudflare-radar", "/zero-wire/briefings/feed"))

    def test_enregistrement_reduit_a_la_liste_blanche_puis_nvd(self):
        self.repondre("/api/cve/" + CVE, enregistrement())
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_une())
        r = self.consulter()
        self.assertTrue(r["ok"], r)
        self.assertEqual((r["cveOrgEtat"], r["nvdEtat"]), ("trouvee", "trouvee"))
        self.assertEqual([p for _, p in Faux.recues], ["/api/cve/" + CVE, "/rest/json/cves/2.0?cveId=" + CVE])
        self.assertEqual(self.destinations, ["cveawg.mitre.org", "services.nvd.nist.gov"])
        f = r["cveOrg"]
        self.assertEqual(set(f), {"cve", "etat", "titre", "description", "publieLe", "majLe", "cna", "references", "produits",
                                  "ssvc", "kevAjoutLe"})
        self.assertEqual(f["titre"], "Débordement fictif dans un serveur imaginaire")
        self.assertEqual(f["description"], "A fictitious overflow.")
        self.assertEqual((f["etat"], f["cna"], f["publieLe"], f["majLe"]),
                         ("publiee", "exemple", "2026-11-20T10:00:00.000Z", "2026-11-21T10:00:00.000Z"))
        # Références : https seulement, sans caractère interdit, sans doublon.
        self.assertEqual(f["references"], [{"url": "https://editeur.exemple.invalid/avis/1", "nom": "Avis fictif"}])
        self.assertEqual(f["produits"], [{"editeur": "Éditeur fictif", "produit": "Serveur imaginaire", "versions": [
            {"version": "1.0", "statut": "affected", "inferieurA": "1.4", "auPlus": None},
            {"version": None, "statut": None, "inferieurA": None, "auPlus": None}]}])
        # SSVC et KEV du seul conteneur ADP de la CISA, valeurs ramenées à la liste fermée.
        self.assertEqual(f["ssvc"], {"exploitation": "poc", "automatisable": "no", "impact": "total",
                                     "evalueLe": "2026-11-21T12:00:00.123Z"})
        self.assertEqual(f["kevAjoutLe"], "2026-11-21")
        self.assertNotIn("CWE-787", json.dumps(r))
        self.assertEqual(r["nvd"]["cvss31"]["score"], 9.8)

    def test_absente_de_cve_org_et_de_nvd_n_est_pas_un_echec(self):
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_vide())
        r = self.consulter()
        self.assertEqual(r, {"ok": True, "erreur": None, "cveOrg": None, "cveOrgEtat": "absente", "nvd": None, "nvdEtat": "absente"})

    def test_chaque_partie_a_son_etat_echec_global_si_les_deux_echouent(self):
        self.repondre("/api/cve/" + CVE, enregistrement(cve="CVE-2026-90002"))
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_une())
        r = self.consulter()
        self.assertEqual((r["ok"], r["cveOrgEtat"], r["nvdEtat"]), (True, "echec", "trouvee"))
        self.repondre("/api/cve/" + CVE, b"{pas du json", 200)
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, b"", 503)
        r = self.consulter()
        self.assertFalse(r["ok"])
        self.assertIn("cve.org : Réponse illisible", r["erreur"])
        self.assertIn("NVD : Réponse inattendue de la source (code 503)", r["erreur"])
        self.assertEqual((r["cveOrg"], r["nvd"], r["cveOrgEtat"], r["nvdEtat"]), (None, None, None, None))

    def test_identifiant_mal_forme_rien_n_est_lu(self):
        for cve in ("CVE-26-1", "CVE-2026-1/../x", None, 12):
            r = self.consulter(cve)
            self.assertFalse(r["ok"])
            self.assertIn("rien n'a été lu", r["erreur"])
        self.assertEqual(Faux.recues, [])

    def test_cve_org_muet_nvd_lue_reponse_partielle_dans_le_delai_du_passage_court(self):
        # Relecture de la PR #369 : cve.org ne répond pas ; le script, qui connaît le délai après lequel l'exécutant
        # l'interrompt, laisse à NVD le temps de répondre. Réponse partielle : un succès.
        reveil = threading.Event()
        self.addCleanup(reveil.set)
        vrai = Faux.do_GET

        def muet(handler):
            if handler.path.startswith("/api/cve/"):
                reveil.wait(30)
                return None
            return vrai(handler)
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_une())
        with patch.object(Faux, "do_GET", muet):
            debut = time.monotonic()
            r = v.executer({"source": "cve-inconnue", "parametres": {"cve": CVE}, "delai": CVE_DELAI_COURT})
            duree = time.monotonic() - debut
        self.assertEqual((r["ok"], r["erreur"], r["cveOrgEtat"], r["nvdEtat"]), (True, None, "echec", "trouvee"), r)
        self.assertEqual(r["nvd"]["cve"], CVE)
        self.assertLess(duree, CVE_DELAI_COURT - v.CVE_MARGE)
        # Passage complet : même partage, NVD garde au moins 60 % du temps.
        for delai in (CVE_DELAI_COURT, CVE_DELAI):
            part, total = v.budget_cve_inconnue(delai)
            self.assertLessEqual(total, delai - v.CVE_MARGE)
            self.assertGreaterEqual(total - part, 0.6 * total)
            self.assertGreaterEqual(total - part, 5)

    def test_delai_recu_controle(self):
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_vide())
        for delai in ("12", 0, 121, True, 12.5, [12]):
            with self.subTest(delai=delai):
                Faux.recues = []
                r = v.executer({"source": "cve-inconnue", "parametres": {"cve": CVE}, "delai": delai})
                self.assertFalse(r["ok"])
                self.assertIn("Délai de la consultation illisible", r["erreur"])
                self.assertEqual(Faux.recues, [])
        self.assertEqual(v.delai_cve_inconnue(None), v.CVE_DELAI_DEFAUT)
        self.assertTrue(v.executer({"source": "cve-inconnue", "parametres": {"cve": CVE}, "delai": 30})["ok"])

    def test_identifiant_en_chiffres_unicode_refuse(self):
        for cve in ("CVE-２０２６-90001", "CVE-2026-٩٠٠٠١"):
            with self.subTest(cve=cve):
                self.assertIsNone(v.CVE_ID.fullmatch(cve))
                self.assertIsNone(h.CVE_ID.fullmatch(cve))
                self.assertFalse(v.chemin_admis("cve-org", "/api/cve/" + cve))
                r = self.consulter(cve)
                self.assertFalse(r["ok"])
        self.assertEqual(v.CVE_DANS_TEXTE.findall("CVE-２０２６-90001 et " + CVE), [CVE])
        self.assertEqual(Faux.recues, [])

    def test_redirection_refusee(self):
        Faux.reponses["/api/cve/" + CVE] = (302, b"", (("Location", "https://ailleurs.exemple.invalid/"),))
        self.repondre("/rest/json/cves/2.0?cveId=" + CVE, nvd_vide())
        r = self.consulter()
        self.assertEqual((r["cveOrgEtat"], r["nvdEtat"]), ("echec", "absente"))

    # ------------------------------------------------------------------ Préavis de Cloudflare Radar
    def test_preavis_json_feed_cles_inconnues_ignorees_lien_hors_hote_ecarte(self):
        flux = {"version": "https://jsonfeed.org/version/1.1", "title": "CVE", "items": [
            {"id": "https://radar.cloudflare.com/zero-wire/cves/CVE-2026-90010", "url": "https://radar.cloudflare.com/zero-wire/cves/CVE-2026-90010",
             "title": "Critical flaw <script>x</script>in a fictitious library", "summary": "Summary.", "date_published": "2026-11-22T08:00:00+01:00",
             "_cve": {"id": "CVE-2026-90010", "severity": "critical", "score": "9.8", "cvss_version": 3.1, "kev_added": "2026-11-22"},
             "inconnu": {"x": 1}},
            {"id": "b", "url": "https://autre.exemple.invalid/x", "title": "Medium flaw", "_cve": {"id": "CVE-2026-90011", "severity": "MEDIUM", "score": 11}},
            {"id": "c", "title": "Sans CVE", "_cve": {"id": "CVE-26-1"}},
            {"id": "b", "title": "Doublon", "_cve": {"id": "CVE-2026-90012"}},
        ]}
        self.repondre("/zero-wire/cves/feed?format=json", json.dumps(flux).encode())
        r = v.executer({"source": "cloudflare-radar", "parametres": {}})
        self.assertTrue(r["ok"], r)
        self.assertEqual([p for _, p in Faux.recues], ["/zero-wire/cves/feed?format=json"])
        self.assertEqual(r["bilan"]["ecartes"], 2)
        a, b = r["elements"]
        self.assertEqual(a, {"identifiant": "https://radar.cloudflare.com/zero-wire/cves/CVE-2026-90010", "cve": "CVE-2026-90010",
                             "titre": "Critical flaw in a fictitious library", "resume": "Summary.",
                             "lien": "https://radar.cloudflare.com/zero-wire/cves/CVE-2026-90010",
                             "publieLe": "2026-11-22T07:00:00.000Z", "gravite": "CRITICAL", "score": 9.8, "versionCvss": "3.1", "kev": True})
        self.assertEqual((b["lien"], b["score"], b["gravite"], b["kev"]), (None, None, "MEDIUM", None))

    def test_preavis_nombre_ou_date_hostile_ecarte_compte_la_collecte_continue(self):
        # Relecture de la PR #369 : un entier trop grand pour un flottant, une date hors des dates de Python une fois ramenée
        # en UTC : l'élément est écarté et compté, jamais toute la collecte.
        brut = ('{"items": ['
                '{"id": "a", "title": "Score hostile", "_cve": {"id": "CVE-2026-90030", "score": 1' + "0" * 400 + '}},'
                '{"id": "b", "title": "Date hostile", "date_published": "9999-12-31T23:59:59-23:59", "_cve": {"id": "CVE-2026-90031"}},'
                '{"id": "c", "title": "Lisible", "date_published": "2026-11-22T08:00:00Z", "_cve": {"id": "CVE-2026-90032", "score": 7.5}}'
                ']}')
        self.repondre("/zero-wire/cves/feed?format=json", brut.encode())
        r = v.executer({"source": "cloudflare-radar", "parametres": {}})
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["bilan"]["ecartes"], 2)
        self.assertEqual([e["cve"] for e in r["elements"]], ["CVE-2026-90032"])
        self.assertEqual((r["elements"][0]["score"], r["elements"][0]["publieLe"]), (7.5, "2026-11-22T08:00:00.000Z"))
        with self.assertRaises(v.ElementHostile):
            v.score_annonce(10 ** 400)
        with self.assertRaises(v.ElementHostile):
            v.instant_rfc3339("9999-12-31T23:59:59-23:59")
        self.assertIsNone(v.horodatage_rss("Fri, 31 Dec 9999 23:59:59 -2359"))

    def test_preavis_illisible(self):
        self.repondre("/zero-wire/cves/feed?format=json", json.dumps({"items": "x"}).encode())
        r = v.executer({"source": "cloudflare-radar", "parametres": {}})
        self.assertFalse(r["ok"])
        self.assertIn("items", r["erreur"])

    # ------------------------------------------------------------------ Résumés de tldrcve
    def test_tldrcve_rss_verdict_nature_cves_lien(self):
        rss = """<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>tldrcve</title>
<item><title>New: Serveur imaginaire (CVE-2026-90020)</title><link>https://tldrcve.com/cve/CVE-2026-90020</link>
<guid>https://tldrcve.com/cve/CVE-2026-90020</guid><pubDate>Sun, 22 Nov 2026 07:00:00 +0000</pubDate>
<description>&lt;p&gt;A fictitious summary. Verdict: Patch now if you expose the admin port.&lt;/p&gt;</description></item>
<item><title>Update: Autre produit (CVE-2026-90021, CVE-2026-90022)</title><link>https://tldrcve.com/cve/CVE-2026-90021</link>
<description>Another summary. Verdict: Watching</description></item>
<item><title>New: Sans verdict (CVE-2026-90023)</title><link>https://tldrcve.com/cve/CVE-2026-90023</link><description>Rien.</description></item>
<item><title>New: Lien ailleurs (CVE-2026-90024)</title><link>https://ailleurs.exemple.invalid/x</link></item>
<item><title>Sans CVE</title><link>https://tldrcve.com/x</link></item>
</channel></rss>"""
        self.repondre("/feed.xml", rss.encode())
        r = v.executer({"source": "tldrcve", "parametres": {}})
        self.assertTrue(r["ok"], r)
        self.assertEqual(r["bilan"]["ecartes"], 2)
        a, b, c = r["elements"]
        self.assertEqual(a, {"identifiant": "https://tldrcve.com/cve/CVE-2026-90020", "titre": "New: Serveur imaginaire (CVE-2026-90020)",
                             "nature": "nouvelle", "cves": ["CVE-2026-90020"],
                             "resume": "A fictitious summary. Verdict: Patch now if you expose the admin port.",
                             "verdict": "patch-now-if", "verdictTexte": "Patch now if you expose the admin port",
                             "lien": "https://tldrcve.com/cve/CVE-2026-90020", "publieLe": "2026-11-22T07:00:00.000Z"})
        self.assertEqual((b["nature"], b["cves"], b["verdict"], b["verdictTexte"]),
                         ("mise_a_jour", ["CVE-2026-90021", "CVE-2026-90022"], "watching", "Watching"))
        self.assertEqual(b["identifiant"], "https://tldrcve.com/cve/CVE-2026-90021")
        self.assertEqual((c["verdict"], c["verdictTexte"]), (None, None))

    def test_tldrcve_rss_piege_refuse(self):
        self.repondre("/feed.xml", b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><rss><channel></channel></rss>')
        r = v.executer({"source": "tldrcve", "parametres": {}})
        self.assertFalse(r["ok"])
        self.assertIn("type de document", r["erreur"])


class ControlesTenable(unittest.TestCase):
    """scripts/integration-http.py : opération « controles-cve », hors de la file des connecteurs."""

    def client(self, reponse):
        appels = []

        class Client:
            def requete(self, methode, chemin, corps=None, parametres=None, maximum=None, fixe=None):
                appels.append((methode, chemin, corps, parametres, fixe))
                return reponse
        return Client(), appels

    def test_requete_fixe_liste_blanche_et_citation_exacte(self):
        reponse = {"type": "regular", "error_code": 0, "error_msg": "", "warnings": [], "timestamp": 1, "response": [
            {"id": "123456", "name": "Serveur imaginaire < 1.4 (CVE-2026-90001)", "family": {"id": "1", "name": "Web Servers", "type": "active"},
             "type": "active", "xrefs": "CVE:CVE-2026-90001, IAVA:2026-A-0001", "exploitAvailable": "true", "exploitEase": "x",
             "exploitFrameworks": "Metasploit (fictif)", "riskFactor": "High", "vulnPubDate": "1", "patchPubDate": "-1", "pluginPubDate": "1"},
            {"id": 99, "name": "Autre", "family": "Misc.", "xrefs": ["CVE:CVE-2026-900011"], "riskFactor": "Bizarre"},
            {"id": "77", "name": "Cite bien", "family": None, "xrefs": ["CVE:CVE-2026-90001"], "exploitAvailable": "false", "riskFactor": "None"},
            {"id": "0", "name": "Numéro invalide", "xrefs": "CVE-2026-90001"},
        ]}
        c, appels = self.client(reponse)
        r = h.tenable_controles_cve(c, {"cve": CVE})
        self.assertEqual(appels, [("GET", "/rest/plugin", None, None, h.REQUETE_CONTROLES_CVE % CVE)])
        self.assertTrue(h.REQUETE_CONTROLES_CVE_FORME.fullmatch(h.REQUETE_CONTROLES_CVE % CVE))
        self.assertIn("fields=id,name,family,type,xrefs,exploitAvailable,exploitEase,exploitFrameworks,riskFactor,vulnPubDate,"
                      "patchPubDate,pluginPubDate&startOffset=0&endOffset=50", h.REQUETE_CONTROLES_CVE)
        self.assertEqual(r, {"tronque": False, "controles": [
            {"id": "123456", "nom": "Serveur imaginaire < 1.4 (CVE-2026-90001)", "famille": "Web Servers", "exploitDisponible": True, "risque": "High"},
            {"id": "77", "nom": "Cite bien", "famille": None, "exploitDisponible": False, "risque": "None"}]})
        self.assertNotIn("Metasploit", json.dumps(r))

    def test_cve_mal_formee_ou_erreur_de_tenable(self):
        c, appels = self.client({"error_code": 0, "response": []})
        with self.assertRaises(h.Refus):
            h.tenable_controles_cve(c, {"cve": "CVE-26-1"})
        self.assertEqual(appels, [])
        c, _ = self.client({"error_code": 143, "error_msg": "secret", "response": None})
        with self.assertRaises(h.Refus) as e:
            h.tenable_controles_cve(c, {"cve": CVE})
        self.assertNotIn("secret", str(e.exception))

    def test_operation_hors_file_et_requete_fixe_controlee(self):
        self.assertEqual(h.OPERATIONS_CVE, {"tenable": ["controles-cve"]})
        self.assertNotIn("controles-cve", h.OPERATIONS["tenable"])
        self.assertIn(["GET", "/rest/plugin"], h.POINTS_ACCES["tenable"])
        client = h.Client.__new__(h.Client)
        client.type, client.mandataire = "tenable", None
        for fixe in ("filterField=name&op=like&value=x", (h.REQUETE_CONTROLES_CVE % CVE) + "&x=1",
                     (h.REQUETE_CONTROLES_CVE % "CVE-2026-1 OR 1"), ):
            with self.assertRaises(h.Refus):
                client.requete("GET", "/rest/plugin", fixe=fixe)
        with self.assertRaises(h.Refus):
            client.requete("GET", "/rest/system", fixe=h.REQUETE_CONTROLES_CVE % CVE)
        # Relecture de la PR #369 : GET /rest/plugin n'est jamais admis nu (tout le catalogue de Security Center).
        with patch.object(h.http.client, "HTTPSConnection", side_effect=AssertionError("appel réseau")):
            for parametres in (None, {}):
                with self.assertRaises(h.Refus):
                    client.requete("GET", "/rest/plugin", parametres=parametres)
        # La forme admise est construite à partir des champs admis : un autre jeu de champs ou des chiffres Unicode, refusés.
        self.assertTrue(h.REQUETE_CONTROLES_CVE_FORME.fullmatch(h.REQUETE_CONTROLES_CVE % CVE))
        for fixe in ("filterField=xrefs&op=like&value=%s&fields=id,name&startOffset=0&endOffset=50" % CVE,
                     h.REQUETE_CONTROLES_CVE % "CVE-２０２６-90001",
                     (h.REQUETE_CONTROLES_CVE % CVE).replace("pluginPubDate", "pluginText")):
            self.assertIsNone(h.REQUETE_CONTROLES_CVE_FORME.fullmatch(fixe), fixe)
        # Un autre type n'admet jamais cette opération.
        r = h.executer({"type": "algolighthouse", "operation": "controles-cve", "configuration": {}, "secrets": {}})
        self.assertFalse(r["ok"])


if __name__ == "__main__":
    unittest.main()
