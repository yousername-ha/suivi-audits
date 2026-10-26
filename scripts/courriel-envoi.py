#!/usr/bin/env python3
"""Envoi d'UN courriel par SMTP/SMTPS : message de test (décision 1 du 25/10/2026, ADR 0049) ou notification métier (ADR 0058).

Lancé par l'exécutant d'exploitation du serveur (scripts/exploitation-worker.py) sous un compte sans privilège, jamais par
l'API : le conteneur de l'API reste sans accès réseau sortant. Entrée : un objet JSON sur l'entrée standard (hôte, port,
chiffrement, compte, mot de passe, expéditeur, destinataire, autorité de certification privée facultative). Sortie : un objet
JSON {ok, steps, error} sur la sortie standard ; il ne contient jamais le mot de passe. Pour une notification (`kind` =
"notification"), l'objet et le corps en texte brut sont fournis par l'API (ils ne contiennent aucune donnée métier) et la trace
n'écrit pas l'adresse du destinataire.

Règles : STARTTLS (le serveur doit le proposer, sinon refus) ou TLS implicite ; certificat du serveur toujours vérifié ;
authentification PLAIN ou LOGIN en UTF-8, pas XOAUTH2.
"""
import base64
import json
import smtplib
import socket
import ssl
import sys
from email.message import EmailMessage

DELAI = 15


def explication(erreur):
    if isinstance(erreur, socket.gaierror):
        return "Nom d'hôte introuvable depuis le serveur (DNS). Vérifiez l'hôte saisi."
    if isinstance(erreur, ConnectionRefusedError):
        return "Connexion refusée : le serveur SMTP n'écoute pas sur ce port, ou un pare-feu la refuse."
    if isinstance(erreur, (TimeoutError, socket.timeout)):
        return "Délai dépassé : le serveur SMTP ne répond pas (pare-feu ou mauvais port)."
    if isinstance(erreur, ssl.SSLCertVerificationError):
        return "Certificat du serveur refusé (%s). Il doit être valide, correspondre à l'hôte et être signé par une autorité reconnue (ou ajoutée dans les paramètres)." % erreur.verify_message
    if isinstance(erreur, ssl.SSLError):
        return "Échec de la négociation TLS (%s). Vérifiez le port et le mode de chiffrement." % (erreur.reason or "erreur TLS")
    if isinstance(erreur, smtplib.SMTPAuthenticationError):
        return "Authentification refusée par le serveur (%s). Vérifiez le compte et le mot de passe." % erreur.smtp_code
    if isinstance(erreur, smtplib.SMTPRecipientsRefused):
        return "Le serveur refuse le destinataire."
    if isinstance(erreur, smtplib.SMTPSenderRefused):
        return "Le serveur refuse l'adresse d'expédition (%s)." % erreur.smtp_code
    if isinstance(erreur, smtplib.SMTPNotSupportedError):
        return str(erreur)
    if isinstance(erreur, smtplib.SMTPServerDisconnected):
        return "Le serveur a fermé la connexion."
    if isinstance(erreur, OSError):
        return "Réseau injoignable depuis le serveur (%s)." % (erreur.strerror or type(erreur).__name__)
    if isinstance(erreur, smtplib.SMTPException):
        return "Erreur SMTP : %s" % type(erreur).__name__
    return "Échec de l'envoi (%s)." % type(erreur).__name__


def authentifier(serveur, utilisateur, mot_de_passe):
    """AUTH PLAIN ou LOGIN en UTF-8 (la méthode login() de smtplib n'accepte que l'ASCII)."""
    b64 = lambda texte: base64.b64encode(texte.encode("utf-8")).decode("ascii")  # noqa: E731
    mecanismes = serveur.esmtp_features.get("auth", "").upper().split()
    if "PLAIN" in mecanismes:
        code, reponse = serveur.docmd("AUTH", "PLAIN " + b64("\0%s\0%s" % (utilisateur, mot_de_passe)))
    elif "LOGIN" in mecanismes:
        code, reponse = serveur.docmd("AUTH", "LOGIN")
        if code == 334:
            code, reponse = serveur.docmd(b64(utilisateur))
        if code == 334:
            code, reponse = serveur.docmd(b64(mot_de_passe))
    else:
        raise smtplib.SMTPNotSupportedError("Le serveur ne propose ni AUTH PLAIN ni AUTH LOGIN (XOAUTH2 n'est pas pris en charge).")
    if code != 235:
        raise smtplib.SMTPAuthenticationError(code, reponse)


def envoyer(p):
    etapes = []
    notification = p.get("kind") == "notification"

    def etape(nom, ok, detail):
        etapes.append({"step": nom, "ok": ok, "detail": detail})

    contexte = ssl.create_default_context(cadata=p.get("ca") or None)
    contexte.minimum_version = ssl.TLSVersion.TLSv1_2
    serveur = None
    try:
        if p["security"] == "smtps":
            serveur = smtplib.SMTP_SSL(p["host"], p["port"], timeout=DELAI, context=contexte)
            etape("Connexion", True, "%s:%s (TLS implicite)" % (p["host"], p["port"]))
            etape("Chiffrement", True, "TLS implicite, certificat vérifié")
        else:
            serveur = smtplib.SMTP(p["host"], p["port"], timeout=DELAI)
            etape("Connexion", True, "%s:%s (STARTTLS)" % (p["host"], p["port"]))
        etape("Accueil du serveur", True, "Réponse 220")
        serveur.ehlo()
        if p["security"] == "starttls":
            if not serveur.has_extn("starttls"):
                raise smtplib.SMTPNotSupportedError("Le serveur ne propose pas STARTTLS : l'envoi sans chiffrement est refusé.")
            serveur.starttls(context=contexte)
            serveur.ehlo()
            etape("Chiffrement", True, "STARTTLS établi, certificat vérifié")
        if p.get("username"):
            authentifier(serveur, p["username"], p.get("password", ""))
            etape("Authentification", True, "Compte %s" % p["username"])
        else:
            etape("Authentification", True, "Aucun compte configuré (relais sans authentification)")
        message = EmailMessage()
        message["From"] = p["from"]
        message["To"] = p["to"]
        if notification:
            message["Subject"] = p["subject"]
            message["Auto-Submitted"] = "auto-generated"
            message.set_content(p["body"])
        else:
            message["Subject"] = "Suivi des audits : message de test"
            message.set_content(
                "Ce message confirme que le serveur peut envoyer des courriels.\n"
                "Demandé par %s.\nSi vous le lisez, la configuration SMTP fonctionne.\n" % p.get("requested_by", "un administrateur")
            )
        serveur.send_message(message, from_addr=p["from"], to_addrs=[p["to"]])
        etape("Message accepté", True, "Notification acceptée par le serveur" if notification else "Destinataire %s" % p["to"])
        return {"ok": True, "steps": etapes, "error": None}
    except Exception as erreur:  # noqa: BLE001 - tout échec est expliqué, jamais propagé avec ses détails
        message = str(erreur) if isinstance(erreur, smtplib.SMTPNotSupportedError) else explication(erreur)
        etape("Échec", False, message)
        return {"ok": False, "steps": etapes, "error": message}
    finally:
        if serveur is not None:
            try:
                serveur.quit()
            except Exception:  # noqa: BLE001
                pass


def main():
    p = json.loads(sys.stdin.read(65536))
    for cle in ("host", "port", "security", "from", "to"):
        if cle not in p:
            raise SystemExit("paramètre manquant")
    if p["security"] not in ("starttls", "smtps"):
        raise SystemExit("chiffrement invalide")
    for texte in (p["host"], p["from"], p["to"], p.get("username", ""), p.get("subject", "")):
        if "\r" in str(texte) or "\n" in str(texte):
            raise SystemExit("valeur invalide")
    if p.get("kind", "test") not in ("test", "notification"):
        raise SystemExit("type de demande invalide")
    if p.get("kind") == "notification":
        sujet, corps = p.get("subject"), p.get("body")
        if not isinstance(sujet, str) or not isinstance(corps, str) or not sujet.strip() or not corps.strip():
            raise SystemExit("objet ou corps manquant")
        if len(sujet) > 200 or len(corps) > 4000:
            raise SystemExit("message trop long")
    sys.stdout.write(json.dumps(envoyer(p), ensure_ascii=True))


if __name__ == "__main__":
    main()
