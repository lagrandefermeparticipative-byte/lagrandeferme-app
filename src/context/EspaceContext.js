import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EspaceContext = createContext();

export const EspaceProvider = ({ children }) => {
  const [espaceActif, setEspaceActif] = useState('projet');
  const [animationDirection, setAnimationDirection] = useState('none');

  useEffect(() => {
    AsyncStorage.getItem('espaceActif').then(val => {
      if (val) setEspaceActif(val);
    });
  }, []);

  const switchEspace = async (espace) => {
    setEspaceActif(espace);
    await AsyncStorage.setItem('espaceActif', espace);
  };

  return (
    <EspaceContext.Provider value={{ espaceActif, switchEspace, animationDirection, setAnimationDirection }}>
      {children}
    </EspaceContext.Provider>
  );
};

export const useEspace = () => useContext(EspaceContext);