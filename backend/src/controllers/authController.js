const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Hàm Đăng ký (Register)
exports.register = async (req, res) => {
    try {
        const { username, password, displayName } = req.body;

        // 1. Kiểm tra xem user đã tồn tại chưa
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
        }

        // 2. Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Tạo user mới và lưu vào DB
        const newUser = new User({
            username,
            password: hashedPassword,
            displayName: displayName || username // Nếu không nhập tên hiển thị thì lấy luôn username
        });
        await newUser.save();

        res.status(201).json({ message: "Đăng ký thành công!", user: { id: newUser._id, username: newUser.username } });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// Hàm Đăng nhập (Login)
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Tìm user trong DB
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: "Tên đăng nhập không tồn tại!" });
        }

        // 2. So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Mật khẩu không đúng!" });
        }

        // 3. Tạo JWT Token (Vé thông hành)
        // Lưu ý: Cần thêm JWT_SECRET vào file .env
        const token = jwt.sign(
            { id: user._id, username: user.username }, 
            process.env.JWT_SECRET, // Chuỗi bí mật để tạo token
            { expiresIn: '7d' } // Token có hạn trong 7 ngày
        );

        res.status(200).json({ 
            message: "Đăng nhập thành công!", 
            token, 
            user: { id: user._id, username: user.username, displayName: user.displayName } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};