import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useEspace } from '../context/EspaceContext';
import { useNavigationProjets } from '../context/NavigationProjetsContext';

const menuGestionnaireProjet = [
  { nom: 'Accueil', icone: '🏠', label: 'Accueil' },
  { nom: 'Elevage', icone: '🐦', label: 'Élevage' },
  { nom: 'Reproduction', icone: '🥚', label: 'Repro.' },
  { nom: 'Gestion', icone: '⚙️', label: 'Gestion' },
  { nom: 'Commerce', icone: '🛒', label: 'Commerce' },
  { nom: 'Analyses', icone: '📊', label: 'Analyses' },
];

const menuGestionnaireFerme = [
  { nom: 'Ferme', icone: '🏡', label: 'Ferme' },
  { nom: 'FermeDepenses', icone: '💵', label: 'Dépenses' },
  { nom: 'Caisses', icone: '🏦', label: 'Caisses' },
  { nom: 'Equipements', icone: '🧰', label: 'Équip.' },
  { nom: 'Bilan', icone: '📊', label: 'Bilan' },
  { nom: 'Profil', icone: '👤', label: 'Profil' },
];

const menuTechnicien = (projetChoisi) => [
  { nom: 'Accueil', icone: '📋', label: projetChoisi ? 'Rapport' : 'Dashboard' },
  { nom: 'Profil', icone: '👤', label: 'Profil' },
];

const menuInvestisseur = (projetChoisi) => [
  { nom: 'Accueil', icone: '💰', label: projetChoisi ? 'Mon invest.' : 'Dashboard' },
  { nom: 'Profil', icone: '👤', label: 'Profil' },
];

const BottomNav = () => {
  const navigation = useNavigation();
  const { utilisateur, modeVue } = useAuth();
  const { espaceActif, switchEspace, setAnimationDirection, vueApercuFerme, setVueApercuFerme } = useEspace();
    const { projetChoisi } = useNavigationProjets();
  const routeActuelle = useNavigationState(state => state?.routes[state.index]?.name);
  const positionAnimee = useRef(new Animated.Value(espaceActif === 'ferme' ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(positionAnimee, {
      toValue: espaceActif === 'ferme' ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [espaceActif]);

  const aAccesEspaces = () => {
    if (utilisateur?.role === 'gestionnaire') return true;
    if (utilisateur?.role === 'gestion_invest' && modeVue !== 'investisseur') return true;
    return false;
  };

  const getMenu = () => {
    if (utilisateur?.role === 'gestionnaire') {
      return espaceActif === 'ferme' ? menuGestionnaireFerme : menuGestionnaireProjet;
    }
    if (utilisateur?.role === 'gestion_invest') {
      if (modeVue === 'investisseur') return menuInvestisseur(projetChoisi);
      return espaceActif === 'ferme' ? menuGestionnaireFerme : menuGestionnaireProjet;
    }
    if (utilisateur?.role === 'tech_invest') {
      return modeVue === 'investisseur' ? menuInvestisseur(projetChoisi) : menuTechnicien(projetChoisi);
    }
    if (utilisateur?.role === 'technicien') return menuTechnicien(projetChoisi);
    return menuInvestisseur(projetChoisi);
  };

  // Capacité additionnelle greffée sur n'importe quel rôle — jamais pour le
  // gestionnaire/gestion_invest qui a déjà accès à tout par ailleurs.
  // Capacité additionnelle greffée sur n'importe quel rôle — jamais pour le
  // gestionnaire/gestion_invest qui a déjà accès à tout par ailleurs. Un vrai
  // espace à part (comme le switch Gestion/Investisseur), jamais un item de
  // plus mélangé dans le menu habituel de la personne.
  const aCapaciteApercuFerme = utilisateur?.apercu_ferme_actif && !['gestionnaire', 'gestion_invest'].includes(utilisateur?.role);
  const menuBase = getMenu();
  const menuApercuFerme = [{ nom: 'ApercuFerme', icone: '🔍', label: 'Aperçu ferme' }, { nom: 'Profil', icone: '👤', label: 'Profil' }];
  const menu = (aCapaciteApercuFerme && vueApercuFerme) ? menuApercuFerme : menuBase;
  const LARGEUR_TOTALE = 320; // largeur totale du sélecteur (ajustable selon ton écran)
  const PADDING = 4;
  const largeurBouton = (LARGEUR_TOTALE - PADDING * 2) / 2;

  return (
    <View style={styles.conteneur}>
      {aAccesEspaces() && (
        <View style={[styles.espaceSwitch, { width: LARGEUR_TOTALE, alignSelf: 'center' }]}>
          <Animated.View
            style={[
              styles.espaceFond,
              {
                width: largeurBouton,
                transform: [{
                  translateX: positionAnimee.interpolate({ inputRange: [0, 1], outputRange: [0, largeurBouton] }),
                }],
              },
            ]}
          />
          <TouchableOpacity
            onPress={() => { switchEspace('projet'); navigation.navigate('Accueil'); }}
            style={styles.espaceBouton}
          >
            <Text style={[styles.espaceTexte, espaceActif !== 'ferme' && styles.espaceTexteActif]}>Projet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { switchEspace('ferme'); navigation.navigate('Accueil'); }}
            style={styles.espaceBouton}
          >
            <Text style={[styles.espaceTexte, espaceActif === 'ferme' && styles.espaceTexteActif]}>Ferme</Text>
          </TouchableOpacity>
        </View>
      )}
      {aCapaciteApercuFerme && (
        <View style={[styles.espaceSwitch, { width: LARGEUR_TOTALE, alignSelf: 'center' }]}>
          <TouchableOpacity
            onPress={() => { setVueApercuFerme(false); navigation.navigate(menuBase[0].nom); }}
            style={[styles.espaceBouton, !vueApercuFerme && styles.espaceBoutonActifFond]}
          >
            <Text style={[styles.espaceTexte, !vueApercuFerme && styles.espaceTexteActif]}>Mon espace</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setVueApercuFerme(true); navigation.navigate('ApercuFerme'); }}
            style={[styles.espaceBouton, vueApercuFerme && styles.espaceBoutonActifFond]}
          >
            <Text style={[styles.espaceTexte, vueApercuFerme && styles.espaceTexteActif]}>Aperçu ferme</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.menuLigne}>
        {menu.map((item) => {
          const isActive = routeActuelle === item.nom;
          return (
            <TouchableOpacity key={item.nom} onPress={() => navigation.navigate(item.nom)} style={styles.menuItem}>
              <Text style={[styles.icone, { opacity: isActive ? 1 : 0.4 }]}>{item.icone}</Text>
              <Text style={[styles.label, isActive && styles.labelActif]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingBottom: 20 },
  espaceSwitch: { flexDirection: 'row', paddingTop: 8, marginBottom: 4, position: 'relative', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4 },
  espaceFond: { position: 'absolute', top: 4, left: 4, height: 34, backgroundColor: '#1D1D1F', borderRadius: 8 },
  espaceBouton: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1, height: 34 },
  espaceBoutonActifFond: { backgroundColor: '#1D1D1F', borderRadius: 8 },
  espaceTexte: { fontSize: 12, fontWeight: '600', color: '#6E6E73' },
  espaceTexteActif: { color: '#fff' },
  menuLigne: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, paddingHorizontal: 8 },
  menuItem: { alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 4 },
  icone: { fontSize: 20 },
  label: { fontSize: 10, color: '#6E6E73' },
  labelActif: { color: '#1D1D1F', fontWeight: '600' },
});

export default BottomNav;