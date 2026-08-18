import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Header, TabBar } from '../components/layout';
import {
  CalendarScreen,
  ChatsScreen,
  HomeScreen,
  LoginScreen,
  ProfileScreen,
  TasksScreen,
} from '../screens';
import { useApp } from '../store';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * The five tabs. Both the header and the bar are the design's own, so React
 * Navigation supplies routing and nothing else.
 *
 * Tab route names double as header titles — they already match the design's
 * title map exactly.
 */
function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={({ route }) => ({
        header: () => <Header title={route.name} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/** Swaps the whole tree between signed-out and signed-in. */
export function RootNavigator() {
  const { auth } = useApp();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      {auth === 'signedIn' ? (
        <Stack.Screen name="App" component={AppTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
