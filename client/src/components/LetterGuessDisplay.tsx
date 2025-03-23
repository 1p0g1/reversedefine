import React from 'react';
import './LetterGuessDisplay.css';

interface LetterGuessDisplayProps {
  wordLength: number;
  currentGuess: string;
}

const LetterGuessDisplay: React.FC<LetterGuessDisplayProps> = ({ wordLength, currentGuess }) => {
  // Split current guess into characters for display
  const guessChars = currentGuess.split('');
  
  // Create an array of display items (letters or underscores)
  const displayItems = Array(wordLength).fill('_').map((underscore, index) => {
    // If we have a character at this index in the guess, use it; otherwise use underscore
    return guessChars[index] || underscore;
  });
  
  return (
    <div className="letter-guess-display">
      {displayItems.map((item, index) => (
        <span 
          key={index} 
          className={`letter-space ${item !== '_' ? 'has-letter' : ''}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

export default LetterGuessDisplay; 