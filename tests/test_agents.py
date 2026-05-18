"""
tests.test_agents
-----------------
Unit tests for the core logic of AgentZ specialized agents.
"""
import pytest
import asyncio
from agentz.core.scout import calculate_pilot_fit
from agentz.core.trust import calculate_authenticity
from agentz.core.pages import generate_living_page_config

def test_scout_scoring():
    """Verify that the Scout Agent correctly ranks businesses."""
    high_value = {"category": "dispensary", "city": "Detroit", "rating": 4.5, "website": "https://test.com"}
    low_value = {"category": "hardware", "city": "Remote", "rating": 3.0}
    
    high_score = calculate_pilot_fit(high_value)
    low_score = calculate_pilot_fit(low_value)
    
    assert high_score > low_score
    assert high_score >= 80.0
    assert low_score <= 60.0

def test_trust_authenticity():
    """Verify the Trust Agent's scoring logic."""
    safe_history = {"velocity": 1, "duplicate_regions": 0, "signature_valid": True}
    suspicious_history = {"velocity": 50, "duplicate_regions": 5, "signature_valid": True}
    fail_history = {"velocity": 1, "duplicate_regions": 0, "signature_valid": False}
    
    assert calculate_authenticity(safe_history) == 100.0
    assert calculate_authenticity(suspicious_history) < 50.0
    assert calculate_authenticity(fail_history) == 0.0

def test_living_page_metadata():
    """Ensure the Pages Agent generates valid digital twin configurations."""
    product = {"name": "Test", "brand": "Brand", "authenticity_score": 95, "industry_id": "luxury"}
    qr = {"id": 12345}
    
    config = generate_living_page_config(product, qr)
    
    assert "authenticity" in config
    assert "supply_chain" in config
    assert "storymode" in config
    assert config["authenticity"]["score"] == 95
    assert "qron.space" in config["rewards"]["redemption_url"]

def test_strainchain_customization():
    """Ensure the Pages Agent handles cannabis-specific data."""
    product = {
        "name": "Bud", "brand": "Grower", "industry_id": "cannabis",
        "metadata": {"thc_content": "20%", "terpene_profile": {"a": "b"}}
    }
    qr = {"id": 12345}
    
    config = generate_living_page_config(product, qr)
    assert "cannabis_metrics" in config
    assert config["cannabis_metrics"]["thc"] == "20%"
