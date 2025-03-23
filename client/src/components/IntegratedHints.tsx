import React from 'react';
import './IntegratedHints.css';

interface HintData {
  type: string;
  value: string | number;
}

interface HintMap {
  u: null;
  n: HintData;
  d: HintData;
  e: HintData;
  f: HintData;
  i: HintData;
  n2: HintData;
  e2: HintData;
}

interface IntegratedHintsProps {
  guessResults: Array<'correct' | 'incorrect' | null>;
  hintsToReveal: number;
  hintsData: HintMap | null;
  isGameOver: boolean;
}

const IntegratedHints: React.FC<IntegratedHintsProps> = ({
  guessResults,
  hintsToReveal,
  hintsData,
  isGameOver
}) => {
  // Return null if no hint data available
  if (!hintsData) return null;

  // Letters to display in the hint boxes
  const letters = ['U', 'N', 'D', 'E', 'F', 'I', 'N', 'E'];
  
  // Map hint type to user-friendly label
  const getHintLabel = (type: string): string => {
    switch (type) {
      case 'letterCount': return 'Number of Letters';
      case 'alternateDefinition': return 'Alternate Definition';
      case 'synonyms': return 'Synonyms';
      case 'inSentence': return 'Used in a Sentence';
      case 'etymology': return 'Etymology';
      case 'nearbyWords': return 'Nearby Words';
      case 'firstLetter': return 'First Letter';
      default: return 'Hint';
    }
  };
  
  // Get hint content based on position in UNDEFINE sequence
  const getHintContent = (position: number): React.ReactNode => {
    // Don't show hints beyond what's been revealed
    if (position >= hintsToReveal && !isGameOver) {
      return null;
    }
    
    // Map position to hint data
    let hintData: HintData | null = null;
    switch (position) {
      case 0: // U - No hint
        return null;
      case 1: // N - Number of letters
        hintData = hintsData.n;
        break;
      case 2: // D - Alternate Definition
        hintData = hintsData.d;
        break;
      case 3: // E - Synonyms
        hintData = hintsData.e;
        break;
      case 4: // F - In a sentence
        hintData = hintsData.f;
        break;
      case 5: // I - Etymology
        hintData = hintsData.i;
        break;
      case 6: // N - Nearby words
        hintData = hintsData.n2;
        break;
      case 7: // E - First letter
        hintData = hintsData.e2;
        break;
      default:
        return null;
    }
    
    if (!hintData || !hintData.value) return null;
    
    // Format the hint content based on type
    switch (hintData.type) {
      case 'letterCount':
        return <p>This word has <strong>{hintData.value}</strong> letters.</p>;
      case 'synonyms':
        return (
          <div className="synonyms-container">
            {String(hintData.value).split(',').map((synonym, i) => (
              <span key={i} className="synonym-tag">{synonym.trim()}</span>
            ))}
          </div>
        );
      case 'firstLetter':
        return <p>The first letter is <strong>{hintData.value}</strong></p>;
      case 'inSentence':
        return <p>"{String(hintData.value)}"</p>;
      default:
        return <p>{hintData.value}</p>;
    }
  };
  
  // Get the class for a box based on its position and the guess results
  const getBoxClass = (position: number): string => {
    let boxClass = 'undefine-box';
    
    // If game is won, make all boxes correct
    if (guessResults.every(r => r === 'correct')) {
      return `${boxClass} correct`;
    }
    
    // If we have a result for this position (already guessed)
    if (position < guessResults.length && guessResults[position] !== null) {
      boxClass += ` ${guessResults[position]}`;
    }
    
    // If this hint is revealed (for visual indication)
    if (position < hintsToReveal || isGameOver) {
      boxClass += ' revealed';
    }
    
    return boxClass;
  };
  
  return (
    <div className="integrated-hints-container">
      <div className="undefine-boxes">
        {letters.map((letter, index) => (
          <div key={index} className={getBoxClass(index)}>
            <span className="letter">{letter}</span>
          </div>
        ))}
      </div>
      
      <div className="hints-display">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(position => (
          <div 
            key={position} 
            className={`hint-content ${position < hintsToReveal || isGameOver ? 'visible' : 'hidden'}`}
          >
            {position > 0 && position < hintsToReveal + 1 && (
              <div className="hint-box">
                <div className="hint-label">
                  {position === 1 && 'Number of Letters'}
                  {position === 2 && 'Alternate Definition'}
                  {position === 3 && 'Synonyms'}
                  {position === 4 && 'Used in a Sentence'}
                  {position === 5 && 'Etymology'}
                  {position === 6 && 'Nearby Words'}
                  {position === 7 && 'First Letter'}
                </div>
                <div className="hint-value">{getHintContent(position)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IntegratedHints; 