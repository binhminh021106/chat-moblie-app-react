const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Khai báo các API:
// [POST] http://localhost:3000/api/auth/register
router.post('/register', authController.register);

// [POST] http://localhost:3000/api/auth/login
router.post('/login', authController.login);

module.exports = router;