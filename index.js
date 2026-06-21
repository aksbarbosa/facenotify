/**
 * @format
 */

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

// Deve ser registrado antes do AppRegistry para funcionar com app fechado/background
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const data = remoteMessage.data ?? {};

  const channelId = await notifee.createChannel({
    id: 'facenotify',
    name: 'Reconhecimentos',
    importance: AndroidImportance.HIGH,
  });

  await notifee.displayNotification({
    title: remoteMessage.notification?.title ?? data.person_name ?? 'Reconhecimento',
    body:
      remoteMessage.notification?.body ??
      `${data.camera_label ?? ''} · ${data.timestamp ?? ''}`,
    android: {channelId, pressAction: {id: 'default'}},
  });
});

AppRegistry.registerComponent(appName, () => App);
