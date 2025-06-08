/**
 * OpenAI Responses API Orchestrator - Sports Proxy
 * Native Responses API integration with MCP servers coordination
 */

const { CacheManager } = require('../cache/manager');
const { OpenAIRequestProcessor } = require('../openai/requestProcessor');
const { OpenAIResponseProcessor } = require('../openai/responseProcessor');
const { OpenAIConversationManager } = require('../openai/conversationManager');
const { ContextAnalyzer } = require('../intelligence/contextAnalyzer');
const { ToolHandler } = require('../intelligence/toolHandler');
const { MCPCoordinator } = require('./mcpCoordinator');

class ResponsesAPIOrchestrator {
  constructor(env) {
    this.env = env;
    this.cacheManager = new CacheManager(env);
    this.mcpCoordinator = new MCPCoordinator(env);
    this.openAIRequestProcessor = new OpenAIRequestProcessor(env);
    this.openAIResponseProcessor = new OpenAIResponseProcessor(env);
    this.openAIConversationManager = new OpenAIConversationManager(env);
    this.contextAnalyzer = new ContextAnalyzer(env);
    // ToolHandler depends on mcpCoordinator and cacheManager for executing and caching tools
    this.toolHandler = new ToolHandler(env, this.mcpCoordinator, this.cacheManager);
  }

  /**
   * Process OpenAI Responses API request natively
   */
  async processResponsesAPIRequest({ model, input, tools, previous_response_id, instructions, stream, memories }) {
    const responseId = this.openAIRequestProcessor._generateResponseId();
    const timestamp = Date.now() / 1000;

    const processedInput = this.openAIConversationManager.processInputWithMemories(input, memories, previous_response_id);
    
    // Use contextAnalyzer for sport detection if needed for tool filtering, though ToolHandler also has it
    // const { sport, confidence } = this.contextAnalyzer.detectSport(processedInput);
    // const filteredTools = this.toolHandler.buildFilteredTools(sport, confidence, tools); // Pass original tools if needed

    // Tool extraction now considers the 'tools' parameter from the OpenAI request.
    const toolCalls = this.toolHandler.extractToolCalls(processedInput, tools);

    if (stream) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Pass necessary methods to processStreamingRequest
      this.openAIResponseProcessor.createStreamingResponse({
        responseId,
        writer,
        encoder,
        processRequestFn: async (writer, encoder, responseId) => {
          await this.openAIResponseProcessor.processStreamingRequest(writer, encoder, {
            responseId,
            toolCalls,
            executeToolFn: (toolName, args) => this.toolHandler._executeSingleTool(toolName, args),
            formatToolResultFn: (toolName, result) => this.toolHandler.formatSingleToolResult(toolName, result),
            generateContextualResponseFn: (inp) => this.contextAnalyzer.generateContextualResponse(inp)
          });
        }
      });
      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
      });
    }

    if (toolCalls.length === 0) {
      return {
        id: responseId,
        created_at: timestamp,
        model: model,
        object: "response",
        output: [{
          id: this.openAIRequestProcessor._generateMessageId(),
          content: [{
            text: this.contextAnalyzer.generateContextualResponse(processedInput),
            type: "output_text"
          }],
          role: "assistant",
          type: "message"
        }],
        usage: {
          input_tokens: this.openAIRequestProcessor._estimateTokens(JSON.stringify(processedInput)),
          output_tokens: this.openAIRequestProcessor._estimateTokens(this.contextAnalyzer.generateContextualResponse(processedInput)),
          total_tokens: this.openAIRequestProcessor._estimateTokens(JSON.stringify(processedInput)) + this.openAIRequestProcessor._estimateTokens(this.contextAnalyzer.generateContextualResponse(processedInput))
        }
      };
    }

    const toolResults = await this.toolHandler.processToolCalls(toolCalls);

    return {
      id: responseId,
      created_at: timestamp,
      model: model,
      object: "response",
      output: [{
        id: this.openAIRequestProcessor._generateMessageId(),
        content: [{
          text: this.toolHandler.formatToolResults(toolResults),
          type: "output_text"
        }],
        role: "assistant",
        type: "message"
      }],
      usage: {
        input_tokens: this.openAIRequestProcessor._estimateTokens(JSON.stringify(processedInput)),
        output_tokens: this.openAIRequestProcessor._estimateTokens(this.toolHandler.formatToolResults(toolResults)),
        total_tokens: this.openAIRequestProcessor._estimateTokens(JSON.stringify(processedInput)) + this.openAIRequestProcessor._estimateTokens(this.toolHandler.formatToolResults(toolResults))
      }
    };
  }

  /**
   * List all available tools (delegated to ToolHandler)
   * This is for direct calls to list tools, not for OpenAI's `tools` parameter.
   * OpenAI's `tools` parameter in the request should be a list of tool definitions.
   */
  async listTools() {
    // Returns the format expected by older /tools endpoint if any, or internal use.
    // For OpenAI, the client sends the tool definitions.
    return { tools: this.toolHandler.listTools() }; // toolHandler.listTools() returns an array of tool definitions
  }

  /**
   * Call a specific tool (delegated to MCPCoordinator via ToolHandler)
   * This is for direct tool calls (e.g. legacy /mcp endpoint).
   */
  async callTool(name, arguments_) {
    try {
      // _executeSingleTool handles caching and calling mcpCoordinator
      const result = await this.toolHandler._executeSingleTool(name, arguments_);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: error.message, tool: name, arguments: arguments_ }, null, 2)
        }],
        isError: true
      };
    }
  }
  
  /**
   * Health check for all MCP services (delegated to MCPCoordinator)
   */
  async healthCheck() {
    return this.mcpCoordinator.healthCheck();
  }
}

module.exports = { ResponsesAPIOrchestrator };