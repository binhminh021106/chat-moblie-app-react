import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { jwtDecode } from "jwt-decode"; // Minh nhớ chạy lệnh: npx expo install jwt-decode

// Đọc IP từ biến môi trường
const IP_MAY_TINH = process.env.EXPO_PUBLIC_SERVER_IP || '192.168.1.33'; 
const API_URL = `http://${IP_MAY_TINH}:3000/api/auth`;

const authService = {
  // Hàm đăng nhập  
  login: async (username, password) => {
    try {
      console.log(`🚀 [Auth] Gửi POST tới: ${API_URL}/login`);
      const response = await axios.post(`${API_URL}/login`, { 
        username: username.trim(), 
        password: password.trim() 
      }, { timeout: 10000 });

      if (response.status === 200) {
        await AsyncStorage.setItem('jwt_token', response.data.token);
        return { success: true };
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.log('❌ Lỗi Đăng nhập:', errorMsg);
      Alert.alert("Lỗi kết nối", `Chi tiết: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  },

  // Hàm đăng ký
  register: async (username, password, displayName) => {
    try {
      console.log(`🚀 [Auth] Gửi POST tới: ${API_URL}/register`);
      const response = await axios.post(`${API_URL}/register`, { 
        username: username.trim(), 
        password: password.trim(), 
        displayName: displayName.trim() 
      }, { timeout: 10000 });

      if (response.status === 201) {
        return { success: true };
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.log('❌ Lỗi Đăng ký:', errorMsg);
      Alert.alert("Lỗi Đăng ký", `Chi tiết: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('jwt_token');
  },

  // --- HÀM MỚI: Lấy thông tin người dùng đang đăng nhập ---
  getCurrentUser: async () => {
    const token = await AsyncStorage.getItem('jwt_token');
    if (!token) return null;
    try {
      const decoded = jwtDecode(token);
      return decoded; // Trả về { id, username }
    } catch (e) {
      return null;
    }
  },

  getToken: async () => {
    return await AsyncStorage.getItem('jwt_token');
  }
};

export default authService;