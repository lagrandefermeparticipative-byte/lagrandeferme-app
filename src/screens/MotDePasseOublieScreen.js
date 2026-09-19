import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';

const MotDePasseOublieScreen = ({ onRetourLogin }) => {
  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const soumettre = async () => {
    setErreur(''); setChargement(true);
    try {
      await api.post('/auth/mot-de-passe-oublie', { email });
      setEnvoye(true);
    } catch (error) {
      setErreur(error.response?.data?.message || 'Une erreur est survenue.');
    } finally { setChargement(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.conteneur} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.centre}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.titre}>Mot de passe oublié</Text>
        <Text style={styles.sousTitre}>Entrez votre email, nous vous enverrons un lien de réinitialisation.</Text>

        {envoye ? (
          <View style={styles.encartVert}>
            <Text style={styles.encartVertTexte}>Si cet email est associé à un compte, un lien de réinitialisation vient d'être envoyé.</Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput style={styles.champ} keyboardType="email-address" autoCapitalize="none" placeholder="votre@email.com" value={email} onChangeText={setEmail} />
            {erreur !== '' && <View style={styles.encartRouge}><Text style={styles.encartRougeTexte}>{erreur}</Text></View>}
            <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={chargement}>
              <Text style={styles.boutonPrincipalTexte}>{chargement ? 'Envoi...' : 'Envoyer le lien'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={onRetourLogin} style={{ marginTop: 20 }}>
          <Text style={styles.lienRetour}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F5F5F7' },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 80, height: 80, borderRadius: 16, marginBottom: 16 },
  titre: { fontSize: 17, fontWeight: '600', color: '#1D1D1F' },
  sousTitre: { fontSize: 13, color: '#6E6E73', textAlign: 'center', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '600', color: '#6E6E73', marginBottom: 6 },
  champ: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, padding: 12, fontSize: 13, color: '#1D1D1F' },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, padding: 12 },
  encartVertTexte: { color: '#047857', fontSize: 13, textAlign: 'center' },
  encartRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 10, marginTop: 10 },
  encartRougeTexte: { color: '#DC2626', fontSize: 13 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  lienRetour: { color: '#6E6E73', fontSize: 12, textDecorationLine: 'underline' },
});

export default MotDePasseOublieScreen;