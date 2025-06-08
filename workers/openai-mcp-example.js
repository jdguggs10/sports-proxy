/**
 * OpenAI MCP Integration Example for Sports Proxy
 * Shows how to register and use the Sports Proxy as a remote MCP server
 */

// Using OpenAI Node.js SDK
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function createChatWithSportsProxy() {
  try {
    const completion = await openai.beta.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system", 
          content: "You are a sports analysis assistant with access to MLB data. Use the sports tools to get accurate, real-time information about teams, players, and games. When asked about baseball statistics or information, always use the available tools rather than relying on your training data."
        },
        {
          role: "user",
          content: "Tell me about the New York Yankees roster and their recent performance"
        }
      ],
      tools: [
        {
          "type": "mcp",
          "server_label": "sports-proxy",
          "server_url": "https://sports-proxy.gerrygugger.workers.dev/mcp",
          "allowed_tools": [
            "get_team_info",
            "get_team_roster", 
            "get_player_stats",
            "get_schedule",
            "get_standings"
          ],
          "require_approval": "never"
        }
      ],
      parallel_tool_calls: true,
      stream: true
    });

    for await (const chunk of completion) {
      if (chunk.choices[0]?.delta?.content) {
        process.stdout.write(chunk.choices[0].delta.content);
      }
      
      // Handle tool calls
      if (chunk.choices[0]?.delta?.tool_calls) {
        console.log('\n🔧 Tool calls:', chunk.choices[0].delta.tool_calls);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Alternative: Using curl for testing
const curlExample = `
# Test MCP registration with curl
curl -X POST https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": "Get information about the Yankees team"
      }
    ],
    "tools": [
      {
        "type": "mcp",
        "server_label": "sports-proxy",
        "server_url": "https://sports-proxy.gerrygugger.workers.dev/mcp",
        "allowed_tools": ["get_team_info", "get_team_roster"],
        "require_approval": "never"
      }
    ]
  }'
`;

console.log('Curl example for testing:');
console.log(curlExample);

// Run the example
if (require.main === module) {
  createChatWithSportsProxy();
}

module.exports = { createChatWithSportsProxy };