/**
 * OpenAI Responses API Orchestrator - Sports Proxy
 * Native Responses API integration with MCP servers coordination
 */

const { transformMLBTeam, transformMLBPlayer, transformMLBGame } = require('../schemas/sports');
const { CacheManager } = require('../cache/manager');

class ResponsesAPIOrchestrator {
  constructor(env) {
    this.env = env;
    // Service bindings provide direct worker-to-worker communication
    this.mcpServices = {
      mlb: env.MLB_MCP,
      espn: env.ESPN_MCP // Will be undefined until ESPN MCP is deployed
    };
  }

  /**
   * Process OpenAI Responses API request natively
   */
  async processResponsesAPIRequest({ model, input, tools, previous_response_id, instructions, stream, memories }) {
    const cache = new CacheManager(this.env);
    
    // Generate unique response ID
    const responseId = this._generateResponseId();
    const timestamp = Date.now() / 1000;
    
    // Handle hybrid memory system
    const processedInput = this._processInputWithMemories(input, memories, previous_response_id);
    
    if (stream) {
      return this._createStreamingResponse({
        responseId, input: processedInput, tools, instructions, cache
      });
    }
    
    // Parse input to extract tool calls
    const toolCalls = this._extractToolCalls(processedInput, tools);
    
    if (toolCalls.length === 0) {
      // No tools needed - return standard response
      return {
        id: responseId,
        created_at: timestamp,
        model: model,
        object: "response",
        output: [{
          id: this._generateMessageId(),
          content: [{
            text: this._generateContextualResponse(processedInput),
            type: "output_text"
          }],
          role: "assistant",
          type: "message"
        }],
        usage: {
          input_tokens: this._estimateTokens(processedInput),
          output_tokens: 50,
          total_tokens: this._estimateTokens(processedInput) + 50
        }
      };
    }
    
    // Process tool calls
    const toolResults = await this._processToolCalls(toolCalls, cache);
    
    return {
      id: responseId,
      created_at: timestamp,
      model: model,
      object: "response",
      output: [{
        id: this._generateMessageId(),
        content: [{
          text: this._formatToolResults(toolResults),
          type: "output_text"
        }],
        role: "assistant",
        type: "message"
      }],
      usage: {
        input_tokens: this._estimateTokens(processedInput),
        output_tokens: this._estimateTokens(this._formatToolResults(toolResults)),
        total_tokens: this._estimateTokens(processedInput) + this._estimateTokens(this._formatToolResults(toolResults))
      }
    };
  }
  
  /**
   * Create streaming response for Responses API
   */
  async _createStreamingResponse({ responseId, input, tools, instructions, cache }) {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // Start processing in background
    this._processStreamingRequest(writer, encoder, {
      responseId, input, tools, instructions, cache
    });
    
    return { stream: readable };
  }
  
  /**
   * Process streaming request with Responses API events
   */
  async _processStreamingRequest(writer, encoder, { responseId, input, tools, instructions, cache }) {
    try {
      // Send response.created event
      await writer.write(encoder.encode(`event: response.created\ndata: ${JSON.stringify({
        id: responseId,
        object: "response",
        created_at: Date.now() / 1000
      })}\n\n`));
      
      // Send response.in_progress event
      await writer.write(encoder.encode(`event: response.in_progress\ndata: {}\n\n`));
      
      // Extract and process tool calls
      const toolCalls = this._extractToolCalls(input, tools);
      
      if (toolCalls.length > 0) {
        // Process each tool call
        for (const toolCall of toolCalls) {
          // Send tool call event
          await writer.write(encoder.encode(`event: tool_call\ndata: ${JSON.stringify({
            name: toolCall.name,
            arguments: toolCall.arguments
          })}\n\n`));
          
          // Execute tool
          const result = await this._executeSingleTool(toolCall.name, toolCall.arguments, cache);
          
          // Send tool result
          await writer.write(encoder.encode(`event: tool_result\ndata: ${JSON.stringify({
            tool: toolCall.name,
            result: result
          })}\n\n`));
          
          // Stream response text delta
          const responseText = this._formatSingleToolResult(toolCall.name, result);
          const words = responseText.split(' ');
          
          for (const word of words) {
            await writer.write(encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify({
              delta: word + ' '
            })}\n\n`));
            
            // Small delay for streaming effect
            try {
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error('Streaming delay error:', error);
            }
          }
        }
      } else {
        // No tools - stream informational response
        const responseText = "I can help you with MLB sports data. Available tools: get_team_info, get_player_stats, get_team_roster, get_schedule, get_standings, get_live_game. What would you like to know?";
        const words = responseText.split(' ');
        
        for (const word of words) {
          await writer.write(encoder.encode(`event: response.output_text.delta\ndata: ${JSON.stringify({
            delta: word + ' '
          })}\n\n`));
          
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Send completion event
      await writer.write(encoder.encode(`event: response.completed\ndata: ${JSON.stringify({
        id: responseId,
        status: "completed"
      })}\n\n`));
      
    } catch (error) {
      // Send error event
      await writer.write(encoder.encode(`event: response.error\ndata: ${JSON.stringify({
        error: error.message
      })}\n\n`));
    } finally {
      await writer.close();
    }
  }
  
  /**
   * Sport detection and tool filtering
   */
  _detectSport(input) {
    const inputText = typeof input === 'string' ? input.toLowerCase() : 
                     JSON.stringify(input).toLowerCase();
    
    // Simple sport detection patterns
    const sportPatterns = {
      mlb: [
        'yankees', 'red sox', 'dodgers', 'giants', 'mets', 'cubs', 'braves',
        'baseball', 'mlb', 'pitcher', 'batter', 'home run', 'strikeout',
        'innings', 'world series', 'aaron judge', 'ohtani', 'trout'
      ],
      nfl: [
        'patriots', 'cowboys', 'packers', 'steelers', 'chiefs', 'ravens',
        'football', 'nfl', 'quarterback', 'touchdown', 'super bowl'
      ],
      nba: [
        'lakers', 'warriors', 'celtics', 'heat', 'bulls', 'knicks',
        'basketball', 'nba', 'lebron', 'curry', 'playoffs'
      ]
    };
    
    let maxMatches = 0;
    let detectedSport = 'mlb'; // Default to MLB
    
    for (const [sport, patterns] of Object.entries(sportPatterns)) {
      const matches = patterns.filter(pattern => inputText.includes(pattern)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedSport = sport;
      }
    }
    
    return { sport: detectedSport, confidence: maxMatches > 0 ? 0.8 : 0.3 };
  }

  /**
   * Build filtered tool list based on detected sport
   */
  _buildFilteredTools(sport, confidence) {
    const sportTools = {
      mlb: [
        "resolve_team", "resolve_player", "get_team_info", "get_player_stats", 
        "get_team_roster", "get_schedule", "get_standings", "get_live_game"
      ],
      nfl: [
        // Future NFL tools would go here
      ],
      nba: [
        // Future NBA tools would go here
      ]
    };
    
    // If confidence is low, expose multiple sports tools
    if (confidence < 0.7) {
      return sportTools.mlb; // For now, just MLB since that's what we have
    }
    
    return sportTools[sport] || sportTools.mlb;
  }

  /**
   * List all available tools for legacy MCP compatibility
   */
  async listTools() {
    const tools = [
      // Meta-tools for entity resolution
      {
        name: "resolve_team",
        description: "Resolve team name to team ID and information",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Team name (e.g., 'Yankees', 'Red Sox')" }
          },
          required: ["name"]
        }
      },
      {
        name: "resolve_player",
        description: "Resolve player name to player ID and information",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Player name (e.g., 'Aaron Judge', 'Ohtani')" }
          },
          required: ["name"]
        }
      },
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
   * Route tool call to appropriate MCP server using Service Bindings
   */
  async _routeToolCall(toolName, args) {
    // All current tools go to MLB MCP service
    const mcpService = this.mcpServices.mlb;
    
    if (!mcpService) {
      throw new Error('MLB MCP service not available');
    }
    
    // Map tool names to MLB MCP commands
    const commandMap = {
      'resolve_team': 'resolve_team',
      'resolve_player': 'resolve_player',
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
    
    // Create request for service binding
    const request = new Request('https://localhost/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mcpRequest)
    });
    
    // Call via service binding - zero latency, no 1042 errors!
    const response = await mcpService.fetch(request);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MCP service error: ${response.status} - ${errorText}`);
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
      case 'resolve_team':
      case 'resolve_player':
        // Pass resolver arguments directly
        request.params = args;
        break;
        
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
   * Generate unique response ID
   */
  _generateResponseId() {
    return `resp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Generate unique message ID
   */
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Extract tool calls from input (enhanced implementation)
   */
  _extractToolCalls(input, tools) {
    const toolCalls = [];
    
    if (!tools || tools.length === 0) {
      return toolCalls;
    }
    
    const inputText = typeof input === 'string' ? input.toLowerCase() : 
                     JSON.stringify(input).toLowerCase();
    
    // Detect intent patterns that should trigger tools
    const intentPatterns = {
      team_info: ['about', 'info', 'information', 'details', 'tell me about'],
      roster: ['roster', 'players', 'team members', 'lineup'],
      stats: ['stats', 'statistics', 'performance', 'numbers'],
      schedule: ['schedule', 'games', 'when', 'playing'],
      standings: ['standings', 'rankings', 'position', 'place']
    };
    
    // Entity patterns
    const entityPatterns = {
      teams: ['yankees', 'red sox', 'dodgers', 'giants', 'mets', 'cubs', 'braves', 'astros'],
      players: ['judge', 'ohtani', 'trout', 'betts', 'acuna', 'freeman']
    };
    
    // Check for team-related queries
    const hasTeamEntity = entityPatterns.teams.some(team => inputText.includes(team));
    const hasPlayerEntity = entityPatterns.players.some(player => inputText.includes(player));
    
    if (hasTeamEntity || hasPlayerEntity) {
      // First, we need to resolve the entity
      if (hasTeamEntity && tools.some(t => t.name === 'resolve_team')) {
        const teamName = entityPatterns.teams.find(team => inputText.includes(team));
        toolCalls.push({
          name: 'resolve_team',
          arguments: { name: teamName }
        });
      }
      
      if (hasPlayerEntity && tools.some(t => t.name === 'resolve_player')) {
        const playerName = entityPatterns.players.find(player => inputText.includes(player));
        toolCalls.push({
          name: 'resolve_player', 
          arguments: { name: playerName }
        });
      }
      
      // Then determine what action to take
      if (intentPatterns.roster.some(pattern => inputText.includes(pattern)) && 
          tools.some(t => t.name === 'get_team_roster')) {
        toolCalls.push({
          name: 'get_team_roster',
          arguments: {} // Will be filled after team resolution
        });
      } else if (intentPatterns.team_info.some(pattern => inputText.includes(pattern)) && 
                 tools.some(t => t.name === 'get_team_info')) {
        toolCalls.push({
          name: 'get_team_info',
          arguments: {} // Will be filled after team resolution
        });
      } else if (intentPatterns.stats.some(pattern => inputText.includes(pattern)) && 
                 tools.some(t => t.name === 'get_player_stats') && hasPlayerEntity) {
        toolCalls.push({
          name: 'get_player_stats',
          arguments: {} // Will be filled after player resolution
        });
      }
    }
    
    return toolCalls;
  }

  /**
   * Process multiple tool calls with approve/enrich step
   */
  async _processToolCalls(toolCalls, cache) {
    const results = [];
    const resolverResults = new Map();
    
    // First pass: execute resolvers and collect their results
    for (const toolCall of toolCalls) {
      if (toolCall.name === 'resolve_team' || toolCall.name === 'resolve_player') {
        try {
          const result = await this._executeSingleTool(toolCall.name, toolCall.arguments, cache);
          results.push({
            tool: toolCall.name,
            result: result,
            success: true
          });
          
          // Store resolver result for enrichment
          if (result && result.id) {
            const entityType = toolCall.name === 'resolve_team' ? 'team' : 'player';
            resolverResults.set(entityType, result);
          }
        } catch (error) {
          results.push({
            tool: toolCall.name,
            error: error.message,
            success: false
          });
        }
      }
    }
    
    // Second pass: execute enriched tool calls
    for (const toolCall of toolCalls) {
      if (toolCall.name !== 'resolve_team' && toolCall.name !== 'resolve_player') {
        try {
          // Enrich arguments with resolved entity IDs
          const enrichedArgs = this._enrichToolArguments(toolCall, resolverResults);
          
          const result = await this._executeSingleTool(toolCall.name, enrichedArgs, cache);
          results.push({
            tool: toolCall.name,
            result: result,
            success: true,
            enriched: enrichedArgs !== toolCall.arguments
          });
        } catch (error) {
          results.push({
            tool: toolCall.name,
            error: error.message,
            success: false
          });
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
    
    // Map tool names to their required entity types
    const toolEntityMap = {
      'get_team_info': ['team'],
      'get_team_roster': ['team'],
      'get_player_stats': ['player'],
      'get_schedule': ['team'], // optional
      'get_standings': [], // no entities needed
      'get_live_game': [] // uses gameId, not team/player
    };
    
    const requiredEntities = toolEntityMap[toolCall.name] || [];
    
    for (const entityType of requiredEntities) {
      const resolvedEntity = resolverResults.get(entityType);
      if (resolvedEntity && resolvedEntity.id) {
        // Map entity types to argument names
        if (entityType === 'team') {
          if (!enrichedArgs.teamId) {
            enrichedArgs.teamId = resolvedEntity.id.toString();
          }
        } else if (entityType === 'player') {
          if (!enrichedArgs.playerId) {
            enrichedArgs.playerId = resolvedEntity.id.toString();
          }
        }
      }
    }
    
    return enrichedArgs;
  }

  /**
   * Execute a single tool
   */
  async _executeSingleTool(toolName, args, cache) {
    // Check cache first
    const cached = await cache.get(toolName, args);
    if (cached) {
      return cached.data;
    }
    
    // Execute tool
    const result = await this.callTool(toolName, args);
    
    if (!result.isError) {
      const data = JSON.parse(result.content[0].text);
      const ttl = cache.getSmartTTL(toolName, args);
      await cache.set(toolName, args, data);
      return data;
    }
    
    throw new Error(result.content[0].text);
  }

  /**
   * Format tool results for output
   */
  _formatToolResults(toolResults) {
    if (toolResults.length === 0) {
      return "No tools were executed.";
    }
    
    let output = "";
    for (const result of toolResults) {
      if (result.success) {
        output += `${result.tool}: ${JSON.stringify(result.result, null, 2)}\n\n`;
      } else {
        output += `${result.tool} failed: ${result.error}\n\n`;
      }
    }
    
    return output.trim();
  }

  /**
   * Format single tool result
   */
  _formatSingleToolResult(toolName, result) {
    return `${toolName} result: ${JSON.stringify(result, null, 2)}`;
  }

  /**
   * Estimate token count (simple approximation)
   */
  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4); // Rough approximation
  }

  /**
   * Process input with hybrid memory system
   * Combines device-stored memories with current input
   */
  _processInputWithMemories(input, memories, previous_response_id) {
    // If this is a continuation (has previous_response_id), don't add memories again
    if (previous_response_id) {
      return input;
    }
    
    // New chat - inject memories as system messages
    const memoryMessages = this._convertMemoriesToSystemMessages(memories);
    
    // Ensure input is in array format
    let inputArray = [];
    if (typeof input === 'string') {
      inputArray = [{ role: 'user', content: input }];
    } else if (Array.isArray(input)) {
      inputArray = input;
    } else {
      inputArray = [{ role: 'user', content: JSON.stringify(input) }];
    }
    
    // Combine memories + input for new chats
    return [...memoryMessages, ...inputArray];
  }

  /**
   * Convert device memories to system messages
   */
  _convertMemoriesToSystemMessages(memories) {
    if (!memories || !Array.isArray(memories)) {
      return [];
    }
    
    const systemMessages = [];
    
    // Add sports-specific system context
    systemMessages.push({
      role: 'system',
      content: 'You are a helpful MLB sports data assistant. You have access to real-time MLB data through specialized tools. Always use the available tools when users ask about current stats, scores, or team information.'
    });
    
    // Add user memories
    for (const memory of memories) {
      if (memory.key && memory.value) {
        systemMessages.push({
          role: 'system',
          content: `USER_MEMORY: ${memory.key} = ${memory.value}`
        });
      }
    }
    
    return systemMessages;
  }

  /**
   * Generate contextual response based on processed input
   */
  _generateContextualResponse(processedInput) {
    // Extract the actual user message from processed input
    const userMessages = Array.isArray(processedInput) 
      ? processedInput.filter(msg => msg.role === 'user')
      : [{ content: processedInput }];
    
    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';
    
    // Generate contextual responses based on user input
    if (lastUserMessage.toLowerCase().includes('hello') || 
        lastUserMessage.toLowerCase().includes('hi') ||
        lastUserMessage.toLowerCase().includes('are you there')) {
      return "Hello! I'm here and ready to help you with MLB sports data. I can provide team information, player stats, schedules, standings, and live game data. What would you like to know?";
    }
    
    if (lastUserMessage.toLowerCase().includes('help')) {
      return "I can help you with MLB sports data using these tools:\n\n• get_team_info - Team details and information\n• get_player_stats - Player statistics\n• get_team_roster - Team roster information\n• get_schedule - Game schedules\n• get_standings - League standings\n• get_live_game - Live game data\n\nWhat specific information are you looking for?";
    }
    
    // Default response
    return "I can help you with MLB sports data. Available tools: get_team_info, get_player_stats, get_team_roster, get_schedule, get_standings, get_live_game. What would you like to know?";
  }

  /**
   * Health check for all MCP services
   */
  async healthCheck() {
    const results = {};
    
    for (const [name, service] of Object.entries(this.mcpServices)) {
      if (!service) {
        results[name] = {
          status: 'unavailable',
          error: 'Service binding not configured'
        };
        continue;
      }
      
      try {
        const request = new Request('https://localhost/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            command: 'getTeamInfo',
            params: { queryParams: { season: '2025', sportId: '1' } }
          })
        });
        
        const startTime = Date.now();
        const response = await service.fetch(request);
        const responseTime = Date.now() - startTime;
        
        results[name] = {
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: responseTime,
          httpStatus: response.status
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

module.exports = { ResponsesAPIOrchestrator };