const express = require('express'); // Import Express.js framework
const axios = require('axios'); // Import Axios for making HTTP requests
const cors = require('cors'); // Import CORS middleware for cross-origin requests

const app = express(); // Create Express application instance
const PORT = process.env.PORT || 4000; // Set port from environment variable or default to 4000

// Enable CORS middleware
app.use(cors());

// Root endpoint - Returns API information and available endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Coding Contests API',
    endpoints: {
      '/contests': 'Get all active contests from Codeforces, LeetCode, and CodeChef',
      '/contests/codeforces': 'Get active Codeforces contests', 
      '/contests/leetcode': 'Get active LeetCode contests',
      '/contests/codechef': 'Get active CodeChef contests'
    }
  });
});

/**
 * Fetches active contests from Codeforces API
 * Filters for upcoming contests and formats the response
 */
async function fetchCodeforcesContests() {
  try {
    const response = await axios.get('https://codeforces.com/api/contest.list'); // Make GET request to Codeforces API
    
    if (response.data.status !== 'OK') {
      throw new Error('Failed to fetch Codeforces contests');
    }
    
    // Filter only active contests and map to standardized format
    const activeContests = response.data.result
      .filter(contest => contest.phase === 'BEFORE') // Get only upcoming contests
      .map(contest => ({
        platform: 'Codeforces',
        name: contest.name,
        startTimeUnix: contest.startTimeSeconds,
        startTime: new Date(contest.startTimeSeconds * 1000).toISOString(), // Convert unix timestamp to ISO string
        durationSeconds: contest.durationSeconds,
        duration: `${Math.floor(contest.durationSeconds / 3600)} hours ${(contest.durationSeconds % 3600) / 60} minutes`, // Format duration
        url: `https://codeforces.com/contests/${contest.id}` // Generate contest URL
      }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching Codeforces contests:', error.message);
    return []; // Return empty array on error
  }
}

/**
 * Fetches active contests from LeetCode GraphQL API
 * Filters for upcoming contests and formats the response
 */
async function fetchLeetcodeContests() {
  try {
    // GraphQL query to get contest information
    const graphqlQuery = {
      query: `
        query getContestList {
          allContests {
            title
            startTime
            duration
            titleSlug
          }
        }
      `
    };
    
    // Make POST request to LeetCode GraphQL API
    const response = await axios.post('https://leetcode.com/graphql', graphqlQuery, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const allContests = response.data.data.allContests;
    const now = Date.now(); // Get current timestamp
    
    // Filter upcoming contests and map to standardized format
    const activeContests = allContests
      .filter(contest => contest.startTime * 1000 > now) // Get only future contests
      .map(contest => ({
        platform: 'LeetCode',
        name: contest.title,
        startTimeUnix: contest.startTime,
        startTime: new Date(contest.startTime * 1000).toISOString(), // Convert unix timestamp to ISO string
        durationSeconds: contest.duration,
        duration: `${Math.floor(contest.duration / 3600)} hours ${(contest.duration % 3600) / 60} minutes`, // Format duration
        url: `https://leetcode.com/contest/${contest.titleSlug}` // Generate contest URL
      }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching LeetCode contests:', error.message);
    return []; // Return empty array on error
  }
}

/**
 * Fetches active contests from CodeChef API
 * Formats the response to match other platforms
 */
async function fetchCodechefContests() {
  try {
    const response = await axios.get('https://www.codechef.com/api/list/contests/all'); // Make GET request to CodeChef API
    
    if (!response.data.future_contests) {
      throw new Error('Failed to fetch CodeChef contests');
    }
    
    // Map contests to standardized format
    const activeContests = response.data.future_contests.map(contest => ({
      platform: 'CodeChef',
      name: contest.contest_name,
      code: contest.contest_code,
      startTimeUnix: Math.floor(new Date(contest.contest_start_date).getTime() / 1000), // Convert date to unix timestamp
      startTime: new Date(contest.contest_start_date).toISOString(),
      endTime: new Date(contest.contest_end_date).toISOString(),
      duration: calculateDuration(contest.contest_start_date, contest.contest_end_date), // Calculate duration between dates
      url: `https://www.codechef.com/${contest.contest_code}` // Generate contest URL
    }));
    
    return activeContests;
  } catch (error) {
    console.error('Error fetching CodeChef contests:', error.message);
    return []; // Return empty array on error
  }
}

/**
 * Calculates duration between two dates and formats it as hours and minutes
 */
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate); // Convert start date string to Date object
  const end = new Date(endDate); // Convert end date string to Date object
  const durationSeconds = Math.floor((end - start) / 1000); // Get duration in seconds
  
  return `${Math.floor(durationSeconds / 3600)} hours ${(durationSeconds % 3600) / 60} minutes`; // Format as hours and minutes
}

// Endpoint to get all active contests from all platforms
app.get('/contests', async (req, res) => {
  try {
    // Fetch contests from all platforms in parallel
    const [codeforces, leetcode, codechef] = await Promise.all([
      fetchCodeforcesContests(),
      fetchLeetcodeContests(),
      fetchCodechefContests()
    ]);
    
    // Combine and sort all contests by start time
    const allContests = [...codeforces, ...leetcode, ...codechef].sort((a, b) => a.startTimeUnix - b.startTimeUnix);
    
    res.json({
      status: 'success',
      count: allContests.length,
      data: allContests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get only Codeforces contests
app.get('/contests/codeforces', async (req, res) => {
  try {
    const contests = await fetchCodeforcesContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get only LeetCode contests
app.get('/contests/leetcode', async (req, res) => {
  try {
    const contests = await fetchLeetcodeContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Endpoint to get only CodeChef contests
app.get('/contests/codechef', async (req, res) => {
  try {
    const contests = await fetchCodechefContests();
    
    res.json({
      status: 'success',
      count: contests.length,
      data: contests
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
