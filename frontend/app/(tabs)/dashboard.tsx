import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [backtests, setBacktests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const data = await api.getBacktests();
      setBacktests(data);
    } catch (e) {
      console.log('Failed to load backtests:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalReturn = backtests.length > 0
    ? backtests.reduce((sum, b) => sum + (b.metrics?.total_return || 0), 0) / backtests.length
    : 0;
  const avgWinRate = backtests.length > 0
    ? backtests.reduce((sum, b) => sum + (b.metrics?.win_rate || 0), 0) / backtests.length
    : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back</Text>
            <Text style={[styles.username, { color: colors.text }]}>{user?.username || 'Trader'}</Text>
          </View>
          <TouchableOpacity testID="theme-toggle-btn" onPress={toggleTheme} style={[styles.themeBtn, { backgroundColor: colors.surface }]}>
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bar-chart" size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{backtests.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Backtests</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="trending-up" size={20} color={totalReturn >= 0 ? colors.success : colors.error} />
            <Text style={[styles.statValue, { color: totalReturn >= 0 ? colors.success : colors.error }]}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Return</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.text }]}>{avgWinRate.toFixed(0)}%</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Win Rate</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="new-backtest-btn"
            style={[styles.actionCard, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/backtest/new')}
          >
            <Ionicons name="play-circle" size={28} color="#fff" />
            <Text style={styles.actionText}>New Backtest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="upload-strategy-btn"
            style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => router.push('/(tabs)/strategies')}
          >
            <Ionicons name="cloud-upload" size={28} color={colors.primary} />
            <Text style={[styles.actionTextDark, { color: colors.text }]}>Upload Strategy</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Backtests */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Backtests</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : backtests.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="analytics-outline" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No backtests yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>Run your first backtest to see results here</Text>
          </View>
        ) : (
          backtests.slice(0, 5).map((bt) => (
            <TouchableOpacity
              testID={`backtest-item-${bt.id}`}
              key={bt.id}
              style={[styles.btCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/backtest/${bt.id}`)}
            >
              <View style={styles.btCardHeader}>
                <Text style={[styles.btName, { color: colors.text }]}>{bt.strategy_name}</Text>
                <View style={[
                  styles.badge,
                  { backgroundColor: (bt.metrics?.total_return || 0) >= 0 ? colors.success + '20' : colors.error + '20' }
                ]}>
                  <Text style={[
                    styles.badgeText,
                    { color: (bt.metrics?.total_return || 0) >= 0 ? colors.success : colors.error }
                  ]}>
                    {(bt.metrics?.total_return || 0) >= 0 ? '+' : ''}{(bt.metrics?.total_return || 0).toFixed(1)}%
                  </Text>
                </View>
              </View>
              <View style={styles.btCardMeta}>
                <Text style={[styles.btMeta, { color: colors.textSecondary }]}>{bt.data_source}</Text>
                <Text style={[styles.btMeta, { color: colors.textSecondary }]}>
                  ${(bt.initial_capital || 0).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 24 },
  greeting: { fontSize: 14 },
  username: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  themeBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  actionCard: { flex: 1, borderRadius: 12, padding: 20, alignItems: 'center', gap: 8 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  actionTextDark: { fontWeight: '700', fontSize: 14 },
  emptyCard: {
    borderRadius: 12, padding: 32, borderWidth: 1, alignItems: 'center', gap: 8,
  },
  emptyText: { fontSize: 16, fontWeight: '600' },
  emptySubtext: { fontSize: 13, textAlign: 'center' },
  btCard: {
    borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 10,
  },
  btCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btName: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  btCardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  btMeta: { fontSize: 13 },
});
