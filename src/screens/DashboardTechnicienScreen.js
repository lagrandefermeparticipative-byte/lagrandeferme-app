import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';
import { useProjet } from '../context/ProjetContext';

// Vue d'ensemble pour un technicien qui supervise plusieurs projets : les
// données agrégées d'abord, la liste détaillée "Mes projets" ensuite.
const DashboardTechnicienScreen = ({ token, onVoirProjets, onOuvrirProjet, onEnregistrerVente }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const { choisirProjet } = useProjet();
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get('/projets/moi/technicien/dashboard', { headers })
      .then(res => setDonnees(res.data))
      .catch(() => setDonnees(null))
      .finally(() => setChargement(false));
  }, [token]);

  const ouvrirProjet = (projetId) => {
    choisirProjet(projetId);
    onOuvrirProjet();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Tableau de bord" sousTitre="Technicien" sansRetour />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        {chargement ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#1D1D1F" />
        ) : !donnees || donnees.nb_projets === 0 ? (
          <View style={styles.videCarte}>
            <Text style={styles.vide}>Aucun projet ne t'est encore assigné.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.grille2}>
              <View style={styles.carteStat}>
                <Text style={styles.statLabel}>EFFECTIF VIVANT</Text>
                <Text style={styles.statChiffre}>{donnees.effectif_vivant_total}</Text>
                <Text style={styles.statSousTexte}>sur {donnees.nb_projets} projet{donnees.nb_projets > 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.carteStat}>
                <Text style={styles.statLabel}>SURVIE MOYENNE</Text>
                <Text style={styles.statChiffre}>{donnees.taux_survie_moyen !== null ? `${donnees.taux_survie_moyen}%` : '—'}</Text>
              </View>
            </View>

            {donnees.rapports_en_attente > 0 && (
              <View style={[styles.carte, styles.ligneEntre]}>
                <Text style={styles.carteTitre}>Rapports à soumettre cette semaine</Text>
                <View style={styles.badgeAmbre}>
                  <Text style={styles.badgeAmbreTexte}>{donnees.rapports_en_attente}</Text>
                </View>
              </View>
            )}

            {donnees.alertes.length > 0 && (
              <View style={styles.carte}>
                <Text style={[styles.carteTitre, { marginBottom: 8 }]}>Projets à surveiller</Text>
                {donnees.alertes.map(a => (
                  <TouchableOpacity key={a.projet_id} onPress={() => ouvrirProjet(a.projet_id)} style={styles.ligneAlerte}>
                    <Text style={styles.alerteNom}>{a.nom}</Text>
                    <Text style={[styles.alerteValeur, { color: a.urgence === 'urgent' ? '#C0392B' : '#B08D57' }]}>{a.taux_survie_reel}% de survie</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.boutonPrincipal} onPress={onVoirProjets}>
              <Text style={styles.boutonPrincipalTexte}>Voir mes projets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={onEnregistrerVente}>
              <Text style={styles.boutonSecondaireTexte}>Enregistrer une vente</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { padding: 16 },
  vide: { fontSize: 13, color: '#6E6E73', textAlign: 'center' },
  videCarte: { backgroundColor: '#fff', borderRadius: 20, padding: 30, marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  grille2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  carteStat: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statLabel: { fontSize: 10, color: '#6E6E73', fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  statChiffre: { fontSize: 24, fontWeight: '700', color: '#1D1D1F' },
  statSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 4 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  badgeAmbre: { backgroundColor: 'rgba(176,141,87,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeAmbreTexte: { fontSize: 12, fontWeight: '700', color: '#B08D57' },
  ligneAlerte: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  alerteNom: { fontSize: 12, color: '#1D1D1F' },
  alerteValeur: { fontSize: 12, fontWeight: '600' },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#1D1D1F', fontSize: 14, fontWeight: '600' },
});

export default DashboardTechnicienScreen;
