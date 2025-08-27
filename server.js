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

// Serve static files from current directory (NOT public folder)
app.use(express.static(__dirname));

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

// [Your existing functions: searchMovieData, extractMovieQuery, generateAIResponse, generateSuggestions remain the same]

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

// TEMPORARY FALLBACK - No OpenRouter dependency
async function generateAIResponse(message, movieData) {
  console.log('🎬 Processing message:', message);
  
  // If we have movie data, create a response about it
  if (movieData) {
    return `Great choice! **${movieData.title}** (${movieData.year}) is a fantastic ${movieData.genre} film directed by ${movieData.director}. 

🌟 **Rating**: ${movieData.rating}
🎭 **Cast**: ${movieData.cast}
⏱️ **Runtime**: ${movieData.runtime}

${movieData.plot}

This movie is definitely worth watching! What would you like to know more about?`;
  }
  
  // General movie responses based on keywords
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('horror') || lowerMessage.includes('scary')) {
    return `🎃 Love horror movies? Here are some spine-chilling recommendations:

• **The Conjuring** (2013) - Classic supernatural horror
• **Hereditary** (2018) - Psychological terror at its finest  
• **Get Out** (2017) - Brilliant social thriller
• **The Babadook** (2014) - Australian psychological horror

What type of scares are you in the mood for? 👻`;
  }
  
  if (lowerMessage.includes('comedy') || lowerMessage.includes('funny')) {
    return `😂 Need a good laugh? Check out these comedies:

• **The Grand Budapest Hotel** (2014) - Wes Anderson's whimsical masterpiece
• **Knives Out** (2019) - Murder mystery with perfect comedy timing
• **Parasite** (2019) - Dark comedy that won Best Picture
• **Hunt for the Wilderpeople** (2016) - Heartwarming New Zealand adventure

What kind of humor makes you laugh? 🎭`;
  }
  
  if (lowerMessage.includes('action')) {
    return `💥 Action-packed recommendations coming up:

• **Mad Max: Fury Road** (2015) - Non-stop vehicular mayhem
• **John Wick** (2014) - Stylish revenge thriller
• **Mission: Impossible - Fallout** (2018) - Tom Cruise at his most daring
• **The Raid** (2011) - Indonesian martial arts masterpiece

Ready for some adrenaline? 🚗💨`;
  }
  
  // Default response
  return `🎬 Hi there! I'm MovieGPT, your friendly movie assistant. I can help you with:

• **Movie recommendations** based on your mood
• **Information** about actors, directors, and films
• **Reviews and ratings** to help you decide what to watch
• **Fun movie trivia** and behind-the-scenes facts

Try asking me about a specific movie, actor, or tell me what genre you're in the mood for! 🍿

What kind of movie experience are you looking for today?`;
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

// Serve index.html for all other routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT server running on port ${PORT}`);
  console.log(`🌐 URL: https://movie-gpt-v-pqsl.onrender.com`);
  console.log(`🔑 OpenRouter: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
