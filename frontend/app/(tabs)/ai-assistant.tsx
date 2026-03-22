import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { api } from '../../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export default function AIAssistantScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', text: 'Hi! I can help you create trading strategies or analyze your backtest results. Try asking me to:\n\n- Create an RSI-based strategy\n- Build a momentum strategy\n- Suggest a mean reversion approach\n- Analyze a specific backtest' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.aiSuggest(text);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: res.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', text: `Error: ${e.message}` };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Ionicons name="sparkles" size={22} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>AI Strategy Assistant</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.msgBubble,
                msg.role === 'user'
                  ? { backgroundColor: colors.primary, alignSelf: 'flex-end' }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-start' },
              ]}
            >
              <Text
                style={[
                  styles.msgText,
                  { color: msg.role === 'user' ? '#fff' : colors.text },
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.msgBubble, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, alignSelf: 'flex-start' }]}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            testID="ai-chat-input"
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about trading strategies..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            testID="ai-send-btn"
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.muted }]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons name="send" size={18} color={input.trim() ? '#fff' : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: '800' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10 },
  msgBubble: { maxWidth: '85%', padding: 14, borderRadius: 16, flexDirection: 'column' },
  msgText: { fontSize: 14, lineHeight: 20 },
  thinkingText: { fontSize: 13, marginLeft: 8 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
});
