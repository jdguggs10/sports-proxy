/**
 * Handles tool filtering, extraction, processing, and enrichment.
 */
class ToolHandler {
  constructor(env, mcpCoordinator, cacheManager) {
    this.env = env;
    this.mcpCoordinator = mcpCoordinator; // Dependency for executing tools
    this.cacheManager = cacheManager; // Dependency for caching tool results
  }

  /**
   * Build filtered tool list based on detected sport
   */
  buildFilteredTools(sport, confidence) {
    const sportTools = {
      mlb: [
        "resolve_team", "resolve_player", "get_team_info", "get_player_stats",
        "get_team_roster", "get_schedule", "get_standings", "get_live_game"
      ],
      hockey: [
        "resolve_team", "resolve_player", "get_team_info", "get_player_stats",
        "get_team_roster", "get_schedule", "get_standings", "get_live_game"
      ],
      nfl: [],
      nba: []
    };
    if (confidence < 0.7) {
      return sportTools.mlb; // Default for low confidence
    }
    return sportTools[sport] || sportTools.mlb;
  }

  /**
   * Extract tool calls from input
   */
  extractToolCalls(input, tools) {
    const toolCalls = [];
    if (!tools || tools.length === 0) {
      return toolCalls;
    }
    const inputText = typeof input === 'string' ? input.toLowerCase() :
                     JSON.stringify(input).toLowerCase();

    const intentPatterns = {
      team_info: ['about', 'info', 'information', 'details', 'tell me about'],
      roster: ['roster', 'players', 'team members', 'lineup'],
      stats: ['stats', 'statistics', 'performance', 'numbers'],
      schedule: ['schedule', 'games', 'when', 'playing'],
      standings: ['standings', 'rankings', 'position', 'place']
    };
    const entityPatterns = {
      teams: ['yankees', 'red sox', 'dodgers', 'giants', 'mets', 'cubs', 'braves', 'astros',
              'bruins', 'rangers', 'penguins', 'oilers', 'lightning', 'blackhawks'],
      players: ['judge', 'ohtani', 'trout', 'betts', 'acuna', 'freeman',
                'mcdavid', 'crosby', 'ovechkin', 'pastrnak', 'draisaitl', 'mackinnon']
    };

    const hasTeamEntity = entityPatterns.teams.some(team => inputText.includes(team));
    const hasPlayerEntity = entityPatterns.players.some(player => inputText.includes(player));

    if (hasTeamEntity || hasPlayerEntity) {
      if (hasTeamEntity && tools.some(t => t.name === 'resolve_team' || (typeof t.function === 'object' && t.function.name === 'resolve_team'))) {
        const teamName = entityPatterns.teams.find(team => inputText.includes(team));
        toolCalls.push({ name: 'resolve_team', arguments: { name: teamName } });
      }
      if (hasPlayerEntity && tools.some(t => t.name === 'resolve_player' || (typeof t.function === 'object' && t.function.name === 'resolve_player'))) {
        const playerName = entityPatterns.players.find(player => inputText.includes(player));
        toolCalls.push({ name: 'resolve_player', arguments: { name: playerName } });
      }

      if (intentPatterns.roster.some(pattern => inputText.includes(pattern)) &&
          tools.some(t => t.name === 'get_team_roster' || (typeof t.function === 'object' && t.function.name === 'get_team_roster'))) {
        toolCalls.push({ name: 'get_team_roster', arguments: {} });
      } else if (intentPatterns.team_info.some(pattern => inputText.includes(pattern)) &&
                 tools.some(t => t.name === 'get_team_info' || (typeof t.function === 'object' && t.function.name === 'get_team_info'))) {
        toolCalls.push({ name: 'get_team_info', arguments: {} });
      } else if (intentPatterns.stats.some(pattern => inputText.includes(pattern)) &&
                 tools.some(t => t.name === 'get_player_stats' || (typeof t.function === 'object' && t.function.name === 'get_player_stats')) && hasPlayerEntity) {
        toolCalls.push({ name: 'get_player_stats', arguments: {} });
      }
    }
     // Handle cases where tools are explicitly provided in the request
    if (tools && tools.length > 0 && toolCalls.length === 0) {
        for (const tool of tools) {
            if (tool.type === 'function' && tool.function && tool.function.name) {
                // Attempt to parse arguments if provided, otherwise empty object
                let args = {};
                if (tool.function.parameters) { // Assuming parameters might be where args are described
                    // This part is tricky as OpenAI's `tools` input doesn't directly contain `arguments`
                    // For now, we'll assume if a tool is listed, it might be called with empty args
                    // or the LLM will fill them.
                    // If the `input` string contains hints, more complex parsing is needed here.
                }
                 // Only add if the input text seems to generally relate to the tool's purpose
                if (inputText.includes(tool.function.name.replace("get_","").replace("_"," "))) {
                     toolCalls.push({ name: tool.function.name, arguments: args });
                } else if (tool.function.name.startsWith("resolve_") && (hasTeamEntity || hasPlayerEntity)) {
                     toolCalls.push({ name: tool.function.name, arguments: args });
                }
            }
        }
    }


    return toolCalls;
  }

  /**
   * Process multiple tool calls with approve/enrich step
   */
  async processToolCalls(toolCalls) {
    const results = [];
    const resolverResults = new Map();

    for (const toolCall of toolCalls) {
      if (toolCall.name === 'resolve_team' || toolCall.name === 'resolve_player') {
        try {
          const result = await this._executeSingleTool(toolCall.name, toolCall.arguments);
          results.push({ tool: toolCall.name, result: result, success: true });
          if (result && result.id) {
            const entityType = toolCall.name === 'resolve_team' ? 'team' : 'player';
            resolverResults.set(entityType, result);
          }
        } catch (error) {
          results.push({ tool: toolCall.name, error: error.message, success: false });
        }
      }
    }

    for (const toolCall of toolCalls) {
      if (toolCall.name !== 'resolve_team' && toolCall.name !== 'resolve_player') {
        try {
          const enrichedArgs = this._enrichToolArguments(toolCall, resolverResults);
          const result = await this._executeSingleTool(toolCall.name, enrichedArgs);
          results.push({ tool: toolCall.name, result: result, success: true, enriched: enrichedArgs !== toolCall.arguments });
        } catch (error) {
          results.push({ tool: toolCall.name, error: error.message, success: false });
        }
      }
    }
    return results;
  }

  /**
   * Enrich tool arguments with resolved entity IDs
   */
  _enrichToolArguments(toolCall, resolverResults) {
    const enrichedArgs = { ...toolCall.arguments };
    const toolEntityMap = {
      'get_team_info': ['team'],
      'get_team_roster': ['team'],
      'get_player_stats': ['player'],
      'get_schedule': ['team'],
    };
    const requiredEntities = toolEntityMap[toolCall.name] || [];

    for (const entityType of requiredEntities) {
      const resolvedEntity = resolverResults.get(entityType);
      if (resolvedEntity && resolvedEntity.id) {
        if (entityType === 'team' && !enrichedArgs.teamId) {
          enrichedArgs.teamId = resolvedEntity.id.toString();
        } else if (entityType === 'player' && !enrichedArgs.playerId) {
          enrichedArgs.playerId = resolvedEntity.id.toString();
        }
      }
    }
    return enrichedArgs;
  }

  /**
   * Execute a single tool
   */
  async _executeSingleTool(toolName, args) {
    const cached = await this.cacheManager.get(toolName, args);
    if (cached) {
      return cached.data;
    }
    // Use mcpCoordinator to call the tool
    const result = await this.mcpCoordinator.callTool(toolName, args);

    // callTool in mcpCoordinator now returns the direct data or throws an error.
    // It no longer returns { content: [{ type: "text", text: JSON.stringify(...) }] }
    // So, we can directly use 'result' here.

    const ttl = this.cacheManager.getSmartTTL(toolName, args);
    await this.cacheManager.set(toolName, args, result, ttl); // Pass ttl to cacheManager.set
    return result;
  }


  /**
   * Format tool results for output
   */
  formatToolResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return "No tools were executed.";
    }
    let output = "";
    for (const result of toolResults) {
      if (result.success) {
        output += `${result.tool}: ${JSON.stringify(result.result, null, 2)}\\n\\n`;
      } else {
        output += `${result.tool} failed: ${result.error}\\n\\n`;
      }
    }
    return output.trim();
  }

  /**
   * Format single tool result
   */
  formatSingleToolResult(toolName, result) {
    return `${toolName} result: ${JSON.stringify(result, null, 2)}`;
  }

   /**
   * List all available tools for legacy MCP compatibility or direct listing.
   * This should align with what OpenAI expects in the `tools` array.
   */
  listTools() {
    // These definitions should match the `tools` array structure for OpenAI
    return [
      {
        type: "function",
        function: {
          name: "resolve_team",
          description: "Resolve team name to team ID and information",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Team name (e.g., 'Yankees', 'Red Sox')" }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "resolve_player",
          description: "Resolve player name to player ID and information",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Player name (e.g., 'Aaron Judge', 'Ohtani')" }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_team_info",
          description: "Get MLB team information",
          parameters: {
            type: "object",
            properties: {
              teamId: { type: "string", description: "MLB team ID" },
              season: { type: "string", description: "Season year" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_player_stats",
          description: "Get MLB player statistics",
          parameters: {
            type: "object",
            properties: {
              playerId: { type: "string", description: "MLB player ID" },
              season: { type: "string", description: "Season year" },
              statType: { type: "string", description: "Type of stats (hitting, pitching)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_team_roster",
          description: "Get MLB team roster",
          parameters: {
            type: "object",
            properties: {
              teamId: { type: "string", description: "MLB team ID" },
              season: { type: "string", description: "Season year" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_schedule",
          description: "Get MLB game schedule",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date (YYYY-MM-DD)" },
              teamId: { type: "string", description: "Optional team ID filter" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_standings",
          description: "Get MLB standings",
          parameters: {
            type: "object",
            properties: {
              season: { type: "string", description: "Season year" },
              divisionId: { type: "string", description: "Optional division ID" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_live_game",
          description: "Get live MLB game data",
          parameters: {
            type: "object",
            properties: {
              gameId: { type: "string", description: "MLB game ID" }
            }
          }
        }
      }
    ];
  }
}

module.exports = { ToolHandler };