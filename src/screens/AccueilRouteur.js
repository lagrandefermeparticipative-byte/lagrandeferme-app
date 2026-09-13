import React, { useState, useEffect } from 'react';
import GestionInvestScreen from './GestionInvestScreen';
import MesProjetsScreen from './MesProjetsScreen';
import { useAuth } from '../context/AuthContext';
import { useProjet } from '../context/ProjetContext';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

const AccueilRouteur = (props) => {
  const { utilisateur } = useAuth();
  const { projets, chargement } = useProjet();
  const [projetChoisi, setProjetChoisi] = useState(false);
  const { setOnRetourProjets, setProjetChoisiGlobal } = useNavigationProjets();

  const estGestionnairePur = utilisateur?.role === 'gestionnaire' || utilisateur?.role === 'gestion_invest';

  useEffect(() => {
    if (!estGestionnairePur && projets.length > 1 && projetChoisi) {
      setOnRetourProjets(() => () => setProjetChoisi(false));
    } else {
      setOnRetourProjets(null);
    }
    setProjetChoisiGlobal(estGestionnairePur ? true : projetChoisi || projets.length <= 1);
  }, [projetChoisi, projets.length, estGestionnairePur]);

  if (estGestionnairePur) return <GestionInvestScreen {...props} />;

  if (chargement) return null;
  if (projets.length > 1 && !projetChoisi) return <MesProjetsScreen onChoisir={() => setProjetChoisi(true)} />;
  return <GestionInvestScreen {...props} />;
};

export default AccueilRouteur;
