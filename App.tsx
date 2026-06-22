import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {PRIMARY} from './src/theme';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {supabase} from './src/services/supabase';
import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import {
  requestPermission,
  registerMessageHandlers,
  saveTokenToSupabase,
} from './src/services/notificationService';
import {initStore, cleanupStore} from './src/store/notificationsStore';
import {initUser, cleanupUser, useUser} from './src/store/userStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const {state: userState, subscribe: subscribeUser} = useUser();

  useEffect(() => subscribeUser(), [subscribeUser]);

  useEffect(() => {
    const applySession = (s: any) => {
      setSession(prev => {
        if (prev?.user?.id === s?.user?.id) return prev;
        return s;
      });
      setLoading(false);
    };

    supabase.auth.getSession().then(({data: {session: s}}) => applySession(s));

    const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, s) => {
      applySession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      requestPermission();
      const unsubscribeHandlers = registerMessageHandlers();
      saveTokenToSupabase(session.user.id);
      initStore(session.user.id);
      initUser(session.user.id, session.user.email ?? '');
      return unsubscribeHandlers;
    } else {
      cleanupStore();
      cleanupUser();
    }
  }, [session]);

  if (loading) {
    return (
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  const displayName = userState.profile?.name ?? userState.email;
  const initial = displayName ? displayName[0].toUpperCase() : '?';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <NavigationContainer>
        <Stack.Navigator>
          {session ? (
            <>
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={({navigation: nav}) => ({
                  title: 'FaceNotify',
                  headerTitleAlign: 'center',
                  headerLeft: () => (
                    <TouchableOpacity
                      onPress={() => nav.navigate('Profile')}
                      style={appStyles.avatarBtn}>
                      <View style={appStyles.headerAvatar}>
                        <Text style={appStyles.headerAvatarText}>{initial}</Text>
                      </View>
                    </TouchableOpacity>
                  ),
                })}
              />
              <Stack.Screen
                name="Detail"
                component={DetailScreen}
                options={{
                  title: 'Detalhes',
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                  title: 'Meu Perfil',
                  // Desliza da esquerda — perfil está "à esquerda" do home
                  animation: 'slide_from_left',
                }}
              />
            </>
          ) : (
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{headerShown: false}}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({});

const appStyles = StyleSheet.create({
  avatarBtn: {
    marginLeft: 8,
    marginRight: 16,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {color: '#fff', fontSize: 15, fontWeight: '700'},
});
