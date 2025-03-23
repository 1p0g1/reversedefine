import pkg from 'snowflake-sdk';
const { createPool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required Snowflake environment variables
const requiredVars = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USERNAME', 
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_DATABASE',
  'SNOWFLAKE_SCHEMA',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_ROLE'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Missing required Snowflake environment variables: ${missingVars.join(', ')}`);
  console.error('Please add these variables to your .env file');
}

// Create connection pool
const snowflakePool = createPool({
  account: process.env.SNOWFLAKE_ACCOUNT,
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  // Use the new UNDEFINE database
  database: 'UNDEFINE',
  schema: 'PUBLIC',
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  role: process.env.SNOWFLAKE_ROLE
});

/**
 * Fetch a random word from Snowflake
 * @returns {Promise<Object>} Word object with definition and other properties
 */
export async function fetchRandomWord() {
  return new Promise((resolve, reject) => {
    const connection = snowflakePool.acquire();
    
    connection.connect((err) => {
      if (err) {
        console.error('Error connecting to Snowflake:', err);
        snowflakePool.release(connection);
        return reject(err);
      }
      
      // Query to fetch a random word with all hint data from WORDS2 table
      const query = `
        SELECT 
          CONCAT('word-', RANDOM()) as wordId,
          WORD as word,
          DEF as definition,
          POS as partOfSpeech,
          DEF_II as alternateDefinition,
          SYNON as synonyms,
          NUMB as letterCount,
          IN_SENT as inSentence,
          ETYM as etymology,
          F_LET as firstLetter,
          NEAR_W as nearbyWords
        FROM WORDS2 
        ORDER BY RANDOM() 
        LIMIT 1
      `;
      
      connection.execute({
        sqlText: query,
        complete: (err, statement, rows) => {
          snowflakePool.release(connection);
          
          if (err) {
            console.error('Error executing Snowflake query:', err);
            return reject(err);
          }
          
          if (!rows || rows.length === 0) {
            return reject(new Error('No words found in Snowflake WORDS2 table'));
          }
          
          // Process the row to ensure all hint data is properly formatted
          const word = rows[0];
          
          // Format data for frontend consumption
          const processedWord = {
            ...word,
            // Ensure letterCount is a number
            letterCount: parseInt(word.letterCount, 10) || word.word.length,
            // Structure hints according to UNDEFINE sequence
            hints: {
              u: null, // No hint for U
              n: { type: 'letterCount', value: word.letterCount },
              d: { type: 'alternateDefinition', value: word.alternateDefinition },
              e: { type: 'synonyms', value: word.synonyms },
              f: { type: 'inSentence', value: word.inSentence },
              i: { type: 'etymology', value: word.etymology },
              n2: { type: 'nearbyWords', value: word.nearbyWords },
              e2: { type: 'firstLetter', value: word.firstLetter }
            }
          };
          
          // Return the processed data
          resolve(processedWord);
        }
      });
    });
  });
}

/**
 * Check if a word exists in the Snowflake database
 * @param {string} word The word to check
 * @returns {Promise<boolean>} True if the word exists
 */
export async function checkWordExists(word) {
  return new Promise((resolve, reject) => {
    const connection = snowflakePool.acquire();
    
    connection.connect((err) => {
      if (err) {
        console.error('Error connecting to Snowflake:', err);
        snowflakePool.release(connection);
        return reject(err);
      }
      
      const query = `
        SELECT COUNT(*) as count
        FROM WORDS2 
        WHERE LOWER(WORD) = LOWER(?)
      `;
      
      connection.execute({
        sqlText: query,
        binds: [word],
        complete: (err, statement, rows) => {
          snowflakePool.release(connection);
          
          if (err) {
            console.error('Error executing Snowflake query:', err);
            return reject(err);
          }
          
          resolve(rows[0]?.count > 0);
        }
      });
    });
  });
}

export default {
  fetchRandomWord,
  checkWordExists
}; 