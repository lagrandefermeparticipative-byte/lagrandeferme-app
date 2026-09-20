import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import api from '../services/api';

// Création allégée d'un projet "à venir" : juste de quoi donner envie et
// fixer un objectif de collecte — pas de lots, dépenses ou investisseurs à
// ce stade, ça viendra au vrai lancement du projet. Miroir web.
const NouveauProjetAVenirScreen = ({ token }) => {
  const navigation = useNavigation();
  const headers = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState({
    nom: '', type_volaille: 'Pintade', objectif_sujets: '', objectif_collecte: '', description: '', date_lancement_prevue: '',
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const soumettre = async () => {
    if (!form.nom.trim() || !form.objectif_sujets) { setErreur('Nom et objectif de sujets sont obligatoires.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/projets', {
        ...form,
        statut: 'a_venir',
        objectif_sujets: parseInt(form.objectif_sujets),
        objectif_collecte: form.objectif_collecte ? parseFloat(form.objectif_collecte) : null,
        date_lancement_prevue: form.date_lancement_prevue || null,
        taux_survie_vise: 90,
      }, { headers });
      navigation.navigate('ProjetsAVenir');
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur lors de la création.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre="Nouveau projet à venir" />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={styles.label}>Nom du projet *</Text>
          <TextInput style={styles.champ} value={form.nom} onChangeText={v => setForm({ ...form, nom: v })} placeholder="Ex: Canards 2027" />

          <Text style={styles.label}>Type de volaille</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {['Pintade', 'Poulet', 'Dindon', 'Canard', 'Autre'].map(t => (
              <TouchableOpacity key={t} onPress={() => setForm({ ...form, type_volaille: t })} style={[styles.chip, form.type_volaille === t && styles.chipActif]}>
                <Text style={[styles.chipTexte, form.type_volaille === t && styles.chipTexteActif]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Objectif de sujets (estimation) *</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={form.objectif_sujets} onChangeText={v => setForm({ ...form, objectif_sujets: v })} placeholder="Ex: 1000" />

          <Text style={styles.label}>Objectif de collecte (F)</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={form.objectif_collecte} onChangeText={v => setForm({ ...form, objectif_collecte: v })} placeholder="Ex: 5000000" />
          <Text style={styles.infoTexte}>Les réservations des investisseurs se bloqueront une fois cet objectif atteint.</Text>

          <Text style={styles.label}>Date de lancement prévue (AAAA-MM-JJ)</Text>
          <TextInput style={styles.champ} value={form.date_lancement_prevue} onChangeText={v => setForm({ ...form, date_lancement_prevue: v })} placeholder="2027-03-01" />

          <Text style={styles.label}>Description (visible par les investisseurs)</Text>
          <TextInput style={[styles.champ, { height: 90 }]} multiline value={form.description} onChangeText={v => setForm({ ...form, description: v })}
            placeholder="De quoi donner envie d'investir : contexte, opportunité, rendement visé..." />

          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}

          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création...' : 'Créer le projet à venir'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 12, color: '#6E6E73', marginTop: 12, marginBottom: 4 },
  champ: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1D1D1F' },
  chip: { backgroundColor: '#F5F5F7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 12, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  infoTexte: { fontSize: 11, color: '#6E6E73', marginTop: 6 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginTop: 12 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default NouveauProjetAVenirScreen;
