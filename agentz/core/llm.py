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
from typing import Any, List, Optional, Union, Dict
from langchain_openai import ChatOpenAI
from agentz.core.credentials import get
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger("agentz.llm")

class LLMProxy:
    """
    Wraps Langchain ChatModels to expose attributes expected by browser-use.
    """
    def __init__(self, llm):
        self._llm = llm
        
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
            if hasattr(self._llm, "model"): return self._llm.model
            if hasattr(self._llm, "model_name"): return self._llm.model_name
            return "unknown"
        if name in ["bind_tools", "bind"]:
             return self.bind_tools
        return getattr(self._llm, name)

    def invoke(self, *args, **kwargs):
        return self._llm.invoke(*args, **kwargs)

    async def ainvoke(self, *args, **kwargs):
        return await self._llm.ainvoke(*args, **kwargs)

    def bind_tools(self, tools: List[Any], **kwargs):
        """Re-wraps the bound model in a new proxy."""
        if hasattr(self._llm, "bind_tools"):
            return LLMProxy(self._llm.bind_tools(tools, **kwargs))
        return self


class LimitProofLLM:
    """
    Indestructible LLM wrapper that implements a Waterfall Failover Strategy:
    GPT-4o -> Gemini Pro -> HuggingFace -> Groq -> Local Ollama.
    """
    def __init__(self, temperature: float = 0.0):
        self.temperature = temperature
        self.provider = "openai"
        self.model = "gpt-4o"
        self.model_name = "gpt-4o"
        self._tools = []
        self._bind_kwargs = {}
        
        self.providers = [
            ("cerebras-llama3.1", self._get_cerebras), # Near-instant inference for agents
            ("deepseek-chat", self._get_deepseek),
            ("local-lmstudio", self._get_lmstudio),
            ("local-ollama", self._get_ollama),
            # Disabled until keys/quota restored:
            #   - gpt-4o: OPENAI_API_KEY returns 429 insufficient_quota
            #   - gemini-pro: GEMINI_API_KEY is a placeholder ("INVALID..."); replace then re-enable
            # ("gpt-4o", self._get_openai),
            # ("gemini-pro", self._get_gemini),
        ]

    def _get_cerebras(self):
        api_key = get("cerebras_api_key", required=False) or os.environ.get("CEREBRAS_API_KEY")
        if not api_key: raise RuntimeError("Missing Cerebras Key")
        llm = ChatOpenAI(
            model="llama3.1-8b",
            temperature=self.temperature,
            api_key=api_key,
            base_url="https://api.cerebras.ai/v1"
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_deepseek(self):
        api_key = get("deepseek_api_key", required=False) or os.environ.get("DEEPSEEK_API_KEY")
        if not api_key: raise RuntimeError("Missing DeepSeek Key")
        llm = ChatOpenAI(
            model="deepseek-chat",
            temperature=self.temperature,
            api_key=api_key,
            base_url="https://api.deepseek.com"
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_lmstudio(self):
        llm = ChatOpenAI(
            model="local-model",
            temperature=self.temperature,
            api_key="not-needed",
            base_url="http://localhost:1234/v1"
        )
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_openai(self):
        api_key = get("openai_api_key") or os.environ.get("OPENAI_API_KEY")
        if not api_key: raise RuntimeError("Missing OpenAI Key")
        llm = ChatOpenAI(model="gpt-4o", temperature=self.temperature, api_key=api_key)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_gemini(self):
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key or "INVALID" in api_key: raise RuntimeError("Missing Gemini Key")
        llm = ChatGoogleGenerativeAI(model="gemini-pro", temperature=self.temperature, google_api_key=api_key)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def _get_ollama(self):
        from langchain_ollama import ChatOllama
        llm = ChatOllama(model="llama3.2", temperature=self.temperature)
        return llm.bind_tools(self._tools, **self._bind_kwargs) if self._tools else llm

    def bind_tools(self, tools: List[Any], **kwargs) -> LimitProofLLM:
        self._tools = tools
        self._bind_kwargs = kwargs
        return self

    def __getattr__(self, name):
        """Handle missing attributes for browser-use compatibility."""
        if name == "provider": return "openai"
        if name == "model": return "gpt-4o"
        return ""

    @retry(
        retry=retry_if_exception_type(Exception),
        stop=stop_after_attempt(1),
        wait=wait_exponential(multiplier=1, min=1, max=3),
        reraise=True
    )
    def invoke(self, messages: Any) -> Any:
        for name, factory in self.providers:
            try:
                llm = factory()
                logger.info(f"Invoking {name}...")
                return llm.invoke(messages)
            except Exception as e:
                logger.warning(f"Provider {name} failed: {e}. Trying failover...")
                continue
        raise RuntimeError("All LLM providers failed.")

    async def ainvoke(self, messages: Any, *args, **kwargs) -> Any:
        for name, factory in self.providers:
            try:
                llm = factory()
                return await llm.ainvoke(messages, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Provider {name} async failed: {e}. Trying failover...")
                continue
        raise RuntimeError("All LLM providers failed (async).")


def get_llm(model: str = "gpt-4o", temperature: float = 0.0):
    """
    Return a properly wrapped LLM instance. 
    Returns LimitProofLLM by default for robustness.
    """
    if model == "limit-proof" or model == "gpt-4o":
        return LLMProxy(LimitProofLLM(temperature=temperature))

    # Single provider fallbacks
    if model.startswith("gemini"):
        from langchain_google_genai import ChatGoogleGenerativeAI
        api_key = os.environ.get("GEMINI_API_KEY")
        llm = ChatGoogleGenerativeAI(model="gemini-pro", temperature=temperature, google_api_key=api_key)
        return LLMProxy(llm)

    api_key = get("openai_api_key") or os.environ.get("OPENAI_API_KEY")
    llm = ChatOpenAI(model=model, temperature=temperature, api_key=api_key)
    return LLMProxy(llm)
