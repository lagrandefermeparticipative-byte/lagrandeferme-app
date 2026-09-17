import React, { useState, useEffect } from 'react';
import GestionInvestScreen from './GestionInvestScreen';
import TechnicienProjetsScreen from './TechnicienProjetsScreen';
import InvestisseurDashboardScreen from './InvestisseurDashboardScreen';
import InvestissementScreen from './InvestissementScreen';
import { useAuth } from '../context/AuthContext';
import { useProjet } from '../context/ProjetContext';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

// Détermine le "mode" réellement affiché à l'écran, peu importe le rôle
// technique du compte — c'est ce mode qui décide de l'écran, pas le rôle
// brut : un gestion_invest en mode investisseur voit exactement le même
// tableau de bord qu'un investisseur pur ou qu'un tech_invest en mode
// investisseur.
const AccueilRouteur = (props) => {
  const { utilisateur, modeVue, token } = useAuth();
  const { projets, chargement, projetActifId } = useProjet();
  const [projetChoisi, setProjetChoisi] = useState(false);
  const { setOnRetourProjets, setProjetChoisiGlobal } = useNavigationProjets();

  const role = utilisateur?.role;
  const estGestionnairePur = role === 'gestionnaire';
  const estGestionInvest = role === 'gestion_invest';
  const estTechInvest = role === 'tech_invest';
  const estInvestisseurPur = role === 'investisseur';

  // Vrai uniquement quand le mode affiché est "investisseur" — que ce soit
  // parce que le compte n'a que ce rôle, ou parce qu'un compte cumulé a
  // basculé dessus via le switch.
  const modeInvestisseur = estInvestisseurPur || (estGestionInvest && modeVue === 'investisseur') || (estTechInvest && modeVue === 'investisseur');
  const modeTechnicien = estTechInvest && modeVue !== 'investisseur';
  const modeGestion = estGestionnairePur || (estGestionInvest && modeVue !== 'investisseur');

  useEffect(() => {
    if (!estGestionnairePur) setProjetChoisi(false);
  }, [modeVue]);

  useEffect(() => {
    if ((modeInvestisseur || modeTechnicien) && projetChoisi) {
      setOnRetourProjets(() => () => setProjetChoisi(false));
    } else {
      setOnRetourProjets(null);
    }
    setProjetChoisiGlobal(modeGestion ? true : projetChoisi);
  }, [projetChoisi, modeInvestisseur, modeTechnicien, modeGestion]);

  if (modeInvestisseur) {
    if (!projetChoisi) return <InvestisseurDashboardScreen token={token} onChoisir={() => setProjetChoisi(true)} />;
    return <InvestissementScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateur?.nom} />;
  }

  if (modeTechnicien) {
    if (!projetChoisi) return <TechnicienProjetsScreen token={token} onChoisir={() => setProjetChoisi(true)} />;
    return <GestionInvestScreen {...props} />;
  }

  // Technicien pur (aucun rôle cumulé) : même liste, mais sans switch —
  // useMesRoles n'a pas de sens hors contexte projet, donc on ne bascule
  // jamais entre modes ici.
  if (role === 'technicien') {
    if (chargement) return null;
    if (!projetChoisi && projets.length > 1) return <TechnicienProjetsScreen token={token} onChoisir={() => setProjetChoisi(true)} />;
    return <GestionInvestScreen {...props} />;
  }

  // Mode gestion (gestionnaire pur, ou gestion_invest en mode gestion) —
  // architecture existante, inchangée.
  return <GestionInvestScreen {...props} />;
};

export default AccueilRouteur;
