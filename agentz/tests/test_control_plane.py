import unittest
from unittest.mock import patch

from agentz.control_plane import SourceState, cloudflare_states, collect_state


class ControlPlaneTests(unittest.TestCase):
    def test_collect_state_ready_gate(self):
        sources = [
            SourceState("github", "healthy", True, ref="main", commit="abc"),
            SourceState("gitlab", "healthy", True, ref="main", commit="abc", pipeline="1"),
            SourceState("vercel", "healthy", True, ref="main", commit="abc", deployment="d1"),
        ]
        with patch("agentz.control_plane.github_state", return_value=sources[0]),              patch("agentz.control_plane.gitlab_state", return_value=sources[1]),              patch("agentz.control_plane.vercel_state", return_value=sources[2]),              patch("agentz.control_plane.cloudflare_states", return_value=[]):
            state = collect_state()

        self.assertEqual(state["status"], "healthy")
        self.assertTrue(state["release_gate"]["passed"])
        self.assertEqual(state["release_gate"]["action_eligibility"], "deploy_eligible")
        self.assertEqual(state["drift"]["count"], 0)

    def test_collect_state_detects_drift(self):
        sources = [
            SourceState("github", "healthy", True, ref="main", commit="abc"),
            SourceState("gitlab", "healthy", True, ref="main", commit="def", pipeline="2"),
            SourceState("vercel", "healthy", True, ref="main", commit="abc", deployment="d2"),
        ]
        with patch("agentz.control_plane.github_state", return_value=sources[0]),              patch("agentz.control_plane.gitlab_state", return_value=sources[1]),              patch("agentz.control_plane.vercel_state", return_value=sources[2]),              patch("agentz.control_plane.cloudflare_states", return_value=[]):
            state = collect_state()

        self.assertEqual(state["status"], "drift")
        self.assertEqual(state["drift"]["providers"], ["gitlab"])
        self.assertEqual(state["release_gate"]["action_eligibility"], "blocked")

    def test_cloudflare_pages_parses_commit(self):
        payload = {
            "result": [{
                "id": "pages-deploy-1",
                "aliases": ["https://example.pages.dev"],
                "is_skipped": False,
                "latest_stage": {"status": "success"},
                "deployment_trigger": {
                    "metadata": {
                        "branch": "main",
                        "commit_hash": "abc",
                        "commit_message": "release",
                    }
                },
            }]
        }
        env = {
            "AGENTZ_CLOUDFLARE_PAGES_PROJECT": "authichain",
            "CLOUDFLARE_ACCOUNT_ID": "acct",
            "CLOUDFLARE_API_TOKEN": "token",
        }
        with patch.dict("os.environ", env, clear=False),              patch("agentz.control_plane._get_json", return_value=payload):
            states = cloudflare_states()

        self.assertEqual(len(states), 1)
        self.assertEqual(states[0].provider, "cloudflare-pages")
        self.assertEqual(states[0].status, "healthy")
        self.assertEqual(states[0].commit, "abc")
        self.assertEqual(states[0].deployment, "pages-deploy-1")


if __name__ == "__main__":
    unittest.main()
