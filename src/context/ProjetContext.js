import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ProjetContext = createContext(null);

export const ProjetProvider = ({ children }) => {
  const { token } = useAuth();
  const [projets, setProjets] = useState([]);
  const [projetActifId, setProjetActifId] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (token) chargerProjets();
    else setChargement(false);
  }, [token]);

  const chargerProjets = async () => {
    try {
      const res = await api.get('/projets', { headers: { Authorization: `Bearer ${token}` } });
      setProjets(res.data);
      const dernierChoisi = await AsyncStorage.getItem('projet_actif_id');
      const existeEncore = res.data.find(p => String(p.uuid_id || p.id) === dernierChoisi);
      if (existeEncore) {
        setProjetActifId(existeEncore.uuid_id || existeEncore.id);
      } else if (res.data.length > 0) {
        setProjetActifId(res.data[0].uuid_id || res.data[0].id);
      }
    } catch (error) {
      console.log('Erreur chargement projets:', error.message);
    } finally {
      setChargement(false);
    }
  };

  const choisirProjet = async (id) => {
    setProjetActifId(id);
    await AsyncStorage.setItem('projet_actif_id', String(id));
  };

  const projetActif = projets.find(p => (p.uuid_id || p.id) === projetActifId) || null;

  return (
    <ProjetContext.Provider value={{ projets, projetActifId, projetActif, choisirProjet, chargement, rechargerProjets: chargerProjets }}>
      {children}
    </ProjetContext.Provider>
  );
};

export const useProjet = () => useContext(ProjetContext);