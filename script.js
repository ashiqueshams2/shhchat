// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBAXWKvlpwnzI9Lghj81d1_M1pIRbuM200",
    authDomain: "shh-chat-db9d0.firebaseapp.com",
    databaseURL: "https://shh-chat-db9d0-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "shh-chat-db9d0",
    storageBucket: "shh-chat-db9d0.firebasestorage.app",
    messagingSenderId: "20040883450",
    appId: "1:20040883450:web:833660405c634b2aaffd43",
    measurementId: "G-D7B8720EXN"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

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

// Firebase operations
async function createOrJoinRoom(roomCode, userName) {
    const userId = generateUserId();
    const user = {
        id: userId,
        name: userName,
        joinedAt: Date.now(),
        lastSeen: Date.now()
    };

    chatData.currentUser = user;

    // Store user
    await database.ref(`users/${userId}`).set(user);

    // Generate or use room code
    if (!roomCode) {
        roomCode = generateRoomCode();
    }
    const roomRef = database.ref(`rooms/${roomCode}`);
    const snapshot = await roomRef.once('value');
    if (!snapshot.exists()) {
        await roomRef.set({
            code: roomCode,
            createdAt: Date.now(),
            users: { [userId]: true }
        });
    } else {
        await roomRef.child(`users/${userId}`).set(true);
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

    database.ref(`rooms/${chatData.currentRoom}/messages`).push(message);
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

    database.ref(`rooms/${chatData.currentRoom}/messages`).push(message);
    messageInput.value = '';
    chatData.currentUser.lastSeen = Date.now();
    database.ref(`users/${chatData.currentUser.id}/lastSeen`).set(Date.now());
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
    const roomRef = database.ref(`rooms/${chatData.currentRoom}/messages`);
    roomRef.on('child_added', snapshot => {
        addMessageToDOM(snapshot.val());
    });
}

function updateOnlineCount() {
    const roomRef = database.ref(`rooms/${chatData.currentRoom}/users`);
    roomRef.on('value', snapshot => {
        const users = snapshot.val();
        const count = users ? Object.keys(users).length : 0;
        document.getElementById('onlineCount').textContent = `${count} online`;
    });
}

async function leaveRoom() {
    if (!chatData.currentRoom || !chatData.currentUser) return;
    if (confirm('Leave room? It will be deleted if empty.')) {
        const roomRef = database.ref(`rooms/${chatData.currentRoom}`);
        const userRef = database.ref(`users/${chatData.currentUser.id}`);
        addSystemMessage(`${chatData.currentUser.name} left the chat`);

        // Remove user from room
        await roomRef.child(`users/${chatData.currentUser.id}`).remove();

        // Delete room if empty
        const snapshot = await roomRef.child('users').once('value');
        if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
            await roomRef.remove();
        }

        // Remove user
        await userRef.remove();
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
