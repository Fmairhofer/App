import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function StrategiesScreen() {
  const { colors } = useTheme();
  const [strategies, setStrategies] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'my' | 'samples'>('my');

  const loadData = async () => {
    try {
      const [myStrats, sampleStrats] = await Promise.all([
        api.getStrategies(),
        api.getMe().then(() => fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/strategies/samples/list`).then(r => r.json())).catch(() => []),
      ]);
      setStrategies(myStrats);
      setSamples(Array.isArray(sampleStrats) ? sampleStrats : []);
    } catch (e) {
      console.log('Failed to load strategies:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/x-python', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      setUploading(true);

      const content = await FileSystem.readAsStringAsync(file.uri);
      const name = file.name?.replace('.py', '') || 'My Strategy';

      await api.uploadStrategy(name, `Uploaded from ${file.name}`, content, file.name || 'strategy.py');
      Alert.alert('Success', 'Strategy uploaded successfully');
      loadData();
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleCopySample = async (id: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/strategies/samples/copy/${id}`, {
        method: 'POST', headers,
      });
      if (!res.ok) throw new Error('Failed to copy');
      Alert.alert('Success', 'Sample strategy copied to your library');
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Strategy', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteStrategy(id);
            setStrategies(s => s.filter(x => x.id !== id));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const displayList = tab === 'my' ? strategies : samples;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Strategies</Text>
        <TouchableOpacity
          testID="upload-strategy-file-btn"
          style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={16} color="#fff" />
              <Text style={styles.uploadBtnText}>Upload .py</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          testID="my-strategies-tab"
          style={[styles.tabBtn, tab === 'my' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('my')}
        >
          <Text style={[styles.tabText, { color: tab === 'my' ? colors.text : colors.textSecondary }]}>My Strategies</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="sample-strategies-tab"
          style={[styles.tabBtn, tab === 'samples' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setTab('samples')}
        >
          <Text style={[styles.tabText, { color: tab === 'samples' ? colors.text : colors.textSecondary }]}>Samples</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : displayList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="code-slash-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {tab === 'my' ? 'No strategies yet' : 'No sample strategies'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
              {tab === 'my' ? 'Upload a .py file or copy from samples' : 'Check back later'}
            </Text>
          </View>
        ) : (
          displayList.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.codeIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="code-slash" size={18} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: colors.text }]}>{s.name}</Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                    {s.description || s.filename}
                  </Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                {tab === 'samples' ? (
                  <TouchableOpacity
                    testID={`copy-sample-${s.id}`}
                    style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleCopySample(s.id)}
                  >
                    <Ionicons name="copy" size={14} color="#fff" />
                    <Text style={styles.smallBtnText}>Copy</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    testID={`delete-strategy-${s.id}`}
                    style={[styles.smallBtn, { backgroundColor: colors.error + '20' }]}
                    onPress={() => handleDelete(s.id)}
                  >
                    <Ionicons name="trash" size={14} color={colors.error} />
                    <Text style={[styles.smallBtnText, { color: colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontWeight: '800' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
  },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 16, marginTop: 8 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 4 },
  tabText: { fontSize: 15, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  emptyCard: {
    borderRadius: 12, padding: 32, borderWidth: 1, alignItems: 'center', gap: 8, marginTop: 20,
  },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  card: {
    borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  codeIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardDesc: { fontSize: 13, marginTop: 2 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 8 },
  smallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  smallBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
});
