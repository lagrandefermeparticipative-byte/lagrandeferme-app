import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function enregistrerPourNotifications(token) {
  if (!Device.isDevice) return null;
  if (Constants.appOwnership === 'expo') return null;

  try {
    const { status: statutExistant } = await Notifications.getPermissionsAsync();
    let statutFinal = statutExistant;

    if (statutExistant !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      statutFinal = status;
    }

    if (statutFinal !== 'granted') return null;

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
  } catch (error) {
    console.log('Erreur notifications:', error.message);
    return null;
  }
}
