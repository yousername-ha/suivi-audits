"""Dictionnaire CPE de la NVD (ADR 0100, lot CPE-1) dans le script isolé scripts/veille-vulnerabilites.py, contre le faux
service HTTPS local de test_veille_vulnerabilites.py : lecture d'une page, entrées obsolètes écartées, dédoublonnage des
produits, intitulé sans version, pages par tranche et pause entre deux pages, fenêtre des nouveautés, versions d'un produit
(seulement ce produit, obsolètes écartées, triées, bornées), aucune autre adresse appelée, demandes mal formées refusées
sans rien lire. Réponses fictives écrites à la main (éditeurs et produits inventés) ; aucune source réelle n'est jointe."""
import http.server
import json
from pathlib import Path
import ssl
import tempfile
import threading
import unittest
from unittest.mock import patch

from test_veille_vulnerabilites import Faux, certificat, v

CHEMIN = "/rest/json/cpes/2.0"


def entree(nom, titre=None, obsolete=False):
    c = {"cpeName": nom, "cpeNameId": "00000000-0000-0000-0000-000000000000", "deprecated": obsolete,
         "lastModified": "2026-11-01T00:00:00.000", "created": "2026-01-01T00:00:00.000",
         "refs": [{"ref": "https://exemple.invalid/notes", "type": "Vendor"}]}
    if titre is not None:
        c["titles"] = [{"title": "Titre en français ignoré", "lang": "fr"}, {"title": titre, "lang": "en"}]
    return {"cpe": c}


def page(produits, total=None, debut=0):
    return json.dumps({"resultsPerPage": len(produits), "startIndex": debut, "totalResults": len(produits) if total is None else total,
                       "format": "NVD_CPE", "version": "2.0", "timestamp": "2026-11-22T00:00:00.000",
                       "products": produits}).encode()


class DictionnaireCpe(unittest.TestCase):
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
        Faux.reponses, Faux.recues = {}, []
        vrai, ca = v.contexte, self.ca

        def contexte():
            c = vrai()
            c.load_verify_locations(ca)
            return c
        self.destinations = []

        def destination(source):
            self.destinations.append((source, v.TOUTES_SOURCES[source]["hote"]))
            return "localhost", self.port
        self.pauses = []
        for nom, valeur in (("destination", destination), ("contexte", contexte)):
            p = patch.object(v, nom, valeur)
            p.start()
            self.addCleanup(p.stop)
        p = patch.object(v.time, "sleep", lambda s: self.pauses.append(s))
        p.start()
        self.addCleanup(p.stop)

    def repondre(self, chemin_requete, corps, code=200):
        Faux.reponses[chemin_requete] = (code, corps, ())

    def demander(self, parametres):
        return v.executer({"source": "nvd-cpe", "parametres": parametres})

    def test_liste_fermee_meme_hote_que_la_veille_nvd(self):
        self.assertEqual(v.SOURCES_CPE, {"nvd-cpe": {"hote": "services.nvd.nist.gov", "chemins": [CHEMIN]}})
        self.assertEqual(v.SOURCES_CPE["nvd-cpe"]["hote"], v.SOURCES["nvd"]["hote"])
        # Une seule page par tranche, sans pause dans le script (le débit est tenu par l'exécutant).
        self.assertEqual(v.BORNES_CPE["pagesParPassage"], 1)
        self.assertFalse(hasattr(v, "CPE_PAUSE"))

    def test_une_page_produits_distincts_obsoletes_ecartes_intitule_sans_version(self):
        self.repondre(CHEMIN + "?resultsPerPage=10000&startIndex=0", page([
            entree("cpe:2.3:a:editeur-fictif:produit_fictif:9.5.1:*:*:*:*:*:*:*", "Editeur Fictif Produit Fictif 9.5.1"),
            entree("cpe:2.3:a:editeur-fictif:produit_fictif:10.0.2:*:*:*:*:*:*:*", "Editeur Fictif Produit Fictif 10.0.2"),
            entree("cpe:2.3:o:autre_editeur:systeme\\:fictif:-:*:*:*:*:*:*:*", "Autre <b>Editeur</b> Systeme"),
            entree("cpe:2.3:a:vieil_editeur:retire:1.0:*:*:*:*:*:*:*", "Vieil Editeur Retire 1.0", obsolete=True),
            entree("cpe:2.3:a:sans_titre:produit:*:*:*:*:*:*:*:*"),
            entree("pas un cpe"),
            {"cpe": "x"},
        ]))
        s = self.demander({"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": False})
        self.assertTrue(s["ok"], s)
        self.assertEqual(s["elements"], [
            {"partie": "a", "editeur": "editeur-fictif", "produit": "produit_fictif", "intitule": "Editeur Fictif Produit Fictif"},
            {"partie": "o", "editeur": "autre_editeur", "produit": "systeme:fictif", "intitule": "Autre Editeur Systeme"},
            {"partie": "a", "editeur": "sans_titre", "produit": "produit", "intitule": None},
        ])
        self.assertEqual(s["versions"], [])
        self.assertEqual(s["bilan"], {"total": 7, "suivant": 7, "entrees": 5, "obsoletes": 1, "ecartes": 2})
        # Une seule page (tout est lu) ; le seul hôte joint est celui de la liste fermée ; rien de la réponse brute ne sort.
        self.assertEqual(Faux.recues, [("GET", CHEMIN + "?resultsPerPage=10000&startIndex=0")])
        self.assertEqual(set(self.destinations), {("nvd-cpe", "services.nvd.nist.gov")})
        self.assertNotIn("exemple.invalid", json.dumps(s))
        self.assertNotIn("français", json.dumps(s))

    def test_tranche_d_une_seule_page_sans_pause_et_copie_des_versions(self):
        p1 = [entree("cpe:2.3:a:ed:prod:%d.0:*:*:*:*:*:*:*" % i, "Ed Prod %d.0" % i) for i in range(2)]
        p1.append(entree("cpe:2.3:h:ed:boitier:-:*:*:*:*:*:*:*", "Ed Boitier"))
        self.repondre(CHEMIN + "?resultsPerPage=10000&startIndex=20000", page(p1, total=30004, debut=20000))
        self.repondre(CHEMIN + "?resultsPerPage=10000&startIndex=20003", page(p1, total=30004, debut=20003))
        s = self.demander({"operation": "dictionnaire", "debut": 20000, "pages": 1, "versions": True})
        self.assertTrue(s["ok"], s)
        # Une seule page, aucune attente ; curseur rendu pour le passage suivant.
        self.assertEqual(len(Faux.recues), 1)
        self.assertEqual(self.pauses, [])
        self.assertEqual(s["bilan"]["suivant"], 20003)
        self.assertEqual(s["bilan"]["total"], 30004)
        self.assertEqual([(e["produit"], e["intitule"]) for e in s["elements"]], [("prod", "Ed Prod"), ("boitier", "Ed Boitier")])
        self.assertEqual(sorted(x["version"] for x in s["versions"]), ["0.0", "1.0"])
        self.assertTrue(all(set(x) == {"partie", "editeur", "produit", "version"} for x in s["versions"]))

    def test_nouveautes_par_fenetre_de_dates(self):
        chemin = (CHEMIN + "?resultsPerPage=10000&startIndex=0&lastModStartDate=2026-11-20T00:00:00.000Z"
                  "&lastModEndDate=2026-11-21T00:00:00.000Z")
        self.repondre(chemin, page([entree("cpe:2.3:a:ed:nouveau:1.0:*:*:*:*:*:*:*", "Ed Nouveau 1.0")]))
        s = self.demander({"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": False,
                           "depuis": "2026-11-20T00:00:00.000Z", "jusqua": "2026-11-21T00:00:00.000Z"})
        self.assertTrue(s["ok"], s)
        self.assertEqual(Faux.recues, [("GET", chemin)])
        for depuis, jusqua in (("2026-01-01T00:00:00.000Z", "2026-11-21T00:00:00.000Z"),
                               ("2026-11-21T00:00:00.000Z", "2026-11-20T00:00:00.000Z"), ("hier", "2026-11-21T00:00:00.000Z")):
            Faux.recues = []
            s = self.demander({"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": False, "depuis": depuis, "jusqua": jusqua})
            self.assertFalse(s["ok"])
            self.assertEqual(Faux.recues, [])

    def test_page_vide_avant_la_fin_et_reponse_illisible_sont_des_erreurs(self):
        self.repondre(CHEMIN + "?resultsPerPage=10000&startIndex=0", page([], total=50))
        s = self.demander({"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": False})
        self.assertFalse(s["ok"])
        self.assertIn("Page vide", s["erreur"])
        self.repondre(CHEMIN + "?resultsPerPage=10000&startIndex=0", b'{"products": "x", "totalResults": 1}')
        self.assertIn("illisible", self.demander({"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": False})["erreur"])

    def test_demandes_mal_formees_rien_n_est_lu(self):
        for p in ({"operation": "autre"}, {"operation": "dictionnaire", "debut": -1, "pages": 1, "versions": False},
                  {"operation": "dictionnaire", "debut": 0, "pages": 2, "versions": False},
                  {"operation": "dictionnaire", "debut": 0, "pages": 1, "versions": "oui"},
                  {"operation": "dictionnaire", "debut": True, "pages": 1, "versions": False},
                  {"operation": "versions", "partie": "x", "editeur": "ed", "produit": "p"},
                  {"operation": "versions", "partie": "a", "editeur": "*", "produit": "p"},
                  {"operation": "versions", "partie": "a", "editeur": "ed", "produit": "avec espace"}):
            with self.subTest(p=p):
                Faux.recues = []
                s = self.demander(p)
                self.assertFalse(s["ok"])
                self.assertEqual(Faux.recues, [])

    def test_versions_d_un_produit_seulement_triees_bornees(self):
        chemin = CHEMIN + "?cpeMatchString=cpe:2.3:a:ed-fictif:prod%5C%21uit&resultsPerPage=10000"
        self.repondre(chemin, page([
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:9.5.1:*:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:10.0.2:*:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:10.0.2:sp1:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:1.0-rc1:*:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:1.0:*:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:0.9:*:*:*:*:*:*:*", obsolete=True),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit:*:*:*:*:*:*:*:*"),
            entree("cpe:2.3:a:ed-fictif:prod\\!uit_greffon:5.0:*:*:*:*:*:*:*"),
        ]))
        s = self.demander({"operation": "versions", "partie": "a", "editeur": "ed-fictif", "produit": "prod!uit"})
        self.assertTrue(s["ok"], s)
        self.assertEqual(s["elements"], ["10.0.2", "9.5.1", "1.0", "1.0-rc1"])
        self.assertEqual(s["bilan"], {"elements": 4, "ecartes": 0, "tronque": False})
        self.assertEqual(Faux.recues, [("GET", chemin)])
        self.assertEqual(self.pauses, [])

    def test_versions_bornees_et_signalees_tronquees(self):
        chemin = CHEMIN + "?cpeMatchString=cpe:2.3:o:ed:sys&resultsPerPage=10000"
        self.repondre(chemin, page([entree("cpe:2.3:o:ed:sys:1.%d:*:*:*:*:*:*:*" % i) for i in range(2500)], total=2500))
        s = self.demander({"operation": "versions", "partie": "o", "editeur": "ed", "produit": "sys"})
        self.assertTrue(s["ok"], s)
        self.assertEqual(len(s["elements"]), 2000)
        self.assertEqual(s["elements"][0], "1.2499")
        self.assertTrue(s["bilan"]["tronque"])
        # Plus d'entrées annoncées que lues dans la page : tronqué aussi.
        self.repondre(chemin, page([entree("cpe:2.3:o:ed:sys:1.0:*:*:*:*:*:*:*")], total=12000))
        self.assertTrue(self.demander({"operation": "versions", "partie": "o", "editeur": "ed", "produit": "sys"})["bilan"]["tronque"])

    def test_tri_et_echappements_identiques_a_packages_shared(self):
        self.assertEqual(v.versions_triees(["1.0", "1.0-rc1", "1.0.1", "1.0beta", "0.9", "10", "9"], 10),
                         ["10", "9", "1.0.1", "1.0", "1.0-rc1", "1.0beta", "0.9"])
        self.assertEqual(v.echapper_cpe("a:b\\c!d_e-f.g"), "a\\:b\\\\c\\!d_e-f.g")
        self.assertEqual(v.titre_sans_version("Produit Fictif 2.4.1 Beta", "2.4.1"), "Produit Fictif")
        self.assertEqual(v.titre_sans_version("Produit Fictif 2.4.10", "2.4.1"), "Produit Fictif 2.4.10")


if __name__ == "__main__":
    unittest.main()
