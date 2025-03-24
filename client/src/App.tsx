import { useState, useEffect, useRef } from 'react'
import './App.css'
import Confetti from 'react-confetti'
import Leaderboard from './Leaderboard'
import { getApiUrl } from './config';
import LetterGuessDisplay from './components/LetterGuessDisplay';
import IntegratedHints from './components/IntegratedHints';
import React from 'react';

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
type GuessResult = 'correct' | 'incorrect' | 'fuzzy' | null;

// Update or add the Hint interface
interface Hint {
  letterCount: boolean;
  alternateDefinition: boolean;
  synonyms: boolean;
}

// Define a type for hint types
type HintType = 'partOfSpeech' | 'alternateDefinition' | 'synonyms';

// Word input component with placeholder for characters
const ResponsiveWordInput: React.FC<{
  word: string;
  currentGuess: string;
  onGuessChange: (guess: string) => void;
  onSubmitGuess: (e: React.FormEvent) => void;
  isFirstHintRevealed: boolean;
}> = ({ word, currentGuess, onGuessChange, onSubmitGuess, isFirstHintRevealed }) => {
  // Simple direct input implementation
  return (
    <div className="responsive-input-container">
      <form onSubmit={onSubmitGuess}>
        <div className="responsive-input-wrapper">
          <input
            type="text"
            className="responsive-game-input"
            value={currentGuess}
            onChange={(e) => onGuessChange(e.target.value.toLowerCase())}
            placeholder="Type your guess here..."
            autoComplete="off"
            autoFocus
          />
          <button 
            type="submit" 
            className="submit-button"
            disabled={currentGuess.length === 0}
          >
            Guess
          </button>
        </div>
      </form>
    </div>
  );
};

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
  const [crackLevels, setCrackLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const shatterTimeouts = useRef<NodeJS.Timeout[]>([]);
  const [shatterComplete, setShatterComplete] = useState<boolean>(false);

  // Define a constant for max guesses
  const MAX_GUESSES = 8;

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

  // Update the useEffect that checks game ending conditions
  useEffect(() => {
    // End game if the last guess was correct or if all guesses are used
    if (guessResults.some(result => result === 'correct') || 
        (hintsToReveal >= MAX_GUESSES - 1)) {
      setIsGameOver(true);
      
      // If the game ended with a correct guess, show confetti and leaderboard
      if (guessResults.some(result => result === 'correct')) {
        setIsCorrect(true);
        setShowConfetti(true);
        
        // Reset any cracks when the player wins
        setCrackLevels([0, 0, 0, 0, 0, 0, 0, 0]);
        
        // Show leaderboard after a short delay
        setTimeout(() => {
          setShowLeaderboard(true);
        }, 2000);
      } else {
        // Player lost - trigger full shatter animation
        // Create a sequence of shatter animations
        const delays = [0, 100, 200, 300, 400, 500, 600, 700];
        
        // Clear any existing timeouts
        shatterTimeouts.current.forEach(timeout => clearTimeout(timeout));
        shatterTimeouts.current = [];
        
        // Schedule the shatter animations
        const newTimeouts = delays.map((delay, index) => {
          return setTimeout(() => {
            setCrackLevels(prev => {
              const newLevels = [...prev];
              newLevels[index] = 5; // Level 5 means "shattered"
              return newLevels;
            });
          }, delay);
        });
        
        shatterTimeouts.current = newTimeouts;
        
        // Set shatter complete flag after all animations finish
        setTimeout(() => {
          setShatterComplete(true);
        }, 1700);
      }
    }
  }, [guessResults, hintsToReveal]);

  // Modify the handleGuess function to increase crack levels on incorrect guesses
  const handleGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isGameOver || !guess.trim()) return;

    try {
      // Log submission for debugging
      console.log(`Submitting guess: ${guess}`);
      
      // Make API call to submit guess
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/guess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId,
          guess,
          remainingGuesses: MAX_GUESSES - hintsToReveal - 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Guess result:', data);

      // Create a copy of the current guessResults array
      const newGuessResults = [...guessResults];

      // Update game state based on response
      if (data.isCorrect) {
        // When the guess is correct, mark all boxes as correct
        for (let i = 0; i < 8; i++) {
          newGuessResults[i] = 'correct';
        }
        setGuessResults(newGuessResults);
        setIsCorrect(true);
        setIsGameOver(true);
        
        // Show confetti and leaderboard on correct guess
        setShowConfetti(true);
        setTimeout(() => {
          setShowLeaderboard(true);
        }, 1500);
      } else {
        // For incorrect guesses, mark the current hint position as incorrect
        // And increase crack level for all tiles
        const currentPosition = hintsToReveal; 
        newGuessResults[currentPosition] = 'incorrect'; // Always incorrect, ignoring fuzzy
        setGuessResults(newGuessResults);
        
        // Update crack levels - increase crack level for incorrect guesses
        setCrackLevels(prev => {
          const newLevels = [...prev];
          // Increase crack level for all boxes by 1, max 4
          return newLevels.map((level, i) => 
            // Only increase if not already at max and not already correct
            newGuessResults[i] !== 'correct' ? Math.min(level + 1, 4) : level
          );
        });
        
        setHintsToReveal(data.hintsToReveal);
        
        // End game if this was the last guess
        if (data.hintsToReveal >= MAX_GUESSES - 1) {
          setIsGameOver(true);
        }
      }

      // Reset input field
      setGuess('');

    } catch (error) {
      console.error('Error submitting guess:', error);
    }
  };

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      shatterTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Modify the DefineBoxes component to visually match our new design
  const DefineBoxes = () => {
    const defineLetters = ['U', 'N', 'D', 'E', 'F', 'I', 'N', 'E'];
    
    // Horizontal left-aligned style
    const horizontalStyle = {
      display: 'flex',
      flexDirection: 'row' as const,
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: '0.4rem',
      width: '100%',
      marginBottom: '2rem'
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
          
          // Add crack level class if there are cracks
          if (crackLevels[index] > 0) {
            if (crackLevels[index] < 5) {
              boxClass += ` crack-level-${crackLevels[index]}`;
            } else {
              boxClass += ' shattered';
            }
          }
          
          // Add win state if game is won
          if (isCorrect && isGameOver) {
            boxClass += ' win-state';
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

  // Update the display of UNDEFINE boxes at the top with middle dot handling
  const renderUnDefineBoxes = () => {
    return (
      <div className="define-boxes-container">
        <div className="define-boxes">
          {/* Render UN part */}
          {['U', 'N'].map((letter, index) => {
            let boxClass = 'define-box';
            
            // Add active class if this box should be highlighted
            if (guessResults[index] === 'correct') {
              boxClass += ' correct';
            } else if (guessResults[index] === 'incorrect' || guessResults[index] === 'fuzzy') {
              boxClass += ' incorrect';
            } else if (index === 0 || index <= hintsToReveal) {
              boxClass += ' active';
            }
            
            // Add crack level class
            if (crackLevels[index] > 0) {
              if (crackLevels[index] < 5) {
                boxClass += ` crack-level-${crackLevels[index]}`;
              } else {
                boxClass += ' shattered';
              }
            }
            
            // Add win state if game is won
            if (isCorrect && isGameOver) {
              boxClass += ' win-state';
            }
            
            return (
              <div key={`un-${index}`} className={boxClass}>
                {letter}
              </div>
            );
          })}
          
          {/* Add centered dot */}
          <div className="middle-dot">·</div>
          
          {/* Render DEFINE part */}
          {['D', 'E', 'F', 'I', 'N', 'E'].map((letter, index) => {
            const actualIndex = index + 2; // Adjust index for DEFINE part (after U, N)
            let boxClass = 'define-box';
            
            // Add active class if this box should be highlighted
            if (guessResults[actualIndex] === 'correct') {
              boxClass += ' correct';
            } else if (guessResults[actualIndex] === 'incorrect' || guessResults[actualIndex] === 'fuzzy') {
              boxClass += ' incorrect';
            } else if (actualIndex === 0 || actualIndex <= hintsToReveal) {
              boxClass += ' active';
            }
            
            // Add crack level class
            if (crackLevels[actualIndex] > 0) {
              if (crackLevels[actualIndex] < 5) {
                boxClass += ` crack-level-${crackLevels[actualIndex]}`;
              } else {
                boxClass += ' shattered';
              }
            }
            
            // Add win state if game is won
            if (isCorrect && isGameOver) {
              boxClass += ' win-state';
            }
            
            return (
              <div key={`define-${index}`} className={boxClass}>
                {letter}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Component to display the correct word when game is over
  const GameOverMessage = () => {
    if (!isGameOver) return null;
    
    if (isCorrect) {
      return (
        <div className="game-over-message success-message">
          <p>Congratulations! You correctly guessed: <span className="correct-word">{correctWord}</span></p>
        </div>
      );
    } else {
      return (
        <div className="game-over-message">
          <p><em className="game-over-label">The word of the day was: </em> <span className="correct-word">{correctWord}</span></p>
        </div>
      );
    }
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

  // Add this function to handle closing the leaderboard
  const handleLeaderboardClose = () => {
    setShowLeaderboard(false);
    // Optionally fetch a new word after closing the leaderboard
    // fetchNewWord();
  };

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
      
      <div className="game-container simplified-ui">
        {/* Display UNDEFINE boxes at the top */}
        {renderUnDefineBoxes()}
      
        <div className="timer-container">
          <div className="timer">{formatTime(timer)}</div>
        </div>

        {/* IntegratedHints component with definition passed as prop */}
        {wordData && wordData.hints && (
          <IntegratedHints
            hints={wordData.hints}
            revealedHints={isGameOver ? 8 : hintsToReveal}
            gameOver={isGameOver}
            guessResults={guessResults}
            definition={definition}
          />
        )}

        {/* Add input field for user guesses */}
        {!isGameOver && (
          <div className="guess-input-container">
            <ResponsiveWordInput
              word={wordData?.word || ''}
              currentGuess={guess}
              onGuessChange={(guess) => setGuess(guess)}
              onSubmitGuess={handleGuess}
              isFirstHintRevealed={hintsToReveal >= 1}
            />
          </div>
        )}

        {isGameOver && (
          <button onClick={handleNextWord} className="next-word-btn">
            Next Word
          </button>
        )}
        
        {/* Game over message */}
        <GameOverMessage />
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
          onClose={handleLeaderboardClose}
          userEmail={userName}
        />
      )}

      {/* Add debug mode info display - only show when debug is true */}
      {debug && (
        <div className="debug-panel" style={{ position: 'fixed', bottom: '0', right: '0', backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', maxWidth: '500px', maxHeight: '300px', overflow: 'auto', zIndex: 1000 }}>
          <h3>Debug Info</h3>
          <pre>
            {JSON.stringify({
              wordData: wordData ? {
                wordId: wordData.wordId,
                word: wordData.word,
                wordLength: wordData?.word?.length,
                definition: wordData.definition?.substring(0, 30) + '...',
                partOfSpeech: wordData.partOfSpeech,
                hints: wordData.hints ? Object.keys(wordData.hints) : 'No hints'
              } : 'No word data loaded',
              gameState: {
                isGameOver,
                isCorrect,
                remainingGuesses,
                currentGuess: guess,
                hintsToReveal,
                crackLevels
              },
              apiInfo: {
                gameId,
                apiUrl: window.API_BASE_URL || 'http://localhost:3001',
                dbProvider: import.meta.env.VITE_DB_PROVIDER || 'unknown',
                mockMode: window.location.search.includes('mock=true')
              },
              uiState: {
                showLeaderboard,
                loading,
                error: error || 'none'
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
