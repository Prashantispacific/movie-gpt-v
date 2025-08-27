import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';

const app = express();

// CORS configuration - Added localhost:8080
app.use(cors({
  origin: [
    'https://moviegpt.rf.gd',
    'http://moviegpt.rf.gd',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:8080',        // ✅ Added for your local server
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080'         // ✅ Added IP version
  ],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// ✅ Enhanced Movie Expert Persona
const moviePersona = {
  name: "MovieGPT Expert",
  model: "meta-llama/llama-3.1-8b-instruct:free",
  temperature: 0.8,  // Higher for more creativity and humor
  system_prompt: `You are MovieGPT, the world's most entertaining and knowledgeable movie & TV show expert! You're like having a film-obsessed best friend who's watched EVERYTHING.

PERSONALITY & STYLE:
🎬 **Movie Buff Supreme**: You know films from Hollywood blockbusters to obscure international gems
📺 **TV Show Connoisseur**: From Netflix originals to classic sitcoms, you've binged them all
😄 **Humorous & Fun**: Use movie puns, witty references, and light humor in conversations
🌟 **Enthusiastic**: Get excited about great films! Use emojis and expressive language
🤔 **Curious**: Ask follow-up questions like "What mood are you in?" or "Seen any good thrillers lately?"

EXPERTISE AREAS:
• **Global Cinema**: Hollywood, Bollywood, K-dramas, European cinema, anime, documentaries
• **All Genres**: From superhero epics to indie dramas, horror to rom-coms
• **TV Shows**: Series from all platforms (Netflix, HBO, Disney+, etc.)
• **Hidden Gems**: Recommend underrated movies people should discover
• **Personalized Picks**: Tailor suggestions based on user's taste and mood

CONVERSATION STYLE (Like ChatGPT):
- Ask engaging follow-ups: "Since you loved that thriller, have you tried any Korean films?"
- Reference previous chat: "Earlier you mentioned liking sci-fi, so here's something different..."
- Be genuinely curious: "What's your guilty pleasure genre?" "Any actors you can't stand?"
- Share fun trivia: "Fun fact: Did you know that movie was actually filmed in..."
- Use humor: "If you want to cry, I've got tissues and tear-jerkers ready!"

RESPONSE FORMAT:
• Start with enthusiasm and relevant emojis
• Give detailed, passionate recommendations
• Include fun facts or behind-the-scenes info
• End with engaging questions to continue conversation
• Use movie quotes occasionally (but don't overdo it)

Remember: You're not just answering questions - you're having an exciting conversation about the amazing world of movies and shows! Make every interaction feel like chatting with a knowledgeable, funny friend who genuinely cares about helping them find their next favorite watch.`
};

// Status endpoint
app.get("/", (req, res) => {
  res.json({
    status: "MovieGPT Expert Backend is running",
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
    message: "MovieGPT Expert API is working!",
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// Main chat endpoint
app.post("/api/chat", async (req, res) => {
  const { message, messages } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    // Get movie data from TMDB first
    const movieData = await searchMovieData(message);

    // Build conversation with history
    let conversationMessages = [];
    conversationMessages.push({
      role: "system",
      content: moviePersona.system_prompt
    });

    // Add conversation history if provided
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const validMessages = messages.filter(msg =>
        msg.role && msg.content &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        msg.content.trim().length > 0
      );
      conversationMessages.push(...validMessages);
    }

    conversationMessages.push({
      role: "user",
      content: message
    });

    console.log(`Sending to OpenRouter: ${conversationMessages.length} messages`);

    // OpenRouter API call
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://moviegpt.rf.gd",
        "X-Title": "MovieGPT Expert"
      },
      body: JSON.stringify({
        model: moviePersona.model,
        messages: conversationMessages,
        max_tokens: 1500,  // Increased for more detailed responses
        temperature: moviePersona.temperature,
        presence_penalty: 0.2,  // Encourage more varied topics
        frequency_penalty: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      
      // Enhanced fallback response
      const fallbackResponse = generateExpertFallbackResponse(message, movieData);
      return res.json({
        response: fallbackResponse,
        movieData: movieData,
        suggestions: generateExpertSuggestions(message, movieData),
        fallback: true
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ||
      "Sorry, I couldn't generate a response.";

    res.json({
      response: reply,
      movieData: movieData,
      suggestions: generateExpertSuggestions(message, movieData),
      model: moviePersona.model
    });

  } catch (err) {
    console.error("Chat error:", err);
    
    const movieData = await searchMovieData(message);
    const fallbackResponse = generateExpertFallbackResponse(message, movieData);
    
    res.json({
      response: fallbackResponse,
      movieData: movieData,
      suggestions: generateExpertSuggestions(message, movieData),
      error: true
    });
  }
});

// TMDB movie search function (same as before)
async function searchMovieData(query) {
  if (!TMDB_API_KEY) return null;
  
  try {
    const cleanQuery = extractMovieQuery(query);
    if (!cleanQuery) return null;
    
    const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanQuery)}&language=en-US`, {
      method: 'GET'
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const movie = data.results[0];
      
      const detailResponse = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`, {
        method: 'GET'
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

function extractMovieQuery(message) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('movie') || lowerMessage.includes('film') || lowerMessage.includes('show')) {
    return message
      .replace(/(?:tell me about|what about|movie|film|show|the movie|the film|the show)/gi, '')
      .trim();
  }
  
  return message.trim();
}

// ✅ Enhanced Expert Fallback Response
function generateExpertFallbackResponse(message, movieData) {
  if (movieData) {
    return `🎬 Oh fantastic! **${movieData.title}** (${movieData.year}) is absolutely brilliant! This ${movieData.genre} masterpiece directed by ${movieData.director} is pure cinematic gold! ⭐

🌟 **Rating**: ${movieData.rating} (and totally deserved!)
🎭 **Stellar Cast**: ${movieData.cast}
⏱️ **Runtime**: ${movieData.runtime}

${movieData.plot}

This one's a real gem! 💎 Have you seen any other films by ${movieData.director}? Or are you in the mood for similar ${movieData.genre} vibes? I've got tons more where that came from! 😄`;
  }
  
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('horror') || lowerMessage.includes('scary')) {
    return `🎃 Oooh, a fellow horror enthusiast! *rubs hands together* I LIVE for spine-chilling recommendations! Here are some absolute screamers:

🔥 **Modern Masterpieces**:
• **Hereditary** (2018) - Will mess with your head for WEEKS! 😱
• **The Wailing** (2016) - Korean horror that'll haunt your dreams
• **Midsommar** (2019) - Daylight terror like you've never seen

🏚️ **Classic Chillers**:
• **The Conjuring** (2013) - James Wan's terrifying perfection
• **Get Out** (2017) - Social thriller that'll blow your mind

What kind of scares get your heart racing? Psychological mind-benders? Jump scares? Or maybe some international horror gems? 👻💀`;
  }
  
  if (lowerMessage.includes('comedy') || lowerMessage.includes('funny')) {
    return `😂 YES! Comedy is life! *chef's kiss* I've got the perfect prescription for some belly laughs:

🤣 **Laugh-Till-You-Cry Picks**:
• **The Grand Budapest Hotel** (2014) - Wes Anderson's whimsical perfection
• **Hunt for the Wilderpeople** (2016) - New Zealand's heartwarming gem
• **Knives Out** (2019) - Murder mystery with impeccable wit

🎭 **International Laughs**:
• **Parasite** (2019) - Dark comedy brilliance from Korea
• **What We Do in the Shadows** (2014) - Vampire mockumentary gold

Are you more into witty British humor, slapstick shenanigans, or maybe some dark comedy that makes you question your morals while giggling? 🎪✨`;
  }
  
  if (lowerMessage.includes('action') || lowerMessage.includes('adventure')) {
    return `💥 BOOM! Action time! *explosion sounds* Get ready for some adrenaline-pumping recommendations:

🚗 **High-Octane Thrills**:
• **Mad Max: Fury Road** (2015) - Non-stop vehicular madness!
• **John Wick** series - Keanu Reeves being absolutely legendary
• **The Raid** (2011) - Indonesian martial arts perfection

🌏 **Global Action Heroes**:
• **Train to Busan** (2016) - Zombie action with ALL the feels
• **Oldboy** (2003) - Korean revenge thriller masterpiece

Do you prefer gun-blazing shootouts, martial arts choreography, or maybe some sci-fi action with mind-bending plots? Let's find your perfect adrenaline rush! 🎯🔥`;
  }
  
  return `🎬 Hey there, fellow movie lover! Welcome to your new favorite obsession - I'm MovieGPT, and I'm basically a walking, talking encyclopedia of EVERYTHING film and TV! 🍿

I'm here to be your personal cinema guru for:

✨ **Movie Recommendations** - From blockbusters to hidden gems
🌍 **Global Cinema** - Hollywood, Bollywood, K-dramas, you name it!
📺 **Binge-Worthy Shows** - Netflix, HBO, Disney+, all platforms covered
🎭 **Genre Deep-Dives** - Horror, comedy, action, romance, documentaries
🏆 **Award Winners & Cult Classics** - The best of the best

So, what's your vibe today? Feeling adventurous for something new, or want to dive deep into a favorite genre? Maybe you've got a specific actor you're obsessed with? 

Come on, let's find your next favorite watch! What gets your movie heart racing? 🎪❤️`;
}

// ✅ Enhanced Expert Suggestions
function generateExpertSuggestions(message, movieData) {
  const suggestions = [];
  const lowerMessage = message.toLowerCase();
  
  if (movieData) {
    suggestions.push(
      `More ${movieData.director} masterpieces`,
      `Hidden ${movieData.genre} gems`,
      `International films like ${movieData.title}`,
      `Binge-worthy TV shows for me`
    );
  } else {
    if (lowerMessage.includes('horror')) {
      suggestions.push('International horror gems', 'Psychological thrillers', 'Horror comedy mashups', 'Classic monster movies');
    } else if (lowerMessage.includes('comedy')) {
      suggestions.push('Dark comedy masterpieces', 'International comedies', 'Comedy shows to binge', 'Romantic comedies that don\'t suck');
    } else if (lowerMessage.includes('action')) {
      suggestions.push('Underrated action gems', 'Foreign action films', 'Action TV series', 'Superhero deep cuts');
    } else {
      suggestions.push('Hidden gems you\'ve never heard of', 'Best movies of 2024', 'Binge-worthy series recommendations', 'Movies based on my mood');
    }
  }
  
  return suggestions.slice(0, 4);
}

// Serve static files
app.use(express.static(path.resolve('.')));

// Catch-all route
app.get('*', (req, res) => {
  const indexPath = path.resolve('.', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not found. Please deploy frontend separately.' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT Expert Backend running on port ${PORT}`);
  console.log(`🌐 Frontend: https://moviegpt.rf.gd`);
  console.log(`🔑 OpenRouter: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🎭 TMDB: ${TMDB_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
});
