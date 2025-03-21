import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPanel.css';
import { FiSearch, FiX } from 'react-icons/fi';

interface WordEntry {
  word: string;
  partOfSpeech: string;
  synonyms?: string[];
  definition: string;
  alternateDefinition?: string;
  dateAdded?: string; // This will now represent the daily word date
  letterCount: {
    count: number;
    display: string;
  };
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  pages: number;
  next?: { page: number; limit: number };
  prev?: { page: number; limit: number };
}

const AdminPanel: React.FC = () => {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<WordEntry | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [formData, setFormData] = useState<WordEntry>({
    word: '',
    partOfSpeech: '',
    definition: '',
    alternateDefinition: '',
    synonyms: [],
    dateAdded: formatDate(new Date()), // Default to today's date
    letterCount: {
      count: 0,
      display: '[0]: '
    }
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [wordsPerPage, setWordsPerPage] = useState<number>(10);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const navigate = useNavigate();

  // Format date to DD/MM/YY
  function formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  }

  // Parse DD/MM/YY date string to Date object
  function parseDate(dateString: string): Date | null {
    // Expected format: DD/MM/YY
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS
    const year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for simplicity
    
    return new Date(year, month, day);
  }

  // Validate date format (DD/MM/YY)
  function isValidDate(dateString: string): boolean {
    // Check format
    if (!/^\d{2}\/\d{2}\/\d{2}$/.test(dateString)) return false;
    
    const date = parseDate(dateString);
    if (!date) return false;
    
    // Check if parsed date components match input
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    return dateString === `${day}/${month}/${year}`;
  }

  // Calculate fuzzy score
  function calculateFuzzyScore(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Check for exact substring match first
    if (s1.includes(s2) || s2.includes(s1)) {
      return 1;
    }
    
    // Calculate Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s1.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= s2.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    // Calculate similarity score (0 to 1)
    const maxLength = Math.max(s1.length, s2.length);
    const distance = matrix[s1.length][s2.length];
    return 1 - (distance / maxLength);
  }

  // Fetch words with optional pagination and search
  const fetchWords = async (page = 1, limit = 10, search = '') => {
    try {
      setLoading(true);
      
      let url = `/api/admin/words?page=${page}&limit=${limit}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Apply fuzzy search if search term exists
      let filteredWords = data.words;
      if (search) {
        filteredWords = data.words.filter((word: WordEntry) => {
          const fuzzyScore = calculateFuzzyScore(word.word, search);
          const definitionScore = calculateFuzzyScore(word.definition, search);
          return fuzzyScore > 0.6 || definitionScore > 0.6;
        });
        
        // Sort by fuzzy match score
        filteredWords.sort((a: WordEntry, b: WordEntry) => {
          const scoreA = Math.max(
            calculateFuzzyScore(a.word, search),
            calculateFuzzyScore(a.definition, search)
          );
          const scoreB = Math.max(
            calculateFuzzyScore(b.word, search),
            calculateFuzzyScore(b.definition, search)
          );
          return scoreB - scoreA;
        });
      }
      
      // Ensure each word has a dateAdded field
      const wordsWithDates = filteredWords.map((word: WordEntry) => ({
        ...word,
        dateAdded: word.dateAdded || formatDate(new Date())
      }));
      
      setWords(wordsWithDates);
      
      // Update pagination info
      if (data.pagination) {
        setPagination({
          ...data.pagination,
          total: filteredWords.length,
          pages: Math.ceil(filteredWords.length / limit)
        });
      }
    } catch (error) {
      console.error('Error fetching words:', error);
      setError('Failed to load words. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchWords(currentPage, wordsPerPage, searchTerm);
  }, [currentPage, wordsPerPage, searchTerm]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'word') {
      // When word changes, update letterCount
      const count = value.length;
      const display = `[${count}]: ${Array(count).fill('_').join(' ')}`;
      setFormData({
        ...formData,
        word: value,
        letterCount: {
          count,
          display
        }
      });
    } else if (name === 'synonyms') {
      // Split comma-separated values into an array
      const synonymsArray = value.split(',').map(s => s.trim()).filter(s => s);
      setFormData({ ...formData, synonyms: synonymsArray });
    } else if (name === 'dateAdded') {
      // Validate date format
      setFormData({ ...formData, dateAdded: value });
    } else if (name === 'letterCount') {
      // Update letterCount display while keeping the count in sync with word length
      setFormData({
        ...formData,
        letterCount: {
          count: formData.word.length,
          display: value
        }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Start editing a word
  const handleEdit = (word: WordEntry) => {
    setSelectedWord(word);
    setFormData({
      ...word,
      synonyms: word.synonyms || [],
      dateAdded: word.dateAdded || formatDate(new Date())
    });
    setIsEditing(true);
    setIsAdding(false);
  };

  // Start adding a new word
  const handleAdd = () => {
    setSelectedWord(null);
    setFormData({
      word: '',
      partOfSpeech: '',
      definition: '',
      alternateDefinition: '',
      synonyms: [],
      dateAdded: formatDate(new Date()), // Default to today's date
      letterCount: {
        count: 0,
        display: '[0]: '
      }
    });
    setIsAdding(true);
    setIsEditing(false);
  };

  // Cancel editing or adding
  const handleCancel = () => {
    setIsEditing(false);
    setIsAdding(false);
    setSelectedWord(null);
    setError(null);
    setSuccessMessage(null);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWordsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page on limit change
  };

  // Add clear search function
  const handleClearSearch = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Save a new or updated word
  const handleSave = async () => {
    try {
      // Validate form data
      if (!formData.word || !formData.definition || !formData.partOfSpeech) {
        setError('Word, definition, and part of speech are required.');
        return;
      }
      
      // Validate date format
      if (formData.dateAdded && !isValidDate(formData.dateAdded)) {
        setError('Date must be in DD/MM/YY format.');
        return;
      }

      let response;
      
      if (isAdding) {
        // Add a new word
        response = await fetch('/api/admin/words', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } else if (isEditing && selectedWord) {
        // Update an existing word
        response = await fetch(`/api/admin/words/${selectedWord.word}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } else {
        setError('Invalid operation.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        // Display the specific error message from the server
        setError(errorData.error || `HTTP error! status: ${response.status}`);
        return;
      }

      const data = await response.json();
      
      // Reset form
      setIsEditing(false);
      setIsAdding(false);
      setSelectedWord(null);
      
      // Show success message
      setSuccessMessage(isAdding ? 'Word added successfully!' : 'Word updated successfully!');
      
      // Refresh the word list
      await fetchWords(currentPage, wordsPerPage, searchTerm);
    } catch (error) {
      console.error('Error saving word:', error);
      setError(error instanceof Error ? error.message : 'Failed to save word. Please try again.');
    }
  };

  // Delete a word
  const handleDelete = async (word: WordEntry) => {
    // Enhanced confirmation dialog
    if (!window.confirm(`⚠️ Delete Confirmation\n\nAre you sure you want to delete "${word.word}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/words/${word.word}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      // Show success message
      setSuccessMessage(`"${word.word}" was deleted successfully!`);
      
      // Refresh the word list
      await fetchWords(currentPage, wordsPerPage, searchTerm);
    } catch (error) {
      console.error('Error deleting word:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete word. Please try again.');
    }
  };

  // Handle back to game navigation
  const handleBackToGame = () => {
    navigate('/');
  };

  // Render loading state
  if (loading && words.length === 0) {
    return <div className="admin-panel loading">Loading words...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Word Management</h1>
        <button onClick={handleBackToGame} className="back-button">Back to Game</button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      
      <div className="admin-controls">
        <div className="search-controls">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search words, definitions..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          {searchTerm && (
            <button
              className="search-clear"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>
        <button onClick={handleAdd} disabled={isAdding || isEditing}>
          Add New Word
        </button>
      </div>
      
      {(isAdding || isEditing) && (
        <div className="word-form">
          <h2>{isAdding ? 'Add New Word' : 'Edit Word'}</h2>
          
          <div className="form-group">
            <label htmlFor="word">Word:</label>
            <input
              type="text"
              id="word"
              name="word"
              value={formData.word}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="partOfSpeech">Part of Speech:</label>
            <input
              type="text"
              id="partOfSpeech"
              name="partOfSpeech"
              value={formData.partOfSpeech}
              onChange={handleInputChange}
              placeholder="e.g., noun, verb, adjective"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="definition">Definition:</label>
            <textarea
              id="definition"
              name="definition"
              value={formData.definition}
              onChange={handleInputChange}
              rows={4}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="alternateDefinition">Alternate Definition (optional):</label>
            <textarea
              id="alternateDefinition"
              name="alternateDefinition"
              value={formData.alternateDefinition || ''}
              onChange={handleInputChange}
              rows={4}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="synonyms">Synonyms (comma-separated, optional):</label>
            <input
              type="text"
              id="synonyms"
              name="synonyms"
              value={formData.synonyms ? formData.synonyms.join(', ') : ''}
              onChange={handleInputChange}
              placeholder="e.g., happy, joyful, content"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="dateAdded">
              Daily Word Date (DD/MM/YY):
              <span className="field-note">
                * Currently for planning purposes only - not yet used in production
              </span>
            </label>
            <input
              type="text"
              id="dateAdded"
              name="dateAdded"
              value={formData.dateAdded || formatDate(new Date())}
              onChange={handleInputChange}
              placeholder="DD/MM/YY"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="letterCount">Letter Count Display:</label>
            <input
              type="text"
              id="letterCount"
              name="letterCount"
              value={formData.letterCount?.display || `[${formData.word.length}]: ${Array(formData.word.length).fill('_').join(' ')}`}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  letterCount: {
                    count: formData.word.length,
                    display: e.target.value
                  }
                });
              }}
              placeholder="[N]: _ _ _ _"
            />
          </div>
          
          <div className="form-actions">
            <button onClick={handleSave}>Save</button>
            <button onClick={handleCancel} className="cancel-button">Cancel</button>
          </div>
        </div>
      )}
      
      <div className="words-list">
        <h2>Words List</h2>
        
        {words.length === 0 ? (
          <p>No words found. {searchTerm ? 'Try a different search term or ' : ''}Add some words to get started.</p>
        ) : (
          <>
            <div className="table-controls">
              <div className="rows-per-page">
                <label>
                  Rows per page:
                  <select value={wordsPerPage} onChange={handleRowsPerPageChange}>
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </label>
              </div>
              
              {pagination && (
                <div className="pagination-info">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} words
                </div>
              )}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Word</th>
                  <th>Part of Speech</th>
                  <th># of Letters</th>
                  <th>Definition</th>
                  <th>Alt. Definition</th>
                  <th>
                    Daily Word Date
                    <div className="column-note">For planning only</div>
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {words.map((word, index) => (
                  <tr key={word.word}>
                    <td className="row-number">{((pagination?.page || 1) - 1) * (pagination?.limit || 10) + index + 1}</td>
                    <td>{word.word}</td>
                    <td>{word.partOfSpeech}</td>
                    <td>{word.letterCount?.count || word.word.length}</td>
                    <td>{word.definition}</td>
                    <td>{word.alternateDefinition || '—'}</td>
                    <td>{word.dateAdded || formatDate(new Date())}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleEdit(word)} 
                          className="edit-button" 
                          title="Edit this word"
                          aria-label="Edit word"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDelete(word)} 
                          className="delete-button"
                          title="Delete this word"
                          aria-label="Delete word"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {pagination && pagination.pages > 1 && (
              <div className="pagination-controls">
                <button 
                  onClick={() => handlePageChange(1)} 
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  &laquo; First
                </button>
                
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                  className="pagination-button"
                >
                  &lsaquo; Prev
                </button>
                
                <span className="page-indicator">
                  Page {pagination.page} of {pagination.pages}
                </span>
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === pagination.pages}
                  className="pagination-button"
                >
                  Next &rsaquo;
                </button>
                
                <button 
                  onClick={() => handlePageChange(pagination.pages)} 
                  disabled={currentPage === pagination.pages}
                  className="pagination-button"
                >
                  Last &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel; 