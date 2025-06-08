#!/usr/bin/env node

/**
 * Test OpenAI MCP Integration
 * Quick test to verify Sports Proxy works with OpenAI API
 */

const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  console.log('Set it with: export OPENAI_API_KEY="your-key-here"');
  process.exit(1);
}

// First test: Check if MCP is supported
const testPayload = {
  model: "gpt-4o",
  messages: [
    {
      role: "user",
      content: "Hello, can you help me test MCP integration?"
    }
  ],
  max_tokens: 100
};

const postData = JSON.stringify(testPayload);

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🧪 Testing OpenAI API Connection...');
console.log('📡 Testing basic API access first');
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.error) {
        console.error('❌ OpenAI API Error:', response.error);
        return;
      }

      console.log('✅ OpenAI API Connection successful!');
      console.log('📝 Response:', response.choices[0]?.message?.content);
      console.log('');
      console.log('🎯 Next: Test MCP integration with beta API access');
      
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(postData);
req.end();