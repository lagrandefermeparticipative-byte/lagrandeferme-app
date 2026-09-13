import React, { createContext, useContext, useRef, useEffect } from 'react';

const CacheContext = createContext();

import { useConnexion } from './ConnexionContext';

export const CacheProvider = ({ children }) => {
  const cache = useRef({});
  const { vientDeSeReconnecter } = useConnexion();

  useEffect(() => {
    if (vientDeSeReconnecter) {
      cache.current = {};
    }
  }, [vientDeSeReconnecter]);

  const getCache = (cle) => cache.current[cle];
  const setCache = (cle, valeur) => { cache.current[cle] = valeur; };
  const viderCache = (cle) => { delete cache.current[cle]; };
  const viderTout = () => { cache.current = {}; };

  return (
    <CacheContext.Provider value={{ getCache, setCache, viderCache, viderTout }}>
      {children}
    </CacheContext.Provider>
  );
};

export const useCache = () => useContext(CacheContext);