const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables (will be set in Render dashboard)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log('Processing message:', message);
    
    // Get movie data from TMDB if relevant
    const movieData = await searchMovieData(message);
    
    // Generate AI response using OpenRouter
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
      error: 'Sorry, I encountered an error. Please try again!',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

async function searchMovieData(query) {
  if (!TMDB_API_KEY) {
    console.warn('TMDB_API_KEY not configured');
    return null;
  }
  
  try {
    // Extract movie/actor names from query
    const searchTerms = extractMovieQuery(query);
    if (!searchTerms) return null;
    
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: {
        api_key: TMDB_API_KEY,
        query: searchTerms,
        language: 'en-US',
        page: 1
      },
      timeout: 5000
    });
    
    if (response.data.results && response.data.results.length > 0) {
      const movie = response.data.results[0];
      
      // Get detailed movie info
      const detailResponse = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}`, {
        params: {
          api_key: TMDB_API_KEY,
          append_to_response: 'credits'
        },
        timeout: 5000
      });
      
      const details = detailResponse.data;
      
      return {
        title: details.title,
        year: details.release_date ? new Date(details.release_date).getFullYear() : 'Unknown',
        rating: details.vote_average ? details.vote_average.toFixed(1) + '/10' : 'N/A',
        genre: details.genres?.map(g => g.name).join(', ') || 'Unknown',
        director: details.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown',
        cast: details.credits?.cast?.slice(0, 5).map(c => c.name).join(', ') || 'Unknown',
        runtime: details.runtime ? `${details.runtime} min` : 'Unknown',
        plot: details.overview || 'No plot available.'
      };
    }
    
    return null;
  } catch (error) {
    console.error('TMDB API Error:', error.message);
    return null;
  }
}

function extractMovieQuery(message) {
  // Simple extraction logic - you can make this more sophisticated
  const lowerMessage = message.toLowerCase();
  
  // Look for movie-related keywords
  const movieKeywords = ['movie', 'film', 'about', 'tell me about', 'watched', 'seen'];
  const hasMovieContext = movieKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (hasMovieContext) {
    // Remove common words and extract potential movie title
    const cleanQuery = message
      .replace(/(?:tell me about|what about|movie|film|the movie|the film)/gi, '')
      .trim();
    
    return cleanQuery || null;
  }
  
  return null;
}

async function generateAIResponse(message, movieData) {
  if (!OPENROUTER_API_KEY) {
    console.warn('OPENROUTER_API_KEY not configured');
    return 'Hi! I\'m MovieGPT. Ask me about any movie, actor, or get recommendations!';
  }
  
  try {
    let prompt;
    
    if (movieData) {
      prompt = `User asked: "${message}". 

Movie data found:
- Title: ${movieData.title} (${movieData.year})
- Rating: ${movieData.rating}
- Genre: ${movieData.genre}
- Director: ${movieData.director}
- Cast: ${movieData.cast}
- Plot: ${movieData.plot}

Respond as MovieGPT, a friendly movie assistant. Be enthusiastic, add some movie humor, and provide interesting insights about the movie or related recommendations.`;
    } else {
      prompt = `User asked: "${message}". 

Respond as MovieGPT, a friendly movie assistant. Help with movie recommendations, information about actors/directors, or general movie trivia. Be enthusiastic and engaging!`;
    }
    
    const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        {
          role: 'system',
          content: 'You are MovieGPT, a friendly and enthusiastic movie assistant. Be helpful, add some humor, and encourage movie discovery. Keep responses conversational and under 200 words.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 250,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app-name.onrender.com',
        'X-Title': 'MovieGPT'
      },
      timeout: 10000
    });
    
    return response.data.choices[0].message.content.trim();
    
  } catch (error) {
    console.error('OpenRouter API Error:', error.message);
    
    if (movieData) {
      return `Great choice! ${movieData.title} (${movieData.year}) is a fantastic ${movieData.genre} film directed by ${movieData.director}. The movie has a ${movieData.rating} rating and features an amazing cast including ${movieData.cast}. What would you like to know more about?`;
    }
    
    return 'I\'m having trouble with my AI brain right now 🧠 But I\'d love to help you discover some amazing movies! Try asking about a specific film or actor.';
  }
}

function generateSuggestions(message, movieData) {
  const suggestions = [];
  
  if (movieData) {
    suggestions.push(
      `Similar movies to ${movieData.title}`,
      `More ${movieData.director} films`,
      `Best ${movieData.genre} movies`,
      'Movie recommendations for tonight'
    );
  } else {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('horror') || lowerMessage.includes('scary')) {
      suggestions.push('Best horror movies 2024', 'Classic horror films', 'Horror movie recommendations');
    } else if (lowerMessage.includes('comedy') || lowerMessage.includes('funny')) {
      suggestions.push('Top comedies this year', 'Best comedy actors', 'Feel-good movies');
    } else if (lowerMessage.includes('action')) {
      suggestions.push('Best action movies', 'Marvel movies ranked', 'Action movie classics');
    } else {
      suggestions.push(
        'Popular movies this year',
        'Oscar winners 2024',
        'Top-rated films',
        'Movie recommendations'
      );
    }
  }
  
  return suggestions.slice(0, 4);
}

// Serve the frontend for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT server running on port ${PORT}`);
  console.log(`🔑 OpenRouter API: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB API: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
