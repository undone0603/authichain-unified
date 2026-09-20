"""Workflow unit tests: scheduled outbound must default dry-run / fail-closed."""

from __future__ import annotations

from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
WORKFLOWS = REPO / ".github" / "workflows"


def _read(name: str) -> str:
    return (WORKFLOWS / name).read_text()


def test_agentz_orchestration_schedule_defaults_dry_run():
    yml = _read("agentz-orchestration.yml")
    assert "${{ inputs.dry_run || 'false' }}" not in yml
    assert 'if [ "${{ github.event_name }}" = "schedule" ]; then' in yml
    schedule_block = yml.split('if [ "${{ github.event_name }}" = "schedule" ]; then', 1)[1]
    schedule_block = schedule_block.split("fi", 1)[0]
    assert 'echo "dry_run=true" >> "$GITHUB_OUTPUT"' in schedule_block
    assert 'echo "dry_run=false"' not in schedule_block
    assert "DRY_RUN: ${{ needs.resolve-mode.outputs.dry_run }}" in yml


def test_content_publish_schedule_defaults_dry_run():
    yml = _read("content-publish.yml")
    assert 'if [ "${{ inputs.dry_run }}" = "true" ]' not in yml
    assert 'if [ "${{ github.event_name }}" = "schedule" ]; then' in yml
    schedule_block = yml.split('if [ "${{ github.event_name }}" = "schedule" ]; then', 1)[1]
    schedule_block = schedule_block.split("fi", 1)[0]
    assert 'echo "dry_run=true" >> "$GITHUB_OUTPUT"' in schedule_block
    assert 'echo "dry_run=false"' not in schedule_block
    assert 'if [ "${{ steps.mode.outputs.dry_run }}" = "true" ]; then ARGS="$ARGS --dry-run"; fi' in yml
    assert "if: steps.mode.outputs.dry_run != 'true'" in yml


def test_email_proposals_schedule_not_fail_open():
    yml = _read("email-proposals.yml")
    assert "${{ inputs.dry_run || 'false' }}" not in yml
    assert "OWNER_LIVE_SEND" in yml
    schedule_block = yml.split('if [ "${{ github.event_name }}" = "schedule" ]; then', 1)[1]
    schedule_block = schedule_block.split("fi", 1)[0]
    assert 'echo "dry_run=true" >> "$GITHUB_OUTPUT"' in schedule_block
    assert "OWNER_LIVE_SEND" in schedule_block


def test_ghost_traffic_dispatch_defaults_dry_run_and_schedule_probes():
    yml = _read("ghost-traffic.yml")
    assert 'default: "true"' in yml
    assert "ghost_traffic_engine --mode ${{ steps.mode.outputs.mode }}" in yml
    assert 'if [ "${{ github.event_name }}" = "schedule" ]; then' in yml
    schedule_block = yml.split('if [ "${{ github.event_name }}" = "schedule" ]; then', 1)[1]
    schedule_block = schedule_block.split("fi", 1)[0]
    assert 'echo "mode=auto"' in schedule_block
    assert "GROQ_API_KEY" not in yml
    assert "STRIPE_SECRET_KEY" not in yml


def test_marketing_autonomous_schedule_is_inbound_only():
    yml = _read("marketing-autonomous.yml")
    assert "publish-social-bundle" not in yml
    assert "content-publish.yml" in yml
    assert "linkedin-post:" in yml
    assert "retired in favour of validated bundles" in yml


INDEXNOW_MONEY_URLS = (
    "https://authichain.com/",
    "https://authichain.com/pricing",
    "https://authichain.com/dpp",
    "https://authichain.com/x402",
    "https://authichain.com/onboard",
    "https://strainchain.io/",
    "https://strainchain.io/pricing",
    "https://strainchain.io/onboard",
    "https://qron.space/",
    "https://qron.space/pricing",
    "https://qron.space/generate",
    "https://govchain.us/",
    "https://govchain.us/onboard",
)

INDEXNOW_SITEMAPS = (
    "https://authichain.com/sitemap.xml",
    "https://qron.space/sitemap.xml",
    "https://strainchain.io/sitemap.xml",
    "https://govchain.us/sitemap.xml",
)


def test_marketing_autonomous_indexnow_pings_sitemaps_and_money_urls():
    yml = _read("marketing-autonomous.yml")
    assert "authichain2026indexnow" in yml
    assert "|| true" in yml
    for url in INDEXNOW_SITEMAPS + INDEXNOW_MONEY_URLS:
        # Quoted so apex "/" is not satisfied by "/sitemap.xml".
        assert f'"{url}"' in yml, f"IndexNow should ping {url}"
