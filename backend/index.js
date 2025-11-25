const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

// Importiere unsere neue Socket-Logik
const initializeSocket = require('./socketHandler');

console.log('FINALE SERVER VERSION (mit ausgelagerter Logik) WIRD GESTARTET');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: "https://doca-webdarts-1.onrender.com",
  methods: ["GET", "POST"]
};
app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

// Übergebe das 'io'-Objekt an unsere ausgelagerte Logik
initializeSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});