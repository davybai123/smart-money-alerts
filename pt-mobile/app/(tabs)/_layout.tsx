import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IconName;
  focused: boolean;
  color: string;
  size: number;
}

function TabIcon({ name, focused, color, size }: TabIconProps) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name={focused ? 'nutrition' : 'nutrition-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Workouts',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name={focused ? 'barbell' : 'barbell-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-coach"
        options={{
          title: 'AI Coach',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name={focused ? 'flash' : 'flash-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    elevation: 0,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
  },
  iconContainerFocused: {
    backgroundColor: Colors.accentMuted,
  },
});
