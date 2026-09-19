import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity, Alert } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';
import { useCache } from '../context/CacheContext';

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const FermeScreen = ({ token }) => {
  const { getCache, setCache } = useCache();
  const [depenses, setDepenses] = useState([]);
  const [sujetsReproduction, setSujetsReproduction] = useState([]);
  const [chargement, setChargement] = useState(getCache("ferme_depenses") ? false : true);
  const [anneeOuverte, setAnneeOuverte] = useState(null);
  const [sujetVenteId, setSujetVenteId] = useState(null);
  const [montantVente, setMontantVente] = useState('');
  const [noteVente, setNoteVente] = useState('');
  const [envoiVente, setEnvoiVente] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const charger = async (forcer = false) => {
    const cleCache = "ferme_depenses";
    if (!forcer) {
      const cache = getCache(cleCache);
      if (cache) {
        setDepenses(cache.depenses);
        setSujetsReproduction(cache.sujets);
        setChargement(false);
        return;
      }
    }
    try {
      const [depensesRes, sujetsRes] = await Promise.all([
        api.get("/depenses?projet_id=1", { headers }),
        api.get("/clotures/sujets-reproduction", { headers }),
      ]);
      const depensesFerme = depensesRes.data.filter(d => d.type_depense === "ferme");
      setDepenses(depensesFerme);
      setSujetsReproduction(sujetsRes.data);
      setCache(cleCache, { depenses: depensesFerme, sujets: sujetsRes.data });
    } catch (error) {
      console.log("Erreur ferme:", error.message);
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => { charger(); }, []);


  const confirmerVente = async () => {
    if (!montantVente || parseFloat(montantVente) <= 0) return;
    setEnvoiVente(true);
    try {
      await api.put(`/clotures/sujets-reproduction/${sujetVenteId}/vendre`, {
        montant_vente: parseFloat(montantVente),
        note: noteVente,
      }, { headers });
      setSujetVenteId(null);
      setMontantVente('');
      setNoteVente('');
      charger();
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer la vente.");
    } finally {
      setEnvoiVente(false);
    }
  };

  const reformerSujet = (id) => {
    Alert.alert('Réformer', 'Réformer ce groupe de reproducteurs ? Ils sortiront définitivement du service, sans vente.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Réformer', onPress: async () => {
        try { await api.put(`/clotures/sujets-reproduction/${id}/reformer`, {}, { headers }); charger(true); }
        catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Impossible de réformer.'); }
      }},
    ]);
  };

  const declarerMortSujet = (id) => {
    Alert.alert('Déclarer mort', 'Déclarer ce groupe de reproducteurs mort ? Action irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déclarer mort', style: 'destructive', onPress: async () => {
        try { await api.put(`/clotures/sujets-reproduction/${id}/mort`, {}, { headers }); charger(true); }
        catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Impossible de déclarer.'); }
      }},
    ]);
  };

  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
  const totalPrevu = depenses.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
  const enCours = depenses.filter(d => d.avancement_pourcentage > 0 && d.avancement_pourcentage < 100);
  const enAttentePaiement = depenses.filter(d => d.statut === 'engagee' || d.statut === 'planifiee');
  const dernieresDepenses = [...depenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  const construireHistorique = () => {
    const parAnnee = {};
    depenses.forEach(d => {
      const dateRef = d.date_depense || d.created_at;
      if (!dateRef) return;
      const date = new Date(dateRef);
      const annee = date.getFullYear();
      const mois = date.getMonth();
      const montant = parseFloat(d.montant_reel || d.montant_prevu || 0);
      if (!parAnnee[annee]) parAnnee[annee] = { total: 0, mois: {} };
      parAnnee[annee].total += montant;
      if (!parAnnee[annee].mois[mois]) parAnnee[annee].mois[mois] = { total: 0, depenses: [] };
      parAnnee[annee].mois[mois].total += montant;
      parAnnee[annee].mois[mois].depenses.push(d);
    });
    return Object.entries(parAnnee).sort((a, b) => b[0] - a[0]);
  };

  const historique = construireHistorique();

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Header titre="Ferme" sousTitre="Vue d'ensemble · Associés" sansRetour />
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Ferme" sousTitre="Vue d'ensemble · Associés" sansRetour />
      <ScrollView style={styles.conteneur}>

        <View style={styles.carteNoire}>
          <Text style={styles.carteNoireLabel}>Total dépensé (ferme)</Text>
          <Text style={styles.carteNoireMontant}>{formatMontant(totalReel)}</Text>
          <Text style={styles.carteNoireSousLabel}>Prévu : {formatMontant(totalPrevu)}</Text>
        </View>

        <View style={styles.grille2x2}>
          <View style={styles.mini}>
            <Text style={styles.miniLabel}>Chantiers en cours</Text>
            <Text style={styles.miniValeur}>{enCours.length}</Text>
          </View>
          <TouchableOpacity style={styles.mini}>
            <Text style={styles.miniLabel}>🧰 Équipements</Text>
            <Text style={styles.miniValeur}>Voir l'inventaire →</Text>
          </TouchableOpacity>
          <View style={styles.mini}>
            <Text style={styles.miniLabel}>En attente de paiement</Text>
            <Text style={styles.miniValeur}>{enAttentePaiement.length}</Text>
          </View>
          <TouchableOpacity style={styles.mini}>
            <Text style={styles.miniLabel}>📖 Journal</Text>
            <Text style={styles.miniValeur}>Toute l'activité →</Text>
          </TouchableOpacity>
        </View>

        {sujetsReproduction.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Sujets retenus pour la reproduction</Text>
            {sujetsReproduction.map(s => (
              <View style={styles.carte} key={s.id}>
                <View style={styles.ligneEntre}>
                  <View>
                    <Text style={styles.carteTitre}>{s.nombre_sujets} sujets</Text>
                    <Text style={styles.carteSousTexte}>Issus de : {s.projet_origine_nom}</Text>
                  </View>
                  <View style={[styles.badge,
                    s.statut === 'vendu' ? styles.badgeVert : s.statut === 'mort' ? styles.badgeRouge : s.statut === 'reforme' ? styles.badgeGris : styles.badgeOrange
                  ]}>
                    <Text style={[styles.badgeTexte,
                      s.statut === 'vendu' ? styles.badgeTexteVert : s.statut === 'mort' ? styles.badgeTexteRouge : s.statut === 'reforme' ? styles.badgeTexteGris : styles.badgeTexteOrange
                    ]}>
                      {s.statut === 'vendu' ? 'Vendu' : s.statut === 'mort' ? 'Mort' : s.statut === 'reforme' ? 'Réformé' : 'En reproduction'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.dateTexte}>Retenus le {new Date(s.date_retenue).toLocaleDateString('fr-FR')}</Text>
                {s.statut === 'vendu' ? (
                  <Text style={styles.venteTexte}>
                    Vendus {new Date(s.date_vente).toLocaleDateString('fr-FR')} pour {formatMontant(s.montant_vente)}
                  </Text>
                ) : s.statut === 'mort' ? (
                  <Text style={styles.mortTexteFerme}>Décédés le {s.date_fin_service ? new Date(s.date_fin_service).toLocaleDateString('fr-FR') : ''}</Text>
                ) : s.statut === 'reforme' && sujetVenteId !== s.id ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.dateTexte}>Réformés le {s.date_fin_service ? new Date(s.date_fin_service).toLocaleDateString('fr-FR') : ''}</Text>
                    <TouchableOpacity style={styles.boutonVendre} onPress={() => setSujetVenteId(s.id)}>
                      <Text style={styles.boutonVendreTexte}>Marquer comme vendu</Text>
                    </TouchableOpacity>
                  </View>
                ) : sujetVenteId === s.id ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <TextInput style={styles.champ} placeholder="Montant total de la vente (F)" keyboardType="numeric"
                      value={montantVente} onChangeText={setMontantVente} />
                    <TextInput style={styles.champ} placeholder="Note (optionnel)"
                      value={noteVente} onChangeText={setNoteVente} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity style={styles.boutonConfirmer} onPress={confirmerVente} disabled={envoiVente}>
                        <Text style={styles.boutonConfirmerTexte}>{envoiVente ? 'Enregistrement...' : 'Confirmer la vente'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.boutonAnnuler} onPress={() => { setSujetVenteId(null); setMontantVente(''); }}>
                        <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.boutonVendre, { flex: 1, marginTop: 0 }]} onPress={() => setSujetVenteId(s.id)}>
                      <Text style={styles.boutonVendreTexte}>Vendre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.boutonReformer} onPress={() => reformerSujet(s.id)}>
                      <Text style={styles.boutonReformerTexte}>Réformer</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.boutonMort} onPress={() => declarerMortSujet(s.id)}>
                      <Text style={styles.boutonMortTexte}>Déclarer mort</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {enCours.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitre}>Chantiers en cours</Text>
            {enCours.map(d => (
              <View style={styles.carte} key={d.id}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{d.libelle}</Text>
                  <Text style={styles.carteSousTexte}>{d.avancement_pourcentage}%</Text>
                </View>
                <View style={styles.progressFond}>
                  <View style={[styles.progressBarre, { width: `${Math.min(d.avancement_pourcentage, 100)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitre}>Historique par année</Text>
        {historique.length === 0 ? (
          <Text style={styles.vide}>Aucune dépense datée pour l'instant</Text>
        ) : (
          historique.map(([annee, data]) => {
            const estOuverte = anneeOuverte === annee;
            const moisTries = Object.entries(data.mois).sort((a, b) => b[0] - a[0]);
            return (
              <View style={styles.carteAccordeon} key={annee}>
                <TouchableOpacity style={styles.accordeonHeader} onPress={() => setAnneeOuverte(estOuverte ? null : annee)}>
                  <Text style={styles.carteTitre}>{annee}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.carteTitre}>{formatMontant(data.total)}</Text>
                    <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{estOuverte ? '▲' : '▼'}</Text>
                  </View>
                </TouchableOpacity>
                {estOuverte && moisTries.map(([moisIndex, moisData]) => (
                  <View style={styles.moisBloc} key={moisIndex}>
                    <View style={styles.ligneEntre}>
                      <Text style={styles.moisLabel}>{MOIS[moisIndex]}</Text>
                      <Text style={styles.moisLabel}>{formatMontant(moisData.total)}</Text>
                    </View>
                    {moisData.depenses.map(d => (
                      <View style={styles.ligneEntre} key={d.id}>
                        <Text style={styles.depenseLigne}>{d.libelle}</Text>
                        <Text style={styles.depenseLigne}>{formatMontant(d.montant_reel || d.montant_prevu)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitre}>Dernières dépenses</Text>
        {dernieresDepenses.length === 0 ? (
          <Text style={styles.vide}>Aucune dépense de ferme pour l'instant</Text>
        ) : (
          dernieresDepenses.map(d => (
            <View style={styles.carte} key={d.id}>
              <View style={styles.ligneEntre}>
                <View>
                  <Text style={styles.carteTitre}>{d.libelle}</Text>
                  <Text style={styles.carteSousTexte}>{d.categorie}</Text>
                </View>
                <Text style={styles.carteTitre}>{formatMontant(d.montant_reel || d.montant_prevu)}</Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.boutonPrincipal}>
          <Text style={styles.boutonPrincipalTexte}>Voir toutes les dépenses de la ferme</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 16 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '600' },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  grille2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  mini: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, width: '47%' },
  miniLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  miniValeur: { fontSize: 15, fontWeight: '600', color: '#111827' },
  section: { marginBottom: 16 },
  sectionTitre: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8, marginTop: 8 },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeVert: { backgroundColor: '#ECFDF5' },
  badgeOrange: { backgroundColor: '#FFF7ED' },
  badgeRouge: { backgroundColor: '#FEF2F2' },
  badgeGris: { backgroundColor: '#F3F4F6' },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  badgeTexteVert: { color: '#047857' },
  badgeTexteOrange: { color: '#C2410C' },
  badgeTexteRouge: { color: '#DC2626' },
  badgeTexteGris: { color: '#4B5563' },
  dateTexte: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  venteTexte: { fontSize: 12, color: '#047857', marginTop: 4 },
  mortTexteFerme: { fontSize: 12, color: '#DC2626', marginTop: 4 },
  boutonReformer: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  boutonReformerTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  boutonMort: { flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  boutonMortTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13 },
  boutonConfirmer: { flex: 1, backgroundColor: '#111827', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  boutonConfirmerTexte: { color: '#fff', fontSize: 12, fontWeight: '600' },
  boutonAnnuler: { paddingHorizontal: 14, backgroundColor: '#F3F4F6', borderRadius: 8, justifyContent: 'center' },
  boutonAnnulerTexte: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  boutonVendre: { marginTop: 8, backgroundColor: '#ECFDF5', borderRadius: 8, paddingVertical: 8, borderWidth: 1, borderColor: '#D1FAE5', alignItems: 'center' },
  boutonVendreTexte: { color: '#047857', fontSize: 12, fontWeight: '600' },
  progressFond: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  progressBarre: { height: '100%', backgroundColor: '#111827', borderRadius: 3 },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 20 },
  carteAccordeon: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 8, overflow: 'hidden' },
  accordeonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  moisBloc: { paddingHorizontal: 14, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB' },
  moisLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 8 },
  depenseLigne: { fontSize: 12, color: '#6B7280', paddingLeft: 8 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default FermeScreen;