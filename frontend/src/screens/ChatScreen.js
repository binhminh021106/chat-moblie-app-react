import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  SafeAreaView, 
  StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import io from 'socket.io-client';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../services/authService';

// Đọc IP từ biến môi trường, nếu không có sẽ lấy giá trị mặc định để phòng hờ
const IP_MAY_TINH = process.env.EXPO_PUBLIC_SERVER_IP || '192.168.1.33';
const API_URL = `http://${IP_MAY_TINH}:3000/api/users`;
const SOCKET_URL = `http://${IP_MAY_TINH}:3000`;

const TELEGRAM_COLORS = [
  '#cc6a67', '#6fb26a', '#d69e4a', '#6995cc', 
  '#b079d1', '#539ad4', '#66cc99', '#eb70b8', 
  '#f28c48', '#517da2'
];

export default function ChatScreen({ route, navigation }) {
  const { receiverId, receiverName, isGroup } = route.params; 
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [memberCount, setMemberCount] = useState(0);
  const socket = useRef(null);
  const flatListRef = useRef(null);

  const getAvatarColor = (senderId) => {
    const id = typeof senderId === 'object' ? senderId?._id : senderId;
    if (!id) return TELEGRAM_COLORS[0];
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return TELEGRAM_COLORS[hash % TELEGRAM_COLORS.length];
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#000' }} numberOfLines={1}>
            {receiverName}
          </Text>
          {isGroup ? (
            <Text style={{ fontSize: 12, color: '#888' }}>
              {memberCount > 0 ? `${memberCount} members` : 'group chat'}
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: '#888' }}>online</Text>
          )}
        </View>
      ),
    });
  }, [memberCount, receiverName, isGroup, navigation]);

  useEffect(() => {
    const initChat = async () => {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      const token = await AsyncStorage.getItem('jwt_token');

      if (isGroup) {
        try {
          const groupRes = await axios.get(`${API_URL}/groups/${receiverId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMemberCount(groupRes.data.memberCount);
        } catch (e) { console.log("Error fetching group info:", e); }
      }

      try {
        const response = await axios.get(`${API_URL}/messages/${receiverId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessages(response.data);
      } catch (error) {
        console.log('Error loading messages:', error);
      } finally {
        setIsLoading(false);
      }

      socket.current = io(SOCKET_URL);
      const room = isGroup ? receiverId : [user.id, receiverId].sort().join('_');
      socket.current.emit('join_room', room);

      socket.current.on('receive_message', (data) => {
        setMessages((prev) => [...prev, data]);
      });

      return () => { if (socket.current) socket.current.disconnect(); };
    };

    initChat();
  }, [receiverId, isGroup]);

  const sendMessage = () => {
    if (text.trim() === '' || !socket.current || !currentUser) return;
    const room = isGroup ? receiverId : [currentUser.id, receiverId].sort().join('_');
    
    // Gửi kèm senderName để Server phát lại tức thì
    const messageData = {
      sender: currentUser.id,
      senderName: currentUser.displayName || currentUser.username,
      receiver: receiverId,
      text: text.trim(),
      room: room
    };
    socket.current.emit('send_message', messageData);
    setText('');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderItem = ({ item }) => {
    // Vì DB trả về sender là object (do populate), Socket trả về sender là object
    const senderId = item.sender?._id || item.sender;
    const isMe = senderId === currentUser?.id;
    
    // Lấy tên hiển thị
    let senderName = 'Member';
    if (isMe) {
      senderName = 'You';
    } else if (item.sender?.displayName || item.sender?.username) {
      senderName = item.sender.displayName || item.sender.username;
    } else if (item.senderName) {
      senderName = item.senderName;
    } else if (!isGroup) {
      senderName = receiverName;
    }

    const initial = senderName ? senderName[0].toUpperCase() : '?';

    return (
      <View style={[styles.messageWrapper, isMe ? styles.myWrapper : styles.theirWrapper]}>
        {!isMe && (
          <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(senderId) }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {isGroup && !isMe && (
            <Text style={[styles.senderNameLabel, { color: getAvatarColor(senderId) }]}>
              {senderName}
            </Text>
          )}
          
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {item.text}
          </Text>
          
          <View style={styles.timeWrapper}>
            <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
              {formatTime(item.createdAt || new Date())}
            </Text>
            {isMe && <MaterialIcons name="done-all" size={14} color="#63ab62" style={{marginLeft: 4}} />}
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0088cc" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item._id || index.toString()}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={renderItem}
          contentContainerStyle={styles.messageList}
        />

        <View style={styles.bottomBar}>
          <View style={styles.inputBox}>
            <TouchableOpacity style={styles.iconInInput}>
              <MaterialIcons name="sentiment-satisfied" size={26} color="#888" />
            </TouchableOpacity>
            <TextInput
              style={styles.inputField}
              placeholder="Message"
              placeholderTextColor="#999"
              value={text}
              onChangeText={setText}
              multiline
            />
            <TouchableOpacity style={styles.iconInInput}>
              <MaterialIcons name="attach-file" size={26} color="#888" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.sendCircle, !text.trim() && styles.sendDisabled]} 
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <MaterialIcons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#e5e5e5' },
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messageList: { paddingHorizontal: 12, paddingVertical: 15 },
  messageWrapper: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  myWrapper: { justifyContent: 'flex-end' },
  theirWrapper: { justifyContent: 'flex-start' },
  avatarCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, maxWidth: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 2 },
  myBubble: { backgroundColor: '#efffde', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  senderNameLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  messageText: { fontSize: 16, color: '#000', lineHeight: 22 },
  myText: { color: '#000' },
  theirText: { color: '#000' },
  timeWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10 },
  myTime: { color: '#63ab62' },
  theirTime: { color: '#a0a0a0' },
  bottomBar: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#fff', alignItems: 'flex-end', borderTopWidth: 0.5, borderTopColor: '#ddd' },
  inputBox: { flex: 1, flexDirection: 'row', backgroundColor: '#f1f1f1', borderRadius: 24, paddingHorizontal: 10, alignItems: 'center', marginRight: 10, maxHeight: 120 },
  inputField: { flex: 1, paddingHorizontal: 10, paddingVertical: 10, fontSize: 16, color: '#000' },
  iconInInput: { padding: 8 },
  sendCircle: { backgroundColor: '#0088cc', width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  sendDisabled: { backgroundColor: '#b3e0ff' }
});