function registerMediaEvents({ io, socket }) {
    const emitMediaEvent = (eventName, data) => {
        const { to, from, roomId } = data;
        const hasDirectTarget = typeof to === 'string' && to.length > 0 && io.sockets.sockets.has(to);
        if (hasDirectTarget) {
            io.to(to).emit(eventName, data);
            return;
        }
        if (roomId) {
            socket.to(roomId).emit(eventName, data);
            return;
        }
        console.warn(`[RTC] ${eventName} ohne gültiges Ziel von ${from}`);
    };

    socket.on('camera-offer', (data) => {
        emitMediaEvent('camera-offer', data);
    });

    socket.on('camera-answer', (data) => {
        emitMediaEvent('camera-answer', data);
    });

    socket.on('camera-ice', (data) => {
        emitMediaEvent('camera-ice', data);
    });
}

module.exports = registerMediaEvents;
