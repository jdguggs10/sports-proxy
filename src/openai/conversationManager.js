/**
 * Manages conversation state and hybrid memory system.
 */
class OpenAIConversationManager {
  constructor(env) {
    this.env = env;
  }

  /**
   * Process input with hybrid memory system
   * Combines device-stored memories with current input
   */
  processInputWithMemories(input, memories, previous_response_id) {
    if (previous_response_id) {
      return input; // If continuing, OpenAI handles memory via previous_response_id
    }

    const memoryMessages = this._convertMemoriesToSystemMessages(memories);

    let inputArray = [];
    if (typeof input === 'string') {
      inputArray = [{ role: 'user', content: input }];
    } else if (Array.isArray(input)) {
      inputArray = input; // Assuming input is already in OpenAI message format
    } else {
      // Fallback for other input types, though typically string or array of messages
      inputArray = [{ role: 'user', content: JSON.stringify(input) }];
    }
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
    systemMessages.push({
      role: 'system',
      content: 'You are a helpful MLB sports data assistant. You have access to real-time MLB data through specialized tools. Always use the available tools when users ask about current stats, scores, or team information.'
    });

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
}

module.exports = { OpenAIConversationManager };