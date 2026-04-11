import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { User, Download, Play, AlertCircle } from 'lucide-react-native';
import { COLORS, SPACING } from '../constants/Theme';
import { fetchStories } from '../services/api';
import { downloadFile } from '../utils/download';
import { CustomButton } from '../components/CustomButton';
import { CustomInput } from '../components/CustomInput';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = width / 2 - SPACING.lg - SPACING.xs;

export default function StoryViewerScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);

  const handleFetch = async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    setStories([]);

    try {
      const data = await fetchStories(username.trim().replace('@', ''));
      if (data && data.length > 0) {
        setStories(data);
      } else {
        setError('No stories found or account is private.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch stories. Try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (item) => {
    const fileName = `ReelVault_Story_${Date.now()}.${item.type === 'video' ? 'mp4' : 'jpg'}`;
    const success = await downloadFile(item.url, fileName, item.type);
    if (success) {
      Alert.alert('Success', 'Story saved to gallery!');
    }
  };

  const renderStoryItem = ({ item }) => (
    <View style={styles.storyCard}>
      <Image source={{ uri: item.thumbnail || item.url }} style={styles.thumbnail} />
      {item.type === 'video' && (
        <View style={styles.videoBadge}>
          <Play color={COLORS.text} size={14} fill={COLORS.text} />
        </View>
      )}
      <TouchableOpacity 
        style={styles.storyDownloadBtn} 
        onPress={() => handleDownload(item)}
      >
        <Download color={COLORS.text} size={20} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Story Viewer</Text>
      <Text style={styles.subtitle}>Enter Instagram username (Public only)</Text>

      <CustomInput
        icon={User}
        placeholder="username"
        value={username}
        onChangeText={setUsername}
        onClear={() => setUsername('')}
      />

      <CustomButton
        title="View Stories"
        onPress={handleFetch}
        loading={loading}
        disabled={!username}
        colors={[COLORS.secondary, COLORS.accent]}
        style={{ marginBottom: SPACING.lg }}
      />

      {error ? (
        <View style={styles.errorContainer}>
          <AlertCircle color={COLORS.error} size={24} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          renderItem={renderStoryItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Find stories to download</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.xl,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: SPACING.xl,
  },
  storyCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 1.5,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    margin: SPACING.xs,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    borderRadius: 12,
  },
  storyDownloadBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
    elevation: 3,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    color: COLORS.error,
    marginTop: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
