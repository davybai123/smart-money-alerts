import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { TypingIndicator } from '@/components/ai/TypingIndicator';
import { sendMessage, ClaudeMessage } from '@/lib/claude';
import { Colors, FontSize, FontWeight, Spacing, BorderRadius } from '@/constants/theme';
import { ChatMessage as ChatMessageType } from '@/types';
import { format } from 'date-fns';

const QUICK_PROMPTS = [
  { label: '💪 Workout Plan', text: 'Generate a workout plan for this week based on my goals.' },
  { label: '🥗 Meal Plan', text: 'Create a full day meal plan optimized for my targets.' },
  { label: '📊 Analyze Today', text: 'Analyze my nutrition today and give me specific feedback.' },
  { label: '⚡ Pre-Match Prep', text: 'What should I eat and do before a rugby match tomorrow?' },
  { label: '😴 Recovery Tips', text: 'Give me the top recovery strategies for my sport and goals.' },
  { label: '🔥 Cut Advice', text: 'How can I lose fat faster while maintaining muscle?' },
];

let messageIdCounter = 0;
const createId = () => `msg_${++messageIdCounter}_${Date.now()}`;

export default function AiCoachScreen() {
  const { profile } = useAuthStore();
  const { getTotals } = useNutritionStore();

  const [messages, setMessages] = useState<ChatMessageType[]>([
    {
      id: createId(),
      role: 'assistant',
      content: profile
        ? `Hey ${profile.full_name.split(' ')[0]}! 👋 I'm your AI coach. I have your full profile — ${profile.weight_kg}kg, targeting ${profile.daily_calorie_target} kcal/day, goal: **${profile.goal.replace('_', ' ')}**.\n\nHow can I help you today? Ask me anything about training, nutrition, recovery, or performance!`
        : "Hey! I'm your AI performance coach. Ask me anything about training, nutrition, or recovery!",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const streamingMessageId = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const sendUserMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMessage: ChatMessageType = {
      id: createId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsStreaming(true);
    setStreamingContent('');
    scrollToBottom();

    // Build conversation history for Claude
    const allMessages = [...messages, userMessage];
    const claudeMessages: ClaudeMessage[] = allMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let fullResponse = '';
    streamingMessageId.current = createId();

    try {
      await sendMessage(claudeMessages, profile, (chunk) => {
        fullResponse += chunk;
        setStreamingContent(fullResponse);
        scrollToBottom();
      });

      // Add final message
      const assistantMessage: ChatMessageType = {
        id: streamingMessageId.current,
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      Alert.alert(
        'Error',
        err.message?.includes('EXPO_PUBLIC_ANTHROPIC_API_KEY')
          ? 'Please add your Anthropic API key to .env file'
          : err.message || 'Failed to get response from AI coach.'
      );
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      streamingMessageId.current = null;
      scrollToBottom();
    }
  };

  const handleQuickPrompt = (text: string) => {
    sendUserMessage(text);
  };

  const handleClear = () => {
    Alert.alert('Clear Chat', 'Start a fresh conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMessages([
            {
              id: createId(),
              role: 'assistant',
              content: "Chat cleared. What would you like to work on?",
              timestamp: new Date().toISOString(),
            },
          ]);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: ChatMessageType }) => (
    <ChatMessage message={item} />
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.coachAvatar}>
            <Ionicons name="flash" size={20} color={Colors.accent} />
          </View>
          <View>
            <Text style={styles.coachName}>AI Coach</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online · Powered by Claude</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={styles.messageContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            <>
              {isStreaming && streamingContent ? (
                <ChatMessage
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingContent,
                    timestamp: new Date().toISOString(),
                  }}
                />
              ) : isStreaming ? (
                <TypingIndicator />
              ) : null}
            </>
          }
        />

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <View style={styles.quickPromptsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPrompts}
            >
              {QUICK_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickPromptBtn}
                  onPress={() => handleQuickPrompt(prompt.text)}
                  disabled={isStreaming}
                >
                  <Text style={styles.quickPromptText}>{prompt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputRow}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask your coach anything..."
                placeholderTextColor={Colors.textDim}
                multiline
                maxLength={2000}
                editable={!isStreaming}
                returnKeyType="default"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isStreaming) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendUserMessage(inputText)}
              disabled={!inputText.trim() || isStreaming}
            >
              <Ionicons
                name={isStreaming ? 'stop' : 'send'}
                size={18}
                color={!inputText.trim() || isStreaming ? Colors.textDim : Colors.black}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimer}>
            AI advice is for informational purposes only
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  coachAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  coachName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
  },
  statusText: { fontSize: FontSize.xs, color: Colors.textMuted },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: { flex: 1 },
  messageContent: {
    paddingVertical: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  quickPromptsWrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: Spacing.md,
  },
  quickPrompts: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  quickPromptBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickPromptText: { fontSize: FontSize.sm, color: Colors.text, fontWeight: FontWeight.medium },
  inputArea: {
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.xs,
    backgroundColor: Colors.background,
  },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  inputContainer: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 120,
  },
  input: {
    fontSize: FontSize.base,
    color: Colors.text,
    lineHeight: 22,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.border,
  },
  disclaimer: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
