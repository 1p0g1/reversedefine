// snowflake-server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import snowflake from 'snowflake-sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Snowflake configuration
const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  database: process.env.SNOWFLAKE_DATABASE,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  schema: process.env.SNOWFLAKE_SCHEMA,
};

console.log('Snowflake config (without password):', {
  ...snowflakeConfig,
  password: '******',
});

// Create Snowflake connection
const connection = snowflake.createConnection(snowflakeConfig);

// Connect to Snowflake
connection.connect((err) => {
  if (err) {
    console.error('Unable to connect to Snowflake:', err);
    console.log('Starting server with mock data fallback...');
    startServer(true);
  } else {
    console.log('Successfully connected to Snowflake!');
    startServer(false);
  }
});

// Mock data as fallback
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

function startServer(useMockData) {
  // Function to execute a Snowflake query
  const executeQuery = (sql, binds = []) => {
    return new Promise((resolve, reject) => {
      if (useMockData) {
        reject(new Error('Snowflake connection not available, using mock data'));
        return;
      }

      connection.execute({
        sqlText: sql,
        binds: binds,
        complete: (err, stmt, rows) => {
          if (err) {
            console.error('Error executing query:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      });
    });
  };

  // Get a random word from Snowflake
  const getRandomWord = async () => {
    try {
      // Query to get a random word with all data needed for integrated hints
      const sql = `
        SELECT 
          word_id as wordId,
          word,
          definition,
          part_of_speech as partOfSpeech,
          alternate_definition as alternateDefinition,
          synonyms,
          LENGTH(word) as letterCount,
          example_sentence as inSentence,
          etymology,
          SUBSTRING(word, 1, 1) as firstLetter,
          nearby_words as nearbyWords
        FROM words2
        WHERE definition IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1
      `;
      
      const rows = await executeQuery(sql);
      if (rows && rows.length > 0) {
        const wordData = rows[0];
        
        // Format into the structure needed for integrated hints
        return {
          ...wordData,
          hints: {
            u: null, // main definition is always shown
            n: { type: 'number of letters', value: wordData.LETTERCOUNT },
            d: { type: 'alternate definition', value: wordData.ALTERNATEDEFINITION || 'No alternate definition available' },
            e: { type: 'synonyms', value: wordData.SYNONYMS || 'No synonyms available' },
            f: { type: 'in a sentence', value: wordData.INSENTENCE || 'No example sentence available' },
            i: { type: 'etymology', value: wordData.ETYMOLOGY || 'No etymology information available' },
            n2: { type: 'nearby words', value: wordData.NEARBYWORDS || 'No nearby words available' },
            e2: { type: 'first letter', value: wordData.FIRSTLETTER || '?' }
          }
        };
      } else {
        throw new Error('No words found in database');
      }
    } catch (error) {
      console.error('Error getting random word:', error);
      return null;
    }
  };

  // API endpoint for getting a word
  app.get('/api/word', async (req, res) => {
    console.log('GET /api/word - Fetching word data...');
    try {
      let wordData;
      
      if (useMockData) {
        console.log('Using mock data instead of Snowflake');
        wordData = mockWordData;
      } else {
        console.log('Fetching word from Snowflake...');
        wordData = await getRandomWord();
        
        if (!wordData) {
          console.log('Failed to fetch word from Snowflake, using mock data');
          wordData = mockWordData;
        }
      }
      
      // Create unique game ID for this session
      const gameId = `game-${Date.now()}`;
      
      // Return the word data with gameId
      res.json({
        gameId,
        word: wordData
      });
    } catch (error) {
      console.error('Error in /api/word endpoint:', error);
      res.status(500).json({ error: 'Failed to fetch word', message: error.message });
    }
  });

  // API endpoint for guessing a word
  app.post('/api/guess', (req, res) => {
    const { guess, gameId, remainingGuesses } = req.body;
    console.log(`POST /api/guess - Received guess: ${guess}, gameId: ${gameId}, remainingGuesses: ${remainingGuesses}`);
    
    // For now, we'll handle this similarly for both mock and Snowflake data
    // In a real implementation, you could log guesses to Snowflake or do more complex matching
    
    // If using mock data, or if we need to check the current game's word
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
    if (useMockData) {
      console.log(`Using MOCK DATA - Game word is: ${mockWordData.word} (for testing)`);
    } else {
      console.log(`Connected to Snowflake database: ${process.env.SNOWFLAKE_DATABASE}`);
    }
  });
} 