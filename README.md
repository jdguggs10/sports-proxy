# Sports Proxy - MCP Orchestrator

A Cloudflare Worker that acts as a middle layer proxy for sports data, implementing the Model Context Protocol (MCP) with advanced caching, streaming, and authentication.

## 🏗️ Architecture

```
┌────────────────────┐    Streamable HTTP     ┌──────────────────────┐
│ Cloudflare Worker  │ ◄─────────────────────► │   MCP: MLB Stats     │
│  (Sports-Proxy)    │                        └──────────────────────┘
│  • KV/R2 cache     │    Streamable HTTP     ┌──────────────────────┐
│  • Durable Object  │ ◄─────────────────────► │   MCP: ESPN (future) │
│  • OAuth provider  │                        └──────────────────────┘
└────────┬───────────┘
         │ SSE stream (text/event-stream)
         ▼
┌────────────────────┐
│  Web / iOS Client  │
└────────────────────┘
```

## 🚀 Features

### MCP Orchestration
- **Multi-server coordination**: Routes requests to appropriate MCP servers
- **Normalized schemas**: Common data format across different sports APIs
- **Tool discovery**: Dynamic tool listing and registration
- **Error handling**: Graceful fallbacks and error reporting

### Dual Transport Support
- **Streamable HTTP**: Modern long-poll approach for high performance
- **Server-Sent Events (SSE)**: Browser-compatible streaming for real-time updates
- **WebSocket fallback**: Future-proof for advanced streaming needs

### Advanced Caching
- **Hot cache (KV)**: 10-second edge caching for frequently accessed data
- **Cold cache (R2)**: 5-minute deep storage for less frequent requests
- **Smart TTL**: Dynamic cache duration based on data type and game timing
- **Cache promotion**: Automatic hot-cache population from cold storage

### Authentication & Security
- **API key validation**: Secure access control
- **Rate limiting**: Prevent abuse and ensure fair usage
- **CORS support**: Cross-origin requests for web applications
- **Development mode**: Skip auth for local development

## 📡 Endpoints

### `/mcp` - MCP Protocol
Primary endpoint for OpenAI Responses API integration.

**Request:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_player_stats",
    "arguments": {
      "playerId": "592450",
      "season": "2025",
      "statType": "hitting"
    }
  }
}
```

### `/sse` - Server-Sent Events
Real-time streaming endpoint for web clients.

**Usage:**
```javascript
const eventSource = new EventSource('/sse?tool=get_player_stats&args={"playerId":"592450"}');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

### `/stream` - Streamable HTTP
Single request-response endpoint with caching metadata.

**Request:**
```json
{
  "tool": "get_team_info",
  "args": {
    "teamId": "147",
    "season": "2025"
  }
}
```

### `/health` - Health Check
Service status and diagnostics.

**Response:**
```json
{
  "status": "healthy",
  "services": {
    "mcp": {
      "mlb": {"status": "healthy", "responseTime": 150}
    },
    "cache": {
      "hotCacheAvailable": true,
      "coldCacheAvailable": true
    }
  }
}
```

## 🛠️ Available Tools

### MLB Data Tools
- `get_team_info` - Team information and details
- `get_player_stats` - Player statistics (hitting, pitching)
- `get_team_roster` - Team roster and player positions
- `get_schedule` - Game schedules and dates
- `get_standings` - League and division standings
- `get_live_game` - Live game data and updates

### Future Expansions
- ESPN fantasy data
- NBA stats
- NHL stats
- NFL stats

## 🔧 Configuration

### Environment Variables
```bash
# MCP Server URLs
MLB_MCP_URL=https://mlbstats-mcp.gerrygugger.workers.dev
ESPN_MCP_URL=https://espn-mcp.your-domain.workers.dev

# OpenAI Integration
OPENAI_API_KEY=your-openai-api-key

# Caching Configuration
CACHE_TTL_HOT=10      # Hot cache TTL in seconds
CACHE_TTL_COLD=300    # Cold cache TTL in seconds

# Authentication
VALID_API_KEYS=sp_key1,sp_key2,sp_key3
SKIP_AUTH=true        # Development only

# Environment
ENVIRONMENT=development
```

### Cloudflare Resources
```toml
# KV Namespace for hot caching
[[kv_namespaces]]
binding = "SPORTS_CACHE"

# R2 Bucket for cold storage
[[r2_buckets]]
binding = "SPORTS_STORAGE"
bucket_name = "sports-data-bucket"

# Durable Objects for rate limiting
[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiter"
```

## 🚀 Deployment

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Wrangler:**
   ```bash
   wrangler login
   ```

3. **Create KV namespace:**
   ```bash
   wrangler kv:namespace create "SPORTS_CACHE"
   ```

4. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create sports-data-bucket
   ```

5. **Deploy:**
   ```bash
   npm run deploy
   ```

## 📊 Performance

### Caching Strategy
- **Live games**: 5-second cache during active games
- **Player stats**: 60-second cache, reduced to 10s during games
- **Team info**: 5-minute cache (teams don't change often)
- **Standings**: 60-second cache (updates after each game)

### Response Times
- **Cache hit**: <50ms (KV) / <100ms (R2)
- **Cache miss**: 200-500ms (upstream MCP + cache)
- **SSE streaming**: Real-time with <100ms latency

## 🔐 Authentication

### API Key Format
```
Authorization: Bearer sp_your32characterapikeyhere...
```

### Rate Limits
- **Standard tier**: 1,000 requests/hour
- **Premium tier**: 10,000 requests/hour  
- **Unlimited tier**: No limits (for internal use)

## 🧪 Testing

```bash
# Health check
curl https://sports-proxy.your-domain.workers.dev/health

# Get Yankees info
curl -X POST https://sports-proxy.your-domain.workers.dev/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sp_your_api_key" \
  -d '{"tool":"get_team_info","args":{"teamId":"147","season":"2025"}}'

# SSE streaming
curl -H "Authorization: Bearer sp_your_api_key" \
  https://sports-proxy.your-domain.workers.dev/sse?tool=get_player_stats&args={"playerId":"592450"}
```

## 🎯 Integration with OpenAI

Register as a remote MCP server in your OpenAI Responses API calls:

```json
{
  "tools": [
    {
      "type": "mcp",
      "url": "https://sports-proxy.your-domain.workers.dev/mcp"
    }
  ],
  "parallel_tool_calls": true,
  "stream": true
}
```

This enables AI agents to:
- Fetch multiple sports data sources in parallel
- Stream real-time updates to clients
- Leverage intelligent caching for performance
- Access normalized data across different sports APIs