"""Symmetric encryption for message content at rest.

This is *not* end-to-end encryption and must never be described as such: the
server holds the key and can read every message, which is what keeps moderation
reports and admin tooling working. What it does buy is that a leaked database
dump, a stray backup or a snapshot restore contains ciphertext rather than
members' private conversations.

Rollout is designed to need no migration. Ciphertext carries a version marker,
and anything without that marker is returned unchanged, so rows written before
the key existed keep working and can be re-encrypted lazily.

Key rotation: put the new key first in ``MESSAGE_ENCRYPTION_KEYS``. Every key in
the list is tried for decryption, only the first is used to encrypt.
"""

import logging
from typing import List, Optional

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.portal.config import settings

log = logging.getLogger(__name__)

MARKER = "enc:v1:"

_cipher: Optional[MultiFernet] = None
_loaded = False


def _keys() -> List[str]:
    return [k.strip() for k in (settings.MESSAGE_ENCRYPTION_KEYS or "").split(",") if k.strip()]


def _get_cipher() -> Optional[MultiFernet]:
    global _cipher, _loaded
    if _loaded:
        return _cipher
    _loaded = True

    keys = _keys()
    if not keys:
        # Unconfigured means store plaintext, so a laptop with no secrets still
        # runs. Production is expected to set the key.
        log.warning("MESSAGE_ENCRYPTION_KEYS is not set; message bodies stored as plaintext")
        return None

    try:
        _cipher = MultiFernet([Fernet(k.encode()) for k in keys])
    except (ValueError, TypeError) as exc:
        # A malformed key must not silently downgrade to plaintext.
        raise RuntimeError(f"MESSAGE_ENCRYPTION_KEYS is not valid: {exc}") from exc
    return _cipher


def encrypt_text(plain: Optional[str]) -> Optional[str]:
    if plain is None:
        return None
    cipher = _get_cipher()
    if cipher is None:
        return plain
    return MARKER + cipher.encrypt(plain.encode()).decode()


def decrypt_text(stored: Optional[str]) -> Optional[str]:
    if stored is None:
        return None
    if not stored.startswith(MARKER):
        return stored  # Written before encryption was enabled.

    cipher = _get_cipher()
    token = stored[len(MARKER):]
    if cipher is None:
        log.error("Encrypted content found but no key is configured")
        return None
    try:
        return cipher.decrypt(token.encode()).decode()
    except InvalidToken:
        # Wrong or retired key. Returning None renders an empty message rather
        # than 500-ing the whole thread.
        log.error("Could not decrypt message content with any configured key")
        return None


def generate_key() -> str:
    """Convenience for provisioning: prints a key for MESSAGE_ENCRYPTION_KEYS."""
    return Fernet.generate_key().decode()
