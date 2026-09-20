import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { useProjet } from '../context/ProjetContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const couleurSurvie = (taux) => {
  if (taux === null || taux === undefined) return { fond: '#F5F5F7', bordure: '#E5E5EA', accent: '#8E8E93' };
  if (taux >= 90) return { fond: '#fff', bordure: '#F5F5F7', accent: '#2D6A4F' };
  if (taux >= 70) return { fond: '#fff', bordure: '#F5F5F7', accent: '#B08D57' };
  return { fond: '#fff', bordure: '#F5F5F7', accent: '#B54708' };
};

const progressionTemporelle = (dateDebut, dateFin) => {
  if (!dateDebut || !dateFin) return null;
  const debut = new Date(dateDebut).getTime();
  const fin = new Date(dateFin).getTime();
  const maintenant = Date.now();
  if (fin <= debut) return null;
  const pct = ((maintenant - debut) / (fin - debut)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

// Écran dédié au technicien : liste directe de ses projets assignés, sans
// switch ni information d'investissement — un clic mène droit à la mise à
// jour du cheptel de ce projet.
const TechnicienProjetsScreen = ({ token, onChoisir, onRetour }) => {
  const { choisirProjet } = useProjet();
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api.get('/projets/moi/technicien', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProjets(res.data))
      .catch(() => setProjets([]))
      .finally(() => setChargement(false));
  }, [token]);

  const ouvrirProjet = (projet) => {
    choisirProjet(projet.uuid_id || projet.id);
    onChoisir();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Mes projets" sansRetour
        action={onRetour ? (
          <TouchableOpacity onPress={onRetour}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1D1D1F' }}>← Dashboard</Text>
          </TouchableOpacity>
        ) : null} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        {chargement ? (
          <Text style={styles.vide}>Chargement...</Text>
        ) : projets.length === 0 ? (
          <Text style={styles.vide}>Aucun projet ne t'est encore assigné.</Text>
        ) : (
          projets.map(p => {
            const couleurs = couleurSurvie(p.taux_survie_reel);
            const progression = progressionTemporelle(p.date_debut, p.date_fin);
            return (
              <TouchableOpacity key={p.id} style={styles.carteProjet} onPress={() => ouvrirProjet(p)}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{p.nom}</Text>
                  <View style={[styles.pastille, { backgroundColor: couleurs.accent + '1A' }]}>
                    <Text style={[styles.pastilleTexte, { color: couleurs.accent }]}>{p.statut_cloture === 'cloture' ? 'Clôturé' : 'Actif'}</Text>
                  </View>
                </View>
                <Text style={styles.carteSousTexte}>{p.type_volaille} · {p.objectif_sujets} sujets{p.taux_survie_reel != null ? ` · ${p.taux_survie_reel}% de survie` : ''}</Text>
                {progression !== null && (
                  <View style={styles.barreFond}>
                    <View style={[styles.barreRemplie, { width: `${progression}%`, backgroundColor: couleurs.accent }]} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16, justifyContent: 'center' },
  vide: { fontSize: 13, color: '#6E6E73', textAlign: 'center', marginTop: 40 },
  carteProjet: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
  pastille: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pastilleTexte: { fontSize: 10, fontWeight: '600' },
  barreFond: { height: 3, backgroundColor: '#F5F5F7', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  barreRemplie: { height: 3, borderRadius: 2 },
});

export default TechnicienProjetsScreen;
