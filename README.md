# RE-Assistant

A lightweight IREB-aligned assistant with local API key storage for Google Gemini and Anthropic Claude.

## Supported AI Providers

- `gemini`: Google Gemini
- `anthropic`: Anthropic Claude

## Atlassian MCP Support

This app does not use Rovo. For Atlassian MCP integration, configure a backend proxy and set `VITE_MCP_PROXY_URL` in `.env` or `.env.local`.

A helper is available in `src/services/mcp.ts` to fetch MCP-derived context from your proxy.
