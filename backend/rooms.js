// Room management module
const db = require('./index').db;

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> roomData
  }

  createRoom(socket, io, roomData) {
    console.log('RoomManager.createRoom called with roomData:', roomData);
    const roomId = `room_${Date.now()}`;
    const userId = socket.id; // Use socket.id as user identifier
    const room = {
      id: roomId,
      name: roomData.name,
      host: userId,
      players: [],
      spectators: [],
      maxPlayers: roomData.maxPlayers || 4,
      gameMode: roomData.gameMode || 'x01',
      gameOptions: roomData.gameOptions || {},
      whoStarts: roomData.whoStarts || 'random', // WICHTIG: whoStarts speichern
      isPrivate: roomData.isPrivate || false,
      password: roomData.password || null,
      createdAt: new Date(),
      gameStarted: false,
      gameEnded: false,
      gameWinner: null,
      gameState: null
    };
    this.rooms.set(roomId, room);
    console.log('Room created:', room);

    // Join the creator to the room
    const joinResult = this.joinRoomInternal(roomId, userId);
    if (joinResult.success) {
      console.log('Creator joined room successfully');
      // Emit joinedRoom to the creator
      socket.emit('joinedRoom', { success: true, room: room, role: joinResult.role });
      // Emit roomsUpdated to all clients
      io.emit('roomsUpdated', this.getRooms());
    } else {
      console.log('Failed to join creator to room:', joinResult.message);
      socket.emit('roomCreationError', { message: joinResult.message });
    }
    return room;
  }

  joinRoom(socket, io, data) {
    console.log('RoomManager.joinRoom called with data:', data);
    const roomId = data.roomId;
    const userId = socket.id;
    const password = data.password;
    const result = this.joinRoomInternal(roomId, userId, password);
    if (result.success) {
      console.log('User joined room successfully');
      socket.emit('joinedRoom', { success: true, room: this.getRoom(roomId), role: result.role });
      io.emit('roomsUpdated', this.getRooms());
    } else {
      console.log('Failed to join room:', result.message);
      socket.emit('joinedRoom', { success: false, message: result.message });
    }
  }

  getRooms(socket, io) {
    console.log('RoomManager.getRooms called');
    const rooms = this.getRoomsInternal();
    socket.emit('roomsUpdated', rooms);
  }

joinRoomInternal(roomId, userId, password = null) {
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

  getRoomsInternal() {
    return Array.from(this.rooms.values()).filter(room => !room.isPrivate);
  }

  getRooms() {
    return Array.from(this.rooms.values()).filter(room => !room.isPrivate);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
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