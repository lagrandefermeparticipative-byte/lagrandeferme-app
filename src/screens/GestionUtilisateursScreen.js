import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const getRoleLabel = (role) => ({
  gestionnaire: 'Gestionnaire', gestion_invest: 'Gestionnaire · Investisseur',
  technicien: 'Technicien', tech_invest: 'Technicien · Investisseur', investisseur: 'Investisseur',
}[role] || role);

const GestionUtilisateursScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [utilisateurSelectionne, setUtilisateurSelectionne] = useState(null);
  const [editForm, setEditForm] = useState({ nom: '', email: '', telephone: '', whatsapp: '' });
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/utilisateurs/liste', { headers });
      setUtilisateurs(res.data);
    } catch (error) { console.log('Erreur utilisateurs:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { charger(); }, []);

  const ouvrirEdit = (u) => {
    setUtilisateurSelectionne(u);
    setEditForm({ nom: u.nom || '', email: u.email || '', telephone: u.telephone || '', whatsapp: u.whatsapp || '' });
  };

  const enregistrer = async () => {
    setEnvoi(true);
    try {
      await api.put(`/utilisateurs/${utilisateurSelectionne.id}`, editForm, { headers });
      setUtilisateurSelectionne(null);
      charger();
    } catch (error) { Alert.alert('Erreur', "Modification impossible."); }
    finally { setEnvoi(false); }
  };

  const supprimer = (u) => {
    Alert.alert('Supprimer le compte', `Supprimer définitivement le compte de ${u.nom} ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/utilisateurs/${u.id}`, { headers }); setUtilisateurSelectionne(null); charger(); }
        catch (error) { Alert.alert('Erreur', "Suppression impossible — ce compte est peut-être encore associé à un projet."); }
      }},
    ]);
  };

  const utilisateursFiltres = utilisateurs.filter(u =>
    u.nom?.toLowerCase().includes(recherche.toLowerCase()) || u.email?.toLowerCase().includes(recherche.toLowerCase())
  );

  if (utilisateurSelectionne) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Modifier · ${utilisateurSelectionne.nom}`} action={<TouchableOpacity onPress={() => setUtilisateurSelectionne(null)}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput style={styles.champ} value={editForm.nom} onChangeText={v => setEditForm({ ...editForm, nom: v })} />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.champ} keyboardType="email-address" autoCapitalize="none" value={editForm.email} onChangeText={v => setEditForm({ ...editForm, email: v })} />
            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.champ} value={editForm.telephone} onChangeText={v => setEditForm({ ...editForm, telephone: v })} />
            <Text style={styles.label}>WhatsApp</Text>
            <TextInput style={styles.champ} value={editForm.whatsapp} onChangeText={v => setEditForm({ ...editForm, whatsapp: v })} />
            <View style={styles.infoRole}><Text style={styles.infoRoleTexte}>Rôle : {getRoleLabel(utilisateurSelectionne.role)}</Text></View>
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrer} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer les modifications'}</Text>
          </TouchableOpacity>

          <View style={styles.zoneDanger}>
            <Text style={styles.zoneDangerLabel}>Zone de danger</Text>
            <TouchableOpacity style={styles.boutonRouge} onPress={() => supprimer(utilisateurSelectionne)}>
              <Text style={styles.boutonRougeTexte}>Supprimer le compte définitivement</Text>
            </TouchableOpacity>
            <Text style={styles.aideDanger}>Impossible si ce compte est encore associé à un projet actif.</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Comptes utilisateurs" sousTitre="Gestion globale" sansRetour />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <TextInput style={[styles.champ, { marginTop: 12, marginBottom: 12 }]} placeholder="Rechercher par nom ou email..." value={recherche} onChangeText={setRecherche} />
          <Text style={styles.compteur}>{utilisateursFiltres.length} compte{utilisateursFiltres.length > 1 ? 's' : ''}</Text>
          {utilisateursFiltres.map(u => (
            <TouchableOpacity key={u.id} style={styles.carte} onPress={() => ouvrirEdit(u)}>
              <Text style={styles.carteTitre}>{u.nom}</Text>
              <Text style={styles.carteSousTexte}>{u.email}</Text>
              <View style={styles.badgeRole}><Text style={styles.badgeRoleTexte}>{getRoleLabel(u.role)}</Text></View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 11, color: '#6B7280', marginTop: 2, marginBottom: 6 },
  compteur: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  badgeRole: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeRoleTexte: { fontSize: 10, color: '#4B5563', fontWeight: '600' },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  infoRole: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginTop: 12 },
  infoRoleTexte: { fontSize: 11, color: '#6B7280' },
  lienRetourPetit: { color: '#6B7280', fontSize: 11 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  zoneDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14, marginTop: 16 },
  zoneDangerLabel: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  boutonRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonRougeTexte: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  aideDanger: { fontSize: 10, color: '#9CA3AF', marginTop: 6 },
});

export default GestionUtilisateursScreen;