import { useState, useEffect } from 'react'
import './App.css'
import Confetti from 'react-confetti'
import Leaderboard from './Leaderboard'
import { getApiUrl } from './config';
import LetterGuessDisplay from './components/LetterGuessDisplay';
import IntegratedHints from './components/IntegratedHints';

// Add TypeScript declarations for our window extensions
declare global {
  interface Window {
    API_BASE_URL?: string;
    getApiUrl?: (path: string) => string;
    buildApiUrl?: (endpoint: string) => string;
    testApiConnection?: () => Promise<void>;
  }
}

interface GuessHistory {
  word: string;
  isCorrect: boolean;
  isFuzzy: boolean;
}

interface GuessResponse {
  isCorrect: boolean;
  correctWord: string;
  guessedWord: string;
  isFuzzy: boolean;
  fuzzyPositions?: number[];
  leaderboardRank?: number;
  hintsToReveal: number;
}

interface WordData {
  wordId: string;
  word: string;
  definition: string;
  partOfSpeech: string;
  alternateDefinition?: string;
  synonyms?: string;
  letterCount?: number;
  inSentence?: string;
  etymology?: string;
  firstLetter?: string;
  nearbyWords?: string;
  hints?: {
    u: null;
    n: { type: string; value: string | number };
    d: { type: string; value: string | number };
    e: { type: string; value: string | number };
    f: { type: string; value: string | number };
    i: { type: string; value: string | number };
    n2: { type: string; value: string | number };
    e2: { type: string; value: string | number };
  };
}

// Add this type at the top with other type definitions
type GuessResult = 'correct' | 'incorrect' | null;

// Update or add the Hint interface
interface Hint {
  letterCount: boolean;
  alternateDefinition: boolean;
  synonyms: boolean;
}

// Define a type for hint types
type HintType = 'partOfSpeech' | 'alternateDefinition' | 'synonyms';

function App() {
  const [definition, setDefinition] = useState<string>('');
  const [guess, setGuess] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [guessHistory, setGuessHistory] = useState<GuessHistory[]>([]);
  const [remainingGuesses, setRemainingGuesses] = useState<number>(8);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const [guessResults, setGuessResults] = useState<GuessResult[]>([null, null, null, null, null, null, null, null]);
  const [fuzzyMatchPositions, setFuzzyMatchPositions] = useState<number[]>([]);
  const [hintsToReveal, setHintsToReveal] = useState<number>(0);
  const [wordData, setWordData] = useState<WordData | null>(null);
  const [correctWord, setCorrectWord] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [fuzzyCount, setFuzzyCount] = useState<number>(0);
  const [leaderboardRank, setLeaderboardRank] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [hintCount, setHintCount] = useState<number>(0);
  const [gameId, setGameId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [debug, setDebug] = useState<boolean>(false);

  useEffect(() => {
    let interval: number | undefined;
    if (!isGameOver) {
      interval = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGameOver]);

  // Generate a unique user ID and set username if not already set
  useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    const storedUserName = localStorage.getItem('userName');
    
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('userId', newUserId);
      setUserId(newUserId);
    }
    
    if (storedUserName) {
      setUserName(storedUserName);
    } else {
      // Generate a random username
      const adjectives = ['Quick', 'Clever', 'Smart', 'Bright', 'Sharp', 'Witty', 'Nimble', 'Keen'];
      const nouns = ['Thinker', 'Guesser', 'Player', 'Mind', 'Solver', 'Wordsmith', 'Genius'];
      
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNumber = Math.floor(Math.random() * 100);
      
      const generatedName = `${randomAdjective}${randomNoun}${randomNumber}`;
      localStorage.setItem('userName', generatedName);
      setUserName(generatedName);
    }
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    console.log('App component mounted - initializing game...');
    
    if (!definition) {
      console.log('No definition found - fetching new word...');
      fetchNewWord();
    } else {
      console.log('Definition already exists, skipping initial fetch');
    }
  }, []);

  const fetchNewWord = async () => {
    let retryCount = 0;
    const MAX_RETRIES = 3;
    
    const attemptFetch = async () => {
      try {
        setLoading(true);
        setError('');
        
        console.log('Fetching new word from API...');
        const apiUrl = getApiUrl('/api/word');
        console.log(`API URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        console.log('Word API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Word data received:', {
          gameId: data.gameId,
          wordId: data.word?.wordId || data.wordId,
          word: data.word?.word || data.word,
          definition: data.word?.definition || data.definition,
          alternateDefinition: data.word?.alternateDefinition,
          synonyms: data.word?.synonyms,
        });

        // Store the gameId from the response
        if (data.gameId) {
          console.log('Game ID received:', data.gameId);
          setGameId(data.gameId);
        } else {
          console.warn('No gameId found in response');
          setMessage('Warning: No game ID received. Guesses may not work correctly.');
        }
        
        // Handle the response based on its structure
        if (data.word) {
          // Handle new response format with word object
          setDefinition(data.word.definition);
          setWordData(data.word);
          setCorrectWord(data.word.word?.toLowerCase() || '');
        } else if (data.definition) {
          // Handle legacy response format (direct properties)
          setDefinition(data.definition);
          setWordData(data);
          setCorrectWord(data.word?.toLowerCase() || '');
        } else {
          console.error('Unexpected response structure:', data);
          throw new Error('Unexpected response format from API');
        }
        
        // Reset game state
        setIsCorrect(false);
        setMessage('');
        setGuess('');
        setGuessHistory([]);
        setRemainingGuesses(8);
        setIsGameOver(false);
        setTimer(0);
        setGuessResults([null, null, null, null, null, null, null, null]);
        setFuzzyMatchPositions([]);
        
        setHintsToReveal(0);
      } catch (error) {
        console.error('Error fetching word:', error);
        
        // If we have retries left, try again
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`Retry attempt ${retryCount}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          return attemptFetch();
        }
        
        setMessage(`Error fetching word (after ${MAX_RETRIES} attempts). Using fallback data.`);
        
        // Fallback to hardcoded data for development/demo purposes
        console.log('FALLING BACK TO HARDCODED DATA due to API error');
        const fallbackData: WordData = {
          wordId: '123',
          word: 'cogitate',
          definition: "To reason, argue, or think carefully and thoroughly.",
          partOfSpeech: "verb",
          alternateDefinition: "To ponder or meditate on something deeply.",
          synonyms: "think, ponder, contemplate, meditate, reflect"
        };
        
        // Generate a fallback gameId so the game still works
        const fallbackGameId = `fallback-game-${Date.now()}`;
        setGameId(fallbackGameId);
        
        setDefinition(fallbackData.definition);
        setWordData(fallbackData);
        setCorrectWord(fallbackData.word.toLowerCase());
      } finally {
        setLoading(false);
      }
    };
    
    return attemptFetch();
  };

  const handleGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isGameOver || isCorrect || !guess.trim() || loading) {
      return;
    }
    
    try {
      console.log('Submitting guess:', guess);
      
      // Only proceed if we have a gameId
      if (!gameId) {
        setMessage('No active game. Please refresh to start a new game.');
        return;
      }
      
      console.log('Game ID being sent:', gameId);
      
      const newRemainingGuesses = remainingGuesses - 1;
      const currentGuessIndex = 7 - remainingGuesses;
      
      // Create a new guessResults array - DO NOT directly update before API response
      const newGuessResults = [...guessResults];
      
      // Add guess to history
      const newHistory = [...guessHistory];
      newHistory.push({
        word: guess,
        isCorrect: false,
        isFuzzy: false
      });
      setGuessHistory(newHistory);
      
      // Create payload with essential data
      const payload = {
        gameId,
        guess,
        remainingGuesses,
        timer,
        userId,
        fuzzyCount: fuzzyMatchPositions.length,
        userName,
        hintCount: hintsToReveal
      };
      
      console.log('Sending payload to /api/guess:', payload);
      
      // Clear the input field immediately for better UX
      const submittedGuess = guess.trim();
      setGuess('');
      
      const response = await fetch(getApiUrl('/api/guess'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status from /api/guess:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response from /api/guess:', errorData);
        throw new Error(`API error: ${response.status} ${errorData.error || ''}`);
      }
      
      const data = await response.json();
      
      console.log('Guess result:', data);
      
      // Update state based on the response
      setRemainingGuesses(newRemainingGuesses);
      
      // Update hints to reveal counter based on response
      if (data.hintsToReveal !== undefined) {
        setHintsToReveal(data.hintsToReveal);
      }
      
      if (data.isFuzzy && data.fuzzyPositions && data.fuzzyPositions.length) {
        setFuzzyMatchPositions(data.fuzzyPositions);
      }
      
      if (data.isCorrect) {
        // Mark all DEFINE boxes as correct when the guess is correct
        for (let i = 0; i <= 7; i++) {
          newGuessResults[i] = 'correct';
        }
        
        // Update the latest guess in history to be marked as correct
        if (newHistory.length > 0) {
          const lastIndex = newHistory.length - 1;
          newHistory[lastIndex].isCorrect = true;
        }
        setGuessHistory(newHistory);
        
        setMessage('Correct! Well done! 🎉');
        setIsCorrect(true);
        setIsGameOver(true);
        setShowConfetti(true);
        setCorrectWord(data.correctWord);
        
        // Ensure fuzzy match positions are always cleared for correct guesses
        setFuzzyMatchPositions([]);
        
        // Store leaderboard rank if provided
        if (data.leaderboardRank) {
          setLeaderboardRank(data.leaderboardRank);
        }
        
        // Show leaderboard after a short delay
        setTimeout(() => {
          setShowLeaderboard(true);
        }, 2000);
        
        // Hide confetti after 5 seconds
        setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
      } else {
        // Only mark the current guess index as incorrect for wrong guesses
        newGuessResults[currentGuessIndex] = 'incorrect';
        
        if (newRemainingGuesses <= 0) {
          setMessage(`Game Over! The word was: ${data.correctWord}`);
          setIsGameOver(true);
          setCorrectWord(data.correctWord);
        } else {
          setMessage(`Not quite right. ${newRemainingGuesses} guesses remaining!`);
        }
      }
      
      // Set the updated guessResults AFTER API response processing
      setGuessResults(newGuessResults);
    } catch (error) {
      console.error('Error submitting guess:', error);
      setMessage('Error processing your guess. Please try again.');
    }
  };

  // Modify the DefineBoxes component to visually match our new design
  const DefineBoxes = () => {
    const defineLetters = ['U', 'N', 'D', 'E', 'F', 'I', 'N', 'E'];
    
    // Simple grid style for the title
    const horizontalStyle = {
      display: 'flex',
      flexDirection: 'row' as const,
      justifyContent: 'center',
      alignItems: 'center',
      gap: '0.4rem',
      width: '100%'
    };
    
    return (
      <div style={horizontalStyle}>
        {defineLetters.map((letter, index) => {
          // Start with base class
          let boxClass = 'define-box';
          
          // Check for guess result to determine color
          if (index < guessResults.length && guessResults[index] !== null) {
            // If this position has a guess result, use that class (correct/incorrect)
            boxClass += ` ${guessResults[index]}`;
          } else if (index === 0 || index <= hintsToReveal) {
            // If no result yet but this box should be active (first box or revealed hint)
            boxClass += ' active';
          }
          
          // Check if this position has a fuzzy match
          if (fuzzyMatchPositions.includes(index)) {
            boxClass += ' fuzzy';
          }
          
          return (
            <div 
              key={index} 
              className={boxClass}
            >
              {letter}
            </div>
          );
        })}
      </div>
    );
  };

  // Component to display the correct word when game is over
  const GameOverMessage = () => {
    if (!isGameOver || isCorrect) return null;
    
    return (
      <div className="game-over-message">
        <p><em className="game-over-label">The word of the day was: </em> <span className="correct-word">{correctWord}</span></p>
      </div>
    );
  };

  const handleNextWord = () => {
    setGuess('');
    setGuessHistory([]);
    setGuessResults([null, null, null, null, null, null, null, null]);
    setFuzzyMatchPositions([]);
    
    // Reset hints to reveal counter
    setHintsToReveal(0);
    
    fetchNewWord();
    setIsGameOver(false);
  };

  // At the bottom of the component, before the return statement
  // Add a keyboard listener for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle debug mode with Ctrl+Shift+D
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebug(prev => !prev);
        console.log('Debug mode toggled:', !debug);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [debug]);

  return (
    <div className="app-container">
      {showConfetti && <Confetti 
        width={window.innerWidth}
        height={window.innerHeight}
        recycle={false}
        numberOfPieces={200}
        gravity={0.2}
      />}
      
      {/* Add a loading indicator and error message */}
      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading word data...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <h3>Error Loading Game</h3>
          <p>{error}</p>
          <button onClick={() => {
            setError('');
            fetchNewWord();
          }}>
            Retry
          </button>
          <p className="debug-info">
            <small>API URL: {window.API_BASE_URL || 'http://localhost:3001'}</small>
            <br />
            <small>
              <a href="#" onClick={(e) => {
                e.preventDefault();
                if (window.testApiConnection) {
                  window.testApiConnection();
                } else {
                  console.log('Test function not available');
                }
              }}>
                Run API Connection Test
              </a>
            </small>
          </p>
        </div>
      )}
      
      <div className="timer-container">
        <div className="timer">{formatTime(timer)}</div>
      </div>
      <div className="title-container">
        <DefineBoxes />
      </div>
      <div className="definition-box">
        <p>{definition}</p>
        {isGameOver && !isCorrect && <GameOverMessage />}
      </div>
      <div className="game-container">
        <form onSubmit={handleGuess} className="guess-form">
          {/* Only show LetterGuessDisplay after the first N hint is revealed */}
          {wordData && hintsToReveal >= 1 && (
            <LetterGuessDisplay
              wordLength={wordData.letterCount || wordData.word?.length || 0}
              currentGuess={guess}
              word={wordData.word} 
            />
          )}
          
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Enter your guess..."
            disabled={isGameOver}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
          />
          
          {/* Display floating guesses here, between input and submit button */}
          {guessHistory.length > 0 && (
            <div className="floating-guesses">
              {guessHistory.map((guess, index) => (
                <span 
                  key={index} 
                  className={`floating-guess ${guess.isCorrect ? 'correct' : (guess.isFuzzy ? 'fuzzy' : 'incorrect')}`}
                >
                  {guess.word}
                  {guess.isCorrect && <span className="guess-emoji">✓</span>}
                </span>
              ))}
            </div>
          )}
          
          {/* Display remaining guesses counter */}
          <div className="remaining-guesses">
            {!isGameOver && (
              <span>Guesses remaining: <strong>{remainingGuesses}</strong></span>
            )}
            {isGameOver && !isCorrect && (
              <span className="game-over-message">Game Over!</span>
            )}
            {isGameOver && isCorrect && (
              <span className="success-message">Correct! Well done!</span>
            )}
          </div>
          
          <button type="submit" disabled={isGameOver || !guess.trim()}>
            Submit Guess
          </button>
        </form>

        {/* Replace the old hints container with the new IntegratedHints component */}
        {wordData && wordData.hints && (
          <IntegratedHints
            guessResults={guessResults}
            hintsToReveal={hintsToReveal}
            hintsData={wordData.hints}
            isGameOver={isGameOver}
          />
        )}

        {isGameOver && (
          <button onClick={handleNextWord} className="next-word-btn">
            Next Word
          </button>
        )}
      </div>

      {/* Leaderboard component */}
      {showLeaderboard && (
        <Leaderboard
          userId={userId}
          time={timer}
          guessCount={8 - remainingGuesses}
          fuzzyCount={fuzzyCount}
          hintCount={hintCount}
          word={correctWord}
          guessResults={guessResults as any}
          fuzzyMatchPositions={fuzzyMatchPositions}
          hints={{} as Hint}
          onClose={() => setShowLeaderboard(false)}
          userEmail={userName}
        />
      )}

      {/* Add debug mode info display */}
      {debug && (
        <div className="debug-panel">
          <h3>Debug Info</h3>
          <pre>
            {JSON.stringify({
              wordData: {
                word: wordData?.word,
                wordLength: wordData?.word?.length,
                definition: wordData?.definition?.substring(0, 30) + '...',
              },
              gameState: {
                isGameOver,
                isCorrect,
                remainingGuesses,
                currentGuess: guess,
              },
              apiInfo: {
                gameId,
                apiUrl: window.API_BASE_URL || 'http://localhost:3001'
              }
            }, null, 2)}
          </pre>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p>© {new Date().getFullYear()} Reverse Define Game</p>
        </div>
      </footer>
    </div>
  )
}

export default App
