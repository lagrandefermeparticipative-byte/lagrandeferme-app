import React, { useState, useEffect } from 'react';
import GestionInvestScreen from './GestionInvestScreen';
import MesProjetsScreen from './MesProjetsScreen';
import TechnicienProjetsScreen from './TechnicienProjetsScreen';
import InvestisseurDashboardScreen from './InvestisseurDashboardScreen';
import { useAuth } from '../context/AuthContext';
import { useProjet } from '../context/ProjetContext';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

const AccueilRouteur = (props) => {
  const { utilisateur, modeVue, token } = useAuth();
  const { projets, chargement } = useProjet();
  const [projetChoisi, setProjetChoisi] = useState(false);
  const { setOnRetourProjets, setProjetChoisiGlobal } = useNavigationProjets();

  const estGestionnairePur = utilisateur?.role === 'gestionnaire' || utilisateur?.role === 'gestion_invest';
  const estTechInvest = utilisateur?.role === 'tech_invest';

  // Pour un compte cumulé (tech_invest), le switch du Header change de
  // modeVue — ça doit ramener à la liste correspondante, pas essayer de
  // basculer dans le même projet (qui pourrait ne pas concerner l'autre rôle).
  useEffect(() => {
    if (estTechInvest) setProjetChoisi(false);
  }, [modeVue]);

  useEffect(() => {
    if (!estGestionnairePur && !estTechInvest && projets.length > 1 && projetChoisi) {
      setOnRetourProjets(() => () => setProjetChoisi(false));
    } else if (estTechInvest && projetChoisi) {
      setOnRetourProjets(() => () => setProjetChoisi(false));
    } else {
      setOnRetourProjets(null);
    }
    setProjetChoisiGlobal(estGestionnairePur ? true : (estTechInvest ? projetChoisi : (projetChoisi || projets.length <= 1)));
  }, [projetChoisi, projets.length, estGestionnairePur, estTechInvest]);

  if (estGestionnairePur) return <GestionInvestScreen {...props} />;

  if (estTechInvest) {
    if (!projetChoisi) {
      return modeVue === 'investisseur'
        ? <InvestisseurDashboardScreen token={token} onChoisir={() => setProjetChoisi(true)} />
        : <TechnicienProjetsScreen token={token} onChoisir={() => setProjetChoisi(true)} />;
    }
    return <GestionInvestScreen {...props} />;
  }

  if (chargement) return null;
  if (projets.length > 1 && !projetChoisi) return <MesProjetsScreen onChoisir={() => setProjetChoisi(true)} />;
  return <GestionInvestScreen {...props} />;
};

export default AccueilRouteur;
