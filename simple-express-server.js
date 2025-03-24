// simple-express-server.js
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Mock data for the integrated hints
const mockWordData = {
  wordId: '123',
  word: 'prudent',
  definition: 'Acting with or showing care and thought for the future',
  partOfSpeech: 'adjective',
  alternateDefinition: 'Careful and sensible; marked by sound judgment',
  synonyms: 'careful, cautious, judicious, wise, sensible, circumspect',
  letterCount: 7,
  inSentence: "It's prudent to save some money for emergencies.",
  etymology: 'From Latin prudens (wise, skilled)',
  firstLetter: 'p',
  nearbyWords: 'prudence, prudently, prudential',
  hints: {
    u: null,
    n: { type: 'number of letters', value: 7 },
    d: { type: 'alternate definition', value: 'Careful and sensible; marked by sound judgment' },
    e: { type: 'synonyms', value: 'careful, cautious, judicious, wise, sensible, circumspect' },
    f: { type: 'in a sentence', value: "It's prudent to save some money for emergencies." },
    i: { type: 'etymology', value: 'From Latin prudens (wise, skilled)' },
    n2: { type: 'nearby words', value: 'prudence, prudently, prudential' },
    e2: { type: 'first letter', value: 'p' }
  }
};

// API endpoint for getting a word
app.get('/api/word', (req, res) => {
  console.log('GET /api/word - Returning mock word data');
  
  // Create unique game ID for this session
  const gameId = `game-${Date.now()}`;
  
  // Return the mock word data with gameId
  res.json({
    gameId,
    word: mockWordData
  });
});

// API endpoint for guessing a word
app.post('/api/guess', (req, res) => {
  const { guess, gameId, remainingGuesses } = req.body;
  console.log(`POST /api/guess - Received guess: ${guess}, gameId: ${gameId}, remainingGuesses: ${remainingGuesses}`);
  
  const correctWord = mockWordData.word.toLowerCase();
  const isCorrect = guess.toLowerCase() === correctWord;
  
  // Calculate fuzzy match - simple version (just check if first 2 characters match)
  const isFuzzy = !isCorrect && guess.length >= 2 && 
                 correctWord.substring(0, 2) === guess.substring(0, 2);
  
  // Determine how many hints to reveal (increment by 1 for incorrect guesses)
  const hintsToReveal = isCorrect ? 8 : Math.min(7, (8 - remainingGuesses));
  
  console.log(`Guess result: isCorrect=${isCorrect}, isFuzzy=${isFuzzy}, hintsToReveal=${hintsToReveal}`);
  
  res.json({
    isCorrect,
    correctWord: isCorrect ? correctWord : null,
    guessedWord: guess,
    isFuzzy,
    fuzzyPositions: isFuzzy ? [2, 3] : [],  // hardcoded example positions
    hintsToReveal
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game word is: ${mockWordData.word} (for testing)`);
}); 