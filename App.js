import React from 'react';
import { View, AppState, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProjetProvider, useProjet } from './src/context/ProjetContext';
import { EspaceProvider, useEspace } from './src/context/EspaceContext';
import { CacheProvider } from './src/context/CacheContext';
import { ConnexionProvider } from './src/context/ConnexionContext';
import { NavigationProjetsProvider } from './src/context/NavigationProjetsContext';
// Import dynamique plus bas, pour éviter qu'Expo Go ne plante à l'ouverture
// du module expo-notifications lui-même (retiré d'Expo Go depuis le SDK 53).
import BottomNav from './src/components/BottomNav';

import LoginScreen from './src/screens/LoginScreen';
import AccueilFermeScreen from './src/screens/AccueilFermeScreen';
import GestionInvestScreen from './src/screens/GestionInvestScreen';
import AccueilRouteur from './src/screens/AccueilRouteur';
import NouveauProjetScreen from './src/screens/NouveauProjetScreen';
import ElevageScreen from './src/screens/ElevageScreen';
import ReproductionScreen from './src/screens/ReproductionScreen';
import GenerationsScreen from './src/screens/GenerationsScreen';
import LiquidationScreen from './src/screens/LiquidationScreen';
import ProjetsAVenirScreen from './src/screens/ProjetsAVenirScreen';
import NouveauProjetAVenirScreen from './src/screens/NouveauProjetAVenirScreen';
import GestionScreen from './src/screens/GestionScreen';
import CommerceScreen from './src/screens/CommerceScreen';
import AnalysesScreen from './src/screens/AnalysesScreen';
import FermeScreen from './src/screens/FermeScreen';
import GestionFermeScreen from './src/screens/GestionFermeScreen';
import CaissesScreen from './src/screens/CaissesScreen';
import EquipementsScreen from './src/screens/EquipementsScreen';
import BilanScreen from './src/screens/BilanScreen';
import RapportScreen from './src/screens/RapportScreen';
import InvestissementScreen from './src/screens/InvestissementScreen';
import ProfilScreen from './src/screens/ProfilScreen';
import JournalScreen from './src/screens/JournalScreen';
import GestionProjetScreen from './src/screens/GestionProjetScreen';
import GestionUtilisateursScreen from './src/screens/GestionUtilisateursScreen';
import ApercuFermeScreen from './src/screens/ApercuFermeScreen';
import ApercuFermeProjetScreen from './src/screens/ApercuFermeProjetScreen';
import GestionAccesScreen from './src/screens/GestionAccesScreen';

const Stack = createNativeStackNavigator();

const AvecNav = ({ children }) => (
  <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }}>{children}</View>
    <BottomNav />
  </View>
);

const AppNavigator = () => {
  const { utilisateur, token } = useAuth();
  const { projetActifId, projets } = useProjet();
  const { animationDirection, setAnimationDirection } = useEspace();

  React.useEffect(() => {
    setTimeout(() => setAnimationDirection('none'), 300);
  }, [animationDirection]);
  const projetNom = projets.find(p => (p.uuid_id || p.id) === projetActifId)?.nom;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: animationDirection }}>
      <Stack.Screen name="Accueil">{() => <AvecNav><AccueilRouteur token={token} projetActifId={projetActifId} utilisateurNom={utilisateur?.nom} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Elevage">{() => <AvecNav><ElevageScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="GestionProjet">{({ route, navigation }) => <AvecNav><GestionProjetScreen token={token} projetId={route.params?.projetId} onRetour={() => navigation.goBack()} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Reproduction">{() => <AvecNav><ReproductionScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Generations">{() => <AvecNav><GenerationsScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Liquidation">{({ route, navigation }) => <AvecNav><LiquidationScreen token={token} route={route} navigation={navigation} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="ProjetsAVenir">{() => <AvecNav><ProjetsAVenirScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="NouveauProjetAVenir">{() => <AvecNav><NouveauProjetAVenirScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Gestion">{() => <AvecNav><GestionScreen token={token} projetActifId={projetActifId} projetNom={projetNom} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Commerce">{() => <AvecNav><CommerceScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Analyses">{() => <AvecNav><AnalysesScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Ferme">{() => <AvecNav><FermeScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="FermeDepenses">{() => <AvecNav><GestionFermeScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Caisses">{() => <AvecNav><CaissesScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Equipements">{() => <AvecNav><EquipementsScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Bilan">{() => <AvecNav><BilanScreen token={token} /></AvecNav>}</Stack.Screen>
            <Stack.Screen name="Journal">{() => <AvecNav><JournalScreen token={token} /></AvecNav>}</Stack.Screen>
                  <Stack.Screen name="GestionUtilisateurs">{() => <AvecNav><GestionUtilisateursScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="ApercuFerme">{({ navigation }) => <AvecNav><ApercuFermeScreen token={token} onOuvrirProjet={(id) => navigation.navigate('ApercuFermeProjet', { projetId: id })} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="ApercuFermeProjet">{({ route, navigation }) => <AvecNav><ApercuFermeProjetScreen token={token} projetId={route.params?.projetId} onRetour={() => navigation.goBack()} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="GestionAcces">{() => <AvecNav><GestionAccesScreen token={token} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Rapport">{() => <AvecNav><RapportScreen token={token} projetActifId={projetActifId} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Investissement">{() => <AvecNav><InvestissementScreen token={token} projetActifId={projetActifId} utilisateurNom={utilisateur?.nom} /></AvecNav>}</Stack.Screen>
      <Stack.Screen name="Profil">{() => <AvecNav><ProfilScreen utilisateur={{ utilisateur }} token={token} onDeconnecter={useAuth().logout} /></AvecNav>}</Stack.Screen>
    </Stack.Navigator>
  );
};

// expo-updates ne fonctionne pas dans Expo Go (uniquement en build EAS) —
// même garde appOwnership que pour les notifications, sinon ça plante.
const verifierMiseAJour = async () => {
  try {
    const Constants = (await import('expo-constants')).default;
    if (Constants.appOwnership === 'expo') return;
    const Updates = await import('expo-updates');
    const resultat = await Updates.checkForUpdateAsync();
    if (!resultat.isAvailable) return;
    await Updates.fetchUpdateAsync();
    Alert.alert(
      'Mise à jour disponible',
      "Une nouvelle version de l'application est prête. Redémarrer maintenant ?",
      [
        { text: 'Plus tard', style: 'cancel' },
        { text: 'Redémarrer', onPress: () => Updates.reloadAsync() },
      ]
    );
  } catch (err) { console.log('Vérification mise à jour impossible:', err.message); }
};

const Racine = () => {
  const { utilisateur, loading, token } = useAuth();

  React.useEffect(() => {
    if (utilisateur && token) {
      import('expo-constants').then(({ default: Constants }) => {
        if (Constants.appOwnership !== 'expo') {
          import('./src/services/notifications').then(({ enregistrerPourNotifications }) => {
            enregistrerPourNotifications(token).catch(err => console.log('Notifications non disponibles:', err.message));
          });
        }
      });
    }
  }, [utilisateur]);

  React.useEffect(() => {
    verifierMiseAJour();
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') verifierMiseAJour();
    });
    return () => sub.remove();
  }, []);

  if (loading) return null;
  if (!utilisateur) return <LoginScreen />;

  return (
    <ConnexionProvider>
      <NavigationProjetsProvider>
      <ProjetProvider>
        <EspaceProvider>
          <CacheProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </CacheProvider>
        </EspaceProvider>
      </ProjetProvider>
    </NavigationProjetsProvider>
    </ConnexionProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Racine />
    </AuthProvider>
  );
}
