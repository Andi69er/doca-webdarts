// Room management module
const db = require('./index').db;

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> roomData
  }

  createRoom(roomData) {
    const roomId = `room_${Date.now()}`;
    const room = {
      id: roomId,
      name: roomData.name,
      host: roomData.host,
      players: [roomData.host],
      spectators: [],
      maxPlayers: roomData.maxPlayers || 4,
      gameMode: roomData.gameMode || 'x01',
      gameOptions: roomData.gameOptions || {},
      isPrivate: roomData.isPrivate || false,
      password: roomData.password || null,
      createdAt: new Date(),
      gameStarted: false,
      gameEnded: false,
      gameWinner: null,
      gameState: null
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRooms() {
    return Array.from(this.rooms.values()).filter(room => !room.isPrivate);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, userId, password = null) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, message: 'Room not found' };

    if (room.isPrivate && room.password !== password) {
      return { success: false, message: 'Invalid password' };
    }

    if (room.players.length >= room.maxPlayers) {
      // Add as spectator
      if (!room.spectators.includes(userId)) {
        room.spectators.push(userId);
      }
      return { success: true, role: 'spectator' };
    }

    if (!room.players.includes(userId)) {
      room.players.push(userId);
    }
    return { success: true, role: 'player' };
  }

  leaveRoom(roomId, userId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.players = room.players.filter(id => id !== userId);
    room.spectators = room.spectators.filter(id => id !== userId);

    // If host leaves, assign new host
    if (room.host === userId && room.players.length > 0) {
      room.host = room.players[0];
    }

    // If game in progress and player leaves, end game or handle accordingly
    if (room.gameStarted && !room.gameEnded && room.players.length < 2) {
      room.gameEnded = true;
      room.gameWinner = room.players.length === 1 ? room.players[0] : null; // Victory by forfeit or draw
    }

    // Remove empty rooms
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  startGame(roomId) {
    const room = this.getRoom(roomId);
    if (!room || room.players.length < 2) return { success: false, message: 'Not enough players' };

    room.gameStarted = true;
    return { success: true };
  }
}

module.exports = new RoomManager();