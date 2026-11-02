"""Fully offline real HTTPX transport state tests (no sockets or credentials)."""
import asyncio
import json
import unittest

import httpx

from agentz.integrations.mcp_httpx_probe import ENDPOINT, probe


def ok(body, headers=None, status=200):
    return httpx.Response(status, json=body, headers=headers or {})


class HttpxMcpTests(unittest.TestCase):
    def run_probe(self, handle):
        return asyncio.run(probe(transport=httpx.MockTransport(handle)))

    def test_valid_json_handshake_and_list(self):
        methods = []
        def handler(request):
            self.assertEqual(str(request.url), ENDPOINT)
            self.assertNotIn("authorization", request.headers)
            self.assertNotIn("cookie", request.headers)
            methods.append(json.loads(request.content)["method"])
            if len(methods) == 1:
                return ok({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{"name":"authichain","version":"1.0"}}}, headers={"MCP-Session-Id":"ABC_12"})
            self.assertEqual(request.headers["mcp-session-id"], "ABC_12")
            if len(methods) == 2:
                return httpx.Response(202)
            return ok({"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"verify_record"},{"name":"query_provenance"}]}})
        r = self.run_probe(handler)
        self.assertTrue(r["confirmed"])
        self.assertEqual(r["tools_count"], 2)
        self.assertEqual(methods, ["initialize", "notifications/initialized", "tools/list"])
        self.assertFalse(r["payment"])
        self.assertFalse(r["tools_invoked"])

    def test_sse_response_supported(self):
        body='event: message\ndata: '+json.dumps({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{"name":"x"}}})+'\n\n'
        calls=[]
        def handler(request):
            calls.append(1)
            if len(calls)==1:return httpx.Response(200,text=body,headers={"Content-Type":"text/event-stream"})
            if len(calls)==2:return httpx.Response(204)
            return httpx.Response(200,text='data: '+json.dumps({"jsonrpc":"2.0","id":2,"result":{"tools":[]}})+'\n',headers={"Content-Type":"text/event-stream"})
        r=self.run_probe(handler)
        self.assertEqual(r["state"],"mcp_handshake_and_listing_confirmed")

    def test_redirect_never_followed(self):
        calls=[]
        def handler(req):
            calls.append(req)
            return httpx.Response(307,headers={"Location":"https://other.invalid"})
        self.assertEqual(self.run_probe(handler)["state"],"redirect_blocked")
        self.assertEqual(len(calls),1)

    def test_payment_required_no_payment(self):
        r=self.run_probe(lambda _:httpx.Response(402))
        self.assertEqual(r["state"],"payment_required_no_payment_sent")

    def test_auth_required(self):
        self.assertEqual(self.run_probe(lambda _:httpx.Response(401))["state"],"authentication_required")

    def test_upstream_unavailable(self):
        def handler(req):raise httpx.ConnectError("mock DNS failure",request=req)
        self.assertEqual(self.run_probe(handler)["state"],"transport_unavailable")

    def test_timeout(self):
        def handler(req):raise httpx.ConnectTimeout("mock timeout",request=req)
        self.assertEqual(self.run_probe(handler)["state"],"transport_timeout")

    def test_invalid_jsonrpc_does_not_list(self):
        n=[]
        def handler(req):
            n.append(1)
            return ok({"name":"authichain","tools":[{}]})
        self.assertEqual(self.run_probe(handler)["state"],"invalid_initialize_response")
        self.assertEqual(len(n),1)

    def test_session_header_invalid_stops(self):
        calls=[]
        def handler(req):
            calls.append(1)
            return ok({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{}}},headers={"MCP-Session-Id":"bogus/header"})
        self.assertEqual(self.run_probe(handler)["state"],"invalid_session_header")
        self.assertEqual(len(calls),1)

    def test_oversized_response_stops(self):
        r=self.run_probe(lambda _:httpx.Response(200,content=b"A"*66000))
        self.assertEqual(r["state"],"oversize_response")

    def test_tools_list_bad_schema(self):
        calls=[]
        def handler(req):
            calls.append(1)
            if len(calls)==1:return ok({"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","serverInfo":{}}})
            if len(calls)==2:return httpx.Response(204)
            return ok({"jsonrpc":"2.0","id":2,"result":{"tools":[{"not_a_name":"x"}]}})
        self.assertEqual(self.run_probe(handler)["state"],"invalid_tools_list_result")

    def test_not_mcp_not_success(self):
        self.assertEqual(self.run_probe(lambda _:httpx.Response(200,json={"protocol":"mcp","tools":[]}))["state"],"invalid_initialize_response")


if __name__ == "__main__":
    unittest.main()
