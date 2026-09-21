import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EspaceContext = createContext();

export const EspaceProvider = ({ children }) => {
  const [espaceActif, setEspaceActif] = useState('projet');
  const [animationDirection, setAnimationDirection] = useState('none');
  // Bascule dédiée à la capacité "Aperçu ferme" — un vrai espace à part,
  // jamais mélangé au menu habituel de la personne.
  const [vueApercuFerme, setVueApercuFermeState] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('espaceActif').then(val => {
      if (val) setEspaceActif(val);
    });
    AsyncStorage.getItem('vueApercuFerme').then(val => {
      if (val) setVueApercuFermeState(val === '1');
    });
  }, []);

  const switchEspace = async (espace) => {
    setEspaceActif(espace);
    await AsyncStorage.setItem('espaceActif', espace);
  };

  const setVueApercuFerme = async (valeur) => {
    setVueApercuFermeState(valeur);
    await AsyncStorage.setItem('vueApercuFerme', valeur ? '1' : '0');
  };

  return (
    <EspaceContext.Provider value={{ espaceActif, switchEspace, animationDirection, setAnimationDirection, vueApercuFerme, setVueApercuFerme }}>
      {children}
    </EspaceContext.Provider>
  );
};

export const useEspace = () => useContext(EspaceContext);