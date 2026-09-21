import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [utilisateur, setUtilisateur] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modeVue, setModeVue] = useState('gestion');

  useEffect(() => {
    const restaurerSession = async () => {
      try {
        const t = await SecureStore.getItemAsync('token');
        const u = await AsyncStorage.getItem('utilisateur');
        const m = await AsyncStorage.getItem('modeVue');
        if (t && u) {
          const user = JSON.parse(u);
          setToken(t);
          setUtilisateur(user);
          if (user.role === 'tech_invest') setModeVue(m || 'technicien');
          else if (user.role === 'gestion_invest') setModeVue(m || 'gestion');

          // Rafraîchit en arrière-plan depuis le serveur — sans ça, un droit
          // accordé après coup (ex: capacité "Aperçu ferme") ne serait
          // visible qu'après une déconnexion/reconnexion complète.
          api.get('/auth/moi', { headers: { Authorization: `Bearer ${t}` } })
            .then(async (res) => {
              const utilisateurFrais = { ...user, ...res.data };
              await AsyncStorage.setItem('utilisateur', JSON.stringify(utilisateurFrais));
              setUtilisateur(utilisateurFrais);
            })
            .catch(() => {});
        }
      } catch (e) {
        console.log('Erreur restauration session:', e.message);
      } finally {
        setLoading(false);
      }
    };
    restaurerSession();
  }, []);

  const login = async (email, mot_de_passe) => {
    const response = await api.post('/auth/login', { email, mot_de_passe });
    const { token: t, utilisateur: u } = response.data;
    await SecureStore.setItemAsync('token', t);
    await AsyncStorage.setItem('utilisateur', JSON.stringify(u));
    setToken(t);
    setUtilisateur(u);
    if (u.role === 'tech_invest') setModeVue('technicien');
    else if (u.role === 'gestion_invest') setModeVue('gestion');
    return u;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    // On nettoie aussi les réglages propres à un compte (mode de vue, espace
    // actif, projet actif) — sans ça, ils restent en mémoire et s'appliquent
    // à tort à la personne suivante qui se connecte sur ce même appareil.
    await AsyncStorage.multiRemove(['utilisateur', 'modeVue', 'espaceActif', 'projet_actif_id']);
    setUtilisateur(null);
    setToken(null);
  };

  const switchMode = async (mode) => {
    setModeVue(mode);
    await AsyncStorage.setItem('modeVue', mode);
  };

  return (
    <AuthContext.Provider value={{ utilisateur, token, login, logout, loading, modeVue, switchMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);