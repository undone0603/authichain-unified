"""Security and behavior tests for AgentZ's opt-in local voice and vision console."""
import base64
import os
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from agentz.api.voice_vision import _image_data_url, _private_model_endpoint, router


class _Model:
    def __init__(self):
        self.calls = []
    async def __aenter__(self):
        return self
    async def __aexit__(self, *_):
        return False
    async def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        class Response:
            def raise_for_status(self):
                pass
            def json(self):
                return {"choices": [{"message": {"content": "I see a queued job. Check runner health."}}]}
        return Response()


class VoiceVisionTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.local = TestClient(app, client=("127.0.0.1", 50000))
        self.remote = TestClient(app, client=("203.0.113.25", 50000))
        self.auth = {"Authorization": "Bearer test-operator-secret"}
        env = patch.dict(os.environ, {
            "AGENT_SECRET": "test-operator-secret",
            "AGENTZ_VOICE_VISION_ENABLED": "true",
            "AGENTZ_VISION_MODEL": "local-vision",
            "AGENTZ_VISION_ENDPOINT": "http://127.0.0.1:1234/v1/chat/completions",
        })
        env.start()
        self.addCleanup(env.stop)

    def test_console_local_only(self):
        response = self.local.get("/agentz/voice-vision")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Start speaking", response.text)
        self.assertIn("Capture screen", response.text)
        self.assertEqual(self.remote.get("/agentz/voice-vision").status_code, 403)

    def test_missing_secret_and_remote_requests_denied(self):
        path = "/agentz/voice-vision/observe"
        self.assertEqual(self.local.post(path, json={"prompt": "Describe"}).status_code, 401)
        self.assertEqual(self.remote.post(path, json={"prompt": "Describe"}, headers=self.auth).status_code, 403)
        with patch.dict(os.environ, {"AGENT_SECRET": ""}):
            self.assertEqual(self.local.post(path, json={"prompt": "Describe"}, headers=self.auth).status_code, 503)
        with patch.dict(os.environ, {"AGENTZ_VOICE_VISION_ENABLED": "false"}):
            self.assertEqual(self.local.post(path, json={"prompt": "Describe"}, headers=self.auth).status_code, 503)

    def test_image_validation_fails_closed(self):
        invalid = [
            "https://example.net/image.jpg",
            "data:image/jpeg;base64,ZXZpbA==",
            "data:image/png;base64,###",
            "data:image/svg+xml;base64,PHN2Zz4=",
            "data:image/jpeg;base64," + "A" * 4_100_000,
        ]
        for image in invalid:
            with self.subTest(image=image[:35]):
                with self.assertRaises(ValueError):
                    _image_data_url(image)

    def test_only_private_inference_endpoints(self):
        for url in (
            "https://api.openai.com/v1/chat/completions",
            "http://evil.test/v1/chat/completions",
            "http://127.0.0.1:1234/v1/chat/completions?token=secret",
            "http://169.254.1.1/v1/chat/completions",
        ):
            with self.subTest(url=url), patch.dict(os.environ, {"AGENTZ_VISION_ENDPOINT": url}):
                with self.assertRaises(ValueError):
                    _private_model_endpoint()
        with patch.dict(os.environ, {"AGENTZ_VISION_ENDPOINT": "http://10.0.0.5:1234/v1/chat/completions"}):
            self.assertIn("10.0.0.5", _private_model_endpoint())

    def test_image_and_voice_prompt_reach_local_model(self):
        photo = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0mock").decode()
        fake = _Model()
        with patch("agentz.api.voice_vision.httpx.AsyncClient", return_value=fake):
            response = self.local.post("/agentz/voice-vision/observe", headers=self.auth,
                                       json={"prompt": "What should AgentZ improve?", "image": photo})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["image_analyzed"])
        self.assertFalse(response.json()["action_taken"])
        self.assertEqual(fake.calls[0][0], "http://127.0.0.1:1234/v1/chat/completions")
        self.assertEqual(fake.calls[0][1]["json"]["messages"][-1]["content"][-1]["image_url"]["url"], photo)
        self.assertNotIn("test-operator-secret", str(fake.calls[0][1]))

    def test_voice_only_request_does_not_execute(self):
        fake = _Model()
        with patch("agentz.api.voice_vision.httpx.AsyncClient", return_value=fake):
            response = self.local.post("/agentz/voice-vision/observe", headers=self.auth,
                                       json={"prompt": "Suggest one safe step"})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["image_analyzed"])
        self.assertFalse(response.json()["action_taken"])
        self.assertIn("queued job", response.json()["reply"])


if __name__ == "__main__":
    unittest.main()
