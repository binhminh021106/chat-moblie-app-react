require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const Message = require('./models/Message');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Lưu io vào app để các file Controller khác có thể dùng
app.set('io', io);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('🟢 Đã kết nối MongoDB!'))
    .catch(console.error);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`User joined room: ${room}`);
    });

    // Fix: Destructure thêm senderName từ client gửi lên
    socket.on('send_message', async ({ sender, senderName, receiver, text, room }) => {
        try {
            const newMessage = await Message.create({ sender, receiver, text, room });
            
            // Phát lại cho mọi người trong phòng bao gồm cả thông tin người gửi để hiển thị tên
            io.to(room).emit('receive_message', {
                _id: newMessage._id,
                sender: {
                    _id: sender,
                    displayName: senderName
                },
                text,
                createdAt: newMessage.createdAt
            });
        } catch (error) {
            console.error('❌ Lỗi lưu tin nhắn:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server chạy tại port ${PORT}`));