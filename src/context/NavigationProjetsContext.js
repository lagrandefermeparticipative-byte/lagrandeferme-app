import React, { createContext, useContext, useState } from 'react';

const NavigationProjetsContext = createContext({ onRetourProjets: null, setOnRetourProjets: () => {}, projetChoisi: false, setProjetChoisiGlobal: () => {} });

export const NavigationProjetsProvider = ({ children }) => {
  const [onRetourProjets, setOnRetourProjets] = useState(null);
  const [projetChoisi, setProjetChoisiGlobal] = useState(false);
  return (
    <NavigationProjetsContext.Provider value={{ onRetourProjets, setOnRetourProjets, projetChoisi, setProjetChoisiGlobal }}>
      {children}
    </NavigationProjetsContext.Provider>
  );
};

export const useNavigationProjets = () => useContext(NavigationProjetsContext);
