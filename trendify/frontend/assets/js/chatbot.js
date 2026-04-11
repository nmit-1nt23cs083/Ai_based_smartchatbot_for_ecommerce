/* ═══════════════════════════════════════════════════════
   Trendify AI Assistant — chatbot.js  (frontend)
   Calls /api/chat on your Express backend.
   The backend holds the Anthropic API key securely.
═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const API_ENDPOINT = '/api/chat';
  const MAX_HISTORY  = 16;

  let isOpen    = false;
  let isLoading = false;
  let conversationHistory = [];

  // ── Page-aware quick suggestions ──────────────────────
  function getPageSuggestions() {
    const path     = window.location.pathname;
    const loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();

    if (path.includes('cart'))     return ['Shipping cost?', 'Return policy', 'Checkout help'];
    if (path.includes('checkout')) return ['Payment options?', 'When will it arrive?', 'Is checkout secure?'];
    if (path.includes('orders'))   return ['How to return?', 'Order not received?', 'Order status?'];
    if (path.includes('product'))  return ['Is this authentic?', 'Size guide', 'Similar products?'];
    if (path.includes('shop'))     return ['New arrivals?', 'Best sellers?', 'Free shipping info'];
    if (path.includes('wishlist')) return ['Add to cart help', 'Show similar items', 'Checkout from wishlist?'];
    return loggedIn
      ? ['Show new arrivals', 'My orders', 'Free shipping info']
      : ['How to sign up?', 'Show new arrivals', 'Shipping & returns'];
  }

  // ── Build chat UI ──────────────────────────────────────
  function buildUI() {
    const user      = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) ? Auth.getUser() : null;
    const firstName = user ? user.name.split(' ')[0] : null;
    const userInit  = user ? user.name.charAt(0).toUpperCase() : '?';
    const chips     = getPageSuggestions()
      .map(s => `<button class="suggestion-chip" data-msg="${s}">${s}</button>`)
      .join('');

    const launcher = document.createElement('button');
    launcher.id = 'trendify-chat-launcher';
    launcher.setAttribute('aria-label', 'Open Trendify AI Assistant');
    launcher.innerHTML = `
      <span class="launcher-icon launcher-chat">✦</span>
      <span class="launcher-icon launcher-close">✕</span>
      <span id="chat-unread-badge" style="display:none">1</span>
    `;

    const win = document.createElement('div');
    win.id = 'trendify-chat-window';
    win.className = 'hidden';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Trendify AI Assistant');
    win.innerHTML = `
      <div class="chat-header">
        <div class="chat-avatar">✦</div>
        <div class="chat-header-info">
          <div class="chat-header-name">Aria · Trendify Assistant</div>
          <div class="chat-header-status">● Online now</div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-header-btn" id="chat-clear-btn" title="Clear chat">↺</button>
          <button class="chat-header-btn" id="chat-close-btn" title="Close">✕</button>
        </div>
      </div>

      <div class="chat-messages" id="chat-messages-list">
        <div class="chat-welcome">
          <div class="chat-welcome-title">✦ Welcome to Trendify</div>
          <div class="chat-welcome-text">
            ${firstName
              ? `Hi ${firstName}! I'm Aria, your personal fashion guide. What can I help you find today?`
              : `I'm Aria, your luxury shopping assistant. Ask me about products, shipping, returns — anything!`
            }
          </div>
        </div>
      </div>

      <div class="chat-suggestions" id="chat-suggestions">${chips}</div>

      <div class="chat-input-area">
        <textarea
          id="chat-input"
          placeholder="Ask me anything…"
          rows="1"
          maxlength="500"
          aria-label="Chat message"
        ></textarea>
        <button id="chat-send-btn" aria-label="Send">➤</button>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(win);
    bindEvents(launcher, win, userInit);

    setTimeout(() => {
      if (!isOpen) document.getElementById('chat-unread-badge').style.display = 'flex';
    }, 4000);
  }

  // ── Bind events ────────────────────────────────────────
  function bindEvents(launcher, win, userInit) {
    launcher.addEventListener('click', () => toggleChat(launcher, win));
    win.querySelector('#chat-close-btn').addEventListener('click', () => toggleChat(launcher, win));

    win.querySelector('#chat-clear-btn').addEventListener('click', () => {
      conversationHistory = [];
      const list    = document.getElementById('chat-messages-list');
      const welcome = list.querySelector('.chat-welcome');
      list.innerHTML = '';
      if (welcome) list.appendChild(welcome);
      document.getElementById('chat-suggestions').style.display = 'flex';
      if (typeof showToast === 'function') showToast('Chat cleared', 'info');
    });

    document.getElementById('chat-send-btn').addEventListener('click', () => sendMessage(userInit));

    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(userInit); }
    });

    document.getElementById('chat-input').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    win.querySelector('#chat-suggestions').addEventListener('click', e => {
      const chip = e.target.closest('.suggestion-chip');
      if (!chip) return;
      document.getElementById('chat-input').value = chip.dataset.msg;
      sendMessage(userInit);
    });
  }

  // ── Toggle ─────────────────────────────────────────────
  function toggleChat(launcher, win) {
    isOpen = !isOpen;
    launcher.classList.toggle('open', isOpen);
    win.classList.toggle('hidden', !isOpen);
    document.getElementById('chat-unread-badge').style.display = 'none';
    if (isOpen) document.getElementById('chat-input').focus();
  }

  // ── Send message ────────────────────────────────────────
  async function sendMessage(userInit) {
    if (isLoading) return;
    const input = document.getElementById('chat-input');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('chat-suggestions').style.display = 'none';

    appendBubble('user', text, userInit);

    // Snapshot history before adding this user message
    const historySnapshot = [...conversationHistory];
    conversationHistory.push({ role: 'user', content: text });
    if (conversationHistory.length > MAX_HISTORY) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }

    const typingEl = showTyping();
    isLoading = true;
    document.getElementById('chat-send-btn').disabled = true;

    try {
      const authHeader = {};
      if (typeof Auth !== 'undefined' && Auth.getToken && Auth.getToken()) {
        authHeader['Authorization'] = `Bearer ${Auth.getToken()}`;
      }

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ message: text, history: historySnapshot })
      });

      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        appendBubble('bot', data.error || 'Something went wrong. Please try again.', null);
        return;
      }

      // Build the bot reply from summary, details, and followUp
      let botReply = data.summary || data.reply || 'Hello! How can I help?';
      if (data.details) {
        botReply += '\n\n' + data.details;
      }
      if (data.followUp) {
        botReply += '\n\n' + data.followUp;
      }

      appendBubble('bot', botReply, null);
      conversationHistory.push({ role: 'assistant', content: botReply });

      if (data.products && data.products.length > 0) {
        renderProductCards(data.products);
      }

    } catch (err) {
      typingEl.remove();
      appendBubble('bot', 'I\'m having trouble connecting right now. Please try again in a moment. 🙏', null);
      console.error('[Chatbot]', err);
    } finally {
      isLoading = false;
      document.getElementById('chat-send-btn').disabled = false;
      document.getElementById('chat-input').focus();
    }
  }

  // ── Render text bubble ─────────────────────────────────
  function appendBubble(role, text, userInit) {
    const list  = document.getElementById('chat-messages-list');
    const isBot = role === 'bot';
    const now   = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg ${isBot ? 'bot' : 'user'}`;

    const avatar = isBot
      ? `<div class="msg-avatar">✦</div>`
      : `<div class="msg-avatar user-av">${userInit}</div>`;

    const safe = isBot ? linkify(escapeHtml(text)) : escapeHtml(text);

    wrapper.innerHTML = `
      ${avatar}
      <div>
        <div class="msg-bubble">${safe}</div>
        <div class="msg-time">${now}</div>
      </div>
    `;
    list.appendChild(wrapper);
    scrollBottom(list);
    return wrapper;
  }

  // ── Product cards from live DB matches ─────────────────
  function renderProductCards(products) {
    const list      = document.getElementById('chat-messages-list');
    const container = document.createElement('div');
    container.style.cssText = 'padding-left:34px; margin-top:4px;';

    const cards = document.createElement('div');
    cards.className = 'chat-product-cards';

    cards.innerHTML = products.map(p => {
      const discount = p.original_price
        ? `<span class="cpc-discount">-${Math.round((1 - p.price / p.original_price) * 100)}%</span>` : '';
      const stockBadge = p.stock === 0
        ? `<span class="cpc-oos">Out of stock</span>`
        : p.stock < 5 ? `<span class="cpc-low">Only ${p.stock} left</span>` : '';
      const stars = p.rating
        ? '★'.repeat(Math.round(p.rating)) + '☆'.repeat(5 - Math.round(p.rating)) : '';

      return `
        <div class="cpc-card" onclick="window.location='${p.url}'" role="button" tabindex="0">
          <div class="cpc-info">
            <p class="cpc-cat">${escapeHtml(p.category || '')}</p>
            <h4 class="cpc-name">${escapeHtml(p.name)}</h4>
            ${stars ? `<div class="cpc-stars">${stars}<span class="cpc-rating">${p.rating}</span></div>` : ''}
            <div class="cpc-price-row">
              <span class="cpc-price">$${p.price}</span>
              ${p.original_price ? `<span class="cpc-original">$${p.original_price}</span>` : ''}
              ${discount}
            </div>
            ${stockBadge}
          </div>
        </div>
      `;
    }).join('');

    container.appendChild(cards);
    list.appendChild(container);
    scrollBottom(list);
  }

  // ── Typing dots ────────────────────────────────────────
  function showTyping() {
    const list = document.getElementById('chat-messages-list');
    const el   = document.createElement('div');
    el.className = 'typing-indicator';
    el.innerHTML = `
      <div class="msg-avatar">✦</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    list.appendChild(el);
    scrollBottom(list);
    return el;
  }

  // ── Utils ──────────────────────────────────────────────
  function scrollBottom(el) { el.scrollTop = el.scrollHeight; }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function linkify(text) {
    const labels = {
      '/product.html': 'View Product', '/shop.html': 'Browse Shop',
      '/cart.html': 'Your Cart',       '/orders.html': 'My Orders',
      '/wishlist.html': 'Wishlist',    '/checkout.html': 'Checkout',
      '/login.html': 'Sign In'
    };
    return text
      .replace(/\/(product|shop|cart|orders|wishlist|checkout|login)\.html(\?[^\s<]*)?/g, (match) => {
        const base  = match.split('?')[0];
        const label = labels[base] || match;
        return `<a href="${match}">${label}</a>`;
      })
      .replace(/\n/g, '<br>');
  }

  // ── Init ────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

})();
