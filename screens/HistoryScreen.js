import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { 
  ArrowLeft,
  Play, 
  Trash2, 
  Download, 
  Video, 
  FolderOpen,
} from 'lucide-react-native';
import { COLORS, RADII, SHADOWS } from '../constants/Theme';
import { getHistory, deleteHistoryItem, updateFileExists, clearHistory } from '../services/db';

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
    
    // Check local file existence
    const verifiedData = await Promise.all(
      data.map(async (item) => {
        try {
          if (item.filepath) {
            const info = await FileSystem.getInfoAsync(item.filepath);
            if (info.exists !== !!item.file_exists) {
              await updateFileExists(item.id, info.exists);
              return { ...item, file_exists: info.exists ? 1 : 0 };
            }
          }
        } catch (e) {}
        return item;
      })
    );
    
    setHistory(verifiedData);
  };

  const handlePlay = (item) => {
    if (!item.file_exists) {
      Alert.alert(
        'File Deleted', 
        'The file has been deleted or moved from your device.'
      );
      return;
    }
    // Navigate to in-app player screen with local file path
    navigation.navigate('Player', { filepath: item.filepath, title: item.title });
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Remove from History', 
      'Are you sure you want to remove this item from your history?', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            await deleteHistoryItem(id);
            setHistory(prev => prev.filter(h => h.id !== id));
          }
        }
      ]
    );
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    Alert.alert(
      'Clear All History',
      'Are you sure you want to clear your download history? Your saved files on device will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
            setHistory([]);
          },
        },
      ]
    );
  };

  const renderPlatformIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('instagram')) {
      return (
        <View style={[styles.platformIconCircle, { backgroundColor: '#E1306C' }]}>
          <Video color="#FFF" size={14} />
        </View>
      );
    }
    if (p.includes('youtube')) {
      return (
        <View style={[styles.platformIconCircle, { backgroundColor: '#FF0000' }]}>
          <Play color="#FFF" size={12} fill="#FFF" />
        </View>
      );
    }
    return (
      <View style={[styles.platformIconCircle, { backgroundColor: COLORS.primary }]}>
        <Download color="#000" size={14} />
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const formattedDate = item.downloaded_at 
      ? new Date(item.downloaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    const sizeDisplay = item.filesize_mb ? `${item.filesize_mb} MB` : null;

    return (
      <View style={styles.card}>
        <View style={styles.cardMainRow}>
          {/* Platform Icon (colored) */}
          {renderPlatformIcon(item.platform)}

          {/* Details */}
          <View style={styles.infoWrapper}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title || 'Downloaded Media'}
            </Text>

            <View style={styles.metaRow}>
              {/* Date */}
              {!!formattedDate && <Text style={styles.metaText}>{formattedDate}</Text>}

              {/* Format Badge (amber pill) */}
              <View style={styles.formatBadge}>
                <Text style={styles.formatBadgeText}>{item.format || 'MP4'}</Text>
              </View>

              {/* File size */}
              {!!sizeDisplay && <Text style={styles.metaText}>{sizeDisplay}</Text>}
            </View>

            {!item.file_exists && (
              <Text style={styles.deletedWarning}>File removed from device</Text>
            )}
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.cardActionRow}>
          {/* Small amber pill Play button */}
          <TouchableOpacity 
            style={[styles.playPillBtn, !item.file_exists && { opacity: 0.5 }]} 
            onPress={() => handlePlay(item)}
            activeOpacity={0.8}
          >
            <Play color="#000" size={13} fill="#000" />
            <Text style={styles.playBtnText}>Play</Text>
          </TouchableOpacity>

          {/* Red trash delete button */}
          <TouchableOpacity 
            style={styles.deleteBtn} 
            onPress={() => handleDelete(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 color="#EF4444" size={18} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Back, Title, and Clear All */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft color={COLORS.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Downloads</Text>
        {history.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Download color={COLORS.primary} size={36} />
          </View>
          <Text style={styles.emptyTitle}>No downloads yet</Text>
          <Text style={styles.emptySubtitle}>
            Files you download will securely appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  navTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  clearAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearAllText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110, // Content padding bottom 110px
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  platformIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  infoWrapper: {
    flex: 1,
  },
  itemTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  formatBadge: {
    backgroundColor: COLORS.amberGlass,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  formatBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  deletedWarning: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  playPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary, // small amber pill button
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  playBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.amberGlass,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
