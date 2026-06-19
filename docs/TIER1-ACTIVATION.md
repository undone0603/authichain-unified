# Tier 1 Autonomous Pipeline Activation
# Set these environment variables to unlock dormant autonomous workflows

# ══════════════════════════════════════════════════════════════════════════════
# TIER 1: IMMEDIATE ACTIVATION (Unlocks 25-30% of autonomous capability)
# ══════════════════════════════════════════════════════════════════════════════

# Enable autonomous pipeline orchestration
# - Unlocks JOB 9: autonomous-pipeline-tick (every 2 minutes)
# - Unlocks JOB 14: payout-preparation (daily 5 AM)
# Impact: Full lead → proposal → deal → payout automation
AUTONOMOUS_PIPELINE_ENABLED=true

# Enable Pinecone vector search for gov opportunity matching
# Get API key from: https://www.pinecone.io/
# Impact: AI semantic similarity matching for better lead scoring
PINECONE_API_KEY=your_pinecone_api_key_here

# HeyGen API for personalized video outreach
# Get API key from: https://www.heygen.com/
# Impact: Generate AI spokespersons for video campaigns
HEYGEN_API_KEY=your_heygen_api_key_here

# ══════════════════════════════════════════════════════════════════════════════
# OPTIONAL: Enable payouts (requires approval workflow)
# ══════════════════════════════════════════════════════════════════════════════

# Allow automatic payout execution (must review queued payouts first)
PAYOUTS_ENABLED=false

# Max payout per individual item (cents)
PAYOUT_MAX_PER_ITEM=50000

# Max payout per run (cents)
PAYOUT_MAX_PER_RUN=500000

# ══════════════════════════════════════════════════════════════════════════════
# ACTIVATION CHECKLIST
# ══════════════════════════════════════════════════════════════════════════════

# [ ] Set AUTONOMOUS_PIPELINE_ENABLED=true
# [ ] Get PINECONE_API_KEY from https://www.pinecone.io/ (free tier available)
# [ ] Set PINECONE_API_KEY
# [ ] Get HEYGEN_API_KEY from https://www.heygen.com/ (optional but recommended)
# [ ] Set HEYGEN_API_KEY
# [ ] Restart server: pnpm dev
# [ ] Verify: Check logs for "JOB 9" and "JOB 14" initialization
# [ ] Test: Submit a lead form, watch autonomous engagement trigger

# ══════════════════════════════════════════════════════════════════════════════
# WHAT GETS ACTIVATED
# ══════════════════════════════════════════════════════════════════════════════

# JOB 9: Autonomous Pipeline Tick (every 2 minutes)
#   - Runs agent tasks from the mission queue
#   - Drafts outreach emails to leads
#   - Monitors deal progression
#   - Triggers closing workflows

# JOB 14: Payout Preparation (daily 5 AM UTC)
#   - Queues eligible payouts (affiliate commissions, staking rewards)
#   - Requires manual approval before funds move
#   - Logs all payout actions to automation_logs

# Enhanced Gov Lead Matching (with PINECONE_API_KEY)
#   - Semantic similarity for SAM.gov opportunities
#   - Better lead relevance scoring
#   - Reduced false positives in opportunity pipeline

# HeyGen Video Generation (with HEYGEN_API_KEY)
#   - Personalized AI video outreach
#   - Automated video sequence for multi-step campaigns
#   - Real-time tracking of video renders and views

# ══════════════════════════════════════════════════════════════════════════════
# MONITORING
# ══════════════════════════════════════════════════════════════════════════════

# Watch the Founders DreamDash for real-time pipeline activity:
# https://yourapp.com/founders

# Monitor automation logs:
# SELECT * FROM automation_logs WHERE created_at > now() - interval '1 hour'

# Check scheduler status in admin panel:
# https://yourapp.com/admin/ops
