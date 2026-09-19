import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const getIcone = (module) => ({
  Projets: '📋', Finances: '💰', Commerce: '🛒', Rapports: '📝',
  Auth: '👤', Élevage: '🐦', Reproduction: '🥚', Caisses: '🏦',
}[module] || '•');

const formatDate = (d) => {
  const date = new Date(d);
  const maintenant = new Date();
  const diffJours = Math.floor((maintenant - date) / (1000 * 60 * 60 * 24));
  if (diffJours === 0) return "Aujourd'hui · " + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffJours === 1) return "Hier · " + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('fr-FR') + ' · ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const JournalScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [activites, setActivites] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [filtreModule, setFiltreModule] = useState('Tous');

  useEffect(() => {
    api.get('/journal?limite=150', { headers }).then(res => setActivites(res.data))
      .catch(error => console.log('Erreur journal:', error.message))
      .finally(() => setChargement(false));
  }, []);

  const modules = ['Tous', ...new Set(activites.map(a => a.module || 'Autre'))];
  const activitesFiltrees = filtreModule === 'Tous' ? activites : activites.filter(a => a.module === filtreModule);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Journal d'activité" sousTitre="Tout ce qui se passe sur la ferme" sansRetour />
      <ScrollView style={styles.conteneur}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 10 }}>
          {modules.map(m => (
            <TouchableOpacity key={m} onPress={() => setFiltreModule(m)} style={[styles.chip, filtreModule === m && styles.chipActif]}>
              <Text style={[styles.chipTexte, filtreModule === m && styles.chipTexteActif]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.compteur}>{activitesFiltrees.length} activité{activitesFiltrees.length > 1 ? 's' : ''}</Text>
        {chargement ? (
          <ActivityIndicator style={{ marginTop: 20 }} color="#1D1D1F" />
        ) : activitesFiltrees.length === 0 ? (
          <Text style={styles.vide}>Aucune activité enregistrée</Text>
        ) : activitesFiltrees.map(a => (
          <View key={a.id} style={styles.carte}>
            <Text style={styles.icone}>{getIcone(a.module)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.action}>{a.action}</Text>
              {a.details && <Text style={styles.details}>{a.details}</Text>}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <Text style={styles.date}>{formatDate(a.created_at)}</Text>
                {a.utilisateur_nom && <Text style={styles.date}>· {a.utilisateur_nom}</Text>}
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', marginRight: 6 },
  chipActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73', fontWeight: '500' },
  chipTexteActif: { color: '#fff' },
  compteur: { fontSize: 11, color: '#6E6E73', marginBottom: 8 },
  vide: { textAlign: 'center', color: '#6E6E73', fontSize: 13, paddingVertical: 30 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 8, flexDirection: 'row', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  icone: { fontSize: 18, marginTop: 2 },
  action: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  details: { fontSize: 11, color: '#6E6E73', marginTop: 2 },
  date: { fontSize: 10, color: '#6E6E73' },
});

export default JournalScreen;