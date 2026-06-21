import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';
import {Platform, PermissionsAndroid} from 'react-native';
import {supabase} from './supabase';
import {addEvent} from '../store/notificationsStore';
import {RecognitionEvent} from '../types/recognition';

async function displayNotification(event: RecognitionEvent) {
  const channelId = await notifee.createChannel({
    id: 'facenotify',
    name: 'Reconhecimentos',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title: event.person_name,
    body: `${event.location.camera_label} · ${event.location.city}, ${event.location.state}`,
    android: {channelId, pressAction: {id: 'default'}},
  });
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }
  // Android 13+ requer permissão explícita
  if (Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token;
  } catch {
    return null;
  }
}

export async function saveTokenToSupabase(userId: string): Promise<void> {
  const token = await getFCMToken();
  if (!token) return;
  await supabase
    .from('fcm_tokens')
    .upsert({user_id: userId, token}, {onConflict: 'user_id,token'});
}

export async function removeTokenFromSupabase(): Promise<void> {
  const token = await getFCMToken();
  if (!token) return;
  await supabase.from('fcm_tokens').delete().eq('token', token);
}

function parseEvent(remoteMessage: any): RecognitionEvent {
  const data = remoteMessage.data ?? {};

  let location = data.location;
  if (typeof location === 'string') {
    try {
      location = JSON.parse(location);
    } catch {}
  }

  return {
    id: data.id ?? String(Date.now()),
    person_id: data.person_id ?? 'unknown',
    person_name: data.person_name ?? remoteMessage.notification?.title ?? 'Desconhecido',
    location: location ?? {
      camera_id: '',
      camera_label: 'Câmera desconhecida',
      address: '',
      city: '',
      state: '',
    },
    timestamp: data.timestamp ?? new Date().toISOString(),
    confidence: data.confidence ? parseFloat(data.confidence) : 0,
    access_granted: data.access_granted !== 'false',
  };
}

export function registerMessageHandlers(): () => void {
  const unsubForeground = messaging().onMessage(async remoteMessage => {
    const event = parseEvent(remoteMessage);
    addEvent(event);
    await displayNotification(event);
  });

  messaging().onNotificationOpenedApp(remoteMessage => {
    addEvent(parseEvent(remoteMessage));
  });

  return unsubForeground;
}
