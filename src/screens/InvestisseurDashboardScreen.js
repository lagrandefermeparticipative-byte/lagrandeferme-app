import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import { useProjet } from '../context/ProjetContext';
import api from '../services/api';
import { VueRapportInvestisseur, VueMessages } from './InvestissementScreen';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

// Écran dédié à l'investisseur : sa carte d'investissement total en premier,
// puis une simple liste de ses projets investis. Rapports et Messages sont
// désormais des onglets ici, au niveau global — ils ne concernent pas un
// seul projet à la fois, contrairement à l'investissement lui-même.
const InvestisseurDashboardScreen = ({ token, onChoisir }) => {
  const { choisirProjet } = useProjet();
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('investissement');
  const [rapports, setRapports] = useState([]);
  const [rapportOuvertId, setRapportOuvertId] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    api.get('/projets/moi/investisseur', { headers })
      .then(res => setProjets(res.data))
      .catch(() => setProjets([]))
      .finally(() => setChargement(false));
  }, [token]);

  useEffect(() => {
    // Les rapports de tous les projets investis, réunis en une seule liste —
    // un investisseur avec plusieurs projets n'a pas à ouvrir chacun pour
    // suivre ses rapports.
    if (projets.length === 0) return;
    Promise.all(projets.map(p => api.get(`/rapports?projet_id=${p.id}`, { headers }).catch(() => ({ data: [] }))))
      .then(resultats => {
        const tous = resultats.flatMap(r => r.data).filter(r => r.statut === 'envoye');
        tous.sort((a, b) => new Date(b.date_rapport) - new Date(a.date_rapport));
        setRapports(tous);
      });
  }, [projets]);

  const ensemble = projets.length > 0 ? {
    totalMise: projets.reduce((s, p) => s + parseFloat(p.mise || 0), 0),
    totalGain: projets.reduce((s, p) => s + parseFloat(p.mise || 0) * (1 + parseFloat(p.rendement_promis || 0) / 100), 0),
  } : null;

  const ouvrirProjet = (projet) => {
    choisirProjet(projet.uuid_id || projet.id);
    onChoisir();
  };

  if (rapportOuvertId) {
    return <VueRapportInvestisseur token={token} rapportId={rapportOuvertId} onBack={() => setRapportOuvertId(null)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Mes investissements" sansRetour />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        <View style={styles.ongletsLigne}>
          {['investissement', 'rapports', 'messages'].map(t => (
            <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
              <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>
                {t === 'investissement' ? 'Mon invest.' : t === 'rapports' ? 'Rapports' : 'Messages'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {onglet === 'investissement' && (
          <View>
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
          </View>
        )}

        {onglet === 'rapports' && (
          rapports.length === 0 ? <Text style={styles.vide}>Aucun rapport diffusé pour l'instant</Text> : rapports.map(r => (
            <TouchableOpacity key={r.id} style={styles.carteProjet} onPress={() => setRapportOuvertId(r.uuid_id || r.id)}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>Rapport S{r.semaine}</Text>
                <View style={[styles.badge, { backgroundColor: r.lu_par_moi ? '#F3F4F6' : '#ECFDF5' }]}>
                  <Text style={[styles.badgeTexte, { color: r.lu_par_moi ? '#6B7280' : '#047857' }]}>{r.lu_par_moi ? 'Lu ✓' : 'Nouveau'}</Text>
                </View>
              </View>
              <Text style={styles.carteSousTexte}>{new Date(r.date_rapport).toLocaleDateString('fr-FR')} · Effectif {r.effectif_debut || '—'} · {r.morts_semaine || 0} morts</Text>
            </TouchableOpacity>
          ))
        )}

        {onglet === 'messages' && <VueMessages token={token} />}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  vide: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 14 },
  ongletBouton: { paddingVertical: 10, marginRight: 20 },
  ongletBoutonActif: { borderBottomWidth: 2, borderBottomColor: '#111827' },
  ongletTexte: { fontSize: 13, color: '#9CA3AF' },
  ongletTexteActif: { color: '#111827', fontWeight: '600' },
  carteEnsemble: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteEnsembleLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  carteEnsembleMontant: { color: '#1D1D1F', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  carteEnsembleSousTexte: { color: '#6E6E73', fontSize: 12, marginTop: 6 },
  carteProjet: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
});

export default InvestisseurDashboardScreen;
