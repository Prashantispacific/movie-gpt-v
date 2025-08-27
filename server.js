const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    url: 'https://movie-gpt-v-pqsl.onrender.com',
    apis: {
      openrouter: !!OPENROUTER_API_KEY,
      tmdb: !!TMDB_API_KEY
    }
  });
});

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    openrouterKey: OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.substring(0, 8)}...` : 'MISSING',
    tmdbKey: TMDB_API_KEY ? `${TMDB_API_KEY.substring(0, 8)}...` : 'MISSING',
    nodeEnv: process.env.NODE_ENV,
    baseUrl: 'https://movie-gpt-v-pqsl.onrender.com',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Valid message is required' });
    }

    console.log('Processing message:', message);
    
    // Get movie data
    const movieData = await searchMovieData(message);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(message, movieData);
    
    // Generate suggestions
    const suggestions = generateSuggestions(message, movieData);
    
    res.json({
      response: aiResponse,
      movieData: movieData,
      suggestions: suggestions
    });
    
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error. Please try again! 🎬'
    });
  }
});

async function searchMovieData(query) {
  if (!TMDB_API_KEY) return null;
  
  try {
    const cleanQuery = extractMovieQuery(query);
    if (!cleanQuery) return null;
    
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: TMDB_API_KEY,
        query: cleanQuery,
        language: 'en-US'
      },
      timeout: 8000
    });
    
    if (response.data.results && response.data.results.length > 0) {
      const movie = response.data.results[0];
      
      const detailResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}`, {
        params: {
          api_key: TMDB_API_KEY,
          append_to_response: 'credits'
        },
        timeout: 8000
      });
      
      const details = detailResponse.data;
      
      return {
        title: details.title || 'Unknown',
        year: details.release_date ? new Date(details.release_date).getFullYear() : 'Unknown',
        rating: details.vote_average ? `${details.vote_average.toFixed(1)}/10` : 'N/A',
        genre: details.genres?.map(g => g.name).join(', ') || 'Unknown',
        director: details.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown',
        cast: details.credits?.cast?.slice(0, 4).map(c => c.name).join(', ') || 'Unknown',
        runtime: details.runtime ? `${details.runtime} min` : 'Unknown',
        plot: details.overview || 'No plot available.'
      };
    }
    
    return null;
  } catch (error) {
    console.error('TMDB Error:', error.message);
    return null;
  }
}

function extractMovieQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('movie') || lowerMessage.includes('film')) {
    return message
      .replace(/(?:tell me about|what about|movie|film|the movie|the film)/gi, '')
      .trim();
  }
  
  return message.trim();
}

// SIMPLIFIED DEBUG VERSION
async function generateAIResponse(message, movieData) {
  if (!OPENROUTER_API_KEY) {
    console.log('❌ No OpenRouter API key found');
    return 'Hi! I\'m MovieGPT. Ask me about any movie, actor, or get recommendations! 🎬';
  }
  
  try {
    // Create minimal, clean payload
    const payload = {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        {
          role: 'system',
          content: 'You are MovieGPT, a friendly movie assistant. Be helpful and concise.'
        },
        {
          role: 'user', 
          content: String(message) // Ensure it's a string
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    };

    // Log the exact payload being sent
    console.log('🔍 Payload being sent to OpenRouter:');
    console.log(JSON.stringify(payload, null, 2));
    
    // Headers with updated referer
    const headers = {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://movie-gpt-v-pqsl.onrender.com',
      'X-Title': 'MovieGPT'
    };
    
    console.log('📤 Sending request to OpenRouter...');
    
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
      headers: headers,
      timeout: 15000
    });
    
    console.log('✅ OpenRouter response received');
    
    const aiResponse = response.data.choices[0].message.content.trim();
    console.log('AI Response:', aiResponse);
    
    return aiResponse;
    
  } catch (error) {
    console.error('❌ OpenRouter Error Details:');
    console.error('Error message:', error.message);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
    
    // Return fallback message
    return `I'm having trouble connecting to my AI brain right now 🧠 But I'd love to help you with movies! Try asking about a specific film or actor.`;
  }
}

function generateSuggestions(message, movieData) {
  const suggestions = [];
  const lowerMessage = message.toLowerCase();
  
  if (movieData) {
    suggestions.push(
      `Similar movies to ${movieData.title}`,
      `Other ${movieData.director} films`,
      `Best ${movieData.genre} movies`,
      'Movie recommendations'
    );
  } else {
    if (lowerMessage.includes('horror') || lowerMessage.includes('scary')) {
      suggestions.push('Best horror movies 2024', 'Classic horror films', 'Horror recommendations');
    } else if (lowerMessage.includes('comedy')) {
      suggestions.push('Top comedies this year', 'Best comedy actors', 'Feel-good movies');
    } else if (lowerMessage.includes('action')) {
      suggestions.push('Best action movies', 'Marvel movies ranked', 'Action classics');
    } else {
      suggestions.push('Popular movies 2024', 'Oscar winners', 'Top-rated films', 'Movie night picks');
    }
  }
  
  return suggestions.slice(0, 4);
}

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT server running on port ${PORT}`);
  console.log(`🌐 URL: https://movie-gpt-v-pqsl.onrender.com`);
  console.log(`🔑 OpenRouter: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
