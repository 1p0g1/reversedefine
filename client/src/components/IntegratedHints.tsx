import React from 'react';
import './IntegratedHints.css';

interface Hint {
  type: string;
  value: string | number;
}

interface IntegratedHintsProps {
  hints: {
    u: null;
    n: Hint;
    d: Hint;
    e: Hint;
    f: Hint;
    i: Hint;
    n2: Hint;
    e2: Hint;
  } | undefined;
  revealedHints: number;
  gameOver: boolean;
  guessResults: (string | null)[];
  definition: string;
}

const IntegratedHints: React.FC<IntegratedHintsProps> = ({ 
  hints, 
  revealedHints, 
  gameOver,
  guessResults,
  definition
}) => {
  if (!hints) return null;

  // Define which hints correspond to which letters in "UNDEFINE"
  const hintContent: { [key: string]: { letter: string; type: string; hint: Hint | null; isDefinition?: boolean } } = {
    '0': { letter: 'U', type: 'DEFINITION', hint: null, isDefinition: true },
    '1': { letter: 'N', type: 'NUMBER OF LETTERS', hint: hints.n },
    '2': { letter: 'D', type: 'ALTERNATE DEFINITION', hint: hints.d },
    '3': { letter: 'E', type: 'SYNONYMS', hint: hints.e },
    '4': { letter: 'F', type: 'IN A SENTENCE', hint: hints.f },
    '5': { letter: 'I', type: 'ETYMOLOGY', hint: hints.i },
    '6': { letter: 'N', type: 'NEARBY WORDS', hint: hints.n2 },
    '7': { letter: 'E', type: 'FIRST LETTER', hint: hints.e2 },
  };

  // Determine if hint should be revealed based on the game state
  const isHintRevealed = (index: number) => {
    return gameOver || index <= revealedHints;
  };

  // Format the hint value based on its type
  const formatHintValue = (hint: Hint | null, isDefinition = false) => {
    if (isDefinition) {
      return <span>{definition}</span>;
    }
    
    if (!hint) return null;

    if (hint.type === 'synonyms' && typeof hint.value === 'string') {
      const synonyms = hint.value.split(',').map(s => s.trim());
      return (
        <div className="synonyms-container">
          {synonyms.map((synonym, idx) => (
            <span key={idx} className="synonym-tag">{synonym}</span>
          ))}
        </div>
      );
    }

    return <span>{hint.value}</span>;
  };

  return (
    <div className="integrated-hints-container">
      <div className="horizontal-hints-layout">
        {Object.entries(hintContent).map(([key, { letter, type, hint, isDefinition }]) => {
          const index = parseInt(key);
          const revealed = isHintRevealed(index);
          
          // Skip if this hint isn't revealed yet and it's not the U (definition)
          if (!revealed && index !== 0) {
            return null;
          }

          return (
            <div 
              key={key} 
              className={`hint-row ${revealed ? 'visible' : 'hidden'}`}
            >
              <div className={`hint-letter-indicator ${index === 0 ? 'definition-indicator' : ''} ${revealed ? 'active' : 'inactive'}`}>
                {letter}
              </div>
              <div className="hint-connector"></div>
              <div className={`hint-content-box ${index === 0 ? 'definition-content' : ''}`}>
                <div className="hint-label">{type}</div>
                <div className="hint-value">
                  {formatHintValue(hint, isDefinition)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IntegratedHints; 