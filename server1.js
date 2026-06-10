const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();


const localUsers = new Map();
const globalUsers = new Set();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    
    const serverPort = process.env.PORT || 3000;
    console.log(` Redis connected for Server ${serverPort}`);

    subClient.subscribe('user-sync', (message) => {
        const data = JSON.parse(message);
        
        if (data.type === 'join') {
            globalUsers.add(data.username);
            //broadcast
            io.emit('users-update', Array.from(globalUsers));
            console.log(`Synced: ${data.username} joined via Redis`);
        } 
        else if (data.type === 'leave') {
            globalUsers.delete(data.username);
            io.emit('users-update', Array.from(globalUsers));
            console.log(`Synced: ${data.username} left via Redis`);
        }
        else if (data.type === 'sync-request') {
            //send current user list
            pubClient.publish('user-sync-response', JSON.stringify({
                users: Array.from(globalUsers)
            }));
        }
        else if (data.type === 'sync-response') {
            //update global users with response
            data.users.forEach(user => globalUsers.add(user));
            io.emit('users-update', Array.from(globalUsers));
        }
    });

    //sync response
    subClient.subscribe('user-sync-response', (message) => {
        const data = JSON.parse(message);
        data.users.forEach(user => globalUsers.add(user));
        io.emit('users-update', Array.from(globalUsers));
        console.log(` Received user sync: ${data.users.join(', ')}`);
    });

    io.on('connection', (socket) => {
        console.log(`New connection on Server ${serverPort}: ${socket.id}`);

        //when a new client connects, send them the current global user list
        socket.emit('users-update', Array.from(globalUsers));

        socket.on('register-user', (username) => {
            //local store
            localUsers.set(socket.id, username);
            socket.username = username;
            
            //add to global if not already there
            if (!globalUsers.has(username)) {
                globalUsers.add(username);
                
                //publish join event to other servers
                pubClient.publish('user-sync', JSON.stringify({
                    type: 'join',
                    username: username,
                    server: serverPort
                }));
            }
            
            //send updated user list to all clients on this server
            io.emit('users-update', Array.from(globalUsers));
            
            socket.emit('message', {
                user: 'System',
                text: `Welcome ${username}! You are connected to Server ${serverPort}`,
                timestamp: new Date().toLocaleTimeString()
            });
            
            socket.broadcast.emit('message', {
                user: 'System',
                text: `${username} has joined the chat`,
                timestamp: new Date().toLocaleTimeString()
            });
            
            console.log(` User registered: ${username} on Server ${serverPort}`);
            console.log('Current global users:', Array.from(globalUsers));
        });

        socket.on('send-message', (message) => {
            const username = socket.username || 'Anonymous';
            const messageData = {
                user: username,
                text: message,
                timestamp: new Date().toLocaleTimeString(),
                server: `Server ${serverPort}`
            };
            
            io.emit('message', messageData);
            console.log(` Message from ${username} on Server ${serverPort}: ${message}`);
        });

        socket.on('disconnect', () => {
            const username = socket.username;
            if (username) {
                localUsers.delete(socket.id);
                
                let userStillConnected = false;
                for (let [_, user] of localUsers) {
                    if (user === username) {
                        userStillConnected = true;
                        break;
                    }
                }
                
                //if user not on this server anymore, remove from global
                if (!userStillConnected) {
                    globalUsers.delete(username);
                    
                    //publish leave event to other servers
                    pubClient.publish('user-sync', JSON.stringify({
                        type: 'leave',
                        username: username,
                        server: serverPort
                    }));
                }
                
                //update all clients on this server
                io.emit('users-update', Array.from(globalUsers));
                
                io.emit('message', {
                    user: 'System',
                    text: `${username} has left the chat`,
                    timestamp: new Date().toLocaleTimeString()
                });
                
                console.log(` User disconnected from Server ${serverPort}: ${username}`);
                console.log('Current global users:', Array.from(globalUsers));
            }
        });
    });

    const PORT = serverPort;
    server.listen(PORT, () => {
        console.log(`Server ${PORT} running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Redis connection error:', err);
});