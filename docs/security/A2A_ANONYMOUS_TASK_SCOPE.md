# Anonymous A2A task isolation

**Scope:** public `POST /api/a2a` on the AuthiChain Cloudflare Worker.

The public A2A endpoint currently accepts unauthenticated requests for immediate
`SendMessage` evidence demonstrations. It **does not** establish a caller or
tenant identity. Its JSON-RPC library has a process-wide default in-memory
task store; reusing that store for anonymous requests would permit public
`ListTasks` to enumerate other callers' task messages.

Until there is a *properly authenticated and tenant-scoped* backing store,
the Worker must supply `memoryA2aStore()` **afresh per HTTP request**.
This allows batched RPC operations in one request to see only the tasks made
in that same batch. A follow-up HTTP request cannot retrieve or list a previous
request's task; an immediate `SendMessage` response already contains its
completed result.

**Library-wide defense-in-depth:** `handleA2aJsonRpc` no longer creates
or reuses an implicit module-global `defaultStore`. When `opts.store` is
omitted, it constructs a new in-memory store for each invocation, shared
only within that invocation's JSON-RPC batch. An authenticated client that
needs persistence must inject its own owner-scoped store and enforce
authorization outside the JSON-RPC request body. The public Worker also
passes a fresh store explicitly.

Regression coverage now checks this rule at **both** the shared
`src/lib/a2a-jsonrpc.test.ts` boundary and the public
`workers/authichain-com/src/x402-routes.test.ts` boundary. Those
TypeScript tests are committed but have not produced a green hosted run;
do not claim execution or deployed protection.

**Request memory budget:** Public anonymous A2A POST bodies are limited to
64 KiB measured in UTF-8 bytes, not character count. A response with
HTTP 413 `a2a_request_too_large` is returned before parsing or task creation.
Both a claimed `Content-Length` and the actual request stream are checked,
so omitting or understating the header does not bypass the cap. A legitimate
client requiring larger payloads needs a separately authenticated,
tenant-scoped endpoint and explicit resource limits; this anonymous demo
must not accept unbounded arrays/messages.

**Trade-off:** This is a stateless anonymous demonstration, not durable A2A
task lifecycle support. External clients should not expect `GetTask` on a
later request to succeed. Do not advertise durable, multi-tenant, or certified
A2A task semantics until authenticated store and authorization are delivered.

**Required before enabling persistence:**
- Bind a verified transport-level principal to the tenant/account.
- Check authorization for *every* `GetTask`, `ListTasks`, `CancelTask`,
  and other task operation; never accept claimed `agent_id` from an AgentCard
  or JSON-RPC body as authority.
- Scope each task lookup and list to the authenticated principal.
- Apply per-identity limits, retention and audit logs without exposing raw
  evidence or prompt contents.
- Execute negative cross-tenant tests, including a same-Worker-instance test.
- Keep x402 settlement and AgentZ humanHold/production_send policies separate.

This code is a **draft fix**, not proof of a production deployment or completed
security audit.

Reference: current A2A security considerations
https://github.com/a2aproject/A2A/blob/main/docs/specification.md
(authorization checks and caller scope on task reads).
