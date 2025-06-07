/**
 * Sports Proxy - Cloudflare Worker
 * OpenAI Responses API native MCP orchestrator with advanced caching and streaming
 */

const { ResponsesAPIOrchestrator } = require('./mcp/orchestrator');
const { CacheManager } = require('./cache/manager');

/**
 * CORS headers for all responses
 */
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * Handle CORS preflight requests
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders()
  });
}

/**
 * Create error response
 */
function createErrorResponse(message, status = 400) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    }
  );
}

/**
 * Handle OpenAI Responses API requests natively
 */
async function handleResponsesAPI(request, env) {
  try {
    const body = await request.json();
    const orchestrator = new ResponsesAPIOrchestrator(env);
    
    // Handle the Responses API request format
    const { model = "gpt-4.1", input, tools, previous_response_id, instructions, stream = false, memories } = body;
    
    // Process the request through our orchestrator
    const result = await orchestrator.processResponsesAPIRequest({
      model,
      input,
      tools,
      previous_response_id,
      instructions,
      stream,
      memories
    });
    
    if (stream) {
      return new Response(result.stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders()
        }
      });
    }
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...getCorsHeaders() }
    });
    
  } catch (error) {
    return createErrorResponse(`Responses API error: ${error.message}`, 500);
  }
}

/**
 * Handle legacy MCP protocol requests (deprecated - use Responses API)
 */
async function handleLegacyMCP(request, env) {
  try {
    const body = await request.json();
    const orchestrator = new ResponsesAPIOrchestrator(env);
    
    switch (body.method) {
      case 'tools/list':
        return new Response(JSON.stringify(await orchestrator.listTools()), {
          headers: { "Content-Type": "application/json", ...getCorsHeaders() }
        });
        
      case 'tools/call':
        const cache = new CacheManager(env);
        const { name, arguments: args } = body.params;
        
        // Check cache first
        const cached = await cache.get(name, args);
        if (cached) {
          return new Response(JSON.stringify({
            content: [{
              type: "text",
              text: JSON.stringify(cached.data, null, 2)
            }],
            _meta: {
              source: cached.source,
              age: cached.age
            }
          }), {
            headers: { "Content-Type": "application/json", ...getCorsHeaders() }
          });
        }
        
        // Call tool and cache result
        const result = await orchestrator.callTool(name, args);
        
        if (!result.isError) {
          const ttl = cache.getSmartTTL(name, args);
          await cache.set(name, args, JSON.parse(result.content[0].text));
        }
        
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", ...getCorsHeaders() }
        });
        
      default:
        return createErrorResponse(`Unknown MCP method: ${body.method}`);
    }
  } catch (error) {
    return createErrorResponse(`Legacy MCP error: ${error.message}`, 500);
  }
}

/**
 * Handle SSE (Server-Sent Events) streaming
 */
async function handleSSE(request, env) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Parse query parameters for the request
  const tool = searchParams.get('tool');
  const argsParam = searchParams.get('args');
  
  if (!tool) {
    return createErrorResponse('Missing tool parameter');
  }
  
  let args = {};
  if (argsParam) {
    try {
      args = JSON.parse(argsParam);
    } catch (error) {
      return createErrorResponse('Invalid args parameter');
    }
  }
  
  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  
  // Start processing in background
  processSSERequest(tool, args, writer, env).catch(error => {
    console.error('SSE processing error:', error);
    writer.close();
  });
  
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...getCorsHeaders()
    }
  });
}

/**
 * Process SSE request in background
 */
async function processSSERequest(tool, args, writer, env) {
  const encoder = new TextEncoder();
  
  try {
    // Send initial connection event
    await writer.write(encoder.encode(`event: connected\ndata: {"status":"connected","tool":"${tool}"}\n\n`));
    
    const orchestrator = new ResponsesAPIOrchestrator(env);
    const cache = new CacheManager(env);
    
    // Check cache first
    const cached = await cache.get(tool, args);
    if (cached) {
      await writer.write(encoder.encode(`event: data\ndata: ${JSON.stringify({
        data: cached.data,
        meta: { source: cached.source, age: cached.age }
      })}\n\n`));
      
      await writer.write(encoder.encode(`event: complete\ndata: {"status":"complete","source":"cache"}\n\n`));
      await writer.close();
      return;
    }
    
    // Send processing event
    await writer.write(encoder.encode(`event: processing\ndata: {"status":"processing","tool":"${tool}"}\n\n`));
    
    // Call tool
    const result = await orchestrator.callTool(tool, args);
    
    if (result.isError) {
      await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({
        error: result.content[0].text
      })}\n\n`));
    } else {
      const data = JSON.parse(result.content[0].text);
      
      // Cache result
      const ttl = cache.getSmartTTL(tool, args);
      await cache.set(tool, args, data);
      
      // Send data
      await writer.write(encoder.encode(`event: data\ndata: ${JSON.stringify({
        data: data,
        meta: { source: 'live', ttl: ttl }
      })}\n\n`));
    }
    
    // Send completion event
    await writer.write(encoder.encode(`event: complete\ndata: {"status":"complete","source":"live"}\n\n`));
    
  } catch (error) {
    await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({
      error: error.message
    })}\n\n`));
  } finally {
    await writer.close();
  }
}

/**
 * Handle Streamable HTTP requests
 */
async function handleStreamableHTTP(request, env) {
  try {
    const body = await request.json();
    const { tool, args } = body;
    
    if (!tool) {
      return createErrorResponse('Missing tool parameter');
    }
    
    const orchestrator = new ResponsesAPIOrchestrator(env);
    const cache = new CacheManager(env);
    
    // Check cache first
    const cached = await cache.get(tool, args || {});
    if (cached) {
      return new Response(JSON.stringify({
        data: cached.data,
        meta: { 
          source: cached.source, 
          age: cached.age,
          cached: true
        }
      }), {
        headers: { "Content-Type": "application/json", ...getCorsHeaders() }
      });
    }
    
    // Call tool
    const result = await orchestrator.callTool(tool, args || {});
    
    if (result.isError) {
      return createErrorResponse(result.content[0].text, 500);
    }
    
    const data = JSON.parse(result.content[0].text);
    
    // Cache result
    const ttl = cache.getSmartTTL(tool, args || {});
    await cache.set(tool, args || {}, data);
    
    return new Response(JSON.stringify({
      data: data,
      meta: { 
        source: 'live', 
        ttl: ttl,
        cached: false
      }
    }), {
      headers: { "Content-Type": "application/json", ...getCorsHeaders() }
    });
    
  } catch (error) {
    return createErrorResponse(`Streamable HTTP error: ${error.message}`, 500);
  }
}

/**
 * Handle health check
 */
async function handleHealth(env) {
  const orchestrator = new ResponsesAPIOrchestrator(env);
  const cache = new CacheManager(env);
  
  const [mcpHealth, cacheStats] = await Promise.all([
    orchestrator.healthCheck(),
    cache.getStats()
  ]);
  
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mcp: mcpHealth,
      cache: cacheStats
    }
  }), {
    headers: { "Content-Type": "application/json", ...getCorsHeaders() }
  });
}

/**
 * Main request handler
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return handleOptions();
  }
  
  // Route requests
  switch (path) {
    case '/responses':
      // OpenAI Responses API native endpoint (PRIMARY)
      return handleResponsesAPI(request, env);
      
    case '/mcp':
      // Legacy MCP protocol endpoint (DEPRECATED - use /responses)
      return handleLegacyMCP(request, env);
      
    case '/sse':
      // Server-Sent Events endpoint
      return handleSSE(request, env);
      
    case '/stream':
      // Streamable HTTP endpoint
      return handleStreamableHTTP(request, env);
      
    case '/health':
      // Health check endpoint
      return handleHealth(env);
      
    case '/':
      // Root endpoint - basic info
      return new Response(JSON.stringify({
        name: 'Sports Proxy',
        version: '2.0.0',
        api: 'OpenAI Responses API Native',
        endpoints: {
          responses: '/responses (PRIMARY - OpenAI Responses API)',
          mcp: '/mcp (DEPRECATED - use /responses)',
          sse: '/sse (Server-Sent Events)',
          stream: '/stream (Streamable HTTP)',
          health: '/health (Health Check)'
        },
        description: 'OpenAI Responses API native orchestrator for sports data with advanced caching and streaming',
        migration: 'All new integrations should use /responses endpoint with OpenAI Responses API format'
      }), {
        headers: { "Content-Type": "application/json", ...getCorsHeaders() }
      });
      
    default:
      return new Response('Not Found', { 
        status: 404,
        headers: getCorsHeaders()
      });
  }
}

/**
 * RateLimiter Durable Object for rate limiting and coordination
 */
export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Simple rate limiting implementation
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || 'default';
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const window = parseInt(url.searchParams.get('window') || '60'); // seconds

    const currentTime = Math.floor(Date.now() / 1000);
    const windowStart = currentTime - window;

    // Get current count
    const currentCount = await this.state.storage.get(`count:${key}`) || 0;
    const lastReset = await this.state.storage.get(`reset:${key}`) || 0;

    // Reset if window expired
    if (lastReset < windowStart) {
      await this.state.storage.put(`count:${key}`, 1);
      await this.state.storage.put(`reset:${key}`, currentTime);
      return new Response(JSON.stringify({ allowed: true, remaining: limit - 1 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check limit
    if (currentCount >= limit) {
      return new Response(JSON.stringify({ allowed: false, remaining: 0 }), {
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Increment counter
    await this.state.storage.put(`count:${key}`, currentCount + 1);
    
    return new Response(JSON.stringify({ 
      allowed: true, 
      remaining: limit - currentCount - 1 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Export the worker
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};