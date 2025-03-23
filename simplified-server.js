import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchRandomWord, checkWordExists } from './snowflake-connector.js';

// Load environment variables
dotenv.config();

// Calculate __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Set up CORS with more permissive configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Middleware to log API requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url} - Request received`);
  
  // Track response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.url} - Response sent (${res.statusCode}) in ${duration}ms`);
  });
  
  next();
});

// Mock data for fallback when Snowflake is unavailable
const MOCK_WORDS = [
  {
    wordId: 'word-1',
    word: 'peruse',
    definition: "To read or examine with care.",
    partOfSpeech: "verb",
    alternateDefinition: "To skim or browse through something.",
    synonyms: "read, study, examine, inspect, scrutinize",
    letterCount: 6,
    inSentence: "The student would ______ the textbook before each exam.",
    etymology: "From Latin 'pervisus', meaning 'to survey in detail'.",
    firstLetter: "p",
    nearbyWords: "perusal, perusable, perusingly"
  },
  {
    wordId: 'word-2',
    word: 'cogitate',
    definition: "To think deeply about something; meditate or reflect",
    partOfSpeech: "verb",
    alternateDefinition: "To consider or reflect on something deeply",
    synonyms: "think,ponder,reflect,contemplate",
    letterCount: 8,
    inSentence: "She likes to ______ on philosophical questions while walking.",
    etymology: "From Latin 'cogitatus', meaning 'to think deeply'.",
    firstLetter: "c",
    nearbyWords: "cogitation, cogitative, cogitable"
  },
  {
    wordId: 'word-3',
    word: 'ponder',
    definition: "To think about something carefully, especially before making a decision",
    partOfSpeech: "verb",
    alternateDefinition: "To consider something deeply and thoroughly",
    synonyms: "contemplate,muse,reflect,ruminate,meditate",
    letterCount: 6,
    inSentence: "She would often ______ the meaning of life while gazing at the stars.",
    etymology: "From Latin 'ponderare', meaning 'to weigh, consider'.",
    firstLetter: "p",
    nearbyWords: "ponderable, pondering, ponderous"
  }
];

// Store active games in memory
const activeGames = {};

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    message: 'Test server is accessible',
    timestamp: new Date().toISOString()
  });
});

// Endpoint to get a random word
app.get('/api/word', async (req, res) => {
  console.log('[/api/word] Received request for a random word');
  
  try {
    // Try to fetch from Snowflake first
    const wordData = await fetchRandomWord();
    
    // Generate a unique game ID
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Store game data
    activeGames[gameId] = {
      wordId: wordData.wordId,
      word: wordData.word.toLowerCase(),
      guesses: [],
      startTime: Date.now(),
      hintsRevealed: 0
    };
    
    // Format response for client
    const response = {
      gameId,
      word: {
        wordId: wordData.wordId,
        word: wordData.word,
        definition: wordData.definition,
        partOfSpeech: wordData.partOfSpeech,
        alternateDefinition: wordData.alternateDefinition,
        synonyms: wordData.synonyms,
        letterCount: wordData.letterCount,
        inSentence: wordData.inSentence,
        etymology: wordData.etymology,
        firstLetter: wordData.firstLetter,
        nearbyWords: wordData.nearbyWords,
        hints: wordData.hints
      }
    };
    
    console.log('[/api/word] Returning word data:', {
      gameId,
      wordId: wordData.wordId,
      word: wordData.word,
      hasAlternateDefinition: !!wordData.alternateDefinition,
      hasSynonyms: !!wordData.synonyms
    });
    
    res.json(response);
  } catch (error) {
    console.error('[/api/word] Error fetching from Snowflake, using mock data:', error);
    
    // Use mock data as fallback
    const randomIndex = Math.floor(Math.random() * MOCK_WORDS.length);
    const mockWord = MOCK_WORDS[randomIndex];
    
    // Add the hints structure to mock data
    mockWord.hints = {
      u: null, // No hint for U
      n: { type: 'letterCount', value: mockWord.letterCount },
      d: { type: 'alternateDefinition', value: mockWord.alternateDefinition },
      e: { type: 'synonyms', value: mockWord.synonyms },
      f: { type: 'inSentence', value: mockWord.inSentence },
      i: { type: 'etymology', value: mockWord.etymology },
      n2: { type: 'nearbyWords', value: mockWord.nearbyWords },
      e2: { type: 'firstLetter', value: mockWord.firstLetter }
    };
    
    // Generate a unique game ID
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Store game data
    activeGames[gameId] = {
      wordId: mockWord.wordId,
      word: mockWord.word.toLowerCase(),
      guesses: [],
      startTime: Date.now(),
      hintsRevealed: 0
    };
    
    console.log('[/api/word] Returning word data:', {
      gameId,
      wordId: mockWord.wordId,
      word: mockWord.word,
      hasAlternateDefinition: !!mockWord.alternateDefinition,
      hasSynonyms: !!mockWord.synonyms
    });
    
    // Format response for client with mock data
    res.json({
      gameId,
      word: mockWord
    });
  }
});

// Guess endpoint
app.post('/api/guess', (req, res) => {
  try {
    const { gameId, guess, remainingGuesses } = req.body;
    
    console.log(`[/api/guess] Received guess for game ${gameId}: "${guess}"`);
    
    // Check if the game exists
    if (!activeGames[gameId]) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const gameData = activeGames[gameId];
    const correctWord = gameData.word;
    
    // Check if the guess is correct
    const isCorrect = guess.toLowerCase() === correctWord.toLowerCase();
    
    // Calculate fuzzy match positions (letters that are correct but in wrong position)
    const fuzzyPositions = [];
    const guessChars = guess.toLowerCase().split('');
    const correctChars = correctWord.toLowerCase().split('');
    
    // Check for fuzzy matches (letter exists in word but in different position)
    for (let i = 0; i < guessChars.length; i++) {
      if (correctChars.includes(guessChars[i]) && guessChars[i] !== correctChars[i]) {
        fuzzyPositions.push(i);
      }
    }
    
    // Record this guess
    gameData.guesses.push({
      word: guess,
      isCorrect,
      timestamp: Date.now()
    });
    
    // Increment hints revealed counter for incorrect guesses
    if (!isCorrect) {
      gameData.hintsRevealed = Math.min(7, gameData.hintsRevealed + 1);
    }
    
    // Format the response
    const response = {
      isCorrect,
      correctWord: isCorrect ? correctWord : undefined,
      guessedWord: guess,
      isFuzzy: fuzzyPositions.length > 0,
      fuzzyPositions: fuzzyPositions,
      // Send back which hints should be revealed based on number of incorrect guesses
      hintsToReveal: gameData.hintsRevealed
    };
    
    console.log(`[/api/guess] Guess result: correct=${isCorrect}, fuzzy=${fuzzyPositions.length > 0}, hintsToReveal=${gameData.hintsRevealed}`);
    
    res.json(response);
  } catch (error) {
    console.error('[/api/guess] Error processing guess:', error);
    res.status(500).json({ error: 'Error processing guess' });
  }
});

// Streak status endpoint
app.get('/api/streak-status', (req, res) => {
  const username = req.query.username;
  
  if (!username) {
    return res.status(400).json({ error: 'Username parameter required' });
  }
  
  console.log(`[/api/streak-status] Checking streak status for user: ${username}`);
  
  return res.json({
    status: 'success',
    streakInfo: {
      currentStreak: 3,
      longestStreak: 5,
      lastUpdated: new Date().toISOString()
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`Word endpoint: http://localhost:${PORT}/api/word`);
  console.log(`GET  /api/streak-status?username=<email> - Check streak status`);
}); 