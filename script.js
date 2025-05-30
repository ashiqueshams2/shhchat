// In-memory state
const chatData = {
    currentUser: null,
    currentRoom: null
};

// Utility functions
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateUserId() {
    return Math.random().toString(36).substring(2, 15);
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Firebase operations (Assuming Firebase is initialized in index.html)
import { getDatabase, ref, set, push, get } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";

// Create or join a room
async function createOrJoinRoom(roomCode, userName) {
    const userId = generateUserId();
    const user = {
        id: userId,
        name: userName,
        joinedAt: Date.now(),
        lastSeen: Date.now()
    };

    chatData.currentUser = user;

    // Store user in Firebase
    await set(ref(database, 'users/' + userId), user);

    // Generate or use room code
    if (!roomCode) {
        roomCode = generateRoomCode();
    }
    const roomRef = ref(database, 'rooms/' + roomCode);
    const snapshot = await get(roomRef);

    if (!snapshot.exists()) {
        await set(roomRef, {
            code: roomCode,
            createdAt: Date.now(),
            users: { [userId]: true }
        });
    } else {
        await set(ref(roomRef, 'users/' + userId), true);
    }

    chatData.currentRoom = roomCode;
    addSystemMessage(`${userName} joined the chat`);
    return { roomCode, userId };
}

function addSystemMessage(text) {
    const message = {
        id: generateUserId(),
        type: 'system',
        text: text,
        timestamp: Date.now()
    };

    const messagesRef = ref(database, 'rooms/' + chatData.currentRoom + '/messages');
    push(messagesRef, message);
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    if (!text || !chatData.currentUser || !chatData.currentRoom) return;

    const message = {
        id: generateUserId(),
        type: 'user',
        text: text,
        userId: chatData.currentUser.id,
        userName: chatData.currentUser.name,
        timestamp: Date.now()
    };

    const messagesRef = ref(database, 'rooms/' + chatData.currentRoom + '/messages');
    push(messagesRef, message);
    messageInput.value = '';
    chatData.currentUser.lastSeen = Date.now();
    set(ref(database, 'users/' + chatData.currentUser.id + '/lastSeen'), Date.now());
}

function addMessageToDOM(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    if (message.type === 'system') {
        messageDiv.className = 'system-message';
        messageDiv.textContent = message.text;
    } else {
        const isOwn = message.userId === chatData.currentUser.id;
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        messageDiv.innerHTML = `
            <div class="message-info">${message.userName} • ${formatTime(message.timestamp)}</div>
            <div class="message-bubble">${escapeHtml(message.text)}</div>
        `;
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function listenForMessages() {
    const roomRef = ref(database, 'rooms/' + chatData.currentRoom + '/messages');
    roomRef.on('child_added', snapshot => {
        addMessageToDOM(snapshot.val());
    });
}

function updateOnlineCount() {
    const roomRef = ref(database, 'rooms/' + chatData.currentRoom + '/users');
    roomRef.on('value', snapshot => {
        const users = snapshot.val();
        const count = users ? Object.keys(users).length : 0;
        document.getElementById('onlineCount').textContent = `${count} online`;
    });
}

async function leaveRoom() {
    if (!chatData.currentRoom || !chatData.currentUser) return;
    if (confirm('Leave room? It will be deleted if empty.')) {
        const roomRef = ref(database, 'rooms/' + chatData.currentRoom);
        const userRef = ref(database, 'users/' + chatData.currentUser.id);
        addSystemMessage(`${chatData.currentUser.name} left the chat`);

        // Remove user from room
        await set(ref(roomRef, 'users/' + chatData.currentUser.id), null);

        // Delete room if empty
        const snapshot = await get(ref(roomRef, 'users'));
        if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
            await set(roomRef, null);
        }

        // Remove user
        await set(userRef, null);
        chatData.currentUser = null;
        chatData.currentRoom = null;

        // Reset UI
        document.getElementById('chatContainer').style.display = 'none';
        document.getElementById('welcomeScreen').style.display = 'block';
        document.getElementById('displayName').value = '';
        document.getElementById('roomCode').value = '';
        document.getElementById('displayName').focus();
        document.getElementById('messagesContainer').innerHTML = '<div class="system-message">Messages disappear when everyone leaves.</div>';
    }
}

function shareRoom() {
    if (!chatData.currentRoom) return;
    const shareText = `Join my Shh Chat room: ${chatData.currentRoom}\n${window.location.href}`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(shareText).then(() => {
            alert('Room code copied!');
        }).catch(() => {
            alert('Copy failed');
        });
    } else {
        alert('Clipboard not supported');
    }
}

// Form submission
document.getElementById('joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const displayName = document.getElementById('displayName').value.trim();
    const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
    if (!displayName) {
        alert('Enter a name');
        return;
    }
    if (displayName.length > 20) {
        alert('Name must be 20 characters or less');
        return;
    }

    const joinBtn = document.querySelector('.join-btn');
    const originalText = joinBtn.innerHTML;
    joinBtn.innerHTML = '<div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div>';
    joinBtn.disabled = true;

    const result = await createOrJoinRoom(roomCode, displayName);
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('chatContainer').style.display = 'flex';
    document.getElementById('roomTitle').textContent = `Room ${result.roomCode}`;
    listenForMessages();
    updateOnlineCount();
    document.getElementById('messageInput').focus();
    joinBtn.innerHTML = originalText;
    joinBtn.disabled = false;
});

// Send message on Enter
document.getElementById('messageInput').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
