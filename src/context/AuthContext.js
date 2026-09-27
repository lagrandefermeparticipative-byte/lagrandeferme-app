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
  // Capacité composable "est_investisseur" — indépendante du rôle de base et
  // des rôles cumulés existants (tech_invest/gestion_invest, gérés via
  // modeVue ci-dessus). Un stagiaire/technicien/gestionnaire peut en plus
  // avoir cette casquette ; ce booléen ne fait que basculer l'affichage,
  // jamais mélangé à modeVue.
  const [vueInvestisseurCapacite, setVueInvestisseurCapaciteState] = useState(false);

  useEffect(() => {
    const restaurerSession = async () => {
      try {
        const t = await SecureStore.getItemAsync('token');
        const u = await AsyncStorage.getItem('utilisateur');
        const m = await AsyncStorage.getItem('modeVue');
        const vic = await AsyncStorage.getItem('vueInvestisseurCapacite');
        if (t && u) {
          const user = JSON.parse(u);
          setToken(t);
          setUtilisateur(user);
          if (user.role === 'tech_invest') setModeVue(m || 'technicien');
          else if (user.role === 'gestion_invest') setModeVue(m || 'gestion');
          setVueInvestisseurCapaciteState(vic === '1');

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
    setVueInvestisseurCapaciteState(false);
    await AsyncStorage.setItem('vueInvestisseurCapacite', '0');
    return u;
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    // On nettoie aussi les réglages propres à un compte (mode de vue, espace
    // actif, projet actif) — sans ça, ils restent en mémoire et s'appliquent
    // à tort à la personne suivante qui se connecte sur ce même appareil.
    await AsyncStorage.multiRemove(['utilisateur', 'modeVue', 'espaceActif', 'projet_actif_id', 'vueInvestisseurCapacite']);
    setUtilisateur(null);
    setToken(null);
    setVueInvestisseurCapaciteState(false);
  };

  const switchMode = async (mode) => {
    setModeVue(mode);
    await AsyncStorage.setItem('modeVue', mode);
  };

  // Bascule dédiée à la capacité "est_investisseur" — un vrai espace à part,
  // jamais mélangé au modeVue des rôles cumulés (tech_invest/gestion_invest).
  const switchVueInvestisseurCapacite = async (valeur) => {
    setVueInvestisseurCapaciteState(valeur);
    await AsyncStorage.setItem('vueInvestisseurCapacite', valeur ? '1' : '0');
  };

  // Met à jour l'utilisateur en mémoire ET dans AsyncStorage — utile après un
  // changement qui doit être visible immédiatement sans reconnexion (ex: fin
  // de l'onboarding stagiaire, qui doit débloquer l'accès au reste de l'app
  // tout de suite).
  const mettreAJourUtilisateur = async (champs) => {
    setUtilisateur((prev) => {
      const maj = { ...prev, ...champs };
      AsyncStorage.setItem('utilisateur', JSON.stringify(maj)).catch(() => {});
      return maj;
    });
  };

  return (
    <AuthContext.Provider value={{ utilisateur, token, login, logout, loading, modeVue, switchMode, mettreAJourUtilisateur, vueInvestisseurCapacite, switchVueInvestisseurCapacite }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);