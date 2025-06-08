/**
 * Processes responses from the OpenAI API and formats them for the client, including streaming.
 */
class OpenAIResponseProcessor {
  constructor(env) {
    this.env = env;
  }

  /**
   * Create streaming response for Responses API
   */
  async createStreamingResponse({ responseId, writer, encoder, processRequestFn }) {
    // Start processing in background
    await processRequestFn(writer, encoder, responseId);
    // The actual Response object with the readable stream is returned by the main orchestrator
  }

  /**
   * Process streaming request with Responses API events
   */
  async processStreamingRequest(writer, encoder, { responseId, toolCalls, executeToolFn, formatToolResultFn, generateContextualResponseFn }) {
    try {
      // Send response.created event
      await writer.write(encoder.encode(`event: response.created\\ndata: ${JSON.stringify({
        id: responseId,
        object: "response",
        created_at: Date.now() / 1000
      })}\\n\\n`));

      // Send response.in_progress event
      await writer.write(encoder.encode(`event: response.in_progress\\ndata: {}\\n\\n`));

      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          await writer.write(encoder.encode(`event: tool_call\\ndata: ${JSON.stringify({
            name: toolCall.name,
            arguments: toolCall.arguments
          })}\\n\\n`));

          const result = await executeToolFn(toolCall.name, toolCall.arguments);

          await writer.write(encoder.encode(`event: tool_result\\ndata: ${JSON.stringify({
            tool: toolCall.name,
            result: result
          })}\\n\\n`));

          const responseText = formatToolResultFn(toolCall.name, result);
          const words = responseText.split(' ');

          for (const word of words) {
            await writer.write(encoder.encode(`event: response.output_text.delta\\ndata: ${JSON.stringify({
              delta: word + ' '
            })}\\n\\n`));
            try {
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.error('Streaming delay error:', error);
            }
          }
        }
      } else {
        const responseText = generateContextualResponseFn(''); // Pass relevant input if needed
        const words = responseText.split(' ');
        for (const word of words) {
          await writer.write(encoder.encode(`event: response.output_text.delta\\ndata: ${JSON.stringify({
            delta: word + ' '
          })}\\n\\n`));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      await writer.write(encoder.encode(`event: response.completed\\ndata: ${JSON.stringify({
        id: responseId,
        status: "completed"
      })}\\n\\n`));

    } catch (error) {
      await writer.write(encoder.encode(`event: response.error\\ndata: ${JSON.stringify({
        error: error.message
      })}\\n\\n`));
    } finally {
      await writer.close();
    }
  }
}

module.exports = { OpenAIResponseProcessor };