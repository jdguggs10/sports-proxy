#!/usr/bin/env node

/**
 * Test the enhanced hybrid approach with approve/enrich step
 * This tests the complete flow: resolve_team -> enrich -> get_team_roster
 */

const { ResponsesAPIOrchestrator } = require('./src/mcp/orchestrator');

// Mock environment
const mockEnv = {
  MLB_MCP: {
    async fetch(request) {
      const body = await request.json();
      const { command, params } = body;
      
      // Mock resolver responses
      if (command === 'resolve_team') {
        if (params.name && params.name.toLowerCase().includes('yankees')) {
          return new Response(JSON.stringify({
            result: {
              id: 147,
              name: "New York Yankees",
              abbreviation: "NYY",
              query: params.name,
              resolved: true
            }
          }));
        }
      }
      
      // Mock team roster response
      if (command === 'getRoster') {
        if (params.pathParams?.teamId === '147') {
          return new Response(JSON.stringify({
            result: {
              roster: [
                {
                  person: {
                    id: 592450,
                    fullName: "Aaron Judge",
                    firstName: "Aaron",
                    lastName: "Judge"
                  },
                  position: { name: "Right Field" },
                  status: { code: "A" }
                }
              ]
            }
          }));
        }
      }
      
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }
  }
};

async function testEnhancedHybridFlow() {
  console.log('🧪 Testing Enhanced Hybrid Flow with Approve/Enrich...');
  
  const orchestrator = new ResponsesAPIOrchestrator(mockEnv);
  
  // Test input that should trigger: resolve_team -> get_team_roster (enriched)
  const testInput = "Tell me about the Yankees roster";
  
  // Get available tools (filtered for MLB)
  const allTools = await orchestrator.listTools();
  const mlbTools = orchestrator._buildFilteredTools('mlb', 0.8);
  
  console.log(`📋 MLB Tools Available: ${mlbTools.join(', ')}`);
  
  // Extract tool calls from natural language
  const toolCalls = orchestrator._extractToolCalls(testInput, allTools.tools.filter(t => mlbTools.includes(t.name)));
  
  console.log('🔍 Extracted Tool Calls:');
  toolCalls.forEach((call, i) => {
    console.log(`  ${i + 1}. ${call.name}(${JSON.stringify(call.arguments)})`);
  });
  
  // Mock cache for testing
  const mockCache = {
    async get() { return null; },
    async set() { return true; },
    getSmartTTL() { return 60; }
  };
  
  // Process tool calls with the enhanced approve/enrich flow
  console.log('\n⚡ Processing with Approve/Enrich...');
  const results = await orchestrator._processToolCalls(toolCalls, mockCache);
  
  console.log('\n📊 Results:');
  results.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.tool}:`);
    if (result.success) {
      console.log(`     ✅ Success${result.enriched ? ' (enriched)' : ''}`);
      console.log(`     📄 Data:`, JSON.stringify(result.result, null, 6));
    } else {
      console.log(`     ❌ Error: ${result.error}`);
    }
  });
  
  // Verify the enrichment worked
  const rosterCall = results.find(r => r.tool === 'get_team_roster');
  if (rosterCall && rosterCall.success && rosterCall.enriched) {
    console.log('\n🎉 SUCCESS: The approve/enrich step worked!');
    console.log('   - resolve_team extracted teamId: 147');
    console.log('   - get_team_roster was enriched with teamId');
    console.log('   - Complete roster data was returned');
    return true;
  } else {
    console.log('\n❌ FAILED: Approve/enrich step did not work as expected');
    return false;
  }
}

async function main() {
  console.log('🚀 Enhanced Hybrid Flow Test');
  console.log('=' .repeat(50));
  
  try {
    const success = await testEnhancedHybridFlow();
    
    if (success) {
      console.log('\n✅ Enhanced hybrid approach is working perfectly!');
      console.log('🔥 Ready for production deployment!');
    } else {
      console.log('\n⚠️  Need to debug the enrichment flow');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);