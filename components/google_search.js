const axios = require('axios');

require('dotenv').config();

const API_KEY = process.env.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = process.env.SEARCH_ENGINE_ID;

async function googleSearch (query) {
  const endpoint = 'https://www.googleapis.com/customsearch/v1';
  const params = {
    key: API_KEY,
    cx: SEARCH_ENGINE_ID,
    q: query,
    num: 1,  // Number of results to return
  };

  try {
    const response = await axios.get(endpoint, { params });
    const data = response.data;

    // Process and return the data
    const link = data.items[0].link
    return link;
  } catch (error) {
    console.error('Error fetching data from Google Search API:', error);
  }
};

// Example usage
// googleSearch('Super.ru Можно ли есть одно и то же каждый день — отвечает нутрициолог');
module.exports = {
    googleSearch,
};

