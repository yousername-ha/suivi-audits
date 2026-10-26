"""Classement des échecs d'envoi (ADR 0059) : seul un refus définitif du destinataire n'est pas relancé."""
import importlib.util
import smtplib
import socket
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("courriel_envoi", Path(__file__).resolve().parents[1] / "courriel-envoi.py")
envoi = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(envoi)


class DefinitifTests(unittest.TestCase):
    def test_a_permanent_recipient_refusal_is_final(self):
        self.assertTrue(envoi.definitif(smtplib.SMTPRecipientsRefused({"a@exemple.test": (550, b"no such user")})))

    def test_a_temporary_recipient_refusal_is_retried(self):
        self.assertFalse(envoi.definitif(smtplib.SMTPRecipientsRefused({"a@exemple.test": (451, b"try later")})))
        self.assertFalse(
            envoi.definitif(smtplib.SMTPRecipientsRefused({"a@exemple.test": (550, b"no"), "b@exemple.test": (450, b"later")}))
        )

    def test_network_and_configuration_failures_are_retried(self):
        for erreur in (ConnectionRefusedError(), socket.gaierror(), TimeoutError(), smtplib.SMTPAuthenticationError(535, b"bad"), smtplib.SMTPServerDisconnected()):
            self.assertFalse(envoi.definitif(erreur), type(erreur).__name__)

    def test_an_empty_refusal_is_not_final(self):
        self.assertFalse(envoi.definitif(smtplib.SMTPRecipientsRefused({})))


if __name__ == "__main__":
    unittest.main()
