import json
import urllib.request
import urllib.error
import logging

logger = logging.getLogger("agentz.lm_studio")

class LMStudioClient:
    """
    Zero-dependency HTTP client for LM Studio (Local Sovereign Node).
    Uses standard library urllib only.
    """
    def __init__(self, base_url="http://localhost:1234/v1"):
        self.base_url = base_url

    def chat_completion(self, messages, model="local-model", temperature=0.0):
        url = f"{self.base_url}/chat/completions"
        data = {
            "model": model,
            "messages": messages,
            "temperature": temperature
        }
        
        req = urllib.request.Request(
            url, 
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                return res_data["choices"][0]["message"]["content"].strip()
        except urllib.error.URLError as e:
            logger.error(f"LM Studio Connection Refused: {e}")
            return f"Error: Local Node Offline ({e})"
        except Exception as e:
            logger.error(f"LM Studio Error: {e}")
            return f"Error: {e}"

    def get_health(self):
        try:
            with urllib.request.urlopen(f"{self.base_url}/models", timeout=5) as response:
                return response.status == 200
        except:
            return False
