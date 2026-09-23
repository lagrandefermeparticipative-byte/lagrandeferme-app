import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { useProjet } from '../context/ProjetContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const couleurSurvie = (taux) => {
  if (taux === null || taux === undefined) return { fond: '#F5F5F7', bordure: '#E5E5EA', texte: '#6E6E73', accent: '#8E8E93' };
  if (taux >= 90) return { fond: '#fff', bordure: '#F5F5F7', texte: '#6E6E73', accent: '#2D6A4F' };
  if (taux >= 70) return { fond: '#fff', bordure: '#F5F5F7', texte: '#6E6E73', accent: '#B08D57' };
  return { fond: '#fff', bordure: '#F5F5F7', texte: '#6E6E73', accent: '#B54708' };
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

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

const MesProjetsScreen = ({ onChoisir }) => {
  const { projets, chargement, choisirProjet } = useProjet();
  const { utilisateur, switchMode, token } = useAuth();
  const [lignesInvest, setLignesInvest] = useState(null);
  const [detailsOuverts, setDetailsOuverts] = useState(false);

  const estInvestisseur = utilisateur?.role === 'investisseur' || utilisateur?.role === 'tech_invest';

  useEffect(() => {
    if (estInvestisseur && projets.length > 1 && token) {
      api.get('/utilisateurs/mon-investissement', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => setLignesInvest(res.data))
        .catch(() => setLignesInvest(null));
    }
  }, [estInvestisseur, projets.length, token]);

  // "Investissement total" doit refléter l'argent réellement encaissé,
  // pas la mise promise/engagée.
  const ensemble = lignesInvest ? {
    totalEncaisse: lignesInvest.reduce((s, l) => s + parseFloat(l.montant_paye || 0), 0),
    totalEngage: lignesInvest.reduce((s, l) => s + parseFloat(l.mise || 0), 0),
    totalGain: lignesInvest.reduce((s, l) => s + (l.montant_estime != null ? parseFloat(l.montant_estime) : parseFloat(l.mise || 0)), 0),
    nbProjets: lignesInvest.length,
  } : null;

  const ouvrirProjet = (projet) => {
    choisirProjet(projet.uuid_id || projet.id);
    const estTechnicien = utilisateur.role === 'technicien' || utilisateur.role === 'tech_invest';
    switchMode(estTechnicien ? 'technicien' : 'investisseur');
    onChoisir();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Mes projets" sansRetour masquerSwitch />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        {ensemble && (
          <View style={styles.carteEnsemble}>
            <Text style={styles.carteEnsembleLabel}>VOTRE INVESTISSEMENT TOTAL</Text>
            <Text style={styles.carteEnsembleMontant}>{formatMontant(ensemble.totalEncaisse)}</Text>
            {ensemble.totalEncaisse < ensemble.totalEngage && (
              <Text style={styles.carteEnsembleSousTexte}>{formatMontant(ensemble.totalEngage)} engagés au total</Text>
            )}
            <View style={styles.ligneDivisoire} />
            <View style={styles.statsEtalees}>
              <View>
                <Text style={styles.statValeurGrande}>{formatMontant(ensemble.totalGain)}</Text>
                <Text style={styles.statLabel}>Estimé à date</Text>
              </View>
              <View style={{ marginLeft: -90 }}>
                <Text style={styles.statValeurGrande}>{ensemble.nbProjets}</Text>
                <Text style={styles.statLabel}>Projets</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setDetailsOuverts(prev => !prev)}>
              <Text style={styles.lienDetails}>{detailsOuverts ? 'Masquer le détail' : 'Voir le détail par projet'}</Text>
            </TouchableOpacity>
            {detailsOuverts && (
              <View style={styles.detailsBloc}>
                {lignesInvest.map(l => (
                  <View key={l.id} style={styles.ligneDetailProjet}>
                    <Text style={styles.detailProjetNom}>{l.projet_nom}</Text>
                    <View style={styles.ligneEntre}>
                      <Text style={styles.detailLabel}>Encaissé</Text>
                      <Text style={styles.detailValeur}>
                        {formatMontant(l.montant_paye)}{parseFloat(l.montant_paye || 0) < parseFloat(l.mise || 0) ? ` sur ${formatMontant(l.mise)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.ligneEntre}>
                      <Text style={styles.detailLabel}>Estimé à date</Text>
                      <Text style={styles.detailValeur}>{formatMontant(l.montant_estime != null ? l.montant_estime : l.mise)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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

  carteEnsemble: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteEnsembleLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  carteEnsembleMontant: { color: '#1D1D1F', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  carteEnsembleSousTexte: { color: '#6E6E73', fontSize: 12, marginTop: 6 },
  ligneDivisoire: { height: 1.5, backgroundColor: '#E5E5E7', marginTop: 18 },
  statsEtalees: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  statValeurGrande: { color: '#1D1D1F', fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginTop: 6, textAlign: 'left' },
  statLabel: { color: '#1D1D1F', fontSize: 13, fontWeight: '700', textAlign: 'left' },
  lienDetails: { color: '#6E6E73', fontSize: 12, marginTop: 14, textDecorationLine: 'underline' },
  detailsBloc: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F5F5F7', gap: 12 },
  ligneDetailProjet: { gap: 4 },
  detailProjetNom: { color: '#1D1D1F', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  detailLabel: { color: '#6E6E73', fontSize: 11 },
  detailValeur: { color: '#1D1D1F', fontSize: 11, fontWeight: '600' },

  carteProjet: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
  pastille: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pastilleTexte: { fontSize: 10, fontWeight: '600' },
  barreFond: { height: 3, backgroundColor: '#F5F5F7', borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  barreRemplie: { height: 3, borderRadius: 2 },
});

export default MesProjetsScreen;
