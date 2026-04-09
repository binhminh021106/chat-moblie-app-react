const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    room: { type: String, required: true } // ID phòng chat (ghép từ 2 ID user)
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);