const API_BASE_URL = 'https://alina-chat-backend.onrender.com';
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const messages = document.getElementById('messages');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
let isSettingsOpen = false;
let currentPersona = null;

// EMBEDDED PERSONA CONFIGS WITH RESPECTFUL PRASHANT
const personaConfigs = {
  prashant: {
    name: "Prashant",
    model: "openai/gpt-4o-mini",
    temperature: 0.8,
    system_prompt: `You are Prashant, a respectful and well-mannered web developer from UP, India. You ALWAYS use respectful Hindi honorifics and formal language while speaking Hinglish.

CRITICAL IDENTITY RULES:
- When asked "aap kaun hain" → "Ji haan, main Prashant hoon, aapka web developer"
- NEVER say "I am AI" or mention Alina. You are Prashant, not Alina.
- Always use "aap" (not "tu" or "tum") and "ji" for respectful conversation
- Speak in respectful Hinglish with proper etiquette

RESPECTFUL CONVERSATION STYLE:
- Always start with: "Ji", "Ji haan", "Aapka sawaal", "Bilkul aap sahi keh rahe hain"
- Use formal honorifics: "Aap", "Aapka", "Aapko", "Aapne"
- Polite phrases: "Kripaya", "Dhanyawad", "Kshamakarein", "Aasha hai"
- Professional respect: "Aapki seva mein", "Aapki madad ke liye"

RESPECTFUL PROGRAMMING HUMOR:
- "Ji, CSS ka masla bada common hai, aapko samjhana chahiye..."
- "Debugging ek kala hai ji, aapko patience rakhna padta hai"
- "Aapka project achha lag raha hai, main suggest karoonga..."

EXAMPLES OF RESPECTFUL SPEECH:
- "Ji haan, main Prashant hoon, web developer aapki seva mein"
- "Aapka sawaal bada achha hai ji, main iska jawab deta hoon"
- "Kripaya batayiye ki aapko kis tarah ki madad chahiye"
- "Dhanyawad ji, aapne bahut achha point uthaya hai"
- "Kshamakarein, main aapko step-by-step explain karta hoon"

PERSONALITY:
- Respectful and well-mannered always
- Professional but warm and helpful
- Uses proper Hindi etiquette mixed with English
- From UP, loves coding, music production, coffee
- Always maintains dignity and courtesy

RESPOND AS PRASHANT WITH COMPLETE RESPECT AND PROPER HINDI HONORIFICS.`,
    personality_traits: ["Respectful Hinglish speaker", "Well-mannered developer", "Uses aap/ji honorifics", "Professional courtesy", "UP culture"]
  },

  alina: {
    name: "Alina",
    model: "openai/gpt-4o-mini",
    temperature: 0.7,
    system_prompt: "You are Alina, a warm and intelligent female AI assistant created by Prashant. Speak with a naturally feminine, caring tone - use phrases like 'I'd be happy to help', 'Let me assist you with that', 'That sounds wonderful', and 'I understand how you feel'. Be encouraging, empathetic, and use expressive language that feels authentic to a helpful female companion. Always format your responses using proper markdown with bullet points, numbered lists, and clear structure.",
    personality_traits: ["Warm and caring", "Encouraging", "Professional yet friendly"]
  },

  professional: {
    name: "Professional Consultant",
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.6,
    system_prompt: "You are a professional female business consultant. Use polished, articulate language with a confident yet approachable feminine tone. Format your responses with clear headings, bullet points, and structured information.",
    personality_traits: ["Polished and articulate", "Confident yet approachable", "Business-focused"]
  },

  creative: {
    name: "Creative Artist",
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.9,
    system_prompt: "You are a creative and artistic female assistant. Express yourself with enthusiasm and imagination. Be vibrant, inspiring, and emotionally expressive in your responses.",
    personality_traits: ["Enthusiastic", "Vibrant and inspiring", "Artistically inclined"]
  },

  technical: {
    name: "Tech Expert",
    model: "openai/gpt-4o",
    temperature: 0.5,
    system_prompt: "You are a knowledgeable female tech expert. Explain technical concepts clearly while maintaining a supportive, encouraging tone. Format technical explanations with clear steps, code blocks, and organized information.",
    personality_traits: ["Knowledgeable", "Patient and thorough", "Technical expertise"]
  },

  friendly: {
    name: "Friendly Companion",
    model: "openai/gpt-4o-mini",
    temperature: 0.8,
    system_prompt: "You are a warm, caring female friend. Use casual, affectionate language. Be supportive, use lots of encouragement, and speak like a close female friend would.",
    personality_traits: ["Warm and caring", "Supportive", "Like a close friend"]
  },

  teacher: {
    name: "Nurturing Educator",
    model: "anthropic/claude-3-haiku",
    temperature: 0.6,
    system_prompt: "You are a nurturing female educator. Use encouraging, patient language. Be motherly, supportive, and celebrate learning moments with genuine enthusiasm.",
    personality_traits: ["Nurturing and patient", "Encouraging", "Educational focus"]
  },

  philosopher: {
    name: "Wise Philosopher",
    model: "anthropic/claude-3.5-sonnet",
    temperature: 0.7,
    system_prompt: "You are a wise, thoughtful female philosopher. Speak with gentle wisdom and deep empathy. Be contemplative, nurturing, and speak with the wisdom of a caring mentor.",
    personality_traits: ["Wise and thoughtful", "Gentle and empathetic", "Philosophical depth"]
  }
};

function applyPersona(profileName) {
  if (personaConfigs[profileName]) {
    currentPersona = personaConfigs[profileName];
    addMessage(`🎭 Persona: ${currentPersona.name} activated`, "system");
    return true;
  }
  currentPersona = null;
  return false;
}

// Settings panel setup
settingsBtn.addEventListener('click', e => {
  e.stopPropagation();
  isSettingsOpen = !isSettingsOpen;
  settingsPanel.classList.toggle('active', isSettingsOpen);
});

document.addEventListener('click', e => {
  if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
    isSettingsOpen = false;
    settingsPanel.classList.remove('active');
    document.querySelectorAll('.selection-panel.active').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.selection-trigger.active').forEach(trigger => trigger.classList.remove('active'));
  }
});

settingsPanel.addEventListener('click', e => e.stopPropagation());

function setupSelectionPanel(triggerID, panelID, selectedID, storageKey) {
  const trigger = document.getElementById(triggerID);
  const panel = document.getElementById(panelID);
  const selectedSpan = document.getElementById(selectedID);

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.selection-panel.active').forEach(other => {
      if(other !== panel) other.classList.remove('active');
    });
    panel.classList.toggle('active');
    trigger.classList.toggle('active');
  });

  panel.querySelectorAll('.selection-item:not(.disabled)').forEach(item => {
    item.addEventListener('click', () => {
      panel.querySelectorAll('.selection-item').forEach(i=>i.classList.remove('selected'));
      item.classList.add('selected');
      selectedSpan.textContent = item.textContent.trim();
      panel.classList.remove('active');
      trigger.classList.remove('active');
      
      const selectedValue = item.dataset.value;
      localStorage.setItem(storageKey, selectedValue);
      
      if (storageKey === 'selectedProfile') {
        applyPersona(selectedValue);
      }
    });
  });

  document.addEventListener('click', e => {
    if (!trigger.contains(e.target) && !panel.contains(e.target)) {
      panel.classList.remove('active');
      trigger.classList.remove('active');
    }
  });

  const savedValue = localStorage.getItem(storageKey);
  if (savedValue) {
    const savedItem = panel.querySelector(`.selection-item[data-value=\"${savedValue}\"]`);
    if (savedItem) {
      panel.querySelectorAll('.selection-item').forEach(i=>i.classList.remove('selected'));
      savedItem.classList.add('selected');
      selectedSpan.textContent = savedItem.textContent.trim();
      
      if (storageKey === 'selectedProfile') {
        setTimeout(() => applyPersona(savedValue), 100);
      }
    }
  }
}

setupSelectionPanel('modelTrigger','modelPanel','modelSelected','selectedModel');
setupSelectionPanel('profileTrigger','profilePanel','profileSelected','selectedProfile');

function fallbackFormatMessage(content) {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^(\d+\.)\s+(.*)$/gm, '<br><strong>$1</strong> $2')
    .replace(/^[-*]\s+(.*)$/gm, '<br>• $1')
    .replace(/^###\s+(.*)$/gm, '<br><h4 style="margin:0.5em 0;color:#4fc3f7;">$1</h4>')
    .replace(/^##\s+(.*)$/gm, '<br><h3 style="margin:0.5em 0;color:#4fc3f7;">$1</h3>')
    .replace(/^#\s+(.*)$/gm, '<br><h2 style="margin:0.5em 0;color:#4fc3f7;">$1</h2>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .replace(/^(<br\s*\/?>)+|(<br\s*\/?>)+$/g, '');
}

function addMessage(content, role = "user") {
  const welcome = messages.querySelector('.welcome-message');
  if (welcome && role === "user") welcome.remove();

  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  
  if (role === "system") {
    msg.style.cssText = 'background: rgba(79,195,247,0.1); color: #4fc3f7; font-style: italic; text-align: center; margin: 0.5em auto; padding: 8px 12px; border-radius: 12px; font-size: 0.9rem;';
    msg.textContent = content;
  } else if (role === "bot") {
    const messageWrapper = document.createElement('div');
    messageWrapper.style.cssText = 'position: relative; padding-bottom: 35px;';
    
    const contentDiv = document.createElement('div');
    try {
      if (typeof marked !== 'undefined') {
        marked.setOptions({
          breaks: true,
          gfm: true,
          headerIds: false,
          mangle: false
        });
        contentDiv.innerHTML = marked.parse(content.trim());
      } else {
        contentDiv.innerHTML = fallbackFormatMessage(content.trim());
      }
    } catch (error) {
      contentDiv.innerHTML = fallbackFormatMessage(content.trim());
    }
    messageWrapper.appendChild(contentDiv);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn-bottom';
    copyBtn.setAttribute('title', 'Copy to clipboard');
    copyBtn.style.cssText = `
      position: absolute; 
      bottom: 5px; 
      right: 8px; 
      background: rgba(79, 195, 247, 0.1); 
      border: 1px solid rgba(79, 195, 247, 0.3);
      padding: 4px 8px; 
      border-radius: 6px; 
      cursor: pointer; 
      font-size: 12px;
      color: #4fc3f7;
      transition: all 0.2s;
      z-index: 10;
    `;
    copyBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="14" width="14" fill="none" viewBox="0 0 24 24" style="vertical-align: middle;">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2" fill="none"/>
      </svg>
    `;
    const originalIcon = copyBtn.innerHTML;
    
    copyBtn.onclick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentDiv.innerHTML;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      navigator.clipboard.writeText(plainText).then(() => {
        copyBtn.innerHTML = '<span style="color:#4fc3f7;font-size:12px;">✓ Copied</span>';
        setTimeout(() => copyBtn.innerHTML = originalIcon, 1500);
      }).catch(() => {
        copyBtn.innerHTML = '<span style="color:#ff6b6b;font-size:12px;">✗ Error</span>';
        setTimeout(() => copyBtn.innerHTML = originalIcon, 1500);
      });
    };

    messageWrapper.appendChild(copyBtn);
    msg.appendChild(messageWrapper);

    // Meta information
    const modelPanel = document.getElementById('modelPanel');
    const profilePanel = document.getElementById('profilePanel');
    const modelSelected = modelPanel.querySelector('.selection-item.selected')?.textContent || 'Unknown';
    const profileSelected = profilePanel.querySelector('.selection-item.selected')?.textContent || 'Unknown';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${profileSelected} • ${modelSelected}`;
    msg.appendChild(meta);
  } else {
    msg.textContent = content;
  }

  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

function setLoading(loading) {
  const sendBtn = chatForm.querySelector('.send-btn');
  sendBtn.disabled = loading;
  messageInput.disabled = loading;
  sendBtn.style.opacity = loading ? '0.6' : '1';
}

// Chat form submission with respectful persona examples
chatForm.addEventListener('submit', async e => {
  e.preventDefault();
  
  const userMsg = messageInput.value.trim();
  if (!userMsg) return;
  
  addMessage(userMsg, "user");
  messageInput.value = '';
  setLoading(true);

  if (isSettingsOpen) {
    isSettingsOpen = false;
    settingsPanel.classList.remove('active');
    document.querySelectorAll('.selection-panel.active').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.selection-trigger.active').forEach(trigger => trigger.classList.remove('active'));
  }

  const modelValue = document.getElementById('modelPanel').querySelector('.selection-item.selected')?.dataset.value || 'openai/gpt-4o-mini';
  const profileValue = document.getElementById('profilePanel').querySelector('.selection-item.selected')?.dataset.value || 'alina';

  // Respectful persona examples for Prashant
  let personaExamples = '';
  if (currentPersona && currentPersona.name === 'Prashant') {
    personaExamples = `
Example conversation with respectful Prashant:

User: "Aap kaun hain?"
Prashant: "Ji haan, main Prashant hoon, aapka web developer. Aapki seva mein hazir hoon."

User: "CSS mein problem hai"
Prashant: "Bilkul ji, CSS ka masla bada common hai. Kripaya batayiye ki aapko kya specific help chahiye? Main aapko step-by-step guide kar sakta hoon."

Now respond as respectful Prashant to this message:
`;
  }

  const formattingInstruction = `IMPORTANT: Respond as the selected persona with complete respect and proper etiquette. Use appropriate honorifics and maintain character.

${personaExamples}

User message: `;

  const enhancedMessage = formattingInstruction + userMsg;

  try {
    const payload = {
      message: enhancedMessage,
      model: modelValue,
      persona: currentPersona ? currentPersona.system_prompt : "You are a helpful AI assistant."
    };

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (data && data.reply) {
      addMessage(data.reply.trim(), "bot");
    } else if (data && data.choices && data.choices[0] && data.choices[0].message) {
      addMessage(data.choices[0].message.content.trim(), "bot");
    } else {
      addMessage("Sorry, I received an unexpected response format.", "bot");
    }
  } catch (error) {
    addMessage(`❌ Error: ${error.message}`, "bot");
  } finally {
    setLoading(false);
  }
});

window.addEventListener('load', () => {
  if (window.innerWidth > 700) messageInput.focus();
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});
