const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true, // Bắt buộc phải có
        unique: true,   // Không được trùng với người khác
        trim: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    displayName: {
        type: String,
        default: ''
    },
    avatar: {
        type: String,
        default: ''
    },
    friends: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User' // Liên kết tới chính bảng User
    }]
}, { 
    timestamps: true // Tự động thêm ngày tạo (createdAt) và ngày cập nhật (updatedAt)
});

module.exports = mongoose.model('User', userSchema);
