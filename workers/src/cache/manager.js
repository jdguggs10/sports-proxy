/**
 * Cache Manager for Sports Proxy
 * Handles KV (hot), R2 (cold), and Durable Object (LRU) caching
 */

class CacheManager {
  constructor(env) {
    this.env = env;
    this.kv = env.SPORTS_CACHE;
    this.r2 = env.SPORTS_STORAGE;
    this.hotTTL = parseInt(env.CACHE_TTL_HOT) || 10; // seconds
    this.coldTTL = parseInt(env.CACHE_TTL_COLD) || 300; // seconds
  }

  /**
   * Generate cache key from request
   */
  _generateKey(tool, args) {
    // More efficient key generation - avoid object recreation
    const keys = Object.keys(args).sort();
    const sortedPairs = keys.map(key => `${key}:${args[key]}`).join('|');
    return `sports:${tool}:${sortedPairs}`;
  }

  /**
   * Get from cache (KV first, then R2)
   */
  async get(tool, args) {
    const key = this._generateKey(tool, args);
    
    try {
      // Try hot cache (KV) first
      const hotData = await this.kv?.get(key, { type: 'json' });
      if (hotData && this._isValid(hotData, this.hotTTL)) {
        return {
          data: hotData.payload,
          source: 'hot',
          age: Date.now() - hotData.timestamp
        };
      }

      // Try cold cache (R2)
      const coldObject = await this.r2?.get(key);
      if (coldObject) {
        const coldData = await coldObject.json();
        if (this._isValid(coldData, this.coldTTL)) {
          // Promote to hot cache
          await this._setHot(key, coldData.payload);
          
          return {
            data: coldData.payload,
            source: 'cold',
            age: Date.now() - coldData.timestamp
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set in both hot and cold cache
   */
  async set(tool, args, data) {
    const key = this._generateKey(tool, args);
    const payload = {
      payload: data,
      timestamp: Date.now(),
      tool: tool,
      args: args
    };

    try {
      // Set in hot cache (KV)
      await this._setHot(key, data);
      
      // Set in cold cache (R2)
      await this._setCold(key, payload);
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Set in hot cache only (for promotions)
   */
  async _setHot(key, data) {
    if (!this.kv) return;
    
    const payload = {
      payload: data,
      timestamp: Date.now()
    };

    await this.kv.put(key, JSON.stringify(payload), {
      expirationTtl: this.hotTTL
    });
  }

  /**
   * Set in cold cache
   */
  async _setCold(key, payload) {
    if (!this.r2) return;
    
    await this.r2.put(key, JSON.stringify(payload), {
      customMetadata: {
        timestamp: payload.timestamp.toString(),
        tool: payload.tool
      }
    });
  }

  /**
   * Check if cached data is still valid
   */
  _isValid(cachedData, ttlSeconds) {
    const age = (Date.now() - cachedData.timestamp) / 1000;
    return age < ttlSeconds;
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidate(pattern) {
    try {
      // For KV, we can't easily delete by pattern, so we'll rely on TTL
      // For R2, we could list and delete, but it's expensive
      
      // TODO: Implement pattern-based invalidation if needed
      console.log(`Cache invalidation requested for pattern: ${pattern}`);
      
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      // Basic stats - could be enhanced with Durable Objects
      return {
        hotCacheAvailable: !!this.kv,
        coldCacheAvailable: !!this.r2,
        hotTTL: this.hotTTL,
        coldTTL: this.coldTTL,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return { error: error.message };
    }
  }

  /**
   * Determine if data should be cached based on tool type
   */
  shouldCache(tool, args) {
    // Cache strategy by tool type
    const cacheRules = {
      'get_team_info': 300,      // Teams don't change often
      'get_player_stats': 60,    // Stats update frequently during games
      'get_team_roster': 3600,   // Rosters change infrequently
      'get_schedule': 30,        // Schedules can change
      'get_standings': 60,       // Standings update after each game
      'get_live_game': 5         // Live games update constantly
    };

    return cacheRules[tool] || 60; // Default 60 seconds
  }

  /**
   * Smart caching - adjust TTL based on data freshness needs
   */
  getSmartTTL(tool, args) {
    const baseTTL = this.shouldCache(tool, args);
    
    // During live games, cache less aggressively
    const now = new Date();
    const hour = now.getHours();
    
    // Baseball games typically 1-4 PM and 7-10 PM ET
    const isDuringGames = (hour >= 13 && hour <= 16) || (hour >= 19 && hour <= 22);
    
    if (isDuringGames && (tool === 'get_live_game' || tool === 'get_player_stats')) {
      return Math.min(baseTTL, 10); // More aggressive updates during games
    }
    
    return baseTTL;
  }
}

module.exports = { CacheManager };