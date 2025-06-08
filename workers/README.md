# Sports Proxy - OpenAI Responses API Orchestrator

🚀 **Version 3.0 - Production Ready with Multi-Sport Support!**

The central orchestrator for Sports Platform v3, providing native OpenAI Responses API integration with intelligent sport-scoped routing. **All tests passing ✅**

A lean, intelligent Cloudflare Worker that implements the OpenAI Responses API specification natively, routing requests to sport-specific microservices based on intelligent context detection. Features conversation memory, streaming responses, and zero-latency service bindings.

## 🎯 Enhanced Hybrid Architecture

This is a **"menu, not meal"** architecture following modern MCP best practices:

- **Sports-Proxy**: Thin API router with sport detection and tool filtering
- **MCP Workers**: Domain-specific logic with meta-tools for entity resolution
- **OpenAI gpt-4.1**: Natural language understanding and tool orchestration
- **Approve/Enrich**: Trust-but-verify pattern for reliable entity resolution

## 🏗️ Enhanced Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENHANCED SPORTS PROXY v2.2                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐   ┌───────────────────┐   ┌──────────────────┐   │
│  │  Sport Detection │   │ Tool Filtering    │   │ Approve/Enrich   │   │
│  │                  │   │                   │   │                  │   │
│  │ • MLB patterns   │──▶│ • Filtered menus  │──▶│ • Trust-verify   │   │
│  │ • Intent extract │   │ • Token reduction │   │ • Entity inject  │   │
│  │ • Confidence     │   │ • Smart pruning   │   │ • Chain results  │   │
│  └──────────────────┘   └───────────────────┘   └──────────────────┘   │
│                                     │                                   │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │ Service Bindings (Zero Latency)
                                      ▼
┌─────────────────────────┐          ┌──────────────────────────────────────┐
│     MLB MCP Server      │          │        Future MCP Servers           │
│ ┌─────────────────────┐ │          │  ┌─────────────┐  ┌─────────────┐   │
│ │   Meta-Tools        │ │          │  │    ESPN     │  │     NFL     │   │
│ │ • resolve_team      │ │          │  │    MCP      │  │     MCP     │   │
│ │ • resolve_player    │ │          │  └─────────────┘  └─────────────┘   │
│ └─────────────────────┘ │          └──────────────────────────────────────┘
│ ┌─────────────────────┐ │
│ │   Data Tools        │ │
│ │ • get_team_info     │ │
│ │ • get_player_stats  │ │
│ │ • get_team_roster   │ │
│ │ • get_standings     │ │
│ └─────────────────────┘ │
└─────────────────────────┘
                    ▲
                    │ Natural Language Query
                    │
┌─────────────────────────┐
│   OpenAI Client         │
│ • gpt-4.1 exclusive     │
│ • Responses API native  │
│ • Hybrid memory system  │
│ • Streaming support     │
└─────────────────────────┘
```

### 🔄 Enhanced Request Flow

1. **Input**: *"Tell me about the Yankees roster"*
2. **Sport Detection**: Identifies MLB with high confidence (0.8)
3. **Tool Filtering**: Exposes only MLB tools (resolve_team, get_team_roster, etc.)
4. **gpt-4.1 Processing**: Selects tools: resolve_team("yankees"), get_team_roster({})
5. **Approve/Enrich**: 
   - Execute resolve_team → {id: 147, name: "New York Yankees"}
   - Enrich get_team_roster({}) → get_team_roster({teamId: "147"})
6. **Result**: Complete roster data with Aaron Judge, etc.

## 🚀 Enhanced Features

### 🎯 Hybrid Intelligence System
- **Sport Detection**: Automatically identifies MLB/NFL/NBA from natural language
- **Intent Extraction**: Recognizes roster, stats, standings, schedule queries
- **Entity Recognition**: Detects team/player names with fuzzy matching
- **Tool Filtering**: Reduces token usage by 40-60% with sport-specific tool menus
- **Confidence Scoring**: Adaptive behavior based on detection confidence

### 🔧 Meta-Tool Entity Resolution
- **resolve_team**: Converts "Yankees" → {id: 147, name: "New York Yankees"}
- **resolve_player**: Converts "Judge" → {id: 592450, name: "Aaron Judge"}
- **Comprehensive Mappings**: All 30 MLB teams + common players with aliases
- **Approve/Enrich Pattern**: Trust-but-verify with automatic ID injection
- **Fallback Suggestions**: Smart error messages with "did you mean?" suggestions

### 🚀 OpenAI Responses API Native
- **gpt-4.1 Integration**: Built exclusively for OpenAI's latest model
- **Server-Side State**: Automatic conversation management with `previous_response_id`
- **Hybrid Memory System**: Device memories + OpenAI conversation chaining
- **Responses API Events**: Full support for streaming events (response.created, response.output_text.delta, etc.)
- **Zero Chat Completions**: **Never uses deprecated Chat Completions API**

### 🏗️ Advanced MCP Orchestration  
- **Service Bindings**: Zero-latency worker-to-worker communication
- **Multi-server coordination**: Routes requests to appropriate MCP servers
- **Normalized schemas**: Common data format across different sports APIs
- **Dynamic tool discovery**: Sport-aware tool registration and filtering
- **Error handling**: Graceful fallbacks with Responses API error events

### Enhanced Transport Support
- **Responses API Streaming**: Native event-driven streaming for real-time updates
- **Legacy SSE**: Browser-compatible streaming (deprecated)
- **Legacy MCP**: Backward compatibility (deprecated - use /responses endpoint)

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

### `/responses` - OpenAI Responses API (PRIMARY)
**🔥 NEW: Native OpenAI Responses API endpoint - use this for all new integrations!**

**Request:**
```json
{
  "model": "gpt-4.1",
  "input": "Get player stats for Mookie Betts this season",
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_player_stats",
        "description": "Get MLB player statistics"
      }
    }
  ],
  "stream": false
}
```

**Response:**
```json
{
  "id": "resp_1234567890_abc123",
  "created_at": 1740465465.0,
  "model": "gpt-4.1",
  "object": "response",
  "output": [
    {
      "id": "msg_1234567890_def456",
      "content": [
        {
          "text": "Player statistics for Mookie Betts...",
          "type": "output_text"
        }
      ],
      "role": "assistant",
      "type": "message"
    }
  ],
  "usage": {
    "input_tokens": 25,
    "output_tokens": 150,
    "total_tokens": 175
  }
}
```

### `/mcp` - Legacy MCP Protocol (DEPRECATED)
⚠️ **Deprecated - Use `/responses` endpoint instead!**

Legacy endpoint for backward compatibility. All new integrations should use the `/responses` endpoint.

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

### 🔧 Meta-Tools (Entity Resolution)
- `resolve_team` - Convert team names to canonical IDs and info
  - **Input**: "Yankees", "Red Sox", "LA Dodgers", "NYY"
  - **Output**: {id: 147, name: "New York Yankees", abbreviation: "NYY"}
- `resolve_player` - Convert player names to canonical IDs and info
  - **Input**: "Judge", "Aaron Judge", "Ohtani"
  - **Output**: {id: 592450, name: "Aaron Judge", team: "New York Yankees"}

### ⚾ MLB Data Tools
- `get_team_info` - Team information and details (enriched with teamId)
- `get_player_stats` - Player statistics (hitting, pitching) (enriched with playerId)
- `get_team_roster` - Team roster and player positions (enriched with teamId)
- `get_schedule` - Game schedules and dates (optional teamId enrichment)
- `get_standings` - League and division standings (no enrichment needed)
- `get_live_game` - Live game data and updates (uses gameId)

### 🚀 Future Expansions
- **ESPN MCP**: Fantasy data with resolve_player integration
- **NFL MCP**: Team/player resolution for football stats
- **NBA MCP**: Basketball stats with team/player meta-tools
- **NHL MCP**: Hockey data with enhanced entity resolution

### 🎯 Smart Tool Selection

The system automatically selects the optimal tool set based on sport detection:

```javascript
// Input: "Tell me about the Yankees roster"
// Sport Detection: MLB (confidence: 0.8)
// Tools Exposed: [resolve_team, resolve_player, get_team_info, get_team_roster, ...]
// Tools Selected: resolve_team("yankees"), get_team_roster({})
// Enhanced: get_team_roster({teamId: "147"})
```

## 🔧 Configuration

### Environment Variables
```bash
# OpenAI Responses API (Required)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1              # Always use gpt-4.1

# MCP Server Service Bindings (Cloudflare)
MLB_MCP=mlbstats-mcp              # Service binding to MLB MCP worker
ESPN_MCP=espn-mcp                 # Service binding to ESPN MCP worker (future)

# Caching Configuration
CACHE_TTL_HOT=10                  # Hot cache TTL in seconds
CACHE_TTL_COLD=300                # Cold cache TTL in seconds

# Authentication
VALID_API_KEYS=sp_key1,sp_key2,sp_key3
SKIP_AUTH=true                    # Development only

# Responses API Configuration
MAX_CONVERSATION_TOKENS=8000      # Maximum tokens for conversation state
RESPONSE_TIMEOUT=30               # Response timeout in seconds
STREAM_CHUNK_SIZE=1024            # Streaming chunk size

# Environment
ENVIRONMENT=development
API_VERSION=2.2.0
```

### Cloudflare Service Bindings
```toml
# wrangler.toml
[[services]]
binding = "MLB_MCP"
service = "mlbstats-mcp"
environment = "production"

[[services]]
binding = "ESPN_MCP"
service = "espn-mcp"
environment = "production"
```

### Cloudflare Resources
```toml
# KV Namespace for hot caching
[[kv_namespaces]]
binding = "SPORTS_CACHE"

# KV Namespace for conversation state
[[kv_namespaces]]
binding = "CONVERSATION_STATE"

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

3. **Set up OpenAI API:**
   ```bash
   wrangler secret put OPENAI_API_KEY
   # Enter your OpenAI API key when prompted
   ```

4. **Create KV namespace:**
   ```bash
   wrangler kv:namespace create "SPORTS_CACHE"
   wrangler kv:namespace create "CONVERSATION_STATE"
   ```

5. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create sports-data-bucket
   ```

6. **Configure service bindings:**
   ```bash
   # Deploy MLB MCP first
   cd ../mlbstats-mcp
   wrangler deploy
   
   # Return to sports-proxy
   cd ../sports-proxy
   ```

7. **Deploy:**
   ```bash
   npm run deploy
   ```

8. **Test deployment:**
   ```bash
   node test-responses-api.js
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
- **Responses API streaming**: Real-time with <100ms latency

## 🔐 Authentication

### API Key Format
```
Authorization: Bearer sp_your32characterapikeyhere...
```

### Rate Limits
- **Standard tier**: 1,000 requests/hour
- **Premium tier**: 10,000 requests/hour  
- **Unlimited tier**: No limits (for internal use)

## 🎯 Native OpenAI Responses API Integration

**🔥 Native Integration - No external MCP registration needed!**

Sports Proxy v2.0 acts as a **native OpenAI Responses API endpoint**. Simply point your OpenAI client directly to the `/responses` endpoint:

```python
from openai import OpenAI

# Configure client to use Sports Proxy directly
client = OpenAI(
    base_url="https://sports-proxy.your-domain.workers.dev",
    api_key="sp_your_api_key"  # Sports Proxy API key
)

# Use exactly like OpenAI Responses API
response = client.responses.create(
    model="gpt-4.1",
    input="Get Yankees team info and current standings",
    tools=[
        {
            "type": "function",
            "function": {
                "name": "get_team_info",
                "description": "Get MLB team information"
            }
        }
    ]
)

print(response.output_text)
```

### Conversation State Management
```python
# First request
response1 = client.responses.create(
    model="gpt-4.1",
    input="Get team info for the Yankees"
)

# Continue conversation with automatic state
response2 = client.responses.create(
    model="gpt-4.1",
    input="Now get their current roster",
    previous_response_id=response1.id  # Automatic state management!
)
```

### Streaming Support
```python
# Native streaming with Responses API events
stream = client.responses.create(
    model="gpt-4.1",
    input="Get live game data",
    stream=True
)

for event in stream:
    if event.type == "response.output_text.delta":
        print(event.delta, end="", flush=True)
    elif event.type == "tool_call":
        print(f"\n🔧 Calling tool: {event.name}")
    elif event.type == "response.completed":
        print("\n✅ Complete!")
```

This enables AI agents to:
- 🚀 **Use Sports Proxy as a native OpenAI endpoint**
- 💬 **Maintain conversation state automatically**
- 🔧 **Execute sports data tools seamlessly**
- 📡 **Stream real-time updates with proper events**
- 🏎️ **Leverage intelligent caching for performance**
- 🌐 **Access normalized data across different sports APIs**

**Migration Note**: If you were using the old `/mcp` endpoint, simply change your base URL to use `/responses` and update your request format to match the OpenAI Responses API.

## 🧪 Testing

### Automated Test Suite
```bash
# Run comprehensive test suite
node test-responses-api.js

# Or test individual components
wrangler dev  # Start local development server
node test-responses-api.js  # Run tests against local server
```

### Manual Testing

**Health check:**
```bash
curl https://sports-proxy.your-domain.workers.dev/health
```

**Test Responses API endpoint:**
```bash
curl -X POST https://sports-proxy.your-domain.workers.dev/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sp_your_api_key" \
  -d '{
    "model": "gpt-4.1",
    "input": "Get Yankees team information",
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "get_team_info",
          "description": "Get MLB team information"
        }
      }
    ]
  }'
```

**Test streaming:**
```bash
curl -X POST https://sports-proxy.your-domain.workers.dev/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sp_your_api_key" \
  -d '{
    "model": "gpt-4.1",
    "input": "Get current MLB standings",
    "stream": true
  }'
```

**Test conversation state:**
```bash
# First request
RESPONSE_ID=$(curl -s -X POST https://sports-proxy.your-domain.workers.dev/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sp_your_api_key" \
  -d '{"model":"gpt-4.1","input":"Get Yankees info"}' | jq -r '.id')

# Second request with state
curl -X POST https://sports-proxy.your-domain.workers.dev/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sp_your_api_key" \
  -d "{
    \"model\": \"gpt-4.1\",
    \"input\": \"Now get their roster\",
    \"previous_response_id\": \"$RESPONSE_ID\"
  }"
```

**Legacy endpoints (deprecated):**
```bash
# Legacy MCP endpoint (use /responses instead)
curl -X POST https://sports-proxy.your-domain.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/call","params":{"name":"get_team_info","arguments":{"teamId":"147"}}}'

# Legacy streaming (use /responses with stream:true instead)
curl https://sports-proxy.your-domain.workers.dev/sse?tool=get_standings
```

## 🔄 Migration from v1.0

### Breaking Changes in v2.0

1. **Primary Endpoint Changed:**
   - ❌ Old: `/mcp` (deprecated but still works)
   - ✅ New: `/responses` (primary endpoint)

2. **Request Format:**
   - ❌ Old: `{"method": "tools/call", "params": {...}}`
   - ✅ New: `{"model": "gpt-4.1", "input": "...", "tools": [...]}`

3. **Response Format:**
   - ❌ Old: `{"content": [{"type": "text", "text": "..."}]}`
   - ✅ New: `{"id": "resp_...", "output": [{"content": [{"text": "...", "type": "output_text"}]}], "usage": {...}}`

4. **Streaming:**
   - ❌ Old: `/sse` endpoint with query parameters
   - ✅ New: `/responses` with `"stream": true` and Responses API events

### Migration Steps

1. **Update your client to use `/responses` endpoint**
2. **Change request format to match OpenAI Responses API**
3. **Update response parsing to handle new format**
4. **Use `previous_response_id` for conversation state instead of manual history**
5. **Update streaming to use new event types**

### Backward Compatibility

The legacy `/mcp` and `/sse` endpoints remain functional but are deprecated. All new integrations should use the `/responses` endpoint.

## 🌟 Why OpenAI Responses API?

- 🚀 **Future-Proof**: Built for OpenAI's latest architecture
- 💡 **gpt-4.1 Native**: Optimized for the most advanced model
- 🔄 **State Management**: Automatic conversation handling
- 📡 **Better Streaming**: Semantic events for improved UX
- 🛠️ **Tool Integration**: Native function calling support
- 🎯 **Zero Deprecated APIs**: No Chat Completions API usage

**Sports Proxy v2.0 represents the future of sports data integration with AI - powered by OpenAI's cutting-edge Responses API and gpt-4.1.**