let socket = null;
let currentRoomId = null;
let currentRoom = null;
let currentUser = null;
let partnerUser = null;
let typingTimeout = null;
let editingMessageId = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth(true);
  if (!currentUser) return;

  const urlParams = new URLSearchParams(window.location.search);
  currentRoomId = urlParams.get('roomId');

  if (!currentRoomId) {
    window.location.href = '/dashboard.html';
    return;
  }

  await initChat();
  setupSocket();
  setupComposer();
});

async function initChat() {
  try {
    const res = await API.get(`/api/rooms/${currentRoomId}`);
    if (!res.success) {
      alert(res.message || 'Access Denied');
      window.location.href = '/dashboard.html';
      return;
    }
    
    currentRoom = res.room;
    partnerUser = currentRoom.partner;
    
    document.getElementById('roomTitleHeader').textContent = currentRoom.room_name;
    document.getElementById('roomCodeDisplay').textContent = `Room: ${currentRoom.room_code}`;
    
    if (partnerUser) {
      document.getElementById('partnerName').textContent = partnerUser.display_name || partnerUser.username;
      document.getElementById('partnerAvatar').textContent = (partnerUser.display_name || partnerUser.username)[0].toUpperCase();
    } else {
      document.getElementById('partnerName').textContent = 'Waiting for second member...';
      document.getElementById('partnerStatusText').textContent = 'Share room code to invite';
    }

    await loadMessages();
  } catch (err) {
    console.error('Init chat failed:', err);
  }
}

async function loadMessages() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '';
  
  try {
    const res = await API.get(`/api/rooms/${currentRoomId}/messages?limit=100`);
    if (res.success && res.messages) {
      res.messages.forEach(msg => appendMessage(msg));
      scrollToBottom();
      // Mark read
      API.post(`/api/rooms/${currentRoomId}/read`, {});
    }
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

function setupSocket() {
  socket = io({
    auth: { token: getCookie('token') }
  });

  socket.on('connect', () => {
    socket.emit('room:join', { roomId: currentRoomId }, (res) => {
      if (res && res.success && res.partnerStatus) {
        updatePartnerPresence(res.partnerStatus.online, res.partnerStatus.lastSeen);
      }
    });
  });

  socket.on('room:error', (err) => {
    alert(err.message || 'Room socket error');
  });

  socket.on('message:new', (msg) => {
    appendMessage(msg);
    scrollToBottom();
    if (msg.sender_id !== currentUser.id) {
      socket.emit('message:read', { roomId: currentRoomId, messageId: msg.id });
    }
  });

  socket.on('message:updated', (msg) => {
    const el = document.getElementById(`msg-${msg.id}`);
    if (el) {
      const bubble = el.querySelector('.message-bubble');
      bubble.textContent = msg.content;
      let editedSpan = el.querySelector('.edited-tag');
      if (!editedSpan) {
        editedSpan = document.createElement('span');
        editedSpan.className = 'edited-tag';
        editedSpan.style.fontSize = '0.7rem';
        editedSpan.style.opacity = '0.7';
        editedSpan.style.marginLeft = '4px';
        editedSpan.textContent = '(edited)';
        el.querySelector('.message-meta').appendChild(editedSpan);
      }
    }
  });

  socket.on('message:deleted', (data) => {
    const el = document.getElementById(`msg-${data.id}`);
    if (el) {
      const bubble = el.querySelector('.message-bubble');
      bubble.textContent = 'This message was deleted';
      bubble.style.fontStyle = 'italic';
      bubble.style.opacity = '0.6';
      const actions = el.querySelector('.message-actions');
      if (actions) actions.remove();
    }
  });

  socket.on('message:read', (data) => {
    document.querySelectorAll('.receipt-icon').forEach(icon => {
      icon.textContent = '✓✓';
      icon.style.color = '#38bdf8'; // Blue ticks for read
    });
  });

  socket.on('message:delivered', (data) => {
    document.querySelectorAll('.receipt-icon').forEach(icon => {
      if (icon.textContent === '✓') {
        icon.textContent = '✓✓';
        icon.style.color = '#9ca3af';
      }
    });
  });

  socket.on('typing:update', (data) => {
    const indicator = document.getElementById('typingIndicator');
    if (data.isTyping) {
      indicator.textContent = 'Partner is typing...';
      indicator.style.visibility = 'visible';
    } else {
      indicator.style.visibility = 'hidden';
    }
  });

  socket.on('presence:update', (data) => {
    updatePartnerPresence(data.online);
  });

  socket.on('user:online', (data) => {
    if (partnerUser && data.userId === partnerUser.id) {
      updatePartnerPresence(true);
    }
  });

  socket.on('user:offline', (data) => {
    if (partnerUser && data.userId === partnerUser.id) {
      updatePartnerPresence(false, data.lastSeen);
    }
  });
}

function updatePartnerPresence(online, lastSeen) {
  const dot = document.getElementById('partnerStatusDot');
  const text = document.getElementById('partnerStatusText');
  if (online) {
    dot.className = 'status-dot online';
    text.textContent = 'Online';
  } else {
    dot.className = 'status-dot offline';
    text.textContent = lastSeen ? `Last seen ${formatTime(lastSeen)}` : 'Offline';
  }
}

function setupComposer() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('btnSend');

  const emitTyping = () => {
    socket.emit('typing:start', { roomId: currentRoomId });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('typing:stop', { roomId: currentRoomId });
    }, 2000);
  };

  input.addEventListener('input', emitTyping);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);
}

function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  socket.emit('typing:stop', { roomId: currentRoomId });

  if (editingMessageId) {
    socket.emit('message:edit', { messageId: editingMessageId, newContent: content }, (res) => {
      if (res && !res.success) alert(res.error);
    });
    editingMessageId = null;
    document.getElementById('editingBanner').style.display = 'none';
  } else {
    socket.emit('message:send', { roomId: currentRoomId, content }, (res) => {
      if (res && !res.success) alert(res.error);
    });
  }

  input.value = '';
}

function appendMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const isMine = msg.sender_id === currentUser.id;

  const row = document.createElement('div');
  row.id = `msg-${msg.id}`;
  row.className = `message-row ${isMine ? 'sent' : 'received'}`;

  const timeStr = formatTime(msg.created_at);
  const isDeleted = Boolean(msg.deleted_at);

  let receiptStr = '';
  if (isMine && !isDeleted) {
    if (msg.read_at) {
      receiptStr = '<span class="receipt-icon" style="color:#38bdf8;">✓✓</span>';
    } else if (msg.delivered_at) {
      receiptStr = '<span class="receipt-icon" style="color:#9ca3af;">✓✓</span>';
    } else {
      receiptStr = '<span class="receipt-icon" style="color:#9ca3af;">✓</span>';
    }
  }

  const actions = (isMine && !isDeleted) ? `
    <div class="message-actions">
      <button class="action-btn" onclick="startEditMessage(${msg.id}, \`${escapeQuotes(msg.content)}\`)">Edit</button>
      <button class="action-btn" onclick="deleteMessage(${msg.id})">Del</button>
    </div>
  ` : '';

  row.innerHTML = `
    ${actions}
    <div class="message-bubble" style="${isDeleted ? 'font-style:italic; opacity:0.6;' : ''}">
      ${escapeHTML(msg.content)}
    </div>
    <div class="message-meta">
      <span>${timeStr}</span>
      ${msg.updated_at && !isDeleted ? '<span class="edited-tag" style="font-size:0.7rem; opacity:0.7;">(edited)</span>' : ''}
      ${receiptStr}
    </div>
  `;

  container.appendChild(row);
}

function startEditMessage(id, content) {
  editingMessageId = id;
  const input = document.getElementById('messageInput');
  input.value = content;
  input.focus();
  document.getElementById('editingBanner').style.display = 'flex';
}

function cancelEdit() {
  editingMessageId = null;
  document.getElementById('messageInput').value = '';
  document.getElementById('editingBanner').style.display = 'none';
}

function deleteMessage(id) {
  if (confirm('Delete this message?')) {
    socket.emit('message:delete', { messageId: id }, (res) => {
      if (res && !res.success) alert(res.error);
    });
  }
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return '';
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, "\\'");
}
