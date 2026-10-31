# SPDX-License-Identifier: Apache-2.0
"""Offline verifier for AuthiChain provenance records and attestation seals."""

from .verifier import (  # noqa: F401
    ATTESTATION_TYP,
    MAINNET_CHAINS,
    base58_decode,
    base58_encode,
    canonicalize,
    did_key_from_jwk,
    public_key_from_did_key,
    sha256_hex,
    signing_bytes,
    verify_attestation_jws,
    verify_record,
)

__version__ = "0.1.0"
