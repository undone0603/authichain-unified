"""
agentz.workflows.handlers.gsc_setup
-----------------------------------
Verifies ownership of domains via Google Search Console HTML file method.
Supports authichain, qron, strainchain, and govchain.
"""
import os
from agentz.core.modes import ExecutionContext, Mode


def run(ctx: ExecutionContext) -> str:
    # Use workflow_id to determine domain.
    wid = ctx.workflow_id

    # Verification details (placeholder from existing setup).
    html_content = "google-site-verification: google7c95eee4dd86e0e9.html"
    filename = "google7c95eee4dd86e0e9.html"

    # Mapping workflow_id -> (site, target_dir).
    base_dir = os.path.join(os.getcwd(), "..")
    mapping = {
        "gsc_setup_authichain": ("authichain.com", "AuthiChain"),
        "gsc_setup_qron": ("qron.space", "qron-platform"),
        "gsc_setup_strainchain": ("strainchain.io", "StrainChain"),
        "gsc_setup_govchain": ("govchain.us", "GovChain"),
    }

    if wid not in mapping:
        return f"Unknown site for GSC setup: {wid}"

    site, prj_dir = mapping[wid]
    target_dir = os.path.join(base_dir, prj_dir, "public")
    file_path = os.path.join(target_dir, filename)

    ctx.step(f"Setting up Google Search Console verification for {site}...")

    # A missing project directory is reported, not created as a side effect.
    if not os.path.exists(os.path.join(base_dir, prj_dir)):
        ctx.step(f"Warning: Project directory {prj_dir} not found at {base_dir}")

    def _create_file():
        # Directory creation belongs inside the gated action. In dry-run this
        # function is never called; in confirm mode it runs only after approval.
        os.makedirs(target_dir, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(html_content)
        return f"Created {file_path}"

    created = ctx.step(f"Create verification file {filename}", action=_create_file)
    if ctx.mode == Mode.DRY_RUN:
        return f"GSC setup dry-run: would create {file_path}"
    if created is None:
        return f"GSC setup not completed for {site}: file creation was not approved."

    ctx.step("Triggering verification check via GSC API (simulated)...")
    return f"GSC setup complete for {site}."
