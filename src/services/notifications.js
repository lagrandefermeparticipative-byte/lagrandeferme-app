import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

import Constants from 'expo-constants';

export async function enregistrerPourNotifications(token) {
  if (!Device.isDevice) {
    console.log('Les notifications push nécessitent un vrai appareil.');
    return null;
  }

  // Les notifications push ont été retirées d'Expo Go (SDK 53+) — cette
  // fonctionnalité ne peut fonctionner que dans un vrai build (.apk/.ipa).
  if (Constants.appOwnership === 'expo') {
    console.log('Notifications non disponibles dans Expo Go — nécessite un vrai build.');
    return null;
  }

  const { status: statutExistant } = await Notifications.getPermissionsAsync();
  let statutFinal = statutExistant;

  if (statutExistant !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    statutFinal = status;
  }

  if (statutFinal !== 'granted') {
    console.log('Permission de notification refusée.');
    return null;
  }

  const tokenExpo = (await Notifications.getExpoPushTokenAsync()).data;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  try {
    await api.post('/notifications/enregistrer-token', { token: tokenExpo }, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    console.log('Erreur enregistrement token push:', error.message);
  }

  return tokenExpo;
}