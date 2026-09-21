import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

// Détail d'un projet en lecture seule — jamais de liste nominative
// d'investisseurs, aucun bouton d'action nulle part ici.
const ApercuFermeProjetScreen = ({ token, projetId, onRetour }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [donnees, setDonnees] = useState(null);
  const [onglet, setOnglet] = useState('elevage');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    api.get(`/apercu-ferme/projets/${projetId}`, { headers })
      .then(res => setDonnees(res.data))
      .catch(error => setErreur(error.response?.data?.message || 'Impossible de charger ce projet.'))
      .finally(() => setChargement(false));
  }, [projetId]);

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre="Aperçu ferme" action={<TouchableOpacity onPress={onRetour}><Text style={styles.lienRetour}>← Retour</Text></TouchableOpacity>} />
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      </View>
    );
  }

  if (erreur || !donnees) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre="Aperçu ferme" action={<TouchableOpacity onPress={onRetour}><Text style={styles.lienRetour}>← Retour</Text></TouchableOpacity>} />
        <View style={styles.conteneur}><Text style={styles.erreur}>{erreur || 'Projet introuvable.'}</Text></View>
      </View>
    );
  }

  const { projet, lots, depenses, ventes, cycles_reproduction } = donnees;
  const totalVivants = lots.reduce((s, l) => s + parseInt(l.vivants || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
  const totalRecettes = ventes.reduce((s, v) => s + parseFloat(v.recette_totale || 0), 0);
  const totalEncaisse = ventes.reduce((s, v) => s + parseFloat(v.montant_paye || 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre={projet.nom} sousTitre="Lecture seule" action={<TouchableOpacity onPress={onRetour}><Text style={styles.lienRetour}>← Retour</Text></TouchableOpacity>} />
      <View style={styles.ongletsLigne}>
        {['elevage', 'reproduction', 'depenses', 'ventes'].map(t => (
          <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
            <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>
              {t === 'elevage' ? 'Élevage' : t === 'reproduction' ? 'Repro.' : t === 'depenses' ? 'Dépenses' : 'Ventes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView style={styles.conteneur}>
        {onglet === 'elevage' && (
          <View>
            <View style={styles.carteNoire}><Text style={styles.carteNoireLabel}>Effectif vivant</Text><Text style={styles.carteNoireMontant}>{totalVivants}</Text></View>
            {lots.length === 0 ? <Text style={styles.vide}>Aucun lot enregistré.</Text> : lots.map(l => (
              <View key={l.id} style={styles.carte}>
                <Text style={styles.carteTitre}>{l.nom}</Text>
                <Text style={styles.carteSousTexte}>{l.vivants} vivants · {l.total_morts} morts · {l.total_vendus} vendus</Text>
              </View>
            ))}
          </View>
        )}
        {onglet === 'reproduction' && (
          cycles_reproduction.length === 0 ? <Text style={styles.vide}>Aucun cycle de reproduction.</Text> : cycles_reproduction.map(c => (
            <View key={c.id} style={styles.carte}>
              <Text style={styles.carteTitre}>{c.generation}{c.nom ? ' · ' + c.nom : ''}</Text>
              <Text style={styles.carteSousTexte}>{c.oeufs_collectes || 0} œufs collectés · {c.poussins_viables || 0} poussins viables{c.taux_eclosion ? ` · ${c.taux_eclosion}% éclosion` : ''}</Text>
            </View>
          ))
        )}
        {onglet === 'depenses' && (
          <View>
            <View style={styles.carteNoire}><Text style={styles.carteNoireLabel}>Total dépenses</Text><Text style={styles.carteNoireMontant}>{formatMontant(totalDepenses)}</Text></View>
            {depenses.length === 0 ? <Text style={styles.vide}>Aucune dépense enregistrée.</Text> : depenses.map(d => (
              <View key={d.id} style={[styles.carte, styles.ligneEntre]}>
                <View><Text style={styles.carteTitre}>{d.libelle}</Text><Text style={styles.carteSousTexte}>{d.categorie}</Text></View>
                <Text style={styles.carteTitre}>{formatMontant(d.montant_reel)}</Text>
              </View>
            ))}
          </View>
        )}
        {onglet === 'ventes' && (
          <View>
            <View style={styles.carteNoire}>
              <Text style={styles.carteNoireLabel}>Total recettes</Text>
              <Text style={styles.carteNoireMontant}>{formatMontant(totalRecettes)}</Text>
              <Text style={styles.carteNoireSous}>{formatMontant(totalEncaisse)} encaissé</Text>
            </View>
            {ventes.length === 0 ? <Text style={styles.vide}>Aucune vente enregistrée.</Text> : ventes.map(v => (
              <View key={v.id} style={[styles.carte, styles.ligneEntre]}>
                <View><Text style={styles.carteTitre}>{new Date(v.date_vente).toLocaleDateString('fr-FR')}</Text><Text style={styles.carteSousTexte}>{v.males_vendus} mâles · {v.femelles_vendues} femelles</Text></View>
                <Text style={styles.carteTitre}>{formatMontant(v.recette_totale)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  erreur: { color: '#DC2626', fontSize: 13 },
  lienRetour: { fontSize: 13, color: '#1D1D1F', fontWeight: '600' },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', paddingHorizontal: 16, marginTop: 8 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#1D1D1F' },
  ongletTexte: { fontSize: 12, color: '#6E6E73', fontWeight: '500' },
  ongletTexteActif: { color: '#1D1D1F' },
  carteNoire: { backgroundColor: '#1D1D1F', borderRadius: 20, padding: 20, marginTop: 12, marginBottom: 14 },
  carteNoireLabel: { color: '#8E8E93', fontSize: 12 },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 4 },
  carteNoireSous: { color: '#8E8E93', fontSize: 11, marginTop: 6 },
  carte: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
  vide: { color: '#6E6E73', fontSize: 13, textAlign: 'center', marginTop: 40 },
});

export default ApercuFermeProjetScreen;
