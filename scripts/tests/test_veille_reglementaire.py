"""Veille réglementaire (ADR 0110, lots VR-1 et VR-2) dans le script isolé scripts/veille-vulnerabilites.py, contre le faux
service HTTPS local du test de la veille des vulnérabilités : flux lu à son chemin exact (requête comprise pour EUR-Lex),
certificat vérifié, aucune redirection suivie, réponse et nombre d'éléments bornés, RSS piégé (déclaration de type, entité)
refusé, balises retirées, ANSSI et actualités du CERT Santé sans résumé, ANS sans collecteur, résumé et titre jamais tronqués
(CC BY-ND), lien hors hôte ou hors https écarté, date illisible écartée, doublon écarté ; EUR-Lex filtré par les mots-clés
reçus (mot entier, casse et accents ignorés, liste illisible refusée avant toute lecture). Journal officiel (lot VR-2) :
page d'index et archives quotidiennes fictives construites en mémoire (tar.gz), seules les versions de texte lues, texte
intégral jamais repris, filtre par mots-clés, lien Légifrance de forme exacte, archive trop grosse refusée sans être lue,
bombe de décompression, trop de fichiers, en-tête piégé, nom d'archive hors forme, date de départ illisible. Flux et
archives fictifs, écrits à la main ; aucune source réelle n'est jointe."""
import datetime as dt
import gzip
import io
import json
import random
import ssl
import tarfile
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
        self.assertEqual(sorted(v.SOURCES_REGLEMENTAIRES), ["anssi", "cepd", "cert-sante-actualites", "cnil", "eur-lex", "legifrance"])
        for s in v.SOURCES_REGLEMENTAIRES:
            self.assertIn(s, v.COLLECTES)
            # Un seul chemin par flux RSS ; le Journal officiel : la page d'index, puis ses archives (nom contrôlé).
            self.assertEqual(len(v.SOURCES_REGLEMENTAIRES[s]["chemins"]), 2 if s == "legifrance" else 1)
        self.assertEqual(v.SOURCES_REGLEMENTAIRES["legifrance"]["chemins"], ["/OPENDATA/JORF/", "/OPENDATA/JORF/{archive}"])
        # ANS (aucun flux public connu) : pas de collecteur, rien n'est lu ; son site n'est pas un hôte de la liste (le CERT
        # Santé, sur un autre hôte, l'est).
        self.assertNotIn("ans", v.COLLECTES)
        self.echec(self.collecter("ans"), "Source inconnue")
        hotes = [d["hote"] for d in v.SOURCES_REGLEMENTAIRES.values()]
        for interdit in ("esante.gouv.fr", "www.esante.gouv.fr"):
            self.assertNotIn(interdit, hotes)
        # API Légifrance (PISTE) : non réalisée dans ce lot, aucun de ses hôtes n'est dans la liste fermée.
        self.assertNotIn("piste.gouv.fr", json.dumps(hotes))
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
        for s in ("anssi", "cert-sante-actualites"):
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


# ------------------------------------------------------------------ Journal officiel (lot VR-2), archives fictives
MOTS_JO = [{"mot": "données à caractère personnel", "domaine": "donnees-personnelles"},
           {"mot": "cybersécurité", "domaine": "securite"}]
DOSSIER = "/OPENDATA/JORF/"


def texte_jorf(n, titre, date="2026-11-20", racine="TEXTE_VERSION", entete="", ident=None):
    """Version de texte fictive, à la forme supposée du JORF (en-tête META puis corps)."""
    ident = ident or "JORFTEXT%012d" % n
    return ('<?xml version="1.0" encoding="UTF-8"?>%s<%s><META><META_COMMUN><ID>%s</ID><NATURE>DECRET</NATURE></META_COMMUN>'
            '<META_SPEC><META_TEXTE_CHRONICLE><CID>%s</CID><DATE_PUBLI>%s</DATE_PUBLI></META_TEXTE_CHRONICLE>'
            '<META_TEXTE_VERSION><TITRE>%s</TITRE><TITREFULL>%s</TITREFULL></META_TEXTE_VERSION></META_SPEC></META>'
            '<VISAS><CONTENU>Corps fictif qui ne doit jamais être repris.</CONTENU></VISAS></%s>'
            % (entete, racine, ident, ident, date, titre, titre, racine)).encode("utf-8")


def chemin_texte(n, sorte="version"):
    return "20261120-001500/jorf/global/texte/%s/JORF/TEXT/00/00/00/00/00/JORFTEXT%012d.xml" % (sorte, n)


def archive(fichiers):
    """Archive tar.gz construite en mémoire : [(nom, octets)]."""
    tampon = io.BytesIO()
    with tarfile.open(fileobj=tampon, mode="w:gz") as t:
        for nom, octets in fichiers:
            info = tarfile.TarInfo(nom)
            info.size = len(octets)
            t.addfile(info, io.BytesIO(octets))
    return tampon.getvalue()


def index(*noms):
    """Page d'index du dossier, à la forme d'un index HTML de serveur web."""
    lignes = "".join('<a href="%s">%s</a> 20-Nov-2026 00:15 1.2M\n' % (n, n) for n in noms)
    return ('<!DOCTYPE html><html><body><a href="../">../</a>\n%s<a href="Freemium_jorf_global_20260101-000000.tar.gz">x</a>'
            '</body></html>' % lignes).encode("utf-8")


class JournalOfficiel(unittest.TestCase):
    """Même faux service et mêmes outils que la veille des vulnérabilités, repris un à un (ses tests ne sont pas rejoués)."""

    setUpClass = classmethod(base.Veille.setUpClass.__func__)
    tearDownClass = classmethod(base.Veille.tearDownClass.__func__)
    patch = base.Veille.patch
    repondre = base.Veille.repondre
    collecter = base.Veille.collecter
    echec = base.Veille.echec

    def setUp(self):
        base.Veille.setUp(self)
        self.patch(v, "JORF_PAUSE", 0)

    def collecter_jo(self, depuis="2026-11-19", mots=None):
        p = {"motsCles": mots or MOTS_JO}
        if depuis is not None:
            p["depuis"] = depuis
        return self.collecter("legifrance", p)

    def test_archives_recentes_lues_en_memoire_versions_de_texte_filtrees(self):
        self.repondre(DOSSIER, index("JORF_20261118-001500.tar.gz", "JORF_20261119-001500.tar.gz", "JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261118-001500.tar.gz", archive([(chemin_texte(9), texte_jorf(9, "Décret sur la cybersécurité", "2026-11-18"))]))
        self.repondre(DOSSIER + "JORF_20261119-001500.tar.gz", archive([
            (chemin_texte(1), texte_jorf(1, "Décret relatif à la CYBERSECURITE des établissements de santé fictifs", "2026-11-19")),
            (chemin_texte(2), texte_jorf(2, "Arrêté portant nomination (fictif)", "2026-11-19")),
        ]))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([
            (chemin_texte(3), texte_jorf(3, "Décret relatif à un traitement de données à caractère personnel fictif")),
            # Structure du même texte, article, liste : ignorés (ni lus comme texte, ni comptés).
            (chemin_texte(3, "struct"), texte_jorf(3, "Structure fictive cybersécurité", racine="TEXTELR")),
            ("20261120-001500/jorf/global/article/JORF/ARTI/00/JORFARTI000000000031.xml", b"<ARTICLE>cybersecurite</ARTICLE>"),
            ("20261120-001500/liste_suppression_jorf.dat", b"fictif"),
        ]))
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        # L'archive du 18/11 est antérieure à la date de départ : jamais demandée. Aucune autre adresse n'est lue.
        self.assertEqual(Faux.recues, [("GET", DOSSIER), ("GET", DOSSIER + "JORF_20261119-001500.tar.gz"),
                                       ("GET", DOSSIER + "JORF_20261120-001500.tar.gz")])
        self.assertEqual(sortie["elements"], [
            {"identifiant": "JORFTEXT000000000001", "titre": "Décret relatif à la CYBERSECURITE des établissements de santé fictifs",
             "resume": None, "lien": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000001", "publieLe": "2026-11-19T00:00:00.000Z"},
            {"identifiant": "JORFTEXT000000000003", "titre": "Décret relatif à un traitement de données à caractère personnel fictif",
             "resume": None, "lien": "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000003", "publieLe": "2026-11-20T00:00:00.000Z"},
        ])
        self.assertNotIn("Corps fictif", json.dumps(sortie))
        self.assertEqual(sortie["bilan"], {"elements": 2, "ecartes": 1, "tronque": False, "detailsEchoues": 0})

    def test_sans_date_de_depart_sept_jours_et_archives_bornees(self):
        noms = ["JORF_202611%02d-001500.tar.gz" % j for j in range(1, 21)]
        self.repondre(DOSSIER, index(*noms))
        for n in noms:
            self.repondre(DOSSIER + n, archive([]))
        self.patch(v, "JORF_JOURS_DEFAUT", 10000)
        sortie = self.collecter_jo(depuis=None)
        self.assertTrue(sortie["ok"], sortie)
        # Au plus JORF_ARCHIVES_MAX archives, les plus récentes ; la collecte est signalée incomplète.
        self.assertEqual([c for _m, c in Faux.recues[1:]], [DOSSIER + n for n in noms[-v.JORF_ARCHIVES_MAX:]])
        self.assertTrue(sortie["bilan"]["tronque"])
        self.assertEqual(v.depuis_jorf({}), dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=10000))

    def test_duree_presque_epuisee_les_archives_suivantes_attendent(self):
        self.repondre(DOSSIER, index("JORF_20261119-001500.tar.gz", "JORF_20261120-001500.tar.gz"))
        for jour in ("19", "20"):
            self.repondre(DOSSIER + "JORF_202611%s-001500.tar.gz" % jour, archive([(chemin_texte(int(jour)), texte_jorf(int(jour), "Cybersécurité"))]))
        self.patch(v, "JORF_DUREE_MAX", -1)
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual(Faux.recues, [("GET", DOSSIER), ("GET", DOSSIER + "JORF_20261119-001500.tar.gz")])
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["JORFTEXT000000000019"])
        self.assertTrue(sortie["bilan"]["tronque"])

    def test_meme_texte_dans_deux_archives_le_plus_recent_l_emporte(self):
        self.repondre(DOSSIER, index("JORF_20261119-001500.tar.gz", "JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261119-001500.tar.gz", archive([(chemin_texte(1), texte_jorf(1, "Avant : cybersécurité"))]))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([(chemin_texte(1), texte_jorf(1, "Après : cybersécurité"))]))
        sortie = self.collecter_jo()
        self.assertEqual([e["titre"] for e in sortie["elements"]], ["Après : cybersécurité"])

    def test_titre_long_abrege_mais_filtre_sur_le_titre_complet(self):
        long = "Arrêté fictif " + "relatif à une procédure " * 20 + "et à la cybersécurité"
        self.repondre(DOSSIER, index("JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([(chemin_texte(1), texte_jorf(1, long))]))
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        titre = sortie["elements"][0]["titre"]
        self.assertTrue(250 < len(titre) <= v.BORNES_REGLEMENTAIRES["titre"], len(titre))
        self.assertTrue(titre.endswith("…"))
        self.assertNotIn("cybersécurité", titre)

    def test_identifiant_date_ou_titre_illisible_ecarte_lien_de_forme_exacte(self):
        self.repondre(DOSSIER, index("JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([
            (chemin_texte(1), texte_jorf(1, "Cybersécurité", ident="JORFTEXT12")),
            (chemin_texte(2), texte_jorf(2, "Cybersécurité", date="20 novembre 2026")),
            (chemin_texte(3), texte_jorf(3, "Cybersécurité", date="2026-02-30")),
            (chemin_texte(4), texte_jorf(4, "&lt;script&gt;x&lt;/script&gt;")),
            (chemin_texte(5), texte_jorf(5, "Décret &lt;b&gt;fictif&lt;/b&gt; sur la cybersécurité")),
        ]))
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([(e["identifiant"], e["titre"]) for e in sortie["elements"]],
                         [("JORFTEXT000000000005", "Décret fictif sur la cybersécurité")])
        self.assertEqual(sortie["bilan"]["ecartes"], 4)
        self.assertIsNone(v.lien_reglementaire("legifrance", "https://echanges.dila.gouv.fr/OPENDATA/JORF/"))
        self.assertEqual(v.lien_reglementaire("legifrance", "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000005"),
                         "https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000000005")

    def test_archive_trop_grosse_refusee_sans_etre_lue(self):
        self.patch(v, "JORF_ARCHIVE_MAX", 2000)
        # Octets pseudo-aléatoires (graine fixe) : l'archive ne se comprime pas sous la borne.
        bruit = random.Random(1)
        grosse = archive([("20261119/bruit-%d.bin" % n, bruit.randbytes(1000)) for n in range(5)])
        self.assertGreater(len(grosse), 2000)
        petite = archive([(chemin_texte(1), texte_jorf(1, "Cybersécurité"))])
        self.repondre(DOSSIER, index("JORF_20261119-001500.tar.gz", "JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261119-001500.tar.gz", grosse)
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", petite)
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["JORFTEXT000000000001"])
        self.assertTrue(sortie["bilan"]["tronque"])
        # Seule archive de la période et trop grosse : la collecte échoue, expliquée.
        self.repondre(DOSSIER, index("JORF_20261119-001500.tar.gz"))
        self.echec(self.collecter_jo(), "trop volumineuse")
        # Sans longueur annoncée : la lecture s'arrête à la borne.
        self.repondre(DOSSIER + "JORF_20261119-001500.tar.gz", grosse, en_tetes=[("sans-longueur", "1")])
        self.echec(self.collecter_jo(), "trop volumineuse")

    def test_bombe_de_decompression_et_trop_de_fichiers_refusees(self):
        self.repondre(DOSSIER, index("JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([("20261120/zero.bin", b"\0" * 3_000_000)]))
        self.patch(v, "JORF_DECOMPRESSE_MAX", 1_000_000)
        self.echec(self.collecter_jo(), "trop volumineuse une fois décompressée")
        self.patch(v, "JORF_DECOMPRESSE_MAX", 512 * 1024 * 1024)
        self.patch(v, "JORF_FICHIERS_MAX", 5)
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([("20261120/f%d.dat" % n, b"x") for n in range(6)]))
        self.echec(self.collecter_jo(), "trop de fichiers")

    def test_archive_illisible_et_en_tete_piege(self):
        self.repondre(DOSSIER, index("JORF_20261120-001500.tar.gz"))
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", b"pas une archive")
        self.echec(self.collecter_jo(), "Archive du Journal officiel illisible")
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", gzip.compress(b"pas un tar" * 100))
        self.echec(self.collecter_jo(), "Archive du Journal officiel illisible")
        # Déclaration de type de document ou d'entité, autre encodage, profondeur excessive : fichier écarté et compté ;
        # aucune version lisible dans toute la collecte : échec expliqué plutôt qu'une collecte vide.
        pieges = [
            texte_jorf(1, "Cybersécurité &x;", entete='<!DOCTYPE TEXTE_VERSION [<!ENTITY x SYSTEM "file:///etc/passwd">]>'),
            texte_jorf(2, "Cybersécurité", entete='<!DOCTYPE TEXTE_VERSION SYSTEM "fictif.dtd">'),
            texte_jorf(3, "Cybersécurité").decode("utf-8").encode("utf-16"),
            b"<TEXTE_VERSION><META>" + b"<a>" * 20 + b"</META>",
            b"<TEXTE_VERSION><META><ID>JORFTEXT000000000005</ID></MET>",
        ]
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive([(chemin_texte(n + 1), x) for n, x in enumerate(pieges)]))
        self.echec(self.collecter_jo(), "forme inattendue")
        self.repondre(DOSSIER + "JORF_20261120-001500.tar.gz", archive(
            [(chemin_texte(n + 1), x) for n, x in enumerate(pieges)] + [(chemin_texte(9), texte_jorf(9, "Cybersécurité"))]))
        sortie = self.collecter_jo()
        self.assertTrue(sortie["ok"], sortie)
        self.assertEqual([e["identifiant"] for e in sortie["elements"]], ["JORFTEXT000000000009"])
        self.assertEqual(sortie["bilan"]["ecartes"], len(pieges))

    def test_en_tete_lu_seul_et_borne(self):
        # Corps démesuré après l'en-tête : seule la tête est lue, le texte est gardé.
        corps = texte_jorf(1, "Cybersécurité").replace(b"</VISAS>", b"x" * (3 * v.JORF_TETE_MAX) + b"</VISAS>")
        self.assertEqual(v.tete_texte_jorf(corps[: v.JORF_TETE_MAX])["ID"], "JORFTEXT000000000001")
        self.assertIsNone(v.tete_texte_jorf(texte_jorf(1, "x", racine="TEXTELR")))
        self.assertEqual(v.tete_texte_jorf(b"\xff\xfe<"), v.ILLISIBLE)

    def test_index_sans_archive_ou_nom_hors_forme_refuse(self):
        self.repondre(DOSSIER, b"<html><body>Rien</body></html>")
        self.echec(self.collecter_jo(), "aucune archive")
        self.assertEqual(Faux.recues, [("GET", DOSSIER)])
        self.assertEqual(v.archives_jorf(b"JORF_20261340-001500.tar.gz XJORF_20261120-001500.tar.gz JORF_20261120-001500.tar.gz",
                                         dt.date(2026, 1, 1)),
                         [(dt.date(2026, 11, 20), "JORF_20261120-001500.tar.gz")])
        for chemin in ("/OPENDATA/JORF/../LEGI/x.tar.gz", "/OPENDATA/JORF/JORF_2026.tar.gz", "/OPENDATA/JORF/JORF_20261120-001500.tar.gz/x",
                       "/OPENDATA/LEGI/JORF_20261120-001500.tar.gz", "/OPENDATA/JORF/Freemium_jorf_global_20260101-000000.tar.gz",
                       "/OPENDATA/JORF"):
            self.assertFalse(v.chemin_admis("legifrance", chemin), chemin)
        self.assertTrue(v.chemin_admis("legifrance", "/OPENDATA/JORF/JORF_20261120-001500.tar.gz"))
        self.assertTrue(v.chemin_admis("legifrance", "/OPENDATA/JORF/JORF_20261120.tar.gz"))

    def test_demande_illisible_rien_n_est_lu(self):
        for p in ({}, {"motsCles": MOTS_JO, "depuis": "hier"}, {"motsCles": MOTS_JO, "depuis": 20261120},
                  {"motsCles": [{"mot": "x", "domaine": "securite"}], "depuis": "2026-11-20"}):
            Faux.recues = []
            sortie = self.collecter("legifrance", p)
            self.assertFalse(sortie["ok"])
            self.assertTrue("mots-clés illisible" in sortie["erreur"] or "date de départ" in sortie["erreur"], sortie["erreur"])
            self.assertEqual(Faux.recues, [])

    def test_extraction_en_memoire_jamais_sur_disque(self):
        texte = base.SCRIPT.read_text(encoding="utf8")
        for interdit in ("extractall", ".extract(", "tempfile", "builtins", "shutil"):
            self.assertNotIn(interdit, texte)
        # Aucun appel à la fonction open() : la seule ouverture est celle de l'archive en mémoire, par tarfile.
        self.assertEqual(__import__("re").findall(r"(?<![\w.])open\(", texte), [])
        self.assertEqual(texte.count("tarfile.open("), 1)
        self.assertIn('tarfile.open(fileobj=flux, mode="r|")', texte)



if __name__ == "__main__":
    unittest.main()
