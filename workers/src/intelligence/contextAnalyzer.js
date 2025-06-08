/**
 * Handles sport detection, intent extraction, and entity recognition.
 */
class ContextAnalyzer {
  constructor(env) {
    this.env = env;
  }

  /**
   * Sport detection
   */
  detectSport(input) {
    const inputText = typeof input === 'string' ? input.toLowerCase() :
                     JSON.stringify(input).toLowerCase();

    const sportPatterns = {
      mlb: [
        'yankees', 'red sox', 'dodgers', 'giants', 'mets', 'cubs', 'braves',
        'baseball', 'mlb', 'pitcher', 'batter', 'home run', 'strikeout',
        'innings', 'world series', 'aaron judge', 'ohtani', 'trout'
      ],
      hockey: [
        'bruins', 'rangers', 'penguins', 'blackhawks', 'oilers', 'lightning',
        'hockey', 'nhl', 'goalie', 'puck', 'goal', 'assist', 'power play',
        'stanley cup', 'mcdavid', 'crosby', 'ovechkin', 'pastrnak'
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
   * Detect sport from tool context and arguments (used by MCP Coordinator)
   */
  detectSportFromContext(args) {
    const contextText = JSON.stringify(args).toLowerCase();
    const hockeyPatterns = ['bruins', 'rangers', 'penguins', 'oilers', 'mcdavid', 'crosby', 'hockey', 'nhl'];
    if (hockeyPatterns.some(pattern => contextText.includes(pattern))) {
      return 'hockey';
    }
    const mlbPatterns = ['yankees', 'red sox', 'dodgers', 'judge', 'ohtani', 'baseball', 'mlb'];
    if (mlbPatterns.some(pattern => contextText.includes(pattern))) {
      return 'mlb';
    }
    return 'mlb'; // Default
  }
  
  /**
   * Generate contextual response based on processed input
   */
  generateContextualResponse(processedInput) {
    const userMessages = Array.isArray(processedInput)
      ? processedInput.filter(msg => msg.role === 'user')
      : [{ content: processedInput }];

    const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

    if (lastUserMessage.toLowerCase().includes('hello') ||
        lastUserMessage.toLowerCase().includes('hi') ||
        lastUserMessage.toLowerCase().includes('are you there')) {
      return "Hello! I'm here and ready to help you with MLB sports data. I can provide team information, player stats, schedules, standings, and live game data. What would you like to know?";
    }

    if (lastUserMessage.toLowerCase().includes('help')) {
      return "I can help you with MLB sports data using these tools:\\n\\n• get_team_info - Team details and information\\n• get_player_stats - Player statistics\\n• get_team_roster - Team roster information\\n• get_schedule - Game schedules\\n• get_standings - League standings\\n• get_live_game - Live game data\\n\\nWhat specific information are you looking for?";
    }
    return "I can help you with MLB sports data. Available tools: get_team_info, get_player_stats, get_team_roster, get_schedule, get_standings, get_live_game. What would you like to know?";
  }
}

module.exports = { ContextAnalyzer };