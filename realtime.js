const { Server } = require("socket.io");
const { verifyToken } = require("./middleware/auth");

let io = null;

// Chaque utilisateur connecté rejoint la room "user:<id>".
// On notifie ensuite l'agent, son recouvreur et son agrégateur à chaque changement de commande.
exports.init = (server) => {

    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth && socket.handshake.auth.token;
            socket.userId = verifyToken(token).userId;
            next();
        } catch (e) {
            next(new Error("unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        socket.join(`user:${socket.userId}`);
        console.log("Client temps réel connecté :", socket.userId);

        socket.on("disconnect", () => {
            console.log("Client temps réel déconnecté :", socket.userId);
        });
    });

    return io;
};

exports.notifyOrder = (order) => {

    if (!io || !order) return;

    const payload = {
        _id: order._id ? order._id.toString() : null,
        agent_id: order.agent_id ? order.agent_id.toString() : null,
        status: order.status || null,
        type: order.type || null
    };

    const rooms = [order.agent_id, order.rec_id, order.agg_id]
        .filter(Boolean)
        .map(id => `user:${id}`);

    if (rooms.length > 0) {
        io.to(rooms).emit("order:changed", payload);
    }
};

exports.notifyOrders = (orders) => {
    for (const order of orders || []) {
        exports.notifyOrder(order);
    }
};

exports.notifyUser = (userId, event) => {
    if (!io || !userId) return;
    io.to(`user:${userId}`).emit(event, { user_id: userId.toString() });
};
