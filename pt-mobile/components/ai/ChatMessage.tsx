import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage as ChatMessageType } from '@/types';
import { Colors, FontSize, BorderRadius, Spacing, Shadow } from '@/constants/theme';
import { format } from 'date-fns';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="flash" size={14} color={Colors.accent} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
        ]}
      >
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>
        <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
          {format(new Date(message.timestamp), 'HH:mm')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  rowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  bubbleUser: {
    backgroundColor: Colors.accent,
    borderBottomRightRadius: BorderRadius.sm,
    ...Shadow.green,
  },
  bubbleAssistant: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  text: {
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  textUser: {
    color: Colors.black,
    fontWeight: '500',
  },
  textAssistant: {
    color: Colors.text,
  },
  timestamp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: 'rgba(0,0,0,0.5)',
  },
});
