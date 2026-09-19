import React, { useState } from 'react';
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import MotDePasseOublieScreen from './MotDePasseOublieScreen';
import ReinitialiserMotDePasseScreen from './ReinitialiserMotDePasseScreen';

const LoginScreen = () => {
  const { login } = useAuth();
  const [vue, setVue] = useState('login'); // login | oublie | reinitialiser
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);

  const seConnecter = async () => {
    setErreur('');
    setChargement(true);
    try {
      await login(email, motDePasse);
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur de connexion');
    } finally {
      setChargement(false);
    }
  };

  if (vue === 'oublie') return <MotDePasseOublieScreen onRetourLogin={() => setVue('login')} />;
  if (vue === 'reinitialiser') return <ReinitialiserMotDePasseScreen onRetourLogin={() => setVue('login')} />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.conteneur}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={styles.contenu}>
        <View style={styles.logoZone}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.sousTitre}>Gestion d'élevage professionnelle</Text>
        </View>
        <View style={styles.champGroupe}>
          <Text style={styles.label}>Adresse email</Text>
          <TextInput
            style={styles.champ}
            placeholder="votre@email.com"
            placeholderTextColor="#6E6E73"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.champGroupe}>
          <Text style={styles.label}>Mot de passe</Text>
          <View style={styles.champAvecIcone}>
            <TextInput
              style={styles.champAvecIconeTexte}
              placeholder="••••••••"
              placeholderTextColor="#6E6E73"
              value={motDePasse}
              onChangeText={setMotDePasse}
              secureTextEntry={!motDePasseVisible}
            />
            <TouchableOpacity onPress={() => setMotDePasseVisible(!motDePasseVisible)}>
              <Text style={styles.iconeOeil}>{motDePasseVisible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {erreur !== '' && (
          <View style={styles.erreurBox}>
            <Text style={styles.erreurTexte}>{erreur}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.bouton} onPress={seConnecter} disabled={chargement}>
          {chargement ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonTexte}>Se connecter</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setVue('oublie')}>
          <Text style={styles.lienCentre}>Mot de passe oublié ?</Text>
        </TouchableOpacity>
        <Text style={styles.footerTexte}>Accès sur invitation uniquement</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', paddingHorizontal: 24 },
  contenu: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  logoZone: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 140, height: 140, borderRadius: 20, marginBottom: 12 },
  sousTitre: { fontSize: 13, color: '#6E6E73' },
  champGroupe: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '500', color: '#6E6E73', marginBottom: 6 },
  champ: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1D1D1F', backgroundColor: '#fff' },
    champAvecIcone: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, backgroundColor: '#fff', paddingRight: 12 },
  champAvecIconeTexte: { flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#1D1D1F' },
  iconeOeil: { fontSize: 18 },
  erreurBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginBottom: 12 },
  erreurTexte: { fontSize: 13, color: '#DC2626' },
  bouton: { backgroundColor: '#1D1D1F', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  boutonTexte: { color: '#fff', fontWeight: '600', fontSize: 14 },
  lienCentre: { textAlign: 'center', fontSize: 12, color: '#6E6E73', marginTop: 16, textDecorationLine: 'underline' },
  footerTexte: { textAlign: 'center', fontSize: 11, color: '#6E6E73', marginTop: 24 },
});
export default LoginScreen;