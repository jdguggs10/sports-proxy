/**
 * Simple OAuth/Auth Provider for Sports Proxy
 * Handles API key validation and basic authentication
 */

class AuthProvider {
  constructor(env) {
    this.env = env;
    this.validApiKeys = env.VALID_API_KEYS ? env.VALID_API_KEYS.split(',') : [];
  }

  /**
   * Validate API key from request headers
   */
  validateApiKey(request) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return { valid: false, error: 'Missing Authorization header' };
    }
    
    // Support both "Bearer token" and "API-Key token" formats
    let token;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (authHeader.startsWith('API-Key ')) {
      token = authHeader.substring(8);
    } else {
      return { valid: false, error: 'Invalid Authorization header format' };
    }
    
    if (!token) {
      return { valid: false, error: 'Missing token' };
    }
    
    // For development, allow any token if no valid keys are configured
    if (this.validApiKeys.length === 0 && this.env.ENVIRONMENT === 'development') {
      return { 
        valid: true, 
        user: { id: 'dev-user', tier: 'unlimited' },
        warning: 'Development mode - all tokens accepted'
      };
    }
    
    // Check against configured API keys
    if (this.validApiKeys.includes(token)) {
      return { 
        valid: true, 
        user: this.getUserFromToken(token)
      };
    }
    
    return { valid: false, error: 'Invalid API key' };
  }

  /**
   * Get user information from token
   */
  getUserFromToken(token) {
    // In a real implementation, this would lookup user data
    // For now, return basic info based on token
    return {
      id: `user-${token.substring(0, 8)}`,
      tier: 'standard',
      rateLimit: {
        requests: 1000,
        window: 3600 // per hour
      }
    };
  }

  /**
   * Validate request and extract user context
   */
  async validateRequest(request) {
    // Skip auth for health checks and root endpoint
    const url = new URL(request.url);
    const publicPaths = ['/', '/health'];
    
    if (publicPaths.includes(url.pathname)) {
      return { valid: true, user: null, public: true };
    }
    
    // For development, optionally skip auth
    if (this.env.ENVIRONMENT === 'development' && this.env.SKIP_AUTH === 'true') {
      return { 
        valid: true, 
        user: { id: 'dev-user', tier: 'unlimited' },
        warning: 'Development mode - auth skipped'
      };
    }
    
    return this.validateApiKey(request);
  }

  /**
   * Create authentication error response
   */
  createAuthErrorResponse(error) {
    return new Response(JSON.stringify({
      error: 'Authentication failed',
      message: error,
      hint: 'Include Authorization header with valid API key'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="Sports Proxy"'
      }
    });
  }

  /**
   * Generate a new API key (for admin functions)
   */
  generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 32;
    let result = 'sp_'; // Sports Proxy prefix
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Check rate limits for user
   */
  async checkRateLimit(user, request) {
    if (!user || user.tier === 'unlimited') {
      return { allowed: true };
    }
    
    // In a real implementation, this would use Durable Objects 
    // to track rate limits across requests
    
    // For now, allow all requests
    return { 
      allowed: true,
      remaining: user.rateLimit?.requests || 1000,
      resetTime: Date.now() + (user.rateLimit?.window || 3600) * 1000
    };
  }
}

module.exports = { AuthProvider };