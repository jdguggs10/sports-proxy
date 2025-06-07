/**
 * MCP Orchestrator - Sports Proxy
 * Coordinates requests across multiple MCP servers
 */

const { transformMLBTeam, transformMLBPlayer, transformMLBGame } = require('../schemas/sports');

class MCPOrchestrator {
  constructor(env) {
    this.env = env;
    this.mcpServers = {
      mlb: env.MLB_MCP_URL,
      espn: env.ESPN_MCP_URL
    };
  }

  /**
   * List all available tools across MCP servers
   */
  async listTools() {
    const tools = [
      // MLB tools (from our existing MCP server)
      {
        name: "get_team_info",
        description: "Get MLB team information",
        inputSchema: {
          type: "object",
          properties: {
            teamId: { type: "string", description: "MLB team ID" },
            season: { type: "string", description: "Season year" }
          }
        }
      },
      {
        name: "get_player_stats",
        description: "Get MLB player statistics",
        inputSchema: {
          type: "object",
          properties: {
            playerId: { type: "string", description: "MLB player ID" },
            season: { type: "string", description: "Season year" },
            statType: { type: "string", description: "Type of stats (hitting, pitching)" }
          }
        }
      },
      {
        name: "get_team_roster",
        description: "Get MLB team roster",
        inputSchema: {
          type: "object",
          properties: {
            teamId: { type: "string", description: "MLB team ID" },
            season: { type: "string", description: "Season year" }
          }
        }
      },
      {
        name: "get_schedule",
        description: "Get MLB game schedule",
        inputSchema: {
          type: "object",
          properties: {
            date: { type: "string", description: "Date (YYYY-MM-DD)" },
            teamId: { type: "string", description: "Optional team ID filter" }
          }
        }
      },
      {
        name: "get_standings",
        description: "Get MLB standings",
        inputSchema: {
          type: "object",
          properties: {
            season: { type: "string", description: "Season year" },
            divisionId: { type: "string", description: "Optional division ID" }
          }
        }
      },
      {
        name: "get_live_game",
        description: "Get live MLB game data",
        inputSchema: {
          type: "object",
          properties: {
            gameId: { type: "string", description: "MLB game ID" }
          }
        }
      }
    ];

    return {
      tools: tools
    };
  }

  /**
   * Call a specific tool on the appropriate MCP server
   */
  async callTool(name, arguments_) {
    try {
      // Route to appropriate MCP server
      const result = await this._routeToolCall(name, arguments_);
      
      // Transform to normalized format
      const normalizedResult = await this._normalizeResult(name, result);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(normalizedResult, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: error.message,
              tool: name,
              arguments: arguments_
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Route tool call to appropriate MCP server
   */
  async _routeToolCall(toolName, args) {
    // All current tools go to MLB MCP server
    const mcpUrl = this.mcpServers.mlb;
    
    // Map tool names to MLB MCP commands
    const commandMap = {
      'get_team_info': 'getTeamInfo',
      'get_player_stats': 'getPlayerStats', 
      'get_team_roster': 'getRoster',
      'get_schedule': 'getSchedule',
      'get_standings': 'getStandings',
      'get_live_game': 'getLiveGame'
    };

    const command = commandMap[toolName];
    if (!command) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Build MCP request
    const mcpRequest = this._buildMCPRequest(command, args);
    
    // Call MCP server
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mcpRequest)
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }

    return result.result;
  }

  /**
   * Build MCP request from tool arguments
   */
  _buildMCPRequest(command, args) {
    const request = {
      command: command,
      params: {}
    };

    // Map arguments to MCP parameters
    switch (command) {
      case 'getTeamInfo':
        if (args.teamId) {
          request.params.pathParams = { teamId: args.teamId };
        }
        if (args.season) {
          request.params.queryParams = { season: args.season };
        }
        break;

      case 'getPlayerStats':
        request.params.pathParams = { playerId: args.playerId };
        request.params.queryParams = {
          stats: 'season',
          group: args.statType || 'hitting',
          season: args.season || '2025'
        };
        break;

      case 'getRoster':
        request.params.pathParams = { teamId: args.teamId };
        if (args.season) {
          request.params.queryParams = { season: args.season };
        }
        break;

      case 'getSchedule':
        request.params.queryParams = {};
        if (args.date) {
          request.params.queryParams.date = args.date;
        }
        if (args.teamId) {
          request.params.queryParams.teamId = args.teamId;
        }
        request.params.queryParams.sportId = '1';
        break;

      case 'getStandings':
        request.params.queryParams = {
          season: args.season || '2025'
        };
        if (args.divisionId) {
          request.params.queryParams.divisionId = args.divisionId;
        }
        break;

      case 'getLiveGame':
        request.params.pathParams = { gamePk: args.gameId };
        break;
    }

    return request;
  }

  /**
   * Normalize results to common schema
   */
  async _normalizeResult(toolName, rawResult) {
    switch (toolName) {
      case 'get_team_info':
        if (rawResult.teams) {
          return {
            teams: rawResult.teams.map(transformMLBTeam)
          };
        }
        return rawResult;

      case 'get_player_stats':
        // Keep stats as-is for now, could normalize later
        return rawResult;

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
        // Keep standings structure for now
        return rawResult;

      case 'get_live_game':
        return transformMLBGame(rawResult);

      default:
        return rawResult;
    }
  }

  /**
   * Health check for all MCP servers
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, url] of Object.entries(this.mcpServers)) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'getTeamInfo',
            params: { queryParams: { season: '2025', sportId: '1' } }
          })
        });
        
        results[name] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: Date.now()
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    return results;
  }
}

module.exports = { MCPOrchestrator };