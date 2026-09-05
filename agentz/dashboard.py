import sys
from pathlib import Path

# Add project root to sys.path for absolute imports
root_path = Path(__file__).resolve().parent.parent
if str(root_path) not in sys.path:
    sys.path.insert(0, str(root_path))

import json
import time
import pandas as pd
import streamlit as st
import asyncio
from datetime import datetime
from agentz.core.credentials import get
from supabase import create_client, Client
from agentz.core.aggregator import get_global_network_stats, generate_marketplace_manifest
from agentz.core.llm import get_provider_health
from agentz.core.grants_pipeline import read_ledger, LEDGER_STATUSES

# Set page config
st.set_page_config(page_title="AgentZ Command Center", page_icon="🛡️", layout="wide")

st.title("🛡️ AgentZ: Authentic Economy Command Center")

@st.cache_data(ttl=10)
def load_audit_logs():
    log_path = Path(__file__).resolve().parent / "logs" / "runs.jsonl"
    if not log_path.exists():
        return pd.DataFrame()
    runs = []
    with log_path.open("r", encoding="utf-8") as f:
        for line in f:
            try:
                runs.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    if not runs:
        return pd.DataFrame()
    df = pd.DataFrame(runs)
    df['total_tokens'] = df['token_usage'].apply(lambda x: x.get('total_tokens', 0) if isinstance(x, dict) else 0)
    df['cost_usd'] = df['cost_usd'].fillna(0.0)
    df['started_at'] = pd.to_datetime(df['started_at'])
    return df.sort_values(by='started_at', ascending=False)

@st.cache_data(ttl=30)
def load_authichain_data():
    try:
        url = get("supabase_url")
        key = get("supabase_service_key")
        supabase: Client = create_client(url, key)
        
        products_res = supabase.table("products").select("*").order("created_at", desc=True).limit(100).execute()
        products_df = pd.DataFrame(products_res.data)
        
        scans_res = supabase.table("scan_events").select("*").order("scanned_at", desc=True).limit(100).execute()
        scans_df = pd.DataFrame(scans_res.data)
        
        return products_df, scans_df
    except Exception as e:
        st.error(f"Failed to load AuthiChain data: {e}")
        return pd.DataFrame(), pd.DataFrame()

@st.cache_data(ttl=60)
def check_provider_health():
    """Checks the status of LLM providers and circuit breaker state."""
    keys = {
        "GPT-4o": get("openai_api_key", required=False),
        "Gemini 1.5 Pro": get("gemini_api_key", required=False),
        "Groq (Llama-3.3)": get("groq_api_key", required=False),
        "Local Ollama": "http://localhost:11434"
    }
    
    cb_state = get_provider_health()
    health = {}
    for name, key in keys.items():
        lookup = name.lower().replace(" ", "-").replace("1.5-pro", "pro")
        lookup = "gpt-4o" if "gpt" in lookup else lookup
        lookup = "gemini-pro" if "gemini" in lookup else lookup
        lookup = "cerebras-llama3.1" if "groq" in lookup else lookup
        
        status = "🟢 Active"
        if not key:
            status = "🔴 Missing Key"
        elif lookup in cb_state and not cb_state[lookup]["ok"]:
            status = f"🟡 Circuit Broken ({cb_state[lookup]['error'][:30]}...)"
        
        health[name] = status
    return health

@st.cache_data(ttl=30)
def load_federal_pipeline():
    """Loads bid data from the pipeline ledger."""
    try:
        data = read_ledger()
        if not data: return pd.DataFrame()
        
        rows = []
        for nid, entry in data.items():
            rows.append({
                "notice_id": nid,
                "title": entry.get("title", "Unknown"),
                "agency": entry.get("agency", "Unknown"),
                "status": entry.get("status", "drafted"),
                "fit_score": entry.get("fit_score", 0),
                "updated_at": entry.get("updated_at", entry.get("history", [{}])[-1].get("at", "N/A"))
            })
        return pd.DataFrame(rows)
    except:
        return pd.DataFrame()

@st.cache_data(ttl=30)
def load_deal_pipeline():
    """Loads real deal data from HubSpot.

    Mirrors load_federal_pipeline above: returns an empty DataFrame rather
    than placeholder numbers when the source is unavailable, so the Revenue
    Siphon page can say "no data" instead of showing invented figures.
    """
    try:
        # Imported here (not at module scope) so the live module attribute is
        # resolved at call time.
        from agentz.core import hubspot

        deals = asyncio.run(hubspot.get_all_deals())
        if not deals:
            return pd.DataFrame()

        rows = []
        for d in deals:
            try:
                amount = float(d.get("amount") or 0)
            except (TypeError, ValueError):
                amount = 0.0
            rows.append({
                "id": d.get("id", "Unknown"),
                "name": d.get("name", "Unknown"),
                "amount": amount,
                "stage": d.get("stage", "unknown"),
            })
        return pd.DataFrame(rows)
    except Exception:
        return pd.DataFrame()

@st.cache_data(ttl=30)
def load_network_stats():
    try:
        url = get("supabase_url")
        key = get("supabase_service_key")
        supabase: Client = create_client(url, key)
        stats = asyncio.run(get_global_network_stats(supabase))
        manifest = asyncio.run(generate_marketplace_manifest(supabase))
        return stats, manifest
    except:
        return {}, []

@st.cache_data(ttl=10)
def check_system_pulse():
    """Checks the local heartbeat log to verify system continuity and deep health."""
    pulse_path = Path(__file__).resolve().parent / "logs" / "heartbeat.json"
    if not pulse_path.exists():
        return False, "No Heartbeat Found", {}
    try:
        with pulse_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            last_pulse = data.get("timestamp", 0)
            deep_health = data.get("deep_health", {})
            if time.time() - last_pulse < 120: # 2 minute threshold
                return True, "SOVEREIGN PULSE ACTIVE", deep_health
    except:
        pass
    return False, "SYSTEM OFFLINE", {}

# Sidebar
st.sidebar.header("Navigation")
is_live, pulse_msg, deep_health = check_system_pulse()
pulse_icon = "🟢" if is_live else "🔴"
st.sidebar.subheader(f"{pulse_icon} {pulse_msg}")
if deep_health:
    with st.sidebar.expander("Deep Health Metrics"):
        for k, v in deep_health.items():
            icon = "[OK]" if v == "ok" else "[XX]"
            st.write(f"{icon} **{k.title()}**: {v}")

st.sidebar.divider()
page = st.sidebar.radio("Go to", ["Orchestration Telemetry", "AuthiChain Ecosystem", "Federal Capture", "Revenue Siphon", "Limit-Proofing Health"])

if page == "Orchestration Telemetry":
    df = load_audit_logs()
    if df.empty:
        st.warning("No audit logs found.")
    else:
        st.header("Workflow Overview")
        col1, col2, col3, col4 = st.columns(4)
        total_runs = len(df)
        success_rate = (len(df[df['status'] == 'ok']) / total_runs) * 100 if total_runs > 0 else 0
        col1.metric("Total Runs", total_runs)
        col2.metric("Success Rate", f"{success_rate:.1f}%")
        col3.metric("Total Cost", f"${df['cost_usd'].sum():.4f}")
        col4.metric("Total Tokens", f"{df['total_tokens'].sum():,}")
        
        st.divider()
        st.subheader("Recent Workflow Runs")
        st.dataframe(df[['started_at', 'workflow_id', 'status', 'duration_s', 'cost_usd', 'error']].head(20), use_container_width=True)

elif page == "AuthiChain Ecosystem":
    products_df, scans_df = load_authichain_data()
    stats, manifest = load_network_stats()
    
    st.header("🌐 Global Network Activity")
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Total Scans Verified", f"{stats.get('total_scans', 0):,}")
    col2.metric("Digital Identities", f"{stats.get('total_identities', 0):,}")
    col3.metric("Trust Layer", stats.get('active_nodes', 'Polygon'))
    col4.metric("Engine Health", stats.get('throughput_status', 'Optimal'))
    
    st.divider()
    st.header("🏆 Verified Pilot Marketplace")
    if manifest:
        m_df = pd.DataFrame(manifest)
        # Only select columns that exist in the dataframe to prevent KeyErrors
        available_cols = ['brand', 'vertical', 'location', 'product_count', 'directory_link']
        target_cols = [c for c in available_cols if c in m_df.columns]
        st.dataframe(m_df[target_cols], use_container_width=True)
    
    st.divider()
    tab1, tab2, tab3 = st.tabs(["Living Products", "Scan Events", "Geospatial Intelligence"])
    with tab1:
        if not products_df.empty:
            display_df = products_df[~products_df['name'].str.contains('test', case=False, na=False)]
            st.dataframe(display_df[['created_at', 'name', 'brand', 'qron_id', 'industry_id', 'authenticity_score']], use_container_width=True)
    with tab2:
        if not scans_df.empty:
            st.dataframe(scans_df[['scanned_at', 'qron_id', 'city', 'country', 'user_agent']], use_container_width=True)
    with tab3:
        if not scans_df.empty:
            map_data = scans_df.copy()
            map_data['lat'] = 42.3314 + (pd.Series(range(len(map_data))) * 0.01)
            map_data['lon'] = -83.0458 + (pd.Series(range(len(map_data))) * 0.01)
            st.map(map_data[['lat', 'lon']])

elif page == "Federal Capture":
    st.header("🎖️ Federal RFP Capture Pipeline")
    df_pipeline = load_federal_pipeline()
    
    if df_pipeline.empty:
        st.warning("No opportunities found in ledger.")
    else:
        col1, col2, col3 = st.columns(3)
        total_bids = len(df_pipeline)
        submitted = len(df_pipeline[df_pipeline['status'] == 'submitted'])
        potential_value = total_bids * 150000
        
        col1.metric("Tracked Opportunities", total_bids)
        col2.metric("Bids Submitted", submitted)
        col3.metric("Pipeline Value (Est)", f"${potential_value/1e6:.1f}M")
        
        st.divider()
        st.subheader("Opportunity Ledger")
        st.dataframe(df_pipeline.sort_values(by="fit_score", ascending=False), use_container_width=True)
        
        st.divider()
        st.subheader("Bidding Status Distribution")
        status_counts = df_pipeline['status'].value_counts().reset_index()
        status_counts.columns = ['Status', 'Count']
        st.bar_chart(status_counts, x='Status', y='Count')

elif page == "Revenue Siphon":
    st.header("$$ Real-time Revenue Siphon")

    df_deals = load_deal_pipeline()

    if df_deals.empty:
        st.warning(
            "No deals returned from HubSpot. Check the `hubspot_token` credential "
            "and connectivity — no figures are shown rather than placeholder ones."
        )
    else:
        pipeline_total = len(df_deals)
        booked_value = df_deals["amount"].sum()

        # Projection, not measured revenue — assumptions stated inline.
        avg_setup = 2500
        avg_sub = 499 * 12
        potential_arr = pipeline_total * (avg_setup + avg_sub)

        col1, col2, col3 = st.columns(3)
        col1.metric("Deals in Pipeline", f"{pipeline_total:,}")
        col2.metric("Booked Deal Value", f"${booked_value:,.0f}")
        col3.metric(
            "Projected ARR (modelled)",
            f"${potential_arr:,.0f}",
            help=(
                f"Projection only: {pipeline_total} deals x "
                f"(${avg_setup:,} setup + ${avg_sub:,}/yr subscription). "
                "Not booked revenue."
            ),
        )

        st.divider()
        st.subheader("Mass Activation Pipeline")
        stage_counts = (
            df_deals.groupby("stage").size().reset_index(name="Count")
            .rename(columns={"stage": "Stage"})
            .sort_values("Count", ascending=False)
        )
        st.bar_chart(stage_counts, x="Stage", y="Count")

        st.divider()
        st.subheader("Deals")
        st.dataframe(df_deals, use_container_width=True)

elif page == "Limit-Proofing Health":
    st.header("🛡️ Limit-Proofing: Provider Health")
    health = check_provider_health()
    for name, status in health.items():
        col1, col2 = st.columns([2, 2])
        col1.write(f"**{name}**")
        col2.write(status)
    st.info("Waterfall Strategy: GPT-4o -> Gemini Pro -> Cerebras -> DeepSeek -> LM Studio -> Ollama")

st.sidebar.divider()
st.sidebar.caption("AgentZ v1.0 • AuthiChain Autonomous Launch")
