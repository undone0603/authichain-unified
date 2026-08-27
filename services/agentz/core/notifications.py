"""
agentz.core.notifications
-------------------------
Notification delivery for AgentZ. Supports webhooks (Slack/Discord),
email (Resend), and SMS (Make.com).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from agentz.core.credentials import get

logger = logging.getLogger("agentz.notifications")

class Notifier:
    def __init__(self, config: dict[str, Any]):
        self.config = config

    def notify(self, message: str, title: str = "AgentZ Alert"):
        """Deliver notifications based on config."""
        if not self.config:
            return

        # Webhook (Slack/Discord)
        webhook_url = self.config.get("webhook")
        if webhook_url:
            self._send_webhook(webhook_url, f"*{title}*\n{message}")

        # Email (Resend)
        email_to = self.config.get("email")
        if email_to:
            self._send_email(email_to, title, message)

        # SMS (Make.com Webhook Bridge)
        sms_enabled = self.config.get("sms")
        if sms_enabled:
            self._send_sms(message)

    def _send_webhook(self, url: str, text: str):
        try:
            httpx.post(url, json={"text": text}, timeout=10.0)
        except Exception as e:
            logger.error(f"Webhook failed: {e}")

    def _send_sms(self, text: str):
        """Sends an SMS alert via the Make.com webhook bridge."""
        webhook_url = get("make_webhook_url", required=False)
        if not webhook_url:
            return
            
        try:
            httpx.post(webhook_url, json={"message": text, "source": "AgentZ Sovereign"}, timeout=10.0)
            logger.info("SMS Alert triggered via Make.com")
        except Exception as e:
            logger.error(f"SMS Webhook failed: {e}")

    def _send_email(self, to: str, subject: str, body: str):
        api_key = get("resend_api_key", required=False)
        if not api_key:
            return
            
        try:
            httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "AgentZ <alerts@agentz.local>",
                    "to": to,
                    "subject": subject,
                    "text": body,
                },
                timeout=10.0
            )
        except Exception as e:
            logger.error(f"Email failed: {e}")
