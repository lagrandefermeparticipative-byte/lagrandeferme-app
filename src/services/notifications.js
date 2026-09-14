import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
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
  Alert.alert('DEBUG', 'Fonction appelée, Device.isDevice: ' + Device.isDevice);

  if (!Device.isDevice) {
    Alert.alert('DEBUG', 'Arrêt : pas un vrai appareil.');
    return null;
  }

  Alert.alert('DEBUG', 'appOwnership: ' + Constants.appOwnership);

  if (Constants.appOwnership === 'expo') {
    Alert.alert('DEBUG', 'Arrêt : Expo Go détecté.');
    return null;
  }

  try {
    const { status: statutExistant } = await Notifications.getPermissionsAsync();
    Alert.alert('DEBUG', 'Statut existant: ' + statutExistant);
    let statutFinal = statutExistant;

    if (statutExistant !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      Alert.alert('DEBUG', 'Statut après demande: ' + status);
      statutFinal = status;
    }

    if (statutFinal !== 'granted') {
      Alert.alert('DEBUG', 'Permission refusée, arrêt.');
      return null;
    }

    const tokenExpo = (await Notifications.getExpoPushTokenAsync()).data;
    Alert.alert('DEBUG', 'Token obtenu: ' + tokenExpo);

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    try {
      await api.post('/notifications/enregistrer-token', { token: tokenExpo }, { headers: { Authorization: `Bearer ${token}` } });
      Alert.alert('DEBUG', 'Token enregistré avec succès côté backend !');
    } catch (error) {
      Alert.alert('DEBUG', 'Erreur enregistrement backend: ' + error.message);
    }

    return tokenExpo;
  } catch (error) {
    Alert.alert('DEBUG - ERREUR', error.message);
    return null;
  }
}
