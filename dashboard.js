let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await checkAuth(true);
  if (!currentUser) return;

  document.getElementById('userDisplayName').textContent = currentUser.display_name || currentUser.username;
  document.getElementById('userUsername').textContent = `@${currentUser.username}`;

  loadRooms();

  // Create Room Form
  const createForm = document.getElementById('createRoomForm');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomName = document.getElementById('createRoomName').value;
      const password = document.getElementById('createRoomPassword').value;
      const confirmPassword = document.getElementById('createRoomPasswordConfirm').value;

      if (password !== confirmPassword) {
        return showAlert('createRoomAlert', 'Passwords do not match');
      }

      const res = await API.post('/api/rooms', { roomName, password, confirmPassword });
      if (res.success) {
        closeModal('createRoomModal');
        showInviteModal(res.room);
        loadRooms();
      } else {
        showAlert('createRoomAlert', res.message);
      }
    });
  }

  // Join Room Form
  const joinForm = document.getElementById('joinRoomForm');
  if (joinForm) {
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const roomCode = document.getElementById('joinRoomCode').value.trim();
      const password = document.getElementById('joinRoomPassword').value;

      const res = await API.post('/api/rooms/join', { roomCode, password });
      if (res.success) {
        closeModal('joinRoomModal');
        window.location.href = `/chat.html?roomId=${res.room.id}`;
      } else {
        showAlert('joinRoomAlert', res.message);
      }
    });
  }
});

async function loadRooms() {
  const roomsContainer = document.getElementById('roomsListContainer');
  const emptyState = document.getElementById('emptyState');
  
  try {
    const res = await API.get('/api/rooms');
    if (res.success && res.rooms.length > 0) {
      emptyState.style.display = 'none';
      roomsContainer.innerHTML = '';
      
      res.rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'glass-panel room-dashboard-card';
        div.style.padding = '1.25rem';
        div.style.marginBottom = '1rem';
        div.style.cursor = 'pointer';
        div.onclick = () => window.location.href = `/chat.html?roomId=${room.id}`;

        const unreadBadge = room.unread_count > 0 
          ? `<span class="badge" style="background:#ef4444; color:white;">${room.unread_count} new</span>` 
          : '';

        div.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h3 style="font-size:1.15rem; margin-bottom:0.25rem;">${escapeHTML(room.room_name)}</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); font-family:monospace;">CODE: ${room.room_code}</p>
            </div>
            ${unreadBadge}
          </div>
          <div style="margin-top:0.75rem; font-size:0.85rem; color:var(--text-dim); display:flex; justify-content:space-between;">
            <span>Members: ${room.member_count}/2</span>
            <span>${room.last_message ? escapeHTML(room.last_message.substring(0, 30)) + '...' : 'No messages yet'}</span>
          </div>
        `;
        roomsContainer.appendChild(div);
      });
    } else {
      emptyState.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load rooms:', err);
  }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'flex';
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

function showInviteModal(room) {
  document.getElementById('inviteRoomCode').value = room.room_code;
  openModal('inviteModal');
}

function copyInvite() {
  const input = document.getElementById('inviteRoomCode');
  input.select();
  navigator.clipboard.writeText(input.value);
  alert('Room Code copied to clipboard: ' + input.value);
}

async function logout() {
  await API.post('/api/auth/logout', {});
  localStorage.removeItem('duo_user');
  window.location.href = '/login.html';
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
