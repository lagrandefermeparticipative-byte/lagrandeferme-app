import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { useProjet } from '../context/ProjetContext';
import { useAuth } from '../context/AuthContext';

const couleurSurvie = (taux) => {
  if (taux === null || taux === undefined) return { fond: '#F9FAFB', bordure: '#E5E7EB', texte: '#6B7280' };
  if (taux >= 90) return { fond: '#ECFDF5', bordure: '#A7F3D0', texte: '#047857' };
  if (taux >= 70) return { fond: '#FFFBEB', bordure: '#FDE68A', texte: '#92400E' };
  return { fond: '#FEF2F2', bordure: '#FECACA', texte: '#B91C1C' };
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

const MesProjetsScreen = ({ onChoisir }) => {
  const { projets, chargement, choisirProjet } = useProjet();
  const { utilisateur, switchMode } = useAuth();

  const ouvrirProjet = (projet) => {
    choisirProjet(projet.uuid_id || projet.id);
    const estTechnicien = utilisateur.role === 'technicien' || utilisateur.role === 'tech_invest';
    switchMode(estTechnicien ? 'technicien' : 'investisseur');
    onChoisir();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Mes projets" sansRetour masquerSwitch />
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
              <TouchableOpacity key={p.id} style={[styles.carte, { backgroundColor: couleurs.fond, borderColor: couleurs.bordure }]} onPress={() => ouvrirProjet(p)}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{p.nom}</Text>
                  <View style={[styles.badge, { backgroundColor: p.statut_cloture === 'cloture' ? '#F3F4F6' : '#ECFDF5' }]}>
                    <Text style={[styles.badgeTexte, { color: p.statut_cloture === 'cloture' ? '#4B5563' : '#047857' }]}>{p.statut_cloture === 'cloture' ? 'Clôturé' : 'Actif'}</Text>
                  </View>
                </View>
                <Text style={[styles.carteSousTexte, { color: couleurs.texte }]}>{p.type_volaille} · {p.objectif_sujets} sujets{p.taux_survie_reel != null ? ` · ${p.taux_survie_reel}% de survie` : ''}</Text>
                {progression !== null && (
                  <View style={styles.barreProgressionConteneur}>
                    <View style={[styles.barreProgressionRemplie, { width: `${progression}%` }]} />
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
  vide: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '500', color: '#111827' },
  carteSousTexte: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  barreProgressionConteneur: { height: 4, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  barreProgressionRemplie: { height: 4, backgroundColor: '#111827', borderRadius: 2 },
});

export default MesProjetsScreen;
