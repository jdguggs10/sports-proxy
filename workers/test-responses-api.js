/**
 * Test script for Sports Proxy - OpenAI Responses API
 * Validates the new Responses API integration
 */

// Test configuration
const WORKER_URL = 'http://localhost:8787'; // Local development
const API_KEY = 'sp_test_key'; // Test API key

/**
 * Test the new /responses endpoint
 */
async function testResponsesAPI() {
  console.log('🧪 Testing OpenAI Responses API endpoint...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: 'Get team info for the Yankees',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_team_info',
              description: 'Get MLB team information'
            }
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Responses API test passed!');
    console.log('Response ID:', data.id);
    console.log('Model:', data.model);
    console.log('Output:', data.output[0].content[0].text);
    console.log('Usage:', data.usage);
    
    return data.id; // Return response ID for state test
    
  } catch (error) {
    console.error('❌ Responses API test failed:', error);
    return null;
  }
}

/**
 * Test streaming endpoint
 */
async function testStreaming() {
  console.log('\n🌊 Testing streaming endpoint...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: 'Get current standings',
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    console.log('✅ Streaming response started');
    
    // Read the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let eventCount = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`\n✅ Streaming completed with ${eventCount} events`);
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventCount++;
          console.log(`📡 ${line}`);
        } else if (line.startsWith('data:') && line.length > 5) {
          try {
            const data = JSON.parse(line.slice(5));
            console.log(`   ${JSON.stringify(data)}`);
          } catch (e) {
            console.log(`   ${line.slice(5)}`);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Streaming test failed:', error);
  }
}

/**
 * Test conversation state management
 */
async function testConversationState(previousResponseId) {
  if (!previousResponseId) {
    console.log('\n⚠️  Skipping conversation state test (no previous response ID)');
    return;
  }
  
  console.log('\n💬 Testing conversation state management...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: 'Now get player stats for that team',
        previous_response_id: previousResponseId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Conversation state test passed!');
    console.log('Previous Response ID used:', previousResponseId);
    console.log('New Response ID:', data.id);
    console.log('Response:', data.output[0].content[0].text);
    
  } catch (error) {
    console.error('❌ Conversation state test failed:', error);
  }
}

/**
 * Test legacy MCP endpoint compatibility
 */
async function testLegacyMCP() {
  console.log('\n🔄 Testing legacy MCP endpoint compatibility...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: {
          name: 'get_team_info',
          arguments: {
            teamId: '147',
            season: '2025'
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Legacy MCP test passed!');
    console.log('Content type:', data.content[0].type);
    console.log('Response length:', data.content[0].text.length);
    
  } catch (error) {
    console.error('❌ Legacy MCP test failed:', error);
  }
}

/**
 * Test health endpoint
 */
async function testHealth() {
  console.log('\n🏥 Testing health endpoint...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Health test passed!');
    console.log('Status:', data.status);
    console.log('Services:', Object.keys(data.services));
    
  } catch (error) {
    console.error('❌ Health test failed:', error);
  }
}

/**
 * Test root endpoint info
 */
async function testRootEndpoint() {
  console.log('\n📋 Testing root endpoint info...\n');
  
  try {
    const response = await fetch(`${WORKER_URL}/`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    console.log('✅ Root endpoint test passed!');
    console.log('Name:', data.name);
    console.log('Version:', data.version);
    console.log('API:', data.api);
    console.log('Migration note:', data.migration);
    
  } catch (error) {
    console.error('❌ Root endpoint test failed:', error);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Sports Proxy - OpenAI Responses API Tests\n');
  console.log('='.repeat(60));
  
  await testRootEndpoint();
  await testHealth();
  
  const responseId = await testResponsesAPI();
  await testConversationState(responseId);
  
  await testStreaming();
  await testLegacyMCP();
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');
  console.log('📈 Sports Proxy is now running OpenAI Responses API natively');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testResponsesAPI,
  testStreaming,
  testConversationState,
  testLegacyMCP,
  testHealth,
  testRootEndpoint,
  runAllTests
};