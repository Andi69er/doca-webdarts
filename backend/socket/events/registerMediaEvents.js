function registerMediaEvents({ io, socket }) {
    socket.on('camera-offer', (data) => {
        const { to, from } = data;
        console.log(`[RTC] Offer von ${from} -> ${to}`);
        io.to(to).emit('camera-offer', data);
    });

    socket.on('camera-answer', (data) => {
        const { to, from } = data;
        console.log(`[RTC] Answer von ${from} -> ${to}`);
        io.to(to).emit('camera-answer', data);
    });

    socket.on('camera-ice', (data) => {
        const { to, from } = data;
        console.log(`[RTC] ICE von ${from} -> ${to}`);
        io.to(to).emit('camera-ice', data);
    });
}

module.exports = registerMediaEvents;
