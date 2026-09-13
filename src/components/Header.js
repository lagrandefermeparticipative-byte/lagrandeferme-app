import React, { useRef, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useConnexion } from '../context/ConnexionContext';
import { useAuth } from '../context/AuthContext';
import { useEspace } from '../context/EspaceContext';
import { useMesRoles } from '../hooks/useMesRoles';
import { useProjet } from '../context/ProjetContext';
import api from '../services/api';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

const Header = ({ titre, sousTitre, sansRetour, action, masquerSwitch }) => {
  const { utilisateur, modeVue, switchMode, token } = useAuth();
  const { setAnimationDirection } = useEspace();
  const navigation = useNavigation();
    const { estConnecte, vientDeSeReconnecter } = useConnexion();
  const positionAnimee = useRef(new Animated.Value(0)).current;

  const { roles: mesRolesSurProjet } = useMesRoles();
    const [estInvestisseurGlobal, setEstInvestisseurGlobal] = React.useState(false);
  React.useEffect(() => {
    const estGestionnairePur = utilisateur?.role === 'gestion_invest' || utilisateur?.role === 'gestionnaire';
    if (estGestionnairePur && token) {
      api.get('/projets/moi/suis-je-investisseur', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setEstInvestisseurGlobal(res.data.estInvestisseur))
        .catch(() => setEstInvestisseurGlobal(false));
    }
  }, [utilisateur?.role, token]);

  const afficheSwitch = !masquerSwitch && (
    (utilisateur?.role === 'gestion_invest' && estInvestisseurGlobal) ||
    (mesRolesSurProjet.includes('investisseur') && (mesRolesSurProjet.includes('technicien') || utilisateur?.role === 'tech_invest'))
  );
  const { projets, projetActifId, choisirProjet } = useProjet();
  const afficheSelecteurProjet = projets.length > 1 && (utilisateur?.role === 'technicien' || utilisateur?.role === 'tech_invest' || utilisateur?.role === 'investisseur');
  const { onRetourProjets } = useNavigationProjets();
  const premierMode = utilisateur?.role === 'tech_invest' ? 'technicien' : 'gestion';

  useEffect(() => {
    Animated.timing(positionAnimee, {
      toValue: modeVue === premierMode ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [modeVue]);

  const handleSwitch = (mode) => {
    switchMode(mode);
    if (navigation.getState().routes[navigation.getState().index].name !== "Accueil") {
      navigation.navigate("Accueil");
    }
  };

  return (
    <View style={styles.conteneur}>
      {!estConnecte && (
        <View style={styles.bandeauHorsLigne}>
          <Text style={styles.bandeauHorsLigneTexte}>⚠️ Pas de connexion internet</Text>
        </View>
      )}
      {vientDeSeReconnecter && (
        <View style={styles.bandeauReconnecte}>
          <Text style={styles.bandeauReconnecteTexte}>✓ Connecté — synchronisation...</Text>
        </View>
      )}
      <View style={styles.ligne1}>
        {!sansRetour && navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.boutonRetour}>
            <Text style={styles.fleche}>←</Text>
          </TouchableOpacity>
        )}
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.titre} numberOfLines={1}>{titre}</Text>
        <View style={[styles.pointStatut, { backgroundColor: estConnecte ? '#22C55E' : '#EF4444' }]} />
      </View>

      {(sousTitre || afficheSwitch || action || (onRetourProjets && !masquerSwitch)) && (
        <View style={styles.ligne2}>
          {(onRetourProjets && !masquerSwitch) ? (
            <TouchableOpacity onPress={onRetourProjets}>
              <Text style={styles.boutonRetourProjets} numberOfLines={1}>← Mes projets</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre || ''}</Text>
          )}
          {afficheSwitch && (
            <View style={styles.switchConteneur}>
              <Animated.View
                style={[
                  styles.switchFond,
                  {
                    transform: [{
                      translateX: positionAnimee.interpolate({
                        inputRange: [0, 1],
                        outputRange: [2, 52],
                      }),
                    }],
                  },
                ]}
              />
              {utilisateur.role === 'tech_invest' ? (
                <>
                  <TouchableOpacity onPress={() => handleSwitch('technicien')} style={styles.switchBouton}>
                    <Text style={[styles.switchTexte, modeVue === 'technicien' && styles.switchTexteActif]}>Tech.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSwitch('investisseur')} style={styles.switchBouton}>
                    <Text style={[styles.switchTexte, modeVue === 'investisseur' && styles.switchTexteActif]}>Invest.</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => handleSwitch('gestion')} style={styles.switchBouton}>
                    <Text style={[styles.switchTexte, modeVue === 'gestion' && styles.switchTexteActif]}>Gestion</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSwitch('investisseur')} style={styles.switchBouton}>
                    <Text style={[styles.switchTexte, modeVue === 'investisseur' && styles.switchTexteActif]}>Invest.</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          {action}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  selecteurProjet: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  pastilleProjet: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pastilleProjetActive: { backgroundColor: '#111827' },
  pastilleProjetTexte: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  pastilleProjetTexteActif: { color: '#fff' },
  conteneur: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 8 },
  ligne1: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boutonRetour: { paddingRight: 4 },
  fleche: { fontSize: 20, color: '#9CA3AF' },
  logo: { width: 24, height: 24, borderRadius: 6 },
  titre: { fontSize: 16, fontWeight: '500', color: '#111827', flex: 1 },
  pointStatut: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
    bandeauHorsLigne: { backgroundColor: '#FEF2F2', paddingVertical: 6, alignItems: 'center', marginHorizontal: -16, marginTop: -50, marginBottom: 8 },
  bandeauHorsLigneTexte: { color: '#B91C1C', fontSize: 11, fontWeight: '600' },
  bandeauReconnecte: { backgroundColor: '#ECFDF5', paddingVertical: 6, alignItems: 'center', marginHorizontal: -16, marginBottom: 8 },
  bandeauReconnecteTexte: { color: '#047857', fontSize: 11, fontWeight: '600' },
  ligne2: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  sousTitre: { fontSize: 12, color: '#6B7280', flex: 1 },
    boutonRetourProjets: { fontSize: 12, color: '#111827', fontWeight: '700' },
  switchConteneur: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 8, padding: 2, position: 'relative', width: 104 },
  switchFond: { position: 'absolute', top: 2, left: 0, width: 50, height: 24, backgroundColor: '#fff', borderRadius: 6, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  switchBouton: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, width: 52, alignItems: 'center' },
  switchTexte: { fontSize: 11, color: '#6B7280' },
  switchTexteActif: { color: '#111827', fontWeight: '600' },
});

export default Header;