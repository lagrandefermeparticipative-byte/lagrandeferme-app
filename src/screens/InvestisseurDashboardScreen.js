import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { useProjet } from '../context/ProjetContext';
import api from '../services/api';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

// Écran dédié à l'investisseur : sa carte d'investissement total en premier,
// puis une simple liste de ses projets investis — un clic mène directement
// à l'écran d'investissement de ce projet.
const InvestisseurDashboardScreen = ({ token, onChoisir }) => {
  const { choisirProjet } = useProjet();
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get('/projets/moi/investisseur', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProjets(res.data))
      .catch(() => setProjets([]))
      .finally(() => setChargement(false));
  }, [token]);

  const ensemble = projets.length > 0 ? {
    totalMise: projets.reduce((s, p) => s + parseFloat(p.mise || 0), 0),
    totalGain: projets.reduce((s, p) => s + parseFloat(p.mise || 0) * (1 + parseFloat(p.rendement_promis || 0) / 100), 0),
  } : null;

  const ouvrirProjet = (projet) => {
    choisirProjet(projet.uuid_id || projet.id);
    onChoisir();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Mes investissements" sansRetour />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        {ensemble && (
          <View style={styles.carteEnsemble}>
            <Text style={styles.carteEnsembleLabel}>VOTRE INVESTISSEMENT TOTAL</Text>
            <Text style={styles.carteEnsembleMontant}>{formatMontant(ensemble.totalMise)}</Text>
            <Text style={styles.carteEnsembleSousTexte}>{projets.length} projet{projets.length > 1 ? 's' : ''} · {formatMontant(ensemble.totalGain)} attendus au total</Text>
          </View>
        )}
        {chargement ? (
          <Text style={styles.vide}>Chargement...</Text>
        ) : projets.length === 0 ? (
          <Text style={styles.vide}>Aucun investissement pour l'instant.</Text>
        ) : (
          projets.map(p => (
            <TouchableOpacity key={p.id} style={styles.carteProjet} onPress={() => ouvrirProjet(p)}>
              <Text style={styles.carteTitre}>{p.projet_nom || p.nom}</Text>
              <Text style={styles.carteSousTexte}>Investi : {formatMontant(p.mise)}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16, justifyContent: 'center' },
  vide: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  carteEnsemble: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteEnsembleLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  carteEnsembleMontant: { color: '#1D1D1F', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  carteEnsembleSousTexte: { color: '#6E6E73', fontSize: 12, marginTop: 6 },
  carteProjet: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
});

export default InvestisseurDashboardScreen;
