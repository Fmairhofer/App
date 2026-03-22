import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';

export default function BacktestResultScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [backtest, setBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'chart' | 'trades'>('metrics');

  useEffect(() => {
    if (id) loadBacktest();
  }, [id]);

  const loadBacktest = async () => {
    try {
      const data = await api.getBacktest(id as string);
      setBacktest(data);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.aiAnalyze(id as string);
      setAnalysis(res.response);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!backtest) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Backtest not found</Text>
      </SafeAreaView>
    );
  }

  const m = backtest.metrics || {};
  const equityCurve = (backtest.equity_curve || []).map((p: any, i: number) => ({
    value: p.value,
    label: i % Math.ceil((backtest.equity_curve?.length || 1) / 5) === 0 ? p.date?.slice(5, 10) || '' : '',
  }));

  const isPositive = (m.total_return || 0) >= 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity testID="result-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{backtest.strategy_name}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{backtest.data_source}</Text>
        </View>
        <TouchableOpacity testID="ai-analyze-btn" onPress={handleAnalyze} disabled={analyzing}>
          {analyzing ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Ionicons name="sparkles" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Return Badge */}
      <View style={[styles.returnBanner, { backgroundColor: isPositive ? colors.success + '15' : colors.error + '15' }]}>
        <Text style={[styles.returnLabel, { color: isPositive ? colors.success : colors.error }]}>Total Return</Text>
        <Text style={[styles.returnValue, { color: isPositive ? colors.success : colors.error }]}>
          {isPositive ? '+' : ''}{m.total_return}%
        </Text>
        <Text style={[styles.returnSub, { color: isPositive ? colors.success : colors.error }]}>
          ${m.final_value?.toLocaleString()} from ${backtest.initial_capital?.toLocaleString()}
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['metrics', 'chart', 'trades'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`tab-${t}`}
            style={[styles.tabBtn, activeTab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, { color: activeTab === t ? colors.text : colors.textSecondary }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'metrics' && (
          <View style={styles.metricsGrid}>
            <MetricCard colors={colors} label="Sharpe Ratio" value={m.sharpe_ratio?.toString()} icon="analytics" />
            <MetricCard colors={colors} label="Sortino Ratio" value={m.sortino_ratio?.toString()} icon="trending-up" />
            <MetricCard colors={colors} label="Max Drawdown" value={`${m.max_drawdown}%`} icon="trending-down" negative />
            <MetricCard colors={colors} label="Win Rate" value={`${m.win_rate}%`} icon="checkmark-circle" />
            <MetricCard colors={colors} label="Total Trades" value={m.total_trades?.toString()} icon="swap-horizontal" />
            <MetricCard colors={colors} label="Annualized" value={`${m.annualized_return}%`} icon="calendar" />
            <MetricCard colors={colors} label="Winning" value={m.winning_trades?.toString()} icon="arrow-up" positive />
            <MetricCard colors={colors} label="Losing" value={m.losing_trades?.toString()} icon="arrow-down" negative />
            <MetricCard colors={colors} label="Avg Win" value={`$${m.avg_win}`} icon="cash" positive />
            <MetricCard colors={colors} label="Avg Loss" value={`$${m.avg_loss}`} icon="cash" negative />
            <MetricCard colors={colors} label="Profit Factor" value={m.profit_factor?.toString()} icon="stats-chart" />
            <MetricCard colors={colors} label="Final Value" value={`$${m.final_value?.toLocaleString()}`} icon="wallet" />
          </View>
        )}

        {activeTab === 'chart' && equityCurve.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Equity Curve</Text>
            <LineChart
              data={equityCurve}
              width={320}
              height={220}
              thickness={2}
              color={isPositive ? colors.success : colors.error}
              areaChart
              startFillColor={isPositive ? colors.success : colors.error}
              startOpacity={0.2}
              endOpacity={0}
              hideRules
              yAxisThickness={0}
              xAxisThickness={0}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 9 }}
              hideDataPoints
              curved
              adjustToWidth
              spacing={equityCurve.length > 1 ? 320 / equityCurve.length : 10}
            />
          </View>
        )}

        {activeTab === 'trades' && (
          <View>
            {(backtest.trades || []).length === 0 ? (
              <View style={[styles.emptyTrades, { backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No trades executed</Text>
              </View>
            ) : (
              (backtest.trades || []).map((t: any, i: number) => (
                <View key={i} style={[styles.tradeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.tradeIcon, { backgroundColor: t.type === 'BUY' ? colors.success + '20' : colors.error + '20' }]}>
                    <Ionicons
                      name={t.type === 'BUY' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={t.type === 'BUY' ? colors.success : colors.error}
                    />
                  </View>
                  <View style={styles.tradeInfo}>
                    <Text style={[styles.tradeType, { color: t.type === 'BUY' ? colors.success : colors.error }]}>{t.type}</Text>
                    <Text style={[styles.tradeDate, { color: colors.textSecondary }]}>{t.date?.slice(0, 10)}</Text>
                  </View>
                  <View style={styles.tradeRight}>
                    <Text style={[styles.tradePrice, { color: colors.text }]}>${t.price}</Text>
                    <Text style={[styles.tradeShares, { color: colors.textSecondary }]}>{t.shares} shares</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* AI Analysis */}
        {analysis ? (
          <View style={[styles.analysisCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.analysisHeader}>
              <Ionicons name="sparkles" size={18} color={colors.primary} />
              <Text style={[styles.analysisTitle, { color: colors.text }]}>AI Analysis</Text>
            </View>
            <Text style={[styles.analysisText, { color: colors.textSecondary }]}>{analysis}</Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ colors, label, value, icon, positive, negative }: any) {
  let valueColor = colors.text;
  if (positive) valueColor = colors.success;
  if (negative) valueColor = colors.error;

  return (
    <View style={[cardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[cardStyles.value, { color: valueColor }]}>{value || '-'}</Text>
      <Text style={[cardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '47%', borderRadius: 12, padding: 14, borderWidth: 1, gap: 4, marginBottom: 10,
  },
  value: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  label: { fontSize: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  returnBanner: { padding: 16, alignItems: 'center', gap: 2 },
  returnLabel: { fontSize: 13, fontWeight: '600' },
  returnValue: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  returnSub: { fontSize: 13 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  chartContainer: { marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptyTrades: { padding: 24, borderRadius: 12, alignItems: 'center' },
  emptyText: { fontSize: 14 },
  tradeRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10,
    borderWidth: 1, marginBottom: 8, gap: 10,
  },
  tradeIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tradeInfo: { flex: 1 },
  tradeType: { fontSize: 14, fontWeight: '700' },
  tradeDate: { fontSize: 11, marginTop: 2 },
  tradeRight: { alignItems: 'flex-end' },
  tradePrice: { fontSize: 14, fontWeight: '700' },
  tradeShares: { fontSize: 11, marginTop: 2 },
  analysisCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginTop: 16 },
  analysisHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  analysisTitle: { fontSize: 16, fontWeight: '700' },
  analysisText: { fontSize: 14, lineHeight: 22 },
  errorText: { fontSize: 16, textAlign: 'center', marginTop: 40 },
});
