const jwt = require('jsonwebtoken');

// Middleware này dùng để kiểm tra xem iPhone gửi yêu cầu lên có kèm theo "vé" (Token) hợp lệ không
module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Không có quyền truy cập, vui lòng đăng nhập lại!" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'BiMatCuaMinh123');
        req.user = decoded; // Lưu thông tin người dùng vào request để các hàm sau sử physicist
        next();
    } catch (err) {
        res.status(401).json({ message: "Phiên đăng nhập hết hạn!" });
    }
};