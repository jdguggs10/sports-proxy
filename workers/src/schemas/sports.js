/**
 * Normalized schemas for Sports Proxy
 * Common data structures across all sports feeds
 */

/**
 * Normalized Team schema
 */
const TeamSchema = {
  id: String,
  name: String,
  abbreviation: String,
  city: String,
  league: String,
  division: String,
  venue: {
    id: String,
    name: String
  },
  colors: {
    primary: String,
    secondary: String
  }
};

/**
 * Normalized Player schema
 */
const PlayerSchema = {
  id: String,
  name: String,
  firstName: String,
  lastName: String,
  number: String,
  position: String,
  team: {
    id: String,
    name: String
  },
  birthDate: String,
  age: Number,
  height: String,
  weight: Number,
  stats: Object
};

/**
 * Normalized Game schema
 */
const GameSchema = {
  id: String,
  date: String,
  time: String,
  status: String, // scheduled, live, final, postponed
  homeTeam: {
    id: String,
    name: String,
    score: Number
  },
  awayTeam: {
    id: String,
    name: String,
    score: Number
  },
  venue: {
    id: String,
    name: String
  },
  inning: Number,
  inningHalf: String, // top, bottom
  liveData: Object
};

/**
 * Normalized Standings schema
 */
const StandingsSchema = {
  division: String,
  teams: [
    {
      id: String,
      name: String,
      wins: Number,
      losses: Number,
      winPercentage: Number,
      gamesBack: String,
      rank: Number
    }
  ]
};

/**
 * Transform MLB Stats API data to normalized format
 */
function transformMLBTeam(mlbTeam) {
  return {
    id: mlbTeam.id.toString(),
    name: mlbTeam.name,
    abbreviation: mlbTeam.abbreviation,
    city: mlbTeam.locationName,
    league: mlbTeam.league?.name,
    division: mlbTeam.division?.name,
    venue: {
      id: mlbTeam.venue?.id?.toString(),
      name: mlbTeam.venue?.name
    },
    colors: {
      primary: null, // MLB API doesn't provide colors
      secondary: null
    }
  };
}

function transformMLBPlayer(mlbPlayer) {
  return {
    id: mlbPlayer.id.toString(),
    name: mlbPlayer.fullName,
    firstName: mlbPlayer.firstName,
    lastName: mlbPlayer.lastName,
    number: mlbPlayer.primaryNumber,
    position: mlbPlayer.primaryPosition?.name,
    team: {
      id: mlbPlayer.currentTeam?.id?.toString(),
      name: mlbPlayer.currentTeam?.name
    },
    birthDate: mlbPlayer.birthDate,
    age: mlbPlayer.currentAge,
    height: mlbPlayer.height,
    weight: mlbPlayer.weight,
    stats: {}
  };
}

function transformMLBGame(mlbGame) {
  return {
    id: mlbGame.gamePk.toString(),
    date: mlbGame.gameDate,
    time: mlbGame.gameDate,
    status: mlbGame.status?.detailedState?.toLowerCase(),
    homeTeam: {
      id: mlbGame.teams?.home?.team?.id?.toString(),
      name: mlbGame.teams?.home?.team?.name,
      score: mlbGame.teams?.home?.score || 0
    },
    awayTeam: {
      id: mlbGame.teams?.away?.team?.id?.toString(),
      name: mlbGame.teams?.away?.team?.name,
      score: mlbGame.teams?.away?.score || 0
    },
    venue: {
      id: mlbGame.venue?.id?.toString(),
      name: mlbGame.venue?.name
    },
    inning: mlbGame.linescore?.currentInning,
    inningHalf: mlbGame.linescore?.inningHalf,
    liveData: mlbGame.liveData || {}
  };
}

/**
 * Transform ESPN data to normalized format (placeholder for future)
 */
function transformESPNTeam(espnTeam) {
  // TODO: Implement when ESPN MCP is added
  return {};
}

module.exports = {
  TeamSchema,
  PlayerSchema,
  GameSchema,
  StandingsSchema,
  transformMLBTeam,
  transformMLBPlayer,
  transformMLBGame,
  transformESPNTeam
};