import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function NewBacktestScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [strategies, setStrategies] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [dataSource, setDataSource] = useState<'yahoo' | 'csv'>('yahoo');
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const [strats, sets] = await Promise.all([api.getStrategies(), api.getDatasets()]);
      setStrategies(strats);
      setDatasets(sets);
      if (strats.length > 0) setSelectedStrategy(strats[0].id);
      if (sets.length > 0) setSelectedDataset(sets[0].id);
    } catch (e) {
      console.log('Error loading form data:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const handleRun = async () => {
    if (!selectedStrategy) {
      Alert.alert('Error', 'Please select a strategy');
      return;
    }
    const capital = parseFloat(initialCapital);
    if (isNaN(capital) || capital <= 0) {
      Alert.alert('Error', 'Please enter a valid initial capital');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        strategy_id: selectedStrategy,
        initial_capital: capital,
      };
      if (dataSource === 'yahoo') {
        payload.ticker = ticker.toUpperCase();
        payload.start_date = startDate;
        payload.end_date = endDate;
      } else {
        payload.dataset_id = selectedDataset;
      }

      const result = await api.createBacktest(payload);
      router.push(`/backtest/${result.id}`);
    } catch (e: any) {
      Alert.alert('Backtest Failed', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>New Backtest</Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Strategy Selection */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Strategy</Text>
          {strategies.length === 0 ? (
            <View style={[styles.warningBox, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
              <Ionicons name="warning" size={16} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.warning }]}>No strategies found. Upload one first.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {strategies.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  testID={`strategy-chip-${s.id}`}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedStrategy === s.id ? colors.primary : colors.surface,
                      borderColor: selectedStrategy === s.id ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedStrategy(s.id)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: selectedStrategy === s.id ? '#fff' : colors.text },
                  ]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Data Source */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Data Source</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              testID="yahoo-data-btn"
              style={[styles.toggleBtn, {
                backgroundColor: dataSource === 'yahoo' ? colors.primary : colors.surface,
                borderColor: dataSource === 'yahoo' ? colors.primary : colors.border,
              }]}
              onPress={() => setDataSource('yahoo')}
            >
              <Ionicons name="globe" size={16} color={dataSource === 'yahoo' ? '#fff' : colors.text} />
              <Text style={[styles.toggleText, { color: dataSource === 'yahoo' ? '#fff' : colors.text }]}>Yahoo Finance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="csv-data-btn"
              style={[styles.toggleBtn, {
                backgroundColor: dataSource === 'csv' ? colors.primary : colors.surface,
                borderColor: dataSource === 'csv' ? colors.primary : colors.border,
              }]}
              onPress={() => setDataSource('csv')}
            >
              <Ionicons name="document" size={16} color={dataSource === 'csv' ? '#fff' : colors.text} />
              <Text style={[styles.toggleText, { color: dataSource === 'csv' ? '#fff' : colors.text }]}>CSV Data</Text>
            </TouchableOpacity>
          </View>

          {dataSource === 'yahoo' ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Ticker Symbol</Text>
              <TextInput
                testID="ticker-input"
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={ticker}
                onChangeText={setTicker}
                placeholder="AAPL"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
              />
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Start Date</Text>
                  <TextInput
                    testID="start-date-input"
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="2024-01-01"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.dateCol}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>End Date</Text>
                  <TextInput
                    testID="end-date-input"
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="2025-01-01"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Dataset</Text>
              {datasets.length === 0 ? (
                <View style={[styles.warningBox, { backgroundColor: colors.warning + '15', borderColor: colors.warning }]}>
                  <Ionicons name="warning" size={16} color={colors.warning} />
                  <Text style={[styles.warningText, { color: colors.warning }]}>No CSV datasets uploaded. Upload one first.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {datasets.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      testID={`dataset-chip-${d.id}`}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selectedDataset === d.id ? colors.primary : colors.surface,
                          borderColor: selectedDataset === d.id ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedDataset(d.id)}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: selectedDataset === d.id ? '#fff' : colors.text },
                      ]}>{d.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

          {/* Initial Capital */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Initial Capital ($)</Text>
          <TextInput
            testID="capital-input"
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={initialCapital}
            onChangeText={setInitialCapital}
            placeholder="10000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />

          {/* Run Button */}
          <TouchableOpacity
            testID="run-backtest-btn"
            style={[styles.runBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleRun}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.runBtnText}>Run Backtest</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16,
  },
  chipRow: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginRight: 8,
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  toggleText: { fontSize: 14, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateCol: { flex: 1 },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1,
  },
  warningText: { fontSize: 13, flex: 1 },
  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 52, borderRadius: 12, marginTop: 28,
  },
  runBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
