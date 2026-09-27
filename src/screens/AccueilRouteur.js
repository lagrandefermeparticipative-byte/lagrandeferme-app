import React, { useState, useEffect } from 'react';
import GestionInvestScreen from './GestionInvestScreen';
import TechnicienProjetsScreen from './TechnicienProjetsScreen';
import DashboardTechnicienScreen from './DashboardTechnicienScreen';
import VenteTechnicienScreen from './VenteTechnicienScreen';
import InvestisseurDashboardScreen from './InvestisseurDashboardScreen';
import InvestissementScreen from './InvestissementScreen';
import MonParcoursScreen from './MonParcoursScreen';
import { useAuth } from '../context/AuthContext';
import { useProjet } from '../context/ProjetContext';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

// Détermine le "mode" réellement affiché à l'écran, peu importe le rôle
// technique du compte — c'est ce mode qui décide de l'écran, pas le rôle
// brut : un gestion_invest en mode investisseur voit exactement le même
// tableau de bord qu'un investisseur pur ou qu'un tech_invest en mode
// investisseur.
const AccueilRouteur = (props) => {
  const { utilisateur, modeVue, token, vueInvestisseurCapacite } = useAuth();
  const { projets, chargement, projetActifId } = useProjet();
  const [projetChoisi, setProjetChoisi] = useState(false);
  const [vueTechnicien, setVueTechnicien] = useState('dashboard'); // 'dashboard' | 'liste' | 'vente'
  const { setOnRetourProjets, setProjetChoisiGlobal } = useNavigationProjets();

  const role = utilisateur?.role;
  const estGestionnairePur = role === 'gestionnaire';
  const estGestionInvest = role === 'gestion_invest';
  const estTechInvest = role === 'tech_invest';
  const estInvestisseurPur = role === 'investisseur';

  // Vrai uniquement quand le mode affiché est "investisseur" — que ce soit
  // parce que le compte n'a que ce rôle, ou parce qu'un compte cumulé a
  // basculé dessus via le switch.
  // Capacité composable "est_investisseur" — greffée sur un rôle qui n'a pas
  // déjà un accès investisseur de base (investisseur/tech_invest/gestion_invest
  // gèrent déjà leur propre bascule ci-dessus). Bascule indépendante,
  // pilotée par le switch de BottomNav, jamais mélangée à modeVue.
  const aCapaciteInvestisseur = utilisateur?.est_investisseur === true && !['investisseur', 'tech_invest', 'gestion_invest'].includes(role);
  const modeCapaciteInvestisseur = aCapaciteInvestisseur && vueInvestisseurCapacite;

  const modeInvestisseur = estInvestisseurPur || (estGestionInvest && modeVue === 'investisseur') || (estTechInvest && modeVue === 'investisseur') || modeCapaciteInvestisseur;
  const modeTechnicien = estTechInvest && modeVue !== 'investisseur';
  const modeGestion = estGestionnairePur || (estGestionInvest && modeVue !== 'investisseur');

  useEffect(() => {
    if (!estGestionnairePur) setProjetChoisi(false);
    setVueTechnicien('dashboard');
  }, [modeVue, vueInvestisseurCapacite]);

  useEffect(() => {
    if ((modeInvestisseur || modeTechnicien) && projetChoisi) {
      setOnRetourProjets(() => () => setProjetChoisi(false));
    } else {
      setOnRetourProjets(null);
    }
    setProjetChoisiGlobal(modeGestion ? true : projetChoisi);
  }, [projetChoisi, modeInvestisseur, modeTechnicien, modeGestion]);

  // Stagiaire : écran d'accueil dédié ("Mon parcours"), équivalent du
  // RedirectByRole web qui l'envoie vers /mon-parcours. Aucun switch de mode
  // ni de projet — un stagiaire est rattaché à un seul projet/technicien.
  if (role === 'stagiaire' && !modeCapaciteInvestisseur) {
    return <MonParcoursScreen token={token} />;
  }

  if (modeInvestisseur) {
    if (!projetChoisi) return <InvestisseurDashboardScreen token={token} onChoisir={() => setProjetChoisi(true)} />;
    return <InvestissementScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateur?.nom} />;
  }

  if (modeTechnicien) {
    if (projetChoisi) return <GestionInvestScreen {...props} />;
    if (vueTechnicien === 'liste') return <TechnicienProjetsScreen token={token} onChoisir={() => setProjetChoisi(true)} onRetour={() => setVueTechnicien('dashboard')} />;
    if (vueTechnicien === 'vente') return <VenteTechnicienScreen token={token} onRetour={() => setVueTechnicien('dashboard')} />;
    return <DashboardTechnicienScreen token={token} onVoirProjets={() => setVueTechnicien('liste')} onOuvrirProjet={() => setProjetChoisi(true)} onEnregistrerVente={() => setVueTechnicien('vente')} />;
  }

  // Technicien pur (aucun rôle cumulé) : même parcours dashboard -> liste ->
  // projet, mais sans switch — useMesRoles n'a pas de sens hors contexte
  // projet, donc on ne bascule jamais entre modes ici.
  if (role === 'technicien') {
    if (chargement) return null;
    if (projetChoisi) return <GestionInvestScreen {...props} />;
    if (vueTechnicien === 'liste') return <TechnicienProjetsScreen token={token} onChoisir={() => setProjetChoisi(true)} onRetour={() => setVueTechnicien('dashboard')} />;
    if (vueTechnicien === 'vente') return <VenteTechnicienScreen token={token} onRetour={() => setVueTechnicien('dashboard')} />;
    return <DashboardTechnicienScreen token={token} onVoirProjets={() => setVueTechnicien('liste')} onOuvrirProjet={() => setProjetChoisi(true)} onEnregistrerVente={() => setVueTechnicien('vente')} />;
  }

  // Mode gestion (gestionnaire pur, ou gestion_invest en mode gestion) —
  // architecture existante, inchangée.
  return <GestionInvestScreen {...props} />;
};

export default AccueilRouteur;
