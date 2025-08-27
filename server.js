import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'https://moviegpt.rf.gd',
    'http://moviegpt.rf.gd',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500'
  ],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Movie-focused persona (based on your reference structure)
const moviePersona = {
  name: "MovieGPT Assistant",
  model: "meta-llama/llama-3.1-8b-instruct:free",
  temperature: 0.7,
  system_prompt: `You are MovieGPT, a friendly and enthusiastic movie assistant.

FOLLOW-UP BEHAVIOR (like ChatGPT):
- Ask thoughtful follow-up questions about movie preferences
- Reference previous conversation naturally: "Earlier you mentioned...", "Based on your interest in..."
- Show genuine curiosity: "What genres do you usually enjoy?", "Any particular decade of movies?"
- Be encouraging and provide personalized recommendations

PERSONALITY:
- Warm, enthusiastic tone about movies and entertainment
- Use phrases like "Great choice!", "I'd recommend...", "You might also enjoy..."
- Format responses with clear structure using emojis and bullet points
- Always maintain a helpful, professional yet friendly demeanor

MOVIE EXPERTISE:
- Provide detailed movie information including cast, director, ratings, plot
- Offer personalized recommendations based on user preferences
- Share interesting trivia and behind-the-scenes facts
- Help users discover new movies across all genres and eras

Remember our entire conversation history and build meaningful movie discovery experiences.`
};

// Status endpoint (following your reference pattern)
app.get("/", (req, res) => {
  res.json({
    status: "MovieGPT Backend is running",
    timestamp: new Date().toISOString(),
    hasOpenRouterKey: !!OPENROUTER_API_KEY,
    hasTMDBKey: !!TMDB_API_KEY,
    frontend: "https://moviegpt.rf.gd",
    persona: moviePersona.name
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "MovieGPT API is working!",
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint (enhanced with your reference patterns)
app.post("/api/chat", async (req, res) => {
  const { message, messages } = req.body;

  // Input validation (from your reference)
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    // Get movie data from TMDB first
    const movieData = await searchMovieData(message);

    // Build conversation with history (from your reference approach)
    let conversationMessages = [];

    // Add system message (persona)
    conversationMessages.push({
      role: "system",
      content: moviePersona.system_prompt
    });

    // Add conversation history if provided (key for follow-up questions)
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Filter valid messages and add to conversation
      const validMessages = messages.filter(msg =>
        msg.role && msg.content &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        msg.content.trim().length > 0
      );
      conversationMessages.push(...validMessages);
    }

    // Add current message
    conversationMessages.push({
      role: "user",
      content: message
    });

    console.log(`Sending to OpenRouter: ${conversationMessages.length} messages`);

    // OpenRouter API call (using your reference pattern)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://moviegpt.rf.gd",
        "X-Title": "MovieGPT"
      },
      body: JSON.stringify({
        model: moviePersona.model,
        messages: conversationMessages,
        max_tokens: 1000,
        temperature: moviePersona.temperature,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      
      // Fallback response when API fails
      const fallbackResponse = generateFallbackResponse(message, movieData);
      return res.json({
        response: fallbackResponse,
        movieData: movieData,
        suggestions: generateSuggestions(message, movieData),
        fallback: true
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    res.json({
      response: reply,
      movieData: movieData,
      suggestions: generateSuggestions(message, movieData),
      model: moviePersona.model
    });

  } catch (err) {
    console.error("Chat error:", err);
    
    // Fallback when everything fails
    const movieData = await searchMovieData(message);
    const fallbackResponse = generateFallbackResponse(message, movieData);
    
    res.json({
      response: fallbackResponse,
      movieData: movieData,
      suggestions: generateSuggestions(message, movieData),
      error: true
    });
  }
});

// TMDB movie search function
async function searchMovieData(query) {
  if (!TMDB_API_KEY) return null;
  
  try {
    const cleanQuery = extractMovieQuery(query);
    if (!cleanQuery) return null;
    
    const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}&language=en-US`, {
      method: 'GET',
      timeout: 8000
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      
      const detailResponse = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`, {
        method: 'GET',
        timeout: 8000
      });
      
      if (!detailResponse.ok) return null;
      
      const details = await detailResponse.json();
      
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

// Extract movie query from user message
function extractMovieQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('movie') || lowerMessage.includes('film')) {
    return message
      .replace(/(?:tell me about|what about|movie|film|the movie|the film)/gi, '')
      .trim();
  }
  
  return message.trim();
}

// Generate fallback response when AI fails
function generateFallbackResponse(message, movieData) {
  if (movieData) {
    return `Great choice! **${movieData.title}** (${movieData.year}) is a fantastic ${movieData.genre} film directed by ${movieData.director}. 

🌟 **Rating**: ${movieData.rating}
🎭 **Cast**: ${movieData.cast}
⏱️ **Runtime**: ${movieData.runtime}

${movieData.plot}

This movie is definitely worth watching! What would you like to know more about?`;
  }
  
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
  
  return `🎬 Hi there! I'm MovieGPT, your friendly movie assistant. I can help you with:

• **Movie recommendations** based on your mood
• **Information** about actors, directors, and films
• **Reviews and ratings** to help you decide what to watch
• **Fun movie trivia** and behind-the-scenes facts

Try asking me about a specific movie, actor, or tell me what genre you're in the mood for! 🍿`;
}

// Generate suggestion buttons
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

// Serve static files for frontend (if index.html exists)
app.use(express.static(path.resolve('.')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  const indexPath = path.resolve('.', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not found. Please deploy frontend separately.' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT Backend running on port ${PORT}`);
  console.log(`🌐 Frontend: https://moviegpt.rf.gd`);
  console.log(`🔑 OpenRouter: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
