import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import pytest
from agentz.core.alerts import analyze_scan_events, detect_suspicious_activity, trigger_notifications

NOW = datetime(2026, 11, 2, 1, 10, tzinfo=timezone.utc)


def event(i, *, minutes=1, city="Detroit", country="US", qid=7, timestamp=True):
    return {"id": i, "qron_id": qid, "city": city, "country": country,
            "session_id": f"session-{i % 4}",
            "scanned_at": (NOW-timedelta(minutes=minutes)).isoformat() if timestamp else None}


def test_no_fraud_allegation_for_popular_code_single_location():
    assert analyze_scan_events([event(i) for i in range(30)], now=NOW) == []


def test_no_alert_from_old_or_future_or_unknown_time():
    scans = [event(i,minutes=60) for i in range(11)] + [event(i+20,minutes=-1,city="Lansing") for i in range(11)]
    assert analyze_scan_events(scans,now=NOW) == []


def test_distinct_locations_inside_window_yield_review_only():
    scans = [event(i,city="Detroit" if i%2 else "Lansing") for i in range(11)]
    alerts = analyze_scan_events(scans,now=NOW)
    assert len(alerts)==1
    a=alerts[0]
    assert a["severity"] == "REVIEW"
    assert a["counterfeit_verdict"] is None
    assert a["count"] == 11
    assert a["distinct_locations"] == 2
    assert a["distinct_sessions"] == 4
    assert a["verification"] == "not_performed"


def test_duplicate_and_missing_ids_do_not_manufacture_anomaly():
    scans = [event(1,city="Detroit") for _ in range(50)]
    scans += [{**event(2,city="Lansing"),"id":None} for _ in range(20)]
    assert analyze_scan_events(scans,now=NOW) == []


def test_missing_geography_or_qron_id_does_not_create_alert():
    rows = [event(i,city="Detroit" if i%2 else "Lansing", qid=None) for i in range(20)]
    assert analyze_scan_events(rows,now=NOW) == []


def test_naive_time_rejected():
    with pytest.raises(ValueError):
        analyze_scan_events([],now=datetime(2026,11,1))


def test_database_failure_is_not_reported_as_clean():
    class DB:
        def table(self,*a): return self
        def select(self,*a): return self
        def order(self,*a,**k): return self
        def gte(self,*a): return self
        def lte(self,*a): return self
        def limit(self,*a): return self
        def execute(self): return SimpleNamespace(data=None)
    with pytest.raises(RuntimeError,match="unknown"):
        asyncio.run(detect_suspicious_activity(DB(),now=NOW))


def test_no_external_notifications(caplog):
    a=analyze_scan_events([event(i,city="Detroit" if i%2 else "Lansing") for i in range(11)],now=NOW)
    asyncio.run(trigger_notifications(a))
    assert "not a counterfeit verdict" in caplog.text


def test_single_session_never_generates_burst():
    scans = [{**event(i,city="Detroit" if i % 2 else "Lansing"),
             "session_id": "session-one"} for i in range(30)]
    assert analyze_scan_events(scans, now=NOW) == []


def test_missing_sessions_cannot_be_treated_as_independent():
    scans = [{**event(i,city="Detroit" if i % 2 else "Lansing"),
             "session_id": None} for i in range(30)]
    assert analyze_scan_events(scans, now=NOW) == []


def test_database_query_is_window_bounded():
    class DB:
        def __init__(self): self.ops = []
        def table(self,*a): self.ops.append(("table",a)); return self
        def select(self,*a): self.ops.append(("select",a)); return self
        def gte(self,*a): self.ops.append(("gte",a)); return self
        def lte(self,*a): self.ops.append(("lte",a)); return self
        def order(self,*a,**k): self.ops.append(("order",a)); return self
        def limit(self,*a): self.ops.append(("limit",a)); return self
        def execute(self): return SimpleNamespace(data=[])
    db=DB()
    assert asyncio.run(detect_suspicious_activity(db,now=NOW)) == []
    assert ("gte", ("scanned_at", (NOW-timedelta(minutes=10)).isoformat())) in db.ops
    assert ("lte", ("scanned_at", NOW.isoformat())) in db.ops
    assert ("limit", (201,)) in db.ops
    assert all("ip_address" not in str(x) and "user_agent" not in str(x) for x in db.ops)


def test_truncated_result_is_unknown_not_safe():
    class DB:
        def table(self,*a): return self
        def select(self,*a): return self
        def gte(self,*a): return self
        def lte(self,*a): return self
        def order(self,*a,**k): return self
        def limit(self,*a): return self
        def execute(self): return SimpleNamespace(data=[event(i) for i in range(201)])
    with pytest.raises(RuntimeError,match="truncated.*unknown"):
        asyncio.run(detect_suspicious_activity(DB(),now=NOW))


def test_naive_query_time_is_rejected_before_database_call():
    class DB:
        def table(self,*a): raise AssertionError("DB must not be called")
    with pytest.raises(ValueError, match="timezone"):
        asyncio.run(detect_suspicious_activity(DB(),now=datetime(2026,11,1)))
