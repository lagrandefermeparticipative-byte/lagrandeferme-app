import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

// Vue en lecture seule accordée par le gestionnaire — chiffres consolidés
// uniquement, jamais de détail nominatif investisseur, seulement sur les
// projets explicitement autorisés.
const ApercuFermeScreen = ({ token, onOuvrirProjet }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [agrege, setAgrege] = useState(null);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/apercu-ferme/agrege', { headers }),
      api.get('/apercu-ferme/projets', { headers }),
    ]).then(([agRes, projRes]) => {
      setAgrege(agRes.data);
      setProjets(projRes.data);
    }).catch(error => setErreur(error.response?.data?.message || "Impossible de charger l'aperçu ferme."))
      .finally(() => setChargement(false));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Aperçu ferme" sousTitre="Lecture seule · Chiffres consolidés" sansRetour />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : erreur ? (
        <View style={styles.conteneur}><Text style={styles.erreur}>{erreur}</Text></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Sur {agrege.nb_projets} projet{agrege.nb_projets > 1 ? 's' : ''} autorisé{agrege.nb_projets > 1 ? 's' : ''}</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(agrege.caisse_totale)}</Text>
            <Text style={styles.carteNoireSous}>en caisse cumulée</Text>
          </View>

          <View style={styles.carte}>
            <Text style={styles.label}>EFFECTIFS</Text>
            <View style={styles.grille3}>
              <View style={styles.statBleue}><Text style={styles.statBleueTexte}>{agrege.vivants}</Text><Text style={styles.statBleueLabel}>Vivants</Text></View>
              <View style={styles.statRouge}><Text style={styles.statRougeTexte}>{agrege.morts}</Text><Text style={styles.statRougeLabel}>Morts</Text></View>
              <View style={styles.statVerte}><Text style={styles.statVerteTexte}>{agrege.taux_survie != null ? agrege.taux_survie + '%' : '—'}</Text><Text style={styles.statVerteLabel}>Survie</Text></View>
            </View>
          </View>

          <View style={styles.carte}>
            <Text style={styles.label}>FINANCES CONSOLIDÉES</Text>
            <View style={styles.ligneEntre}><Text style={styles.detailLabel}>Revenus (ventes)</Text><Text style={styles.detailValeur}>{formatMontant(agrege.revenus_ventes)}</Text></View>
            <View style={styles.ligneEntre}><Text style={styles.detailLabel}>Dépenses</Text><Text style={styles.detailValeur}>{formatMontant(agrege.depenses_totales)}</Text></View>
            <View style={styles.ligneEntre}><Text style={styles.detailLabel}>Caisse cumulée</Text><Text style={styles.detailValeur}>{formatMontant(agrege.caisse_totale)}</Text></View>
          </View>

          <View style={styles.carte}>
            <Text style={styles.label}>COMMERCE</Text>
            <View style={styles.grille2}>
              <View style={styles.mini}><Text style={styles.miniLabel}>Encaissé</Text><Text style={styles.miniValeur}>{formatMontant(agrege.ventes_encaissees)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>En attente</Text><Text style={styles.miniValeur}>{formatMontant(agrege.ventes_en_attente)}</Text></View>
            </View>
          </View>

          <Text style={[styles.label, { marginTop: 8 }]}>PROJETS AUTORISÉS</Text>
          {projets.length === 0 ? (
            <View style={styles.videCarte}><Text style={styles.vide}>Aucun projet ne t'a encore été rendu visible.</Text></View>
          ) : projets.map(p => (
            <TouchableOpacity key={p.id} style={styles.carteProjet} onPress={() => onOuvrirProjet(p.uuid_id || p.id)}>
              <Text style={styles.carteTitre}>{p.nom}</Text>
              <Text style={styles.carteSousTexte}>{p.type_volaille} · {p.statut}</Text>
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
  erreur: { color: '#DC2626', fontSize: 13 },
  label: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 10 },
  carteNoire: { backgroundColor: '#1D1D1F', borderRadius: 20, padding: 20, marginBottom: 14 },
  carteNoireLabel: { color: '#8E8E93', fontSize: 12 },
  carteNoireMontant: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 4 },
  carteNoireSous: { color: '#8E8E93', fontSize: 11, marginTop: 4 },
  carte: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  grille3: { flexDirection: 'row', gap: 6 },
  statBleue: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, alignItems: 'center' },
  statBleueTexte: { color: '#1D4ED8', fontSize: 14, fontWeight: '700' },
  statBleueLabel: { color: '#3B82F6', fontSize: 10 },
  statRouge: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, alignItems: 'center' },
  statRougeTexte: { color: '#B91C1C', fontSize: 14, fontWeight: '700' },
  statRougeLabel: { color: '#EF4444', fontSize: 10 },
  statVerte: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8, alignItems: 'center' },
  statVerteTexte: { color: '#047857', fontSize: 14, fontWeight: '700' },
  statVerteLabel: { color: '#10B981', fontSize: 10 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 13, color: '#6E6E73' },
  detailValeur: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  grille2: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 8, padding: 8 },
  miniLabel: { fontSize: 11, color: '#6E6E73' },
  miniValeur: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginTop: 2 },
  videCarte: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E5EA', padding: 24, alignItems: 'center' },
  vide: { color: '#6E6E73', fontSize: 13 },
  carteProjet: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
});

export default ApercuFermeScreen;
