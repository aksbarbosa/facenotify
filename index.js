/**
 * @format
 */

import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

// Deve ser registrado antes do AppRegistry para funcionar com app fechado/background
// Android exibe a notificação automaticamente via campo notification do FCM.
// O handler de background não precisa chamar displayNotification para evitar duplicatas.
messaging().setBackgroundMessageHandler(async _remoteMessage => {});

AppRegistry.registerComponent(appName, () => App);
