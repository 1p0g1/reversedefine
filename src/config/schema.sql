-- Create the WORDS table
CREATE TABLE IF NOT EXISTS WORDS (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    WORD VARCHAR(255) NOT NULL,
    DEFINITION TEXT NOT NULL,
    PART_OF_SPEECH VARCHAR(50) NOT NULL,
    TIMES_USED NUMBER DEFAULT 0,
    LAST_USED_DATE TIMESTAMP_NTZ,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    UPDATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (ID)
);

-- Create a clustering key on the WORD column
ALTER TABLE IF EXISTS WORDS CLUSTER BY (WORD);

-- Enable search optimization
ALTER TABLE IF EXISTS WORDS ADD SEARCH OPTIMIZATION;

-- Create a stream for tracking changes
CREATE STREAM IF NOT EXISTS WORDS_STREAM ON TABLE WORDS;

-- Create a task to update the UPDATED_AT timestamp
CREATE OR REPLACE TASK UPDATE_WORDS_TIMESTAMP
    WAREHOUSE = UNDEFINE
    SCHEDULE = '1 minute'
AS
    UPDATE WORDS
    SET UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE ID IN (
        SELECT ID 
        FROM WORDS_STREAM
        WHERE METADATA$ACTION = 'INSERT' OR METADATA$ACTION = 'UPDATE'
    );

-- Start the task
ALTER TASK UPDATE_WORDS_TIMESTAMP RESUME;

-- Create the LEADERBOARD table
CREATE TABLE IF NOT EXISTS LEADERBOARD (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    USERNAME VARCHAR(255) NOT NULL,
    WORD VARCHAR(255) NOT NULL,
    GUESSES INTEGER NOT NULL,
    COMPLETION_TIME_SECONDS INTEGER NOT NULL,
    USED_HINT BOOLEAN DEFAULT FALSE,
    COMPLETED BOOLEAN DEFAULT TRUE,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (ID)
);

-- Create the USER_STATS table
CREATE TABLE IF NOT EXISTS USER_STATS (
    USERNAME VARCHAR(255) NOT NULL,
    GAMES_PLAYED INTEGER DEFAULT 0,
    AVERAGE_GUESSES FLOAT DEFAULT 0,
    AVERAGE_TIME FLOAT DEFAULT 0,
    BEST_TIME INTEGER DEFAULT NULL,
    CURRENT_STREAK INTEGER DEFAULT 0,
    LONGEST_STREAK INTEGER DEFAULT 0,
    TOP_TEN_COUNT INTEGER DEFAULT 0,
    LAST_RESULT VARCHAR(10) DEFAULT NULL,
    LAST_UPDATED TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (USERNAME)
);

-- Create the GAME_METRICS table for tracking detailed game statistics
CREATE TABLE IF NOT EXISTS GAME_METRICS (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    GAME_ID VARCHAR(36) NOT NULL,
    USER_ID VARCHAR(255),
    WORD_ID VARCHAR(36) NOT NULL,
    GUESS VARCHAR(255) NOT NULL,
    IS_CORRECT BOOLEAN DEFAULT FALSE,
    IS_FUZZY BOOLEAN DEFAULT FALSE,
    GUESS_NUMBER INTEGER NOT NULL,
    GUESS_TIME_SECONDS INTEGER NOT NULL,
    HINTS_USED INTEGER DEFAULT 0,
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (ID)
);

-- Create an index on GAME_ID to optimize lookups
CREATE INDEX IF NOT EXISTS IDX_GAME_METRICS_GAME_ID ON GAME_METRICS(GAME_ID);

-- Create a view for fuzzy guess analysis
CREATE OR REPLACE VIEW FUZZY_GUESS_ANALYSIS AS
SELECT 
    WORD_ID,
    COUNT(*) AS TOTAL_FUZZY_GUESSES,
    AVG(GUESS_NUMBER) AS AVG_GUESS_NUMBER,
    COUNT(DISTINCT USER_ID) AS UNIQUE_USERS
FROM GAME_METRICS
WHERE IS_FUZZY = TRUE
GROUP BY WORD_ID; 