import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import AccueilFermeScreen from './AccueilFermeScreen';
import RapportScreen from './RapportScreen';
import InvestissementScreen from './InvestissementScreen';
import { useAuth } from '../context/AuthContext';

const GestionInvestScreen = ({ token, projetActifId, utilisateurNom, onRetourProjets }) => {
  const { modeVue, utilisateur } = useAuth();

  // Un compte à rôle unique (technicien seul, investisseur seul) n'a pas de
  // vrai choix à faire : il voit toujours le même écran, peu importe la
  // valeur de modeVue laissée en mémoire par une précédente session sur cet
  // appareil. Seuls les comptes cumulés (tech_invest, gestion_invest) basculent
  // réellement entre deux vues via le switch du Header.
  if (utilisateur?.role === 'investisseur') {
    return <InvestissementScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateurNom} />;
  }
  if (utilisateur?.role === 'technicien') {
    return <RapportScreen token={token} projetActifId={projetActifId} />;
  }

  const estTechnicien = utilisateur?.role === 'tech_invest';
  const modeGestion = estTechnicien ? 'technicien' : 'gestion';
  const estModeGestion = modeVue === modeGestion;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: estModeGestion ? 'flex' : 'none' }}>
        {estTechnicien ? (
          <RapportScreen token={token} projetActifId={projetActifId} />
        ) : (
          <AccueilFermeScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateurNom} />
        )}
      </View>
      <View style={{ flex: 1, display: !estModeGestion ? 'flex' : 'none' }}>
        <InvestissementScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateurNom} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
});

export default GestionInvestScreen;
