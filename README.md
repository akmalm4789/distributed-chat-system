# Distributed Chat System

A web-based real-time distributed chat system with load balancing, cross-server communication, and fault tolerance.

## Technologies Used

- Node.js
- Express.js
- Socket.IO
- Redis (Docker)
- HTML, CSS, JavaScript

## Features

- Real-time messaging with timestamps
- Multiple server instances (port 3000 & 3001)
- Redis-powered cross-server communication
- Automatic user list synchronization
- Fault tolerance - system survives server failure
- Auto-reconnection with seamless rejoin

## How to Run

1. Install dependencies: npm install
2. Start Redis using Docker: docker-compose up -d
3. Start both servers (in separate terminals):npm run server1
npm run server2

4. Open browsers to:
- http://localhost:3000
- http://localhost:3001

## Author

Muhammad Akmal Bin Ahmad Amiri
- Student ID: BCS2402-029
- Class: DCS5C
## Course
Parallel and Distributed Computing - TechCom Solutions
