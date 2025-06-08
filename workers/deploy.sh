#!/bin/bash

# Sports Proxy Deployment Script

echo "🚀 Deploying Sports Proxy..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if logged in to Cloudflare
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "   wrangler login"
    exit 1
fi

echo "📦 Creating required Cloudflare resources..."

# Create KV namespace for caching
echo "🗃️ Creating KV namespace..."
wrangler kv:namespace create "SPORTS_CACHE" 2>/dev/null || echo "   KV namespace may already exist"

# Create R2 bucket for cold storage
echo "💾 Creating R2 bucket..."
wrangler r2 bucket create sports-data-bucket 2>/dev/null || echo "   R2 bucket may already exist"

# Deploy the worker
echo "🚀 Deploying worker..."
wrangler deploy

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Update wrangler.toml with your KV namespace ID and R2 bucket name"
    echo "   2. Set environment variables (MLB_MCP_URL, OPENAI_API_KEY, etc.)"
    echo "   3. Test your deployment:"
    echo ""
    echo "📝 Test commands:"
    echo '   # Health check'
    echo '   curl https://sports-proxy.your-domain.workers.dev/health'
    echo ""
    echo '   # Get team info'
    echo '   curl -X POST https://sports-proxy.your-domain.workers.dev/stream \'
    echo '     -H "Content-Type: application/json" \'
    echo '     -d '\''{"tool":"get_team_info","args":{"teamId":"147","season":"2025"}}'\'''
    echo ""
    echo "🔗 MCP URL for OpenAI integration:"
    echo "   https://sports-proxy.your-domain.workers.dev/mcp"
else
    echo "❌ Deployment failed!"
    exit 1
fi