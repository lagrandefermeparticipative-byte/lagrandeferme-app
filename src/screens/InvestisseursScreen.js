import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import api from '../services/api';

const InvestisseursScreen = ({ token }) => {
  const [investisseurs, setInvestisseurs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);

  const charger = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.get('/investisseurs', { headers });
      setInvestisseurs(res.data);
    } catch (error) {
      console.log('Erreur investisseurs:', error.message);
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const onRefresh = () => {
    setRafraichissement(true);
    charger();
  };

  const totalMises = investisseurs.reduce((s, i) => s + parseFloat(i.mise || 0), 0);

  if (chargement) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator size="large" color="#80B918" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.conteneur}
      refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={onRefresh} />}
    >
      <Text style={styles.titre}>Investisseurs</Text>
      <View style={styles.resumeCarte}>
        <Text style={styles.resumeChiffre}>{Number(totalMises).toLocaleString('fr-FR')} F</Text>
        <Text style={styles.resumeLabel}>Total investi · {investisseurs.length} investisseur(s)</Text>
      </View>

      {investisseurs.length === 0 && <Text style={styles.vide}>Aucun investisseur pour le moment.</Text>}
      {investisseurs.map((inv, i) => (
        <View style={styles.carte} key={inv.id || i}>
          <Text style={styles.nom}>{inv.nom || inv.utilisateur_nom}</Text>
          <Text style={styles.mise}>{Number(inv.mise).toLocaleString('fr-FR')} F</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F7F7F5', padding: 20, paddingTop: 60 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F7F5' },
  titre: { fontSize: 24, fontWeight: '700', color: '#1E2221', marginBottom: 16 },
  resumeCarte: { backgroundColor: '#23292A', borderRadius: 14, padding: 20, marginBottom: 20 },
  resumeChiffre: { fontSize: 24, fontWeight: '700', color: '#F6D92A' },
  resumeLabel: { fontSize: 12, color: '#9AA29B', marginTop: 4 },
  vide: { color: '#888', fontStyle: 'italic' },
  carte: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontSize: 15, fontWeight: '600', color: '#1E2221' },
  mise: { fontSize: 15, fontWeight: '700', color: '#80B918' },
});

export default InvestisseursScreen;