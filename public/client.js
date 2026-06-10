const servers = [
    'http://localhost:3000',
    'http://localhost:3001'
];

//random server (load distribution)
const selectedServer = servers[Math.floor(Math.random() * servers.length)];
console.log(`Attempting to connect to: ${selectedServer}`);


const socket = io(selectedServer, {
    transports: ['websocket'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
});


const connectionStatus = document.getElementById('connection-status');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const serverInfo = document.getElementById('server-info');

let currentUsername = '';
let isJoined = false;


socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('disconnected');
    

    const serverPort = socket.io.uri.split(':').pop();
    serverInfo.textContent = `Server ${serverPort} (${socket.id.substring(0, 8)}...)`;
    

    joinBtn.disabled = !usernameInput.value.trim();
    

    if (currentUsername) {
        console.log(`Auto-rejoining as ${currentUsername}...`);
        socket.emit('register-user', currentUsername);
        isJoined = true;
        

        usernameInput.disabled = true;
        joinBtn.disabled = true;
        messageInput.disabled = false;
        sendBtn.disabled = false;
        

        addMessage('System', `Auto-reconnected to Server ${serverPort}`, true);
    }
});

socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
    connectionStatus.textContent = 'Connection Failed - Trying next server...';
    connectionStatus.classList.add('disconnected');
    
    //fault tolerance
    const currentPort = socket.io.uri.split(':').pop();
    const nextServer = currentPort === '3000' ? 'http://localhost:3001' : 'http://localhost:3000';
    
    console.log(`Falling back to: ${nextServer}`);
    socket.io.uri = nextServer;
    socket.connect();
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectionStatus.textContent = 'Disconnected - Reconnecting...';
    connectionStatus.classList.add('disconnected');
    
    if (isJoined) {
        addMessage('System', 'Connection lost. Attempting to reconnect...', true);
    }
    
    // temporary disable chat
    messageInput.disabled = true;
    sendBtn.disabled = true;
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected to server after ${attemptNumber} attempts`);
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('disconnected');
    
    // AUTO-REJOIN
});

socket.on('reconnect_attempt', () => {
    console.log('Attempting to reconnect...');
});

socket.on('reconnect_error', (error) => {
    console.log('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
    console.log('Reconnection failed');
    connectionStatus.textContent = 'Connection Failed - Refresh page';
    connectionStatus.classList.add('disconnected');
});

// handle message
socket.on('message', (data) => {
    addMessage(data.user, data.text, data.user === 'System', data.timestamp, data.server);
});

// update user list
socket.on('users-update', (users) => {
    updateUsersList(users);
});

//join chat
joinBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        socket.emit('register-user', username);
        isJoined = true;
        
        //update UI
        usernameInput.disabled = true;
        joinBtn.disabled = true;
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        addMessage('System', `You joined as ${username}`, true);
    }
});

//send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !sendBtn.disabled) {
        sendMessage();
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('send-message', message);
        messageInput.value = '';
    }
}

//add message to chat
function addMessage(user, text, isSystem = false, timestamp = null, server = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSystem ? 'system' : ''}`;
    
    const time = timestamp || new Date().toLocaleTimeString();
    
    let html = `
        <div class="message-header">
            <span class="message-user">${user}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${text}</div>
    `;
    
    if (server) {
        html += `<div class="message-server">via ${server}</div>`;
    }
    
    messageDiv.innerHTML = html;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

//update users list
function updateUsersList(users) {
    usersList.innerHTML = '';
    userCount.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        usersList.appendChild(li);
    });
}

//enable disable join button based on username input
usernameInput.addEventListener('input', () => {
    joinBtn.disabled = !usernameInput.value.trim() || !socket.connected;
});