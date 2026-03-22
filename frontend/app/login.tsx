import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { api } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      await login(res.token, res.user);
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="trending-up" size={32} color="#fff" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>QuantLab</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Backtest your trading strategies
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              testID="login-email-input"
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
            <View style={[styles.passwordWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                testID="login-password-input"
                style={[styles.passwordInput, { color: colors.text }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                testID="login-toggle-password"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="login-goto-register"
              onPress={() => router.push('/register')}
              style={styles.linkBtn}
            >
              <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                Don't have an account?{' '}
              </Text>
              <Text style={[styles.linkTextBold, { color: colors.primary }]}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { fontSize: 16, marginTop: 8 },
  form: {},
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16,
  },
  passwordInput: { flex: 1, fontSize: 16, height: 48 },
  eyeBtn: { padding: 4 },
  btn: {
    height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, paddingBottom: 32 },
  linkText: { fontSize: 14 },
  linkTextBold: { fontSize: 14, fontWeight: '700' },
});
