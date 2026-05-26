import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View className="items-center gap-0.5 pt-1">
      <Text className={`text-xl ${focused ? '' : 'opacity-30'}`}>{icon}</Text>
      <Text
        className={`text-xs font-bold uppercase tracking-widest ${
          focused ? 'text-rush-red' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#2e2e2e',
          borderTopWidth: 1,
          paddingTop: 4,
          height: 72,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="🏠" label="Início" />
          ),
        }}
      />
      <Tabs.Screen
        name="measure"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="💚" label="Medir" />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="📈" label="Histórico" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon="👤" label="Perfil" />
          ),
        }}
      />
    </Tabs>
  );
}
