import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';

const ReinitialiserMotDePasseScreen = ({ tokenInitial, onRetourLogin }) => {
  const [token, setToken] = useState(tokenInitial || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reussi, setReussi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (reussi) {
      const t = setTimeout(onRetourLogin, 2500);
      return () => clearTimeout(t);
    }
  }, [reussi]);

  const soumettre = async () => {
    setErreur('');
    if (motDePasse.length < 6) { setErreur('Le mot de passe doit faire au moins 6 caractères.'); return; }
    if (motDePasse !== confirmation) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    setChargement(true);
    try {
      await api.post(`/auth/reinitialiser-mot-de-passe/${token}`, { mot_de_passe: motDePasse });
      setReussi(true);
    } catch (error) {
      setErreur(error.response?.data?.message || 'Lien invalide ou expiré.');
    } finally { setChargement(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.conteneur} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.centre}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.titre}>Nouveau mot de passe</Text>

        {reussi ? (
          <View style={styles.encartVert}>
            <Text style={styles.encartVertTexte}>Mot de passe réinitialisé avec succès. Redirection vers la connexion...</Text>
          </View>
        ) : (
          <View style={{ width: '100%' }}>
            {!tokenInitial && (
              <>
                <Text style={styles.label}>Code reçu par email</Text>
                <TextInput style={styles.champ} placeholder="Colle le code reçu par email" value={token} onChangeText={setToken} autoCapitalize="none" />
              </>
            )}
            <Text style={styles.label}>Nouveau mot de passe</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="••••••••" value={motDePasse} onChangeText={setMotDePasse} />
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="••••••••" value={confirmation} onChangeText={setConfirmation} />
            {erreur !== '' && <View style={styles.encartRouge}><Text style={styles.encartRougeTexte}>{erreur}</Text></View>}
            <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={chargement}>
              <Text style={styles.boutonPrincipalTexte}>{chargement ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}</Text>
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
  conteneur: { flex: 1, backgroundColor: '#F9FAFB' },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  logo: { width: 80, height: 80, borderRadius: 16, marginBottom: 16 },
  titre: { fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 24 },
  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, fontSize: 13, color: '#111827' },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, padding: 12 },
  encartVertTexte: { color: '#047857', fontSize: 13, textAlign: 'center' },
  encartRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 10, marginTop: 10 },
  encartRougeTexte: { color: '#DC2626', fontSize: 13 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  lienRetour: { color: '#9CA3AF', fontSize: 12, textDecorationLine: 'underline' },
});

export default ReinitialiserMotDePasseScreen;