# AuthiChain MCP Server

This MCP (Model Context Protocol) server provides external AI agents with secure, read-only access to the AuthiChain provenance and trust infrastructure.

## Available Tools

### 1. `verify_product`
Verifies the authenticity of a product using its unique `qron_id`.
- **Input:** `{ "qron_id": "string" }`
- **Output:** Detailed product provenance data, including authenticity score, current trust status, and the dynamic identity timeline.

### 2. `list_qrons`
Provides a listing of the 50 most recent product scan events processed by the AuthiChain network.
- **Input:** None
- **Output:** A list of recent QRON registrations.

## Integration

To connect an AI agent to this server, configure your agent's MCP client to point to this directory:

```json
{
  "mcpServers": {
    "authichain": {
      "command": "node",
      "args": ["/path/to/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "your_db_connection_string"
      }
    }
  }
}
```
