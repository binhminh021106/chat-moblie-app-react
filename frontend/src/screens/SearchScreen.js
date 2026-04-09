import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CẬP NHẬT IP CỦA BẠN VÀO ĐÂY
const IP_MAY_TINH = '192.168.1.33';
const API_URL = `http://${IP_MAY_TINH}:3000/api/users`;

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Hàm xử lý tìm kiếm khi người dùng nhập chữ
  const handleSearch = async (text) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const response = await axios.get(`${API_URL}/search?query=${text}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (error) {
      console.log('Lỗi tìm kiếm:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Thanh tìm kiếm */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={24} color="#666" />
        <TextInput
          style={styles.input}
          placeholder="Tìm tên người dùng..."
          value={query}
          onChangeText={handleSearch}
          autoFocus
        />
      </View>

      {/* Danh sách kết quả */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#0088cc" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.userItem}
              onPress={() => navigation.navigate('Chat', { 
                receiverId: item._id, 
                receiverName: item.displayName || item.username 
              })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.username[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.displayName}>{item.displayName || item.username}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
              <MaterialIcons name="chat" size={24} color="#0088cc" style={styles.chatIcon} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f1f1f1', 
    margin: 15, 
    paddingHorizontal: 15, 
    borderRadius: 25,
    height: 50
  },
  input: { flex: 1, marginLeft: 10, fontSize: 16 },
  userItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  avatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#0088cc', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  displayName: { fontSize: 16, fontWeight: 'bold' },
  username: { color: '#666', fontSize: 14 },
  chatIcon: { marginLeft: 'auto' }
});