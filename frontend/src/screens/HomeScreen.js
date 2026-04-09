import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TextInput,
  Keyboard,
  Platform,
  Modal,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons'; 
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import authService from '../services/authService'; 

// --- CONFIGURATION ---
const IP_MAY_TINH = '192.168.1.33';
const API_URL = `http://${IP_MAY_TINH}:3000/api/users/conversations`;
const SEARCH_URL = `http://${IP_MAY_TINH}:3000/api/users/search`;
const FRIEND_REQ_URL = `http://${IP_MAY_TINH}:3000/api/users/friend-request`;
const FRIENDS_URL = `http://${IP_MAY_TINH}:3000/api/users/friends`;
const GROUP_URL = `http://${IP_MAY_TINH}:3000/api/users/groups`;
const SOCKET_URL = `http://${IP_MAY_TINH}:3000`;

const TELEGRAM_COLORS = ['#cc6a67', '#6fb26a', '#d69e4a', '#6995cc', '#b079d1', '#539ad4'];

// --- HELPER FUNCTIONS ---
const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

const getAvatarColor = (name) => {
  if (!name) return TELEGRAM_COLORS[0];
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TELEGRAM_COLORS[charCodeSum % TELEGRAM_COLORS.length];
};

// --- SUB-COMPONENTS ---
const ChatItem = memo(({ item, theme, styles, onPress }) => (
  <TouchableOpacity 
    style={styles.chatItem}
    activeOpacity={0.6}
    onPress={() => onPress(item.id, item.name, item.isGroup)}
  >
    <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
      {item.isGroup ? (
        <Ionicons name="people" size={30} color="#fff" />
      ) : (
        <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
      )}
    </View>
    <View style={styles.chatContent}>
      <View style={styles.chatTopRow}>
        <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.chatTime}>{formatTime(item.time)}</Text>
      </View>
      <View style={styles.chatBottomRow}>
        <Text style={styles.lastMsg} numberOfLines={2}>
          {item.isGroup ? `👥 Group: ${item.lastMsg || 'Tap to chat'}` : item.lastMsg}
        </Text>
        {item.unread > 0 && (
          <View style={[styles.unreadBadge, { backgroundColor: theme.blueText }]}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </View>
  </TouchableOpacity>
));

const SearchResultItem = memo(({ item, theme, styles, onPress }) => {
  const displayName = item.displayName || item.username;
  return (
    <TouchableOpacity 
      style={styles.chatItem}
      activeOpacity={0.6}
      onPress={() => onPress(item._id, displayName)}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(displayName) }]}>
        <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatTopRow}>
          <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
        </View>
        <View style={styles.chatBottomRow}>
          <Text style={styles.lastMsg} numberOfLines={1}>@{item.username} - Tap to send request</Text>
          <Ionicons name="person-add-outline" size={20} color={theme.blueText} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// --- MAIN COMPONENT ---
export default function HomeScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [isSearchingDBMode, setIsSearchingDBMode] = useState(false);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isFetchingDB, setIsFetchingDB] = useState(false);

  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]); 
  
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [friendsList, setFriendsList] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const theme = {
    background: isDarkMode ? '#000000' : '#FFFFFF',
    text: isDarkMode ? '#FFFFFF' : '#000000',
    subText: isDarkMode ? '#8E8E93' : '#8E8E93',
    border: isDarkMode ? '#1C1C1E' : '#E5E5EA',
    searchBg: isDarkMode ? '#1C1C1E' : '#F2F2F7',
    tabBg: isDarkMode ? '#121212' : '#F8F8F8',
    blueText: isDarkMode ? '#0A84FF' : '#007AFF',
  };

  const styles = getStyles(theme);

  const fetchConversations = async () => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (!token) return;
      const response = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      setConversations(response.data);
    } catch (error) {
      console.log('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      if (!token) return;
      const response = await axios.get(FRIEND_REQ_URL, { headers: { Authorization: `Bearer ${token}` } });
      setFriendRequests(response.data || []);
    } catch (error) {
      console.log('Error fetching friend requests:', error);
    }
  };

  const openCreateGroupModal = async () => {
    setShowCreateGroup(true);
    setGroupName('');
    setSelectedFriends([]);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const response = await axios.get(FRIENDS_URL, { headers: { Authorization: `Bearer ${token}` } });
      setFriendsList(response.data || []);
    } catch (error) {
      console.log('Error fetching friends for group:', error);
    }
  };

  const toggleSelectFriend = (id) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter(fId => fId !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name!");
      return;
    }
    if (selectedFriends.length === 0) {
      alert("Please select at least 1 friend to add to the group!");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      await axios.post(GROUP_URL, {
        name: groupName.trim(),
        members: selectedFriends
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert("Group created successfully!");
      setShowCreateGroup(false);
      fetchConversations(); 
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchFriendRequests(); 
    
    let socket;
    const setupSocket = async () => {
      const user = await authService.getCurrentUser();
      if (user) {
        socket = io(SOCKET_URL);
        socket.emit('join_room', user.id); 
        socket.on('receive_message', () => fetchConversations());
        socket.on('receive_friend_request', () => fetchFriendRequests());
      }
    };
    setupSocket();
    
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
      fetchFriendRequests();
    });
    
    return () => {
      if (socket) socket.disconnect();
      unsubscribe();
    };
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversations();
    fetchFriendRequests();
  }, []);

  const handleDatabaseSearch = async (text) => {
    setDbSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsFetchingDB(true);
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      const response = await axios.get(`${SEARCH_URL}?query=${text}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data);
    } catch (error) {
      console.log('Error searching DB:', error);
    } finally {
      setIsFetchingDB(false);
    }
  };

  const closeDBSearch = useCallback(() => {
    setIsSearchingDBMode(false);
    setDbSearchQuery('');
    setSearchResults([]);
    Keyboard.dismiss();
  }, []);

  const filteredConversations = useMemo(() => {
    if (!localSearchQuery) return conversations;
    
    const lowerCaseQuery = localSearchQuery.toLowerCase();
    return conversations.filter(chat => 
      chat.name?.toLowerCase().includes(lowerCaseQuery) ||
      chat.lastMsg?.toLowerCase().includes(lowerCaseQuery)
    );
  }, [conversations, localSearchQuery]);

  const handleUserPress = useCallback(async (id, name, isGroup = false) => {
    if (isSearchingDBMode) {
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        await axios.post(FRIEND_REQ_URL, { receiverId: id }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`Friend request sent to ${name}!`);
        closeDBSearch();
      } catch (error) {
        alert(error.response?.data?.message || 'Error sending friend request!');
      }
    } else {
      navigation.navigate('Chat', { receiverId: id, receiverName: name, isGroup });
    }
  }, [isSearchingDBMode, closeDBSearch, navigation]);

  const handleFriendRequest = async (requestId, action) => {
    try {
      const token = await AsyncStorage.getItem('jwt_token');
      await axios.post(`${FRIEND_REQ_URL}/respond`, { requestId, action }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFriendRequests(prev => prev.filter(req => req._id !== requestId));
      
      if (action === 'accept') {
        alert("Friend request accepted!");
        fetchConversations(); 
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing request');
    }
  };

  const renderItem = useCallback(({ item }) => {
    if (isSearchingDBMode) {
      return <SearchResultItem item={item} theme={theme} styles={styles} onPress={handleUserPress} />;
    }
    return <ChatItem item={item} theme={theme} styles={styles} onPress={handleUserPress} />;
  }, [isSearchingDBMode, theme, styles, handleUserPress]);

  const listData = isSearchingDBMode ? searchResults : filteredConversations;

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.blueText} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={openCreateGroupModal}>
          <Text style={styles.headerLeftText}>New Group</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => {
            if (isSearchingDBMode) closeDBSearch();
            else {
              setIsSearchingDBMode(true);
              setLocalSearchQuery(''); 
            }
          }}>
            <Ionicons name={isSearchingDBMode ? "close-circle" : "person-add"} size={22} color={theme.blueText} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowNotifications(true)}>
            <Ionicons name="notifications-outline" size={24} color={theme.blueText} />
            {friendRequests.length > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{friendRequests.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isSearchingDBMode ? (
        <View style={styles.searchContainer}>
          <Text style={styles.searchLabel}>Global Search</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={theme.subText} />
            <TextInput
              style={styles.searchInput}
              placeholder="Enter username or ID..."
              placeholderTextColor={theme.subText}
              autoFocus={true}
              value={dbSearchQuery}
              onChangeText={handleDatabaseSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {isFetchingDB ? (
              <ActivityIndicator size="small" color={theme.blueText} />
            ) : dbSearchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => handleDatabaseSearch('')} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close-circle" size={18} color={theme.subText} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.localSearchContainer}>
          <View style={[styles.searchBox, { height: 44, borderRadius: 12 }]}>
            <Ionicons name="search" size={22} color={theme.subText} />
            <TextInput
              style={[styles.searchInput, { fontSize: 16 }]}
              placeholder="Search chats and messages..."
              placeholderTextColor={theme.subText}
              value={localSearchQuery}
              onChangeText={setLocalSearchQuery}
              autoCorrect={false}
            />
            {localSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setLocalSearchQuery('')} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Ionicons name="close-circle" size={20} color={theme.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <FlatList
        data={listData}
        keyExtractor={(item) => (item.id || item._id).toString()}
        renderItem={renderItem}
        refreshControl={
          !isSearchingDBMode ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.blueText} />
          ) : undefined
        }
        contentContainerStyle={[styles.listContent, listData.length === 0 && styles.listEmpty]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {isSearchingDBMode ? (
              <>
                <Ionicons name="search-outline" size={48} color={theme.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>
                  {dbSearchQuery.length < 2 
                    ? "Type at least 2 characters to search globally" 
                    : "No users found"}
                </Text>
              </>
            ) : localSearchQuery ? (
              <>
                <Ionicons name="file-tray-outline" size={48} color={theme.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>No results found for "{localSearchQuery}"</Text>
              </>
            ) : (
              <>
                <Ionicons name="chatbubbles-outline" size={48} color={theme.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>No chats yet</Text>
              </>
            )}
          </View>
        }
      />

      <Modal
        visible={showCreateGroup}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateGroup(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerLeft} onPress={() => setShowCreateGroup(false)}>
              <Text style={[styles.headerLeftText, { color: theme.subText }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Group</Text>
            <View style={styles.headerRight}>
              {isCreatingGroup ? (
                <ActivityIndicator size="small" color={theme.blueText} style={{marginRight: 10}}/>
              ) : (
                <TouchableOpacity onPress={handleCreateGroup}>
                  <Text style={[styles.headerLeftText, { fontWeight: 'bold' }]}>Create</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={{ padding: 16 }}>
            <TextInput
              style={[styles.inputGroup, { color: theme.text, backgroundColor: theme.searchBg }]}
              placeholder="Group Name..."
              placeholderTextColor={theme.subText}
              value={groupName}
              onChangeText={setGroupName}
            />
            <Text style={{ color: theme.subText, marginTop: 20, marginBottom: 10, fontWeight: 'bold' }}>
              SELECT FRIENDS ({selectedFriends.length} selected)
            </Text>
          </View>

          <FlatList
            data={friendsList}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={theme.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyText}>You don't have any friends yet.</Text>
                <Text style={styles.emptyText}>Find people to add friends first!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isSelected = selectedFriends.includes(item._id);
              return (
                <TouchableOpacity 
                  style={[styles.chatItem, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
                  onPress={() => toggleSelectFriend(item._id)}
                >
                  <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.displayName) }]}>
                    <Text style={styles.avatarText}>{(item.displayName || 'U')[0].toUpperCase()}</Text>
                  </View>
                  <View style={styles.chatContent}>
                    <View style={styles.chatTopRow}>
                      <Text style={styles.chatName}>{item.displayName || item.username}</Text>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={24} color={theme.blueText} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={24} color={theme.subText} />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Friend Requests</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close-circle" size={26} color={theme.subText} />
              </TouchableOpacity>
            </View>

            {friendRequests.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color={theme.border} />
                <Text style={[styles.emptyText, { marginTop: 10 }]}>No pending requests</Text>
              </View>
            ) : (
              <FlatList
                data={friendRequests}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <View style={styles.requestItem}>
                    <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.sender?.displayName || 'User') }]}>
                      <Text style={styles.avatarText}>{(item.sender?.displayName || 'U')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={[styles.requestName, { color: theme.text }]}>{item.sender?.displayName}</Text>
                      <Text style={styles.requestSub}>Wants to be your friend</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: theme.blueText }]}
                        onPress={() => handleFriendRequest(item._id, 'accept')}
                      >
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: theme.searchBg }]}
                        onPress={() => handleFriendRequest(item._id, 'decline')}
                      >
                        <Text style={[styles.actionBtnText, { color: theme.blueText }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSettings}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, minHeight: '30%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close-circle" size={26} color={theme.subText} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingRowLeft}>
                <Ionicons name={isDarkMode ? "moon" : "sunny"} size={24} color={theme.blueText} />
                <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
              </View>
              <Switch 
                value={isDarkMode} 
                onValueChange={setIsDarkMode} 
                trackColor={{ false: theme.border, true: theme.blueText }}
              />
            </View>

            <TouchableOpacity 
              style={styles.logoutBtn} 
              onPress={async () => {
                setShowSettings(false);
                await authService.logout();
                navigation.replace('Login');
              }}
            >
              <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="person-circle-outline" size={26} color={theme.subText} />
          <Text style={styles.tabText}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="call-outline" size={26} color={theme.subText} />
          <Text style={styles.tabText}>Calls</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="chatbubbles" size={26} color={theme.blueText} />
          <Text style={[styles.tabText, { color: theme.blueText }]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setShowSettings(true)}>
          <Ionicons name="settings-outline" size={26} color={theme.subText} />
          <Text style={styles.tabText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 54, backgroundColor: theme.background },
  headerLeft: { flex: 1, alignItems: 'flex-start' },
  headerLeftText: { color: theme.blueText, fontSize: 17 },
  headerTitle: { flex: 1, textAlign: 'center', color: theme.text, fontSize: 17, fontWeight: '700' },
  headerRight: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  iconBtn: { marginLeft: 16, paddingVertical: 4 },
  notificationBadge: { position: 'absolute', top: 2, right: -4, backgroundColor: '#FF3B30', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: theme.background },
  notificationBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4, backgroundColor: theme.background },
  searchLabel: { color: theme.blueText, fontSize: 13, marginBottom: 8, fontWeight: '500', paddingLeft: 4 },
  localSearchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.background },
  searchBox: { flexDirection: 'row', backgroundColor: theme.searchBg, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', height: 40 },
  searchInput: { flex: 1, color: theme.text, marginLeft: 8, fontSize: 15, paddingVertical: 0 },
  listContent: { paddingBottom: Platform.OS === 'ios' ? 100 : 80 },
  listEmpty: { flex: 1, justifyContent: 'center' },
  chatItem: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.background },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '600' },
  chatContent: { flex: 1, marginLeft: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingBottom: 12, justifyContent: 'center' },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 17, fontWeight: '600', color: theme.text, flex: 1 },
  chatTime: { color: theme.subText, fontSize: 14, marginLeft: 8, marginTop: 2 },
  chatBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { color: theme.subText, fontSize: 15, flex: 1, marginRight: 16, lineHeight: 20 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tabBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: theme.tabBg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingBottom: Platform.OS === 'ios' ? 28 : 12, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { color: theme.subText, fontSize: 10, marginTop: 4, fontWeight: '500' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: '30%' },
  emptyText: { color: theme.subText, fontSize: 16, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: '40%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  requestItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  requestInfo: { flex: 1, marginLeft: 12 },
  requestName: { fontSize: 16, fontWeight: '600' },
  requestSub: { fontSize: 13, color: theme.subText, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, marginLeft: 8 },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, marginBottom: 20 },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center' },
  settingText: { fontSize: 18, fontWeight: '500', marginLeft: 12 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 59, 48, 0.1)', paddingVertical: 14, borderRadius: 14, marginTop: 10 },
  logoutText: { color: '#FF3B30', fontSize: 18, fontWeight: '600', marginLeft: 8 },
  inputGroup: { height: 50, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 }
});