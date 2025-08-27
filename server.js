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
    apis: {
      openrouter: !!OPENROUTER_API_KEY,
      tmdb: !!TMDB_API_KEY
    }
  });
});

// Chat endpoint - FIXED
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
      const movie = response.data.results;
      
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

// FIXED: Proper OpenRouter API call
async function generateAIResponse(message, movieData) {
  if (!OPENROUTER_API_KEY) {
    return 'Hi! I\'m MovieGPT. Ask me about any movie, actor, or get recommendations! 🎬';
  }
  
  try {
    // Build proper messages array - FIXED FORMATTING
    const messages = [
      {
        role: 'system',
        content: 'You are MovieGPT, a friendly and enthusiastic movie assistant. Be helpful, add some humor, and encourage movie discovery. Keep responses conversational and under 200 words.'
      }
    ];

    // Build user message with movie context if available
    let userContent = `User asked: "${message}"`;
    
    if (movieData) {
      userContent += `\n\nMovie information found:
- ${movieData.title} (${movieData.year})
- Rating: ${movieData.rating}
- Genre: ${movieData.genre}
- Director: ${movieData.director}
- Cast: ${movieData.cast}
- Plot: ${movieData.plot}

Please provide an enthusiastic response about this movie with interesting insights.`;
    } else {
      userContent += `\n\nPlease help with movie recommendations, information about actors/directors, or general movie trivia. Be enthusiastic and engaging!`;
    }

    messages.push({
      role: 'user',
      content: userContent // FIXED: Ensure content is always a string
    });

    console.log('Sending to OpenRouter:', JSON.stringify({ messages }, null, 2));
    
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: messages, // FIXED: Properly formatted messages
      max_tokens: 250,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://movie-gpt-v.onrender.com',
        'X-Title': 'MovieGPT'
      },
      timeout: 15000
    });
    
    return response.data.choices.message.content.trim();
    
  } catch (error) {
    console.error('OpenRouter Error:', error.response?.data || error.message);
    
    if (movieData) {
      return `Great choice! ${movieData.title} (${movieData.year}) is a fantastic ${movieData.genre} film directed by ${movieData.director}. It has a ${movieData.rating} rating and features an amazing cast including ${movieData.cast}. What would you like to know more about? 🎬`;
    }
    
    return 'I\'m having trouble with my AI brain right now 🧠 But I\'d love to help you discover amazing movies! Try asking about a specific film, actor, or genre.';
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
  console.log(`🔑 OpenRouter: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
