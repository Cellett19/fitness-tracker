
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import type { Session } from '@supabase/supabase-js';

import AuthScreen from './src/screens/AuthScreen';
import { supabase } from './src/services/supabase';

import FoodLibraryScreen from './src/screens/FoodLibraryScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import FoodScreen from './src/screens/FoodScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RecipesScreen from './src/screens/RecipesScreen';

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1c1c1c',
          borderTopColor: '#333333',
          height: 85,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#72d6a0',
        tabBarInactiveTintColor: '#777777',
        tabBarItemStyle: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          textAlign: 'center',
          fontSize: 10,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="th-large" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Food"
        component={FoodScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="apple-alt" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Recipes"
        component={RecipesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="utensils" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Food Library"
        component={FoodLibraryScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="book-open" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Workouts"
        component={WorkoutScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="dumbbell" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="chart-line" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: {
            display: 'none',
          },
        }}
      />
    </Tab.Navigator>
  );
}

function hasPasswordRecoveryMarker() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    new URLSearchParams(window.location.search).get('reset-password') ===
    'true'
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(
    hasPasswordRecoveryMarker,
  );

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }

      setSession(newSession);
      setCheckingSession(false);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('Could not restore session:', error.message);
        }

        if (mounted) {
          setSession(data.session);
          setCheckingSession(false);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not restore session:', error);

        if (mounted) {
          setCheckingSession(false);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handlePasswordResetComplete = () => {
    setPasswordRecovery(false);

    if (typeof window !== 'undefined') {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, '', cleanUrl);
    }
  };

  if (checkingSession) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#121212',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#72d6a0" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {passwordRecovery ? (
        <AuthScreen
          passwordRecovery
          onPasswordResetComplete={handlePasswordResetComplete}
        />
      ) : session ? (
        <MainTabs />
      ) : (
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}
