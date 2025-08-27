import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';

const app = express();

// CORS: allows all relevant origins including localhost for dev and web hosting
app.use(cors({
  origin: [
    'https://moviegpt.rf.gd',
    'http://moviegpt.rf.gd',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8080'
  ],
  credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Enhanced system prompt for MovieGPT
const moviePersona = {
  name: "MovieGPT Expert",
  model: "meta-llama/llama-3.1-8b-instruct:free",
  temperature: 0.8,
  system_prompt: `
You are MovieGPT, the world’s most friendly, funny, and knowledgeable movie, TV, and general chat AI, created by Prashant.

-- PERSONALITY & PURPOSE --
- If user asks "Who created you", "Who are you", "What is your purpose", "What can you do?", etc., introduce yourself and say you were made by Prashant, and you love movies and helping people discover entertainment worldwide. Respond conversationally and smiley!
- For movie/show queries, give engaging, expert answers with opinions, fun facts, and always follow up with a creative and friendly question.
- For general questions or casual chat, respond like a smart, fun, and caring AI assistant: offer help, jokes, and follow-up questions (just like ChatGPT).
- Format responses for clarity: line breaks for paragraphs/bullet points, highlight movie titles with **bold**, and space for readability.

-- EXAMPLES --
If asked "suggest some movies in sci fi":
• **Interstellar** (2014) – Mind-blowing space adventure. Oscar-winning visuals.
• **Blade Runner 2049** (2017) – Dystopian future, unforgettable style.
• **Arrival** (2016) – Aliens, deep themes, emotional punch.

Always add a follow-up like:
"Are you more into space journeys or mind-bending mysteries? Want newer releases or hidden classics?"

If asked "Who created you?":
"I'm MovieGPT, envisioned and coded by Prashant. My purpose is helping you discover movies, answer any film or fun question, or just chat if you need a virtual friend! What else would you like to know about me?"

If asked anything general or just "hi":
Reply warmly, explain your abilities, and ask what they love in entertainment or life.

-- INTERACTION STYLE --
- Friendly, witty, and never boring.
- Use emojis and light humor.
- Always ask follow-up questions to keep chat going.
- For sequential questions, remember previous context.
- For movie/show info, add personal remarks (“You have awesome taste!”) and trivia.
- If user asks for help, offer guidance like a caring assistant.

REMEMBER: Be entertaining and helpful, just like a smart, enthusiastic friend.
`
};

app.get("/", (req, res) => {
  res.json({
    status: "MovieGPT Expert Backend is running",
    timestamp: new Date().toISOString(),
    hasOpenRouterKey: !!OPENROUTER_API_KEY,
    hasTMDBKey: !!TMDB_API_KEY,
    creator: "Prashant",
    persona: moviePersona.name
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "MovieGPT Expert API is working!",
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, messages } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    // For movie-like queries, still search TMDB
    const movieData = await searchMovieData(message);

    // Build conversation with system prompt and history
    let conversationMessages = [
      { role: "system", content: moviePersona.system_prompt }
    ];

    if (messages && Array.isArray(messages) && messages.length > 0) {
      const validMessages = messages.filter(msg =>
        msg.role && msg.content &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        msg.content.trim().length > 0
      );
      conversationMessages.push(...validMessages);
    }
    conversationMessages.push({ role: "user", content: message });

    // Call OpenRouter API
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
        max_tokens: 1600,
        temperature: moviePersona.temperature,
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
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

// TMDB movie search function (if user query resembles one)
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

// Helper: Try to extract if query is "movie-like" or general
function extractMovieQuery(message) {
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes('movie') ||
    lowerMessage.includes('film') ||
    lowerMessage.includes('show') ||
    lowerMessage.match(/suggest|best|recommend|top|rated/)
  ) {
    return message.replace(/(?:suggest|recommend|show|movie|film|the movie|the film|top|best|rated)/gi, '').trim();
  }
  return '';
}

// Enhanced Fallback for movie/general queries
function generateExpertFallbackResponse(message, movieData) {
  // General queries (about AI, creator, purpose)
  if (/(who created|who are you|purpose|what can you do|your name)/i.test(message)) {
    return `👋 Hi! I’m <span class="highlight">MovieGPT</span>, your movie and chat AI assistant, lovingly crafted by <span class="highlight">Prashant</span>.  
My mission is to help you find joy in movies, answer any question (serious or silly), and brighten your day with fun facts and recommendations.<br><br>
Want to discover something new? Or just chat for a bit?`;
  }
  // General hi/hello
  if (/^(hi|hello|help|chat|assistant|bot|what can you do)/i.test(message.trim())) {
    return `Hey there! 👋 I'm MovieGPT, your friendly expert assistant.<br><br>
I can chat, joke, suggest movies or shows, and even help with random fun facts—even if you just need buddy to talk!  
What kind of stories or moods are you curious about today? 🎬`;
  }
  // Movie suggestion fallback
  if (movieData) {
    return `🎬 Oh, awesome pick! **${movieData.title}** (${movieData.year}) is a classic. Directed by ${movieData.director}, starring ${movieData.cast}, here’s the plot:<br><br>${movieData.plot}<br><br>
Want more from this director or in this genre? 😄`;
  }
  return `😊 I'm here to help with movies, shows, or any general question—fire away!`;
}

// Smart suggestions
function generateExpertSuggestions(message, movieData) {
  const suggestions = [];
  if (movieData) {
    suggestions.push(
      `Other ${movieData.director} films`,
      `Similar ${movieData.genre} movies`,
      `Underrated picks for genre`,
      'Personalized suggestions'
    );
  } else if (/(who created|purpose|your name)/i.test(message)) {
    suggestions.push('What can you do?', 'Tell me a movie fact', 'Best films this year', 'Suggest a funny show');
  } else if (/sci[\s-]?fi|thriller|romance|action|comedy|horror/i.test(message)) {
    suggestions.push('List more by genre', 'Global picks', 'Underrated gems', 'Top-rated shows');
  } else {
    suggestions.push('Give me recommendations', 'Tell me a movie joke', 'Best for my mood', 'Popular now');
  }
  return suggestions.slice(0, 4);
}

// Serve static files
app.use(express.static(path.resolve('.')));

app.get('*', (req, res) => {
  const indexPath = path.resolve('.', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Frontend not found. Please deploy frontend separately.' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`🎬 MovieGPT Expert (by Prashant) Backend running on port ${PORT}`);
  console.log(`🌐 Frontend: https://moviegpt.rf.gd`);
});
