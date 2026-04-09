import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  ScrollView 
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import authService from '../services/authService';

export default function RegisterScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password) {
      Alert.alert('Lỗi', 'Tên đăng nhập và mật khẩu không được để trống!');
      return;
    }

    setIsLoading(true);
    const result = await authService.register(username.trim(), password.trim(), displayName.trim());
    setIsLoading(false);

    if (result.success) {
      Alert.alert('Thành công', 'Tài khoản đã được tạo! Bạn có thể đăng nhập ngay.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } else {
      Alert.alert('Thất bại', result.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="person-add" size={80} color="#28a745" />
        <Text style={[styles.title, { color: '#28a745' }]}>Tạo Tài Khoản</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Tên hiển thị (VD: Minh Đẹp Trai)"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={styles.input}
          placeholder="Tên đăng nhập"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu (ít nhất 6 ký tự)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {isLoading ? (
          <ActivityIndicator size="large" color="#28a745" style={{ marginTop: 20 }} />
        ) : (
          <TouchableOpacity style={[styles.buttonMain, { backgroundColor: '#28a745' }]} onPress={handleRegister}>
            <Text style={styles.buttonText}>ĐĂNG KÝ</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Đã có tài khoản? Quay lại</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', marginTop: 10 },
  form: { width: '100%' },
  input: {
    backgroundColor: '#f1f1f1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  buttonMain: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkText: { color: '#28a745', textAlign: 'center', marginTop: 25, fontSize: 15 },
});