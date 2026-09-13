import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

const ConnexionContext = createContext();

export const ConnexionProvider = ({ children }) => {
  const [estConnecte, setEstConnecte] = useState(true);
  const [vientDeSeReconnecter, setVientDeSeReconnecter] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connecteMaintenant = state.isConnected && state.isInternetReachable !== false;
      setEstConnecte(prev => {
        if (!prev && connecteMaintenant) {
          setVientDeSeReconnecter(true);
          setTimeout(() => setVientDeSeReconnecter(false), 3000);
        }
        return connecteMaintenant;
      });
    });
    return () => unsubscribe();
  }, []);

  return (
    <ConnexionContext.Provider value={{ estConnecte, vientDeSeReconnecter }}>
      {children}
    </ConnexionContext.Provider>
  );
};

export const useConnexion = () => useContext(ConnexionContext);