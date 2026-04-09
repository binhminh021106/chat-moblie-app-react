const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// API tìm kiếm bạn mới
router.get('/search', authMiddleware, userController.searchUsers);

// API lấy danh sách các cuộc trò chuyện hiện có
router.get('/conversations', authMiddleware, userController.getConversations);
router.get('/messages/:receiverId', authMiddleware, userController.getMessages);

router.post('/friend-request', authMiddleware, userController.sendFriendRequest);
router.get('/friend-request', authMiddleware, userController.getFriendRequests);
router.post('/friend-request/respond', authMiddleware, userController.respondFriendRequest);

// API Lấy danh sách bạn bè (Để hiện ra trong bảng chọn tạo nhóm)
router.get('/friends', authMiddleware, userController.getFriends);

// API Tạo Nhóm Chat
router.post('/groups', authMiddleware, userController.createGroup);
router.get('/groups/:groupId', authMiddleware, userController.getGroupDetails);

module.exports = router;