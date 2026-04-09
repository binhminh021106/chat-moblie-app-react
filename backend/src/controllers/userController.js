const User = require('../models/User');
const Message = require('../models/Message');
const FriendRequest = require('../models/FriendRequest');
const Group = require('../models/Group');

// 1. User search logic
exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user.id;
        if (!query) return res.json([]);

        const users = await User.find({
            username: { $regex: query, $options: 'i' },
            _id: { $ne: currentUserId }
        }).select('username displayName avatar');

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Search error" });
    }
};

// 2. Get conversations list
exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const myGroups = await Group.find({ members: currentUserId }).select('_id');
        const groupIds = myGroups.map(g => g._id);

        const messages = await Message.find({
            $or: [
                { sender: currentUserId }, 
                { receiver: currentUserId },
                { receiver: { $in: groupIds } }
            ]
        }).sort({ createdAt: -1 });

        const conversationMap = new Map();

        for (const msg of messages) {
            const isGroupMsg = groupIds.some(id => id.toString() === msg.receiver.toString());
            let targetId;
            if (isGroupMsg) {
                targetId = msg.receiver.toString();
            } else {
                targetId = msg.sender.toString() === currentUserId ? msg.receiver.toString() : msg.sender.toString();
            }
            
            if (!conversationMap.has(targetId)) {
                conversationMap.set(targetId, {
                    lastMsg: msg.text,
                    time: msg.createdAt,
                    isGroup: isGroupMsg
                });
            }
        }

        const result = [];
        for (const [targetId, chatData] of conversationMap) {
            if (chatData.isGroup) {
                const group = await Group.findById(targetId).select('name');
                if (group) {
                    result.push({
                        id: group._id,
                        name: group.name,
                        lastMsg: chatData.lastMsg,
                        time: chatData.time,
                        isGroup: true,
                        unread: 0
                    });
                }
            } else {
                const user = await User.findById(targetId).select('username displayName avatar');
                if (user) {
                    result.push({
                        id: user._id,
                        name: user.displayName || user.username,
                        lastMsg: chatData.lastMsg,
                        time: chatData.time,
                        isGroup: false,
                        unread: 0
                    });
                }
            }
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Error fetching conversations" });
    }
};

// 3. Get message history - FIXED: Added populate
exports.getMessages = async (req, res) => {
    try {
        const { receiverId } = req.params;
        const currentUserId = req.user.id;
        
        const group = await Group.findById(receiverId);
        let room;
        if (group) {
            room = group._id.toString();
        } else {
            room = [currentUserId, receiverId].sort().join('_');
        }

        // Fix: Lấy kèm thông tin sender để hiển thị tên trong lịch sử chat
        const messages = await Message.find({ room })
            .populate('sender', 'username displayName avatar')
            .sort({ createdAt: 1 });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "Error fetching messages" });
    }
};

// ... (các hàm khác giữ nguyên)
exports.sendFriendRequest = async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;
        if (senderId === receiverId) return res.status(400).json({ message: "Cannot send a friend request to yourself!" });
        const existingReq = await FriendRequest.findOne({ sender: senderId, receiver: receiverId, status: 'pending' });
        if (existingReq) return res.status(400).json({ message: "Friend request already sent and pending!" });
        const newReq = new FriendRequest({ sender: senderId, receiver: receiverId });
        await newReq.save();
        res.status(201).json({ message: "Friend request sent successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Error sending friend request" });
    }
};

exports.getFriendRequests = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const requests = await FriendRequest.find({ receiver: currentUserId, status: 'pending' }).populate('sender', 'username displayName avatar');
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: "Error fetching friend requests" });
    }
};

exports.respondFriendRequest = async (req, res) => {
    try {
        const { requestId, action } = req.body; 
        const friendReq = await FriendRequest.findById(requestId);
        if (!friendReq) return res.status(404).json({ message: "Friend request not found!" });
        if (action === 'accept') {
            friendReq.status = 'accepted';
            await User.findByIdAndUpdate(friendReq.sender, { $addToSet: { friends: friendReq.receiver } });
            await User.findByIdAndUpdate(friendReq.receiver, { $addToSet: { friends: friendReq.sender } });
        } else {
            friendReq.status = 'declined';
        }
        await friendReq.save();
        res.json({ message: `Friend request ${action === 'accept' ? 'accepted' : 'declined'}!` });
    } catch (error) {
        res.status(500).json({ message: "Error responding to friend request" });
    }
};

exports.getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('friends', 'username displayName avatar');
        res.json(user.friends || []);
    } catch (error) {
        res.status(500).json({ message: "Error fetching friends list" });
    }
};

exports.createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
        const currentUserId = req.user.id;
        const allMembers = [...members, currentUserId];
        const newGroup = new Group({ name, members: allMembers, admin: currentUserId });
        await newGroup.save();

        const systemMessage = new Message({
            sender: currentUserId, 
            receiver: newGroup._id,
            text: `Nhóm "${name}" đã được tạo.`,
            room: newGroup._id.toString()
        });
        await systemMessage.save();

        const io = req.app.get('io');
        if (io) {
            io.to(newGroup._id.toString()).emit('receive_message', {
                _id: systemMessage._id,
                sender: { _id: currentUserId, displayName: req.user.displayName || req.user.username },
                text: systemMessage.text,
                createdAt: systemMessage.createdAt
            });
        }
        res.status(201).json({ message: "Group created successfully", group: newGroup });
    } catch (error) {
        res.status(500).json({ message: "Error creating group" });
    }
};

exports.getGroupDetails = async (req, res) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId).select('name members');
        if (!group) return res.status(404).json({ message: "Group not found" });
        res.json({ id: group._id, name: group.name, memberCount: group.members.length });
    } catch (error) {
        res.status(500).json({ message: "Error fetching group details" });
    }
};