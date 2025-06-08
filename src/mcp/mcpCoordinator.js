const { transformMLBTeam, transformMLBPlayer, transformMLBGame } = require('../schemas/sports');
const { ContextAnalyzer } = require('../intelligence/contextAnalyzer'); // For sport detection from context

/**
 * Manages communication with MCP (Microservice Proxy) workers.
 */
class MCPCoordinator {
  constructor(env) {
    this.env = env;
    this.mcpServices = {
      mlb: env.MLB_MCP,
      hockey: env.HOCKEY_MCP,
      espn: env.ESPN_MCP
    };
    this.contextAnalyzer = new ContextAnalyzer(env); // For _detectSportFromContext
  }

  /**
   * Route tool call to appropriate MCP server using Service Bindings
   */
  async _routeAndExecuteTool(toolName, args) {
    const sport = this.contextAnalyzer.detectSportFromContext(args); // Use contextAnalyzer instance
    let mcpService;
    let serviceName;

    if (sport === 'hockey' && this.mcpServices.hockey) {
      mcpService = this.mcpServices.hockey;
      serviceName = 'Hockey MCP';
    } else if (this.mcpServices.mlb) { // Default to MLB if hockey not specified or available
      mcpService = this.mcpServices.mlb;
      serviceName = 'MLB MCP';
    } else {
      throw new Error(`No suitable MCP service available for sport ${sport} or default MLB.`);
    }
    
    if (!mcpService) {
        throw new Error(`${serviceName || 'Requested MCP'} service not available or not configured.`);
    }

    const endpointMap = {
      'resolve_team': 'team',
      'resolve_player': 'player',
      'get_team_info': 'team',
      'get_player_stats': 'player',
      'get_team_roster': 'roster',
      'get_schedule': 'schedule',
      'get_standings': 'standings',
      'get_live_game': 'game'
    };
    const endpoint = endpointMap[toolName];
    if (!endpoint) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const mcpRequestPayload = { endpoint: endpoint, query: args };
    const request = new Request('https://mcp-internal/', { // URL is arbitrary for service bindings
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mcpRequestPayload)
    });

    const response = await mcpService.fetch(request);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP service error (${serviceName} - ${toolName}): ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    if (result.error) {
      throw new Error(`MCP service error (${serviceName} - ${toolName}): ${result.error}`);
    }
    return result; // This is the direct data from the MCP
  }

  /**
   * Call a specific tool, routing to the appropriate MCP server and normalizing the result.
   * This method now returns the normalized data directly or throws an error.
   */
  async callTool(toolName, args) {
    const rawResult = await this._routeAndExecuteTool(toolName, args);
    return this._normalizeResult(toolName, rawResult); // Normalize before returning
  }

  /**
   * Normalize results to common schema
   */
  _normalizeResult(toolName, rawResult) {
    // Normalization logic (copied from original orchestrator, ensure transforms are available)
    switch (toolName) {
      case 'get_team_info':
        if (rawResult.teams) {
          return { teams: rawResult.teams.map(transformMLBTeam) };
        }
        return rawResult;
      case 'get_player_stats':
        return rawResult; // No normalization defined yet
      case 'get_team_roster':
        if (rawResult.roster) {
          return {
            roster: rawResult.roster.map(player => ({
              ...transformMLBPlayer(player.person),
              position: player.position?.name,
              status: player.status?.code
            }))
          };
        }
        return rawResult;
      case 'get_schedule':
        if (rawResult.dates) {
          return {
            games: rawResult.dates.flatMap(date =>
              date.games?.map(transformMLBGame) || []
            )
          };
        }
        return rawResult;
      case 'get_standings':
        return rawResult; // No normalization defined yet
      case 'get_live_game':
        // Ensure rawResult is the game object itself if transformMLBGame expects that
        return transformMLBGame(rawResult.game || rawResult); // Adjust based on actual MCP output for live_game
      case 'resolve_team':
      case 'resolve_player':
        return rawResult; // Typically, resolver output is already in a usable format
      default:
        return rawResult;
    }
  }
  
  /**
   * Health check for all MCP services
   */
  async healthCheck() {
    const results = {};
    for (const [name, service] of Object.entries(this.mcpServices)) {
      if (!service) {
        results[name] = { status: 'unavailable', error: 'Service binding not configured' };
        continue;
      }
      try {
        const request = new Request('https://mcp-internal/health', { method: 'GET' });
        const startTime = Date.now();
        const response = await service.fetch(request);
        const responseTime = Date.now() - startTime;
        results[name] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: responseTime,
          httpStatus: response.status
        };
        if (!response.ok) {
            results[name].errorDetails = await response.text();
        }
      } catch (error) {
        results[name] = { status: 'error', error: error.message };
      }
    }
    return results;
  }
}

module.exports = { MCPCoordinator };