#!/usr/bin/env node

/**
 * Local test script for Sports Proxy
 * Tests the main components without deployment
 */

const { ResponsesAPIOrchestrator } = require('./src/mcp/orchestrator');
const { CacheManager } = require('./src/cache/manager');
const { transformMLBTeam } = require('./src/schemas/sports');

// Mock environment for testing
const mockEnv = {
  MLB_MCP_URL: 'https://mlbstats-mcp.gerrygugger.workers.dev',
  ESPN_MCP_URL: 'https://espn-mcp.example.workers.dev',
  CACHE_TTL_HOT: '10',
  CACHE_TTL_COLD: '300',
  ENVIRONMENT: 'development'
};

async function testOrchestrator() {
  console.log('🧪 Testing MCP Orchestrator...');
  
  const orchestrator = new ResponsesAPIOrchestrator(mockEnv);
  
  // Test tool listing
  const tools = await orchestrator.listTools();
  console.log(`✅ Found ${tools.tools.length} available tools`);
  
  // Test health check
  console.log('🔍 Testing health check...');
  const health = await orchestrator.healthCheck();
  console.log('📊 Health status:', health);
  
  return true;
}

async function testCacheManager() {
  console.log('\n🧪 Testing Cache Manager...');
  
  const cache = new CacheManager(mockEnv);
  
  // Test cache key generation
  const key = cache._generateKey('get_team_info', { teamId: '147' });
  console.log(`✅ Generated cache key: ${key}`);
  
  // Test TTL calculation
  const ttl = cache.getSmartTTL('get_live_game', {});
  console.log(`✅ Smart TTL for live game: ${ttl}s`);
  
  // Test cache stats
  const stats = await cache.getStats();
  console.log('📊 Cache stats:', stats);
  
  return true;
}

async function testSchemas() {
  console.log('\n🧪 Testing Data Schemas...');
  
  // Test MLB team transformation
  const mockMLBTeam = {
    id: 147,
    name: 'New York Yankees',
    abbreviation: 'NYY',
    locationName: 'Bronx',
    league: { name: 'American League' },
    division: { name: 'American League East' },
    venue: { id: 3313, name: 'Yankee Stadium' }
  };
  
  const normalizedTeam = transformMLBTeam(mockMLBTeam);
  console.log('✅ Team transformation:', normalizedTeam);
  
  return true;
}

async function main() {
  console.log('🚀 Sports Proxy Local Test Suite');
  console.log('=' .repeat(50));
  
  try {
    await testOrchestrator();
    await testCacheManager();
    await testSchemas();
    
    console.log('\n✅ All local tests passed!');
    console.log('\n🔧 Ready for deployment with:');
    console.log('   npm run deploy');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);