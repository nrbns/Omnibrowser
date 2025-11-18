import asyncio
import json


from apps.api.services.telemetry import record_ai_task_metric


def test_record_ai_task_metric_writes_jsonl(monkeypatch, tmp_path):
    log_path = tmp_path / "ai_tasks.jsonl"
    monkeypatch.setenv("AI_TASK_METRICS_PATH", str(log_path))

    payload = {
        "status": "success",
        "kind": "search",
        "latency_ms": 1200,
        "provider": "openai",
        "model": "gpt-4o-mini",
        "prompt_chars": 42,
        "citations_count": 3,
    }

    asyncio.run(record_ai_task_metric(payload))

    assert log_path.exists()
    contents = log_path.read_text(encoding="utf-8").strip().splitlines()
    assert len(contents) == 1

    entry = json.loads(contents[0])
    assert entry["status"] == payload["status"]
    assert entry["kind"] == payload["kind"]
    assert entry["provider"] == payload["provider"]
    assert entry["model"] == payload["model"]
    assert "timestamp" in entry

