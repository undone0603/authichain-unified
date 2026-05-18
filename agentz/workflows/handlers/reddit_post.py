"""
agentz.workflows.handlers.reddit_post
------------------------------------
Drafts and stages the QRON launch posts for r/QRcode and r/generative.
"""
from agentz.core.modes import ExecutionContext
from agentz.core.credentials import get

def run(ctx: ExecutionContext) -> str:
    ctx.step("Drafting r/QRcode launch post...")
    r_qrcode_post = """
    **Title:** We built a Cryptographic Art Engine that generates scannable QR codes using ControlNet + Magic Eye
    
    **Body:**
    Hey r/QRcode,
    
    Traditional QR codes are ugly. Standard AI QR codes are unreliable and break under varied lighting. 
    
    We built **QRON** (qron.space) — a "Living Portal" generator that uses Hugging Face ControlNet combined with Quantitative Colorimetry to ensure 100% scannability without sacrificing the artistic aesthetic.
    
    Plus, every QRON is cryptographically signed via Ed25519 and anchored to Polygon.
    
    We'd love your feedback on the error-correction thresholds we are pushing.
    
    Live Demo: [qron.space](https://qron.space)
    """

    ctx.step("Drafting r/generative launch post...")
    r_generative_post = """
    **Title:** Using SDXL + ControlNet to embed cryptographic payloads inside Autostereograms (Magic Eye)
    
    **Body:**
    Hey r/generative,
    
    We've been experimenting with pushing the boundaries of functional generative art. Our new engine, QRON, uses a specialized Hugging Face pipeline to merge standard QR error correction with deep artistic styles (like Cyber Neon and Technical Blueprints).
    
    The most interesting part: We are now applying autostereography to hide the functional QR anchors completely within the noise pattern. Look past the image, and the scannable TrueMark emerges.
    
    Try generating a few presets here: [qron.space](https://qron.space)
    """

    # Simulate posting or saving the drafts
    with open("reddit_qron_launch_posts.md", "w", encoding="utf-8") as f:
        f.write("# Reddit Launch Posts\n\n")
        f.write("## r/QRcode\n")
        f.write(r_qrcode_post + "\n\n")
        f.write("## r/generative\n")
        f.write(r_generative_post + "\n")

    ctx.step("Reddit posts drafted and saved to reddit_qron_launch_posts.md")
    
    # Check for Reddit session credential
    reddit_session = get("reddit_session", required=False)
    if not reddit_session:
        return "Drafts saved. Skipping live posting (missing REDDIT_SESSION_COOKIE)."
        
    return "Drafts saved and staged for live posting."
