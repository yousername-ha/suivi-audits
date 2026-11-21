"""Veille réglementaire (ADR 0110, lot VR-1) dans le script isolé scripts/veille-vulnerabilites.py, contre le faux service
HTTPS local du test de la veille des vulnérabilités : flux lu à son chemin exact (requête comprise pour EUR-Lex), certificat
vérifié, aucune redirection suivie, réponse et nombre d'éléments bornés, RSS piégé (déclaration de type, entité) refusé,
balises retirées, ANSSI sans résumé, ANS et Légifrance sans collecteur, résumé et titre jamais tronqués (CC BY-ND), lien
hors hôte ou hors https écarté, date illisible écartée, doublon écarté ; EUR-Lex filtré par les mots-clés reçus (mot entier,
casse et accents ignorés, liste illisible refusée avant toute lecture). Flux fictifs, écrits à la main ; aucune source
réelle n'est jointe."""
import json
import ssl
import unittest
from unittest.mock import patch

import test_veille_vulnerabilites as base
from test_veille_vulnerabilites import Faux, rss, v

CHEMINS = {s: d["chemins"][0] for s, d in v.SOURCES_REGLEMENTAIRES.items()}
HOTES = {s: d["hote"] for s, d in v.SOURCES_REGLEMENTAIRES.items()}


def item(source, n, titre=None, description="Résumé fictif &lt;b&gt;en gras&lt;/b&gt; &amp;amp; suite.", lien=None, date="Fri, 20 Nov 2026 08:30:00 +0100", guid=True):
    lien = lien if lien is not None else "https://%s/fictif/publication-%d" % (HOTES[source], n)
    parties = ["<title>%s</title>" % (titre if titre is not None else "Publication fictive %d" % n), "<link>%s</link>" % lien]
    if description is not None:
        parties.append("<description>%s</description>" % description)
    if date is not None:
        parties.append("<pubDate>%s</pubDate>" % date)
    if guid:
        parties.append("<guid>fictif-%s-%d</guid>" % (source, n))
    return "".join(parties)


# Mots-clés fictifs du filtre d'EUR-Lex (forme envoyée par l'application).
MOTS = [{"mot": "personal data", "domaine": "donnees-personnelles"}, {"mot": "cybersécurité", "domaine": "securite"},
        {"mot": "Resilience", "domaine": "securite"}]
# Cas communs de la forme comparée, repris par packages/shared/test/veille-reglementaire.test.ts.
NORMALISATION = {"Données  Personnelles": "donnees personnelles", "CYBERSÉCURITÉ": "cybersecurite",
                 "sécurité de l’information": "securite de l information", "Règlement (UE) 2024/1689": "reglement ue 2024 1689",
                 "  ": ""}


class VeilleReglementaire(unittest.TestCase):
    """Même faux service et mêmes remplacements que la veille des vulnérabilités (hôte remplacé, autorité ajoutée) : ses
    outils sont repris un à un, ses tests ne sont pas rejoués ici."""

    setUpClass = classmethod(base.Veille.setUpClass.__func__)
    tearDownClass = classmethod(base.Veille.tearDownClass.__func__)
    setUp = base.Veille.setUp
    patch = base.Veille.patch
    repondre = base.Veille.repondre
    collecter = base.Veille.collecter
    echec = base.Veille.echec

    def test_chaque_source_a_un_collecteur_et_son_seul_chemin_exact(self):
        self.assertEqual(sorted(v.SOURCES_REGLEMENTAIRES), ["anssi", "cepd", "cnil", "eur-lex"])
        for s in v.SOURCES_REGLEMENTAIRES:
            self.assertIn(s, v.COLLECTES)
            self.assertEqual(len(v.SOURCES_REGLEMENTAIRES[s]["chemins"]), 1)
        # ANS (aucun flux public connu) et Légifrance : pas de collecteur, rien n'est lu.
        for s in ("legifrance", "ans"):
            self.assertNotIn(s, v.COLLECTES)
            self.echec(self.collecter(s), "Source inconnue")
        self.assertNotIn("esante.gouv.fr", json.dumps([d["hote"] for d in v.SOURCES_REGLEMENTAIRES.values()]))
        self.assertEqual(Faux.recues, [])

    def test_cnil_titre_date_lien_resume_sans_balise(self):
        self.repondre(CHEMINS["cnil"], rss([item("cnil", 1), item("cnil", 2, description=None)]))
        sortie = self.collecter("cnil")
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(Faux.recues, [("GET", "/fr/rss.xml")])
        self.assertEqual(sortie["elements"][0], {
            "identifiant": "fictif-cnil-1",
            "titre": "Publication fictive 1",
            "resume": "Résumé fictif en gras & suite.",
            "lien": "https://www.cnil.fr/fictif/publication-1",
            "publieLe": "2026-11-20T07:30:00.000Z",
        })
        self.assertIsNone(sortie["elements"][1]["resume"])
        self.assertEqual(sortie["bilan"], {"elements": 2, "ecartes": 0, "tronque": False, "detailsEchoues": 0})

    def test_eur_lex_est_lu_a_son_adresse_exacte_requete_comprise(self):
        self.repondre("/EN/display-feed.rss?rssId=222", rss([item("eur-lex", 1, titre="Regulation on personal data")]))
        sortie = self.collecter("eur-lex", {"motsCles": MOTS})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(Faux.recues, [("GET", "/EN/display-feed.rss?rssId=222")])
        self.assertFalse(v.chemin_admis("eur-lex", "/EN/display-feed.rss?rssId=999"))
        self.assertFalse(v.chemin_admis("eur-lex", "/EN/display-feed.rss"))

    def test_anssi_titre_date_et_lien_seulement(self):
        for s in ("anssi",):
            Faux.recues = []
            self.repondre(CHEMINS[s], rss([item(s, 1, description="Texte qui ne doit jamais être repris.")]))
            sortie = self.collecter(s)
            self.assertTrue(sortie["ok"], sortie)
            self.assertEqual(sortie["elements"][0]["resume"], None)
            self.assertNotIn("jamais", str(sortie["elements"]))
            self.assertEqual(sorted(sortie["elements"][0]), ["identifiant", "lien", "publieLe", "resume", "titre"])

    def test_lien_hors_hote_ou_hors_https_est_ecarte(self):
        self.repondre(CHEMINS["cnil"], rss([
            item("cnil", 1, lien="https://exemple.invalid/piege"),
            item("cnil", 2, lien="http://www.cnil.fr/fictif"),
            item("cnil", 3, lien="https://www.cnil.fr.exemple.invalid/fictif"),
            item("cnil", 4, lien="https://www.cnil.fr/fictif avec espace"),
            item("cnil", 5, lien="javascript:alert(1)"),
            item("cnil", 6),
        ]))
        sortie = self.collecter("cnil")
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["fictif-cnil-6"])
        self.assertEqual(sortie["bilan"]["ecartes"], 5)

    def test_texte_trop_long_jamais_tronque_et_date_illisible_ecartee(self):
        self.repondre(CHEMINS["cnil"], rss([
            item("cnil", 1, titre="T" * 301),
            item("cnil", 2, description="R" * 1001),
            item("cnil", 3, date="pas une date"),
            item("cnil", 4, date=None),
            item("cnil", 5),
            item("cnil", 5),
        ]))
        sortie = self.collecter("cnil")
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["fictif-cnil-2", "fictif-cnil-5"])
        self.assertIsNone(sortie["elements"][0]["resume"])
        self.assertEqual(sortie["bilan"]["ecartes"], 4)

    def test_sans_guid_le_lien_sert_d_identifiant(self):
        self.repondre(CHEMINS["cepd"], rss([item("cepd", 1, guid=False)]))
        sortie = self.collecter("cepd")
        self.assertEqual(sortie["elements"][0]["identifiant"], "https://www.edpb.europa.eu/fictif/publication-1")

    def test_script_et_balise_retires_du_titre(self):
        self.repondre(CHEMINS["cnil"], rss([item("cnil", 1, titre="&lt;script&gt;alert(1)&lt;/script&gt;Titre &lt;i&gt;fictif&lt;/i&gt;")]))
        sortie = self.collecter("cnil")
        self.assertEqual(sortie["elements"][0]["titre"], "Titre fictif")

    def test_nombre_d_elements_borne_et_signale(self):
        self.repondre(CHEMINS["anssi"], rss([item("anssi", n) for n in range(250)]))
        sortie = self.collecter("anssi")
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(len(sortie["elements"]), v.BORNES_REGLEMENTAIRES["items"])
        self.assertTrue(sortie["bilan"]["tronque"])

    def test_rss_piege_refuse(self):
        self.repondre(CHEMINS["cnil"], rss([item("cnil", 1)], '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]>'))
        self.echec(self.collecter("cnil"), "déclaration de type de document")
        self.repondre(CHEMINS["cnil"], b"<rss><channel><item><title>non ferme</channel>")
        self.echec(self.collecter("cnil"), "Flux RSS illisible")

    def test_reponse_trop_volumineuse_refusee(self):
        self.patch(v, "REPONSE_MAX", {**v.REPONSE_MAX, "anssi": 100})
        self.repondre(CHEMINS["anssi"], rss([item("anssi", n) for n in range(5)]))
        self.echec(self.collecter("anssi"), "trop volumineuse")

    def test_redirection_refusee(self):
        self.repondre(CHEMINS["cepd"], b"", code=301, en_tetes=[("Location", "https://exemple.invalid/")])
        self.echec(self.collecter("cepd"), "Redirection refusée")

    def test_eur_lex_ne_remonte_que_les_actes_avec_un_mot_cle(self):
        self.repondre(CHEMINS["eur-lex"], rss([
            item("eur-lex", 1, titre="Regulation on the protection of PERSONAL DATA"),
            item("eur-lex", 2, titre="Directive sur la CYBERSECURITE des réseaux"),
            item("eur-lex", 3, titre="Decision on fisheries quotas"),
            item("eur-lex", 4, titre="Regulation on personal database tools"),
            item("eur-lex", 5, titre="Digital operational resilience act"),
        ]))
        sortie = self.collecter("eur-lex", {"motsCles": MOTS})
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["fictif-eur-lex-1", "fictif-eur-lex-2", "fictif-eur-lex-5"])
        # Mot entier seulement : « personal database » ne vaut pas « personal data ». Les écartés sont comptés.
        self.assertEqual(sortie["bilan"]["ecartes"], 2)
        self.assertNotIn("domaine", sortie["elements"][0])

    def test_eur_lex_domaine_du_mot_trouve_donnees_personnelles_l_emporte(self):
        mots = v.mots_cles({"motsCles": MOTS})
        self.assertEqual(v.domaine_titre("Loi sur la cybersecurite", mots), "securite")
        self.assertIsNone(v.domaine_titre("Cybersecurity act", mots))
        self.assertEqual(v.domaine_titre("Personal data and cybersécurité", mots), "donnees-personnelles")
        self.assertIsNone(v.domaine_titre("Fisheries", mots))
        for brut, attendu in NORMALISATION.items():
            self.assertEqual(v.normaliser(brut), attendu, brut)

    def test_eur_lex_liste_de_mots_cles_illisible_rien_n_est_lu(self):
        for p in ({}, {"motsCles": []}, {"motsCles": "privacy"}, {"motsCles": [{"mot": "x", "domaine": "securite"}]},
                  {"motsCles": [{"mot": "privacy", "domaine": "autre"}]},
                  {"motsCles": [{"mot": "privacy", "domaine": "securite", "en_trop": 1}]},
                  {"motsCles": [{"mot": "p" * 61, "domaine": "securite"}]},
                  {"motsCles": [{"mot": "privacy", "domaine": "securite"}] * 61},
                  {"motsCles": [{"mot": "« »", "domaine": "securite"}]}):
            Faux.recues = []
            self.echec(self.collecter("eur-lex", p), "mots-clés illisible")
            self.assertEqual(Faux.recues, [])

    def test_certificat_toujours_verifie(self):
        # Contexte du système sans l'autorité du faux service : le certificat est refusé, rien n'est lu.
        self.patch(v, "contexte", self.contexte_systeme)
        self.repondre(CHEMINS["cnil"], rss([item("cnil", 1)]))
        sortie = self.collecter("cnil")
        self.assertFalse(sortie["ok"])
        self.assertIn("Certificat", sortie["erreur"])
        ctx = v.contexte()
        self.assertEqual((ctx.verify_mode, ctx.check_hostname), (ssl.CERT_REQUIRED, True))


if __name__ == "__main__":
    unittest.main()
