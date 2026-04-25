import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { Play, Trash2, Shield, FolderOpen } from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '../constants/Theme';
import { getHistory, deleteHistoryItem, updateFileExists } from '../services/db';

export default function HistoryScreen({ navigation }) {
  const isFocused = useIsFocused();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isFocused) {
      loadHistory();
    }
  }, [isFocused]);

  const loadHistory = async () => {
    const data = await getHistory();
    
    // Check file existence
    const verifiedData = await Promise.all(data.map(async (item) => {
      try {
        const info = await FileSystem.getInfoAsync(item.filepath);
        if (info.exists !== !!item.file_exists) {
          await updateFileExists(item.id, info.exists);
          return { ...item, file_exists: info.exists ? 1 : 0 };
        }
      } catch (e) {}
      return item;
    }));
    
    setHistory(verifiedData);
  };

  const handlePlay = (item) => {
    if (!item.file_exists) {
      Alert.alert('File Deleted', 'The file has been deleted from your device. You can try downloading it again.');
      return;
    }
    // Navigate to media player
    navigation.navigate('Player', { filepath: item.filepath, title: item.title });
  };

  const handleDelete = (id) => {
    Alert.alert('Remove from History', 'Are you sure you want to remove this from your history? The file will remain on your device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await deleteHistoryItem(id);
        setHistory(prev => prev.filter(h => h.id !== id));
      }}
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity style={styles.thumbnailWrap} onPress={() => handlePlay(item)}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
            <FolderOpen color={COLORS.textSecondary} size={24} />
          </View>
        )}
        <View style={styles.playOverlay}>
          <Play fill="#fff" color="#fff" size={20} />
        </View>
      </TouchableOpacity>
      
      <View style={styles.infoWrap}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.metaText}>{item.platform.toUpperCase()} • {item.format || 'Unknown'}</Text>
        <Text style={styles.metaText}>{new Date(item.downloaded_at).toLocaleDateString()}</Text>
        {!item.file_exists && (
          <Text style={styles.deletedText}>File Deleted</Text>
        )}
      </View>
      
      <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
        <Trash2 color={COLORS.textSecondary} size={20} />
      </TouchableOpacity>
    </View>
  );

  return (
    <LinearGradient colors={['#0A0A0B', '#151518', '#050505']} style={styles.container}>
      <View style={[styles.navbar, { justifyContent: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Shield color={COLORS.primary} size={18} style={{ marginRight: 8 }} />
          <Text style={styles.navTitle}>HISTORY</Text>
        </View>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyWrap}>
          <FolderOpen color={COLORS.textSecondary} size={48} opacity={0.5} />
          <Text style={styles.emptyTitle}>Vault is Empty</Text>
          <Text style={styles.emptySub}>Files you download will securely appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.lg },
  navbar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 100, paddingTop: 50 },
  navTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', letterSpacing: 2 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginTop: 16 },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8 },
  card: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  thumbnailWrap: { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', marginRight: 14 },
  thumbnail: { width: '100%', height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  infoWrap: { flex: 1, justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 2 },
  deletedText: { color: '#FF6B6B', fontSize: 11, fontWeight: 'bold', marginTop: 4 },
  deleteBtn: { padding: 10 },
});
