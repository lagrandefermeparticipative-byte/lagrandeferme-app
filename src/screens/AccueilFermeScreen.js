import React from 'react';
import { View } from 'react-native';
import DashboardScreen from './DashboardScreen';
import FermeScreen from './FermeScreen';
import { useEspace } from '../context/EspaceContext';

const AccueilFermeScreen = ({ token, projetActifId, utilisateurNom }) => {
  const { espaceActif } = useEspace();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: espaceActif === 'ferme' ? 'none' : 'flex' }}>
        <DashboardScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateurNom} />
      </View>
      <View style={{ flex: 1, display: espaceActif === 'ferme' ? 'flex' : 'none' }}>
        <FermeScreen token={token} />
      </View>
    </View>
  );
};

export default AccueilFermeScreen;