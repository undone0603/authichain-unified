"""
agentz.core.llm
--------------
LLM initialization and wrapper utilities for AgentZ.
Provides compatibility wrappers for browser-use and multi-provider failover.
Handles tool-binding correctly for failover scenarios.
"""
from __future__ import annotations
import os
import logging
import time
from typing import Any, List, Optional, Union, Dict
from langchain_openai import ChatOpenAI
from agentz.core.credentials import get
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

import httpx

class LMStudioManager:
    """Manages model lifecycle using native LM Studio v1 REST API."""
    def __init__(self, base_url="http://localhost:1234"):
        self.base_url = base_url

    def load_model(self, model_identifier: str):
        """Loads a model via v1 API."""
        url = f"{self.base_url}/api/v1/models/load"
        try:
            with httpx.Client() as client:
                response = client.post(url, json={"model": model_identifier}, timeout=30.0)
                response.raise_for_status()
                logger.info(f"Successfully loaded model: {model_identifier}")
        except Exception as e:
            logger.error(f"Failed to load model {model_identifier}: {e}")

    def unload_model(self, model_identifier: str):
        """Unloads a model via v1 API."""
        url = f"{self.base_url}/api/v1/models/unload"
        try:
            with httpx.Client() as client:
                response = client.post(url, json={"model": model_identifier}, timeout=30.0)
                response.raise_for_status()
                logger.info(f"Successfully unloaded model: {model_identifier}")
        except Exception as e:
            logger.error(f"Failed to unload model {model_identifier}: {e}")

# Global manager instance
lm_manager = LMStudioManager()

logger = logging.getLogger("agentz.llm")

# Global provider health state to avoid repeated failures in the same session
_PROVIDER_HEALTH = {}

class LLMProxy:
    """
    Wraps Langchain ChatModels to expose attributes expected by browser-use.
    """
    def __init__(self, llm):
        self._llm = llm
        
    @property
    def model_name(self):
        return getattr(self._llm, "model_name", "gpt-4o")

    def __getattr__(self, name):
        if name == "provider":
            if hasattr(self._llm, "provider"): return self._llm.provider
            cls_name = self._llm.__class__.__name__.lower()
            if "openai" in cls_name: return "openai"
            if "google" in cls_name: return "google"
            if "groq" in cls_name: return "groq"
            if "ollama" in cls_name: return "ollama"
            if "huggingface" in cls_name: return "huggingface"
            return "openai"
        if name == "model":
            return getattr(self._llm, "model", self.model_name)
        if name == "completion":
            # Some versions of browser-use expect .completion
            return getattr(self._llm, "content", "")
        if name == "choices":
            # Mock OpenAI choice list for legacy framework compatibility
            class MockChoice:
                def __init__(self, content): self.message = type('obj', (object,), {'content': content})
            return [MockChoice(getattr(self._llm, "content", ""))]
        return getattr(self._llm, name)

    def invoke(self, *args, **kwargs):
        return self._llm.invoke(*args, **kwargs)

    async def ainvoke(self, *args, **kwargs):
        return await self._llm.ainvoke(*args, **kwargs)

    def bind_tools(self, tools: List[Any], **kwargs):
        """Re-wraps the bound model in a new proxy."""
        if hasattr(self._llm, "bind_tools"):
            bound = self._llm.bind_tools(tools, **kwargs)
            return LLMProxy(bound)
        return self


class LimitProofLLM:
    """
    Indestructible LLM wrapper that implements a Waterfall Failover Strategy:
    GPT-4o -> Gemini Pro -> Cerebras -> DeepSeek -> LM Studio -> Ollama.
    """
    def __init__(self, temperature: float = 0.0):
        self.temperature = temperature
        self._tools = []
        self._bind_kwargs = {}
        
        self.providers = [
            ("gpt-4o", self._get_openai),
            ("gemini-2.0-flash", self._get_gemini),
            ("openrouter-auto", self._get_openrouter),
            ("cerebras-llama3.1", self._get_cerebras),
            ("deepseek-chat", self._get_deepseek),
            ("local-lmstudio", self._get_lmstudio),
            ("local-ollama", self._get_ollama),
        ]

    @property
    def model_name(self):
        return "gpt-4o"

    @property
    def provider(self):
        return "openai"

    def _should_skip(self, name: str) -> bool:
        health = _PROVIDER_HEALTH.get(name, {"ok": True})
        if not health["ok"]:
            if time.time() - health.get("last_fail", 0) < 600:
                return True
        return False

    def _mark_failed(self, name: str, error: Exception):
        err_msg = str(error).lower()
        is_terminal = any(x in err_msg for x in ["insufficient_quota", "missing", "invalid_api_key", "authentication"])
        _PROVIDER_HEALTH[name] = {
            "ok": False, "last_fail": time.time(), "terminal": is_terminal, "error": err_msg
        }
        if is_terminal:
            logger.error(f"Provider {name} marked as TERMINAL FAILURE: {error}")
        else:
            logger.warning(f"Provider {name} failed: {error}")

    def _get_cerebras(self):
        api_key = get("cerebras_api_key", required=False) or os.environ.get("CEREBRAS_API_KEY")
        if not api_key: raise RuntimeError("Missing Cerebras Key")
        llm = ChatOpenAI(
            model="llama3.1-8b", temperature=self.temperature, api_key=api_key,
            base_url="https://api.cerebras.ai/v1", max_retries=1 
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_deepseek(self):
        api_key = get("deepseek_api_key", required=False) or os.environ.get("DEEPSEEK_API_KEY")
        if not api_key: raise RuntimeError("Missing DeepSeek Key")
        llm = ChatOpenAI(
            model="deepseek-chat", temperature=self.temperature, api_key=api_key,
            base_url="https://api.deepseek.com", max_retries=1
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_lmstudio(self):
        llm = ChatOpenAI(
            model="local-model", temperature=self.temperature, api_key="not-needed",
            base_url="http://localhost:1234/v1", max_retries=0
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_openai(self):
        api_key = get("openai_api_key", required=False) or os.environ.get("OPENAI_API_KEY")
        if not api_key: raise RuntimeError("Missing OpenAI Key")
        llm = ChatOpenAI(model="gpt-4o", temperature=self.temperature, api_key=api_key, max_retries=1)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_openrouter(self):
        api_key = get("openrouter_api_key", required=False) or os.environ.get("OPENROUTER_API_KEY")
        if not api_key: raise RuntimeError("Missing OpenRouter Key")
        llm = ChatOpenAI(
            model="openai/gpt-4o",
            temperature=self.temperature,
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            max_retries=1,
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_gemini(self):
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key or "INVALID" in api_key: raise RuntimeError("Missing Gemini Key")
        llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=self.temperature, google_api_key=api_key)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_ollama(self):
        model = os.environ.get("OLLAMA_MODEL", "llama3.2")
        api_key = get("ollama_api_key", required=False) or os.environ.get("OLLAMA_API_KEY")
        host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        if api_key and "localhost" not in host:
            # Remote Ollama with auth (OpenAI-compatible endpoint)
            llm = ChatOpenAI(model=model, temperature=self.temperature, api_key=api_key,
                             base_url=f"{host.rstrip('/')}/v1", max_retries=1)
        else:
            from langchain_ollama import ChatOllama
            llm = ChatOllama(model=model, temperature=self.temperature)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def bind_tools(self, tools: List[Any], **kwargs) -> LimitProofLLM:
        self._tools = tools
        self._bind_kwargs = kwargs
        return self

    def __getattr__(self, name):
        if name == "provider": return "openai"
        if name == "model": return "gpt-4o"
        return ""

    def _convert_messages(self, messages: Any, max_len: Optional[int] = None) -> List[Any]:
        from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
        if not isinstance(messages, list): return messages
            
        converted = []
        for m in messages:
            cls_name = m.__class__.__name__
            content = getattr(m, "content", "")
            if isinstance(content, list):
                new_content = []
                for part in content:
                    if hasattr(part, "text"): new_content.append({"type": "text", "text": part.text})
                    elif hasattr(part, "image"):
                        if not max_len or len(str(converted)) < (max_len / 2):
                             new_content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{part.image}"}})
                    elif isinstance(part, dict): new_content.append(part)
                content = new_content

            if "SystemMessage" in cls_name: converted.append(SystemMessage(content=content))
            elif "HumanMessage" in cls_name or "UserMessage" in cls_name: converted.append(HumanMessage(content=content))
            elif any(x in cls_name for x in ["AIChatMessage", "AIMessage", "AssistantMessage"]):
                tool_calls = getattr(m, "tool_calls", [])
                converted.append(AIMessage(content=content, tool_calls=tool_calls))
            else: converted.append(m)
        
        if max_len and len(str(converted)) > max_len:
             # Very aggressive: Keep system prompt and instructions, strip DOM/History
             new_msgs = [converted[0]]
             for m in converted[1:]:
                 if hasattr(m, "content"):
                     if isinstance(m.content, list):
                         # Strip large text and images
                         m.content = [p for p in m.content if len(str(p.get("text",""))) < 1000 and p.get("type") != "image_url"]
                     elif len(str(m.content)) > 2000:
                         m.content = str(m.content)[:2000] + "...(truncated)"
                 new_msgs.append(m)
             return new_msgs[-3:] # Keep very latest
        return converted

    def invoke(self, input: Any, config: Optional[Any] = None, **kwargs) -> Any:
        if config is not None and not isinstance(config, dict): config = None
        kwargs.pop("session_id", None)
        for name, factory in self.providers:
            if self._should_skip(name): continue
            max_ctx = 7500 if "cerebras" in name else None
            messages = self._convert_messages(input, max_len=max_ctx)
            try:
                llm = factory()
                res = llm.invoke(messages, config=config, **kwargs)
                if not hasattr(res, "usage"):
                    res.usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
                                 "prompt_cached_tokens": 0, "prompt_cache_creation_tokens": 0, "prompt_image_tokens": 0}
                return res
            except Exception as e:
                self._mark_failed(name, e)
                continue
        raise RuntimeError("All LLM providers failed or are out of quota.")

    async def ainvoke(self, input: Any, config: Optional[Any] = None, **kwargs) -> Any:
        if config is not None and not isinstance(config, dict): config = None
        kwargs.pop("session_id", None)
        for name, factory in self.providers:
            if self._should_skip(name): continue
            max_ctx = 7500 if "cerebras" in name else None
            messages = self._convert_messages(input, max_len=max_ctx)
            try:
                llm = factory()
                res = await llm.ainvoke(messages, config=config, **kwargs)
                if not hasattr(res, "usage") or not isinstance(res.usage, dict):
                    res.usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
                                 "prompt_cached_tokens": 0, "prompt_cache_creation_tokens": 0, "prompt_image_tokens": 0}
                return res
            except Exception as e:
                self._mark_failed(name, e)
                continue
        raise RuntimeError("All LLM providers failed or are out of quota (async).")

def get_llm(model: str = "gpt-4o", temperature: float = 0.0):
    if model.startswith("gemini"):
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key and "INVALID" not in api_key:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return LLMProxy(ChatGoogleGenerativeAI(model=model, temperature=temperature, google_api_key=api_key))
    return LLMProxy(LimitProofLLM(temperature=temperature))

def get_provider_health() -> Dict[str, Any]: return _PROVIDER_HEALTH
