import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';
const largeurEcran = Dimensions.get('window').width - 32;

const configGraphique = {
  backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff', decimalPlaces: 0,
  color: (o = 1) => `rgba(17, 24, 39, ${o})`, labelColor: (o = 1) => `rgba(107, 114, 128, ${o})`,
  barPercentage: 0.6, propsForLabels: { fontSize: 9 },
};

const BilanScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [projets, setProjets] = useState([]);
  const [dateDebut, setDateDebut] = useState('2020-01-01');
  const [dateFin, setDateFin] = useState(new Date().toISOString().split('T')[0]);
  const [projetId, setProjetId] = useState('');
  const [bilan, setBilan] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [clotureOuverte, setClotureOuverte] = useState(null);
  const [detailCloture, setDetailCloture] = useState(null);

  useEffect(() => {
    api.get('/projets', { headers }).then(res => setProjets(res.data)).catch(() => {});
  }, []);

  const genererBilan = async () => {
    setChargement(true);
    try {
      const params = new URLSearchParams({ date_debut: dateDebut, date_fin: dateFin });
      if (projetId) params.append('projet_id', projetId);
      const res = await api.get(`/bilan?${params.toString()}`, { headers });
      setBilan(res.data);
    } catch (error) { Alert.alert('Erreur', 'Génération du bilan impossible.'); }
    finally { setChargement(false); }
  };

  const appliquerRaccourci = (mois) => {
    const fin = new Date();
    const debut = new Date();
    debut.setMonth(debut.getMonth() - mois);
    setDateDebut(debut.toISOString().split('T')[0]);
    setDateFin(fin.toISOString().split('T')[0]);
  };

  const ouvrirCloture = async (pid) => {
    if (clotureOuverte === pid) { setClotureOuverte(null); return; }
    setClotureOuverte(pid);
    try {
      const res = await api.get(`/clotures/${pid}`, { headers });
      setDetailCloture(res.data);
    } catch (error) { console.log('Erreur clôture:', error.message); }
  };

  const marquerPaye = async (versementId) => {
    try {
      await api.put(`/clotures/versements/${versementId}/payer`, {}, { headers });
      const res = await api.get(`/clotures/${clotureOuverte}`, { headers });
      setDetailCloture(res.data);
    } catch { Alert.alert('Erreur', 'Mise à jour impossible.'); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Bilan comptable" sousTitre="Ferme & projets" sansRetour />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Filtres</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            {[{ label: '3 mois', m: 3 }, { label: '6 mois', m: 6 }, { label: '1 an', m: 12 }, { label: 'Tout', m: 999 }].map(r => (
              <TouchableOpacity key={r.label} onPress={() => appliquerRaccourci(r.m)} style={styles.raccourciChip}>
                <Text style={styles.raccourciTexte}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Du (AAAA-MM-JJ)</Text>
          <TextInput style={styles.champ} value={dateDebut} onChangeText={setDateDebut} />
          <Text style={styles.label}>Au (AAAA-MM-JJ)</Text>
          <TextInput style={styles.champ} value={dateFin} onChangeText={setDateFin} />
          <Text style={styles.label}>Projet</Text>
          <TouchableOpacity onPress={() => setProjetId('')} style={[styles.optionLigne, !projetId && styles.optionLigneActive]}>
            <Text style={styles.optionTexte}>Tous les projets (vue ferme complète)</Text>
          </TouchableOpacity>
          {projets.map(p => (
            <TouchableOpacity key={p.id} onPress={() => setProjetId(String(p.uuid_id || p.id))} style={[styles.optionLigne, projetId === String(p.uuid_id || p.id) && styles.optionLigneActive]}>
              <Text style={styles.optionTexte}>{p.nom}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={genererBilan} disabled={chargement}>
            <Text style={styles.boutonPrincipalTexte}>{chargement ? 'Génération...' : 'Générer le bilan'}</Text>
          </TouchableOpacity>
        </View>

        {bilan && (
          <View>
            <View style={styles.carteNoire}>
              <Text style={styles.carteNoireLabel}>Période du {new Date(bilan.periode.debut).toLocaleDateString('fr-FR')} au {new Date(bilan.periode.fin).toLocaleDateString('fr-FR')}</Text>
              <Text style={styles.carteNoireMontant}>{formatMontant(bilan.resume.profit_brut)}</Text>
              <Text style={styles.carteNoireSousLabel}>Profit net (ventes − dépenses projets − dépenses ferme)</Text>
            </View>

            <View style={styles.grille2mini}>
              <View style={styles.mini}><Text style={styles.miniLabel}>Dépenses réelles</Text><Text style={[styles.miniValeur, { color: '#DC2626' }]}>{formatMontant(bilan.resume.total_depenses_reelles)}</Text><Text style={styles.carteSousTexte}>Prévu : {formatMontant(bilan.resume.total_depenses_prevues)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Ventes réelles</Text><Text style={[styles.miniValeur, { color: '#059669' }]}>{formatMontant(bilan.resume.total_ventes_reelles)}</Text><Text style={styles.carteSousTexte}>{bilan.resume.total_sujets_vendus} sujets vendus</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Mises investisseurs</Text><Text style={styles.miniValeur}>{formatMontant(bilan.resume.total_mises_investisseurs)}</Text><Text style={styles.carteSousTexte}>dont encaissé : {formatMontant(bilan.resume.total_mises_encaissees)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Versé aux investisseurs</Text><Text style={styles.miniValeur}>{formatMontant(bilan.resume.total_verse_investisseurs)}</Text><Text style={styles.carteSousTexte}>Payé : {formatMontant(bilan.resume.total_verse_paye)}</Text></View>
            </View>

            <View style={styles.encartAmbre}>
              <Text style={styles.encartAmbreTitre}>Ce qui revient à la ferme</Text>
              <View style={styles.grille3ambre}>
                <View><Text style={styles.ambreLabel}>Loyers perçus (2%)</Text><Text style={styles.ambreValeur}>{formatMontant(bilan.resume.total_loyers_percus)}</Text></View>
                <View><Text style={styles.ambreLabel}>Surplus des clôtures</Text><Text style={[styles.ambreValeur, { color: bilan.resume.total_surplus_ferme < 0 ? '#DC2626' : '#92400E' }]}>{formatMontant(bilan.resume.total_surplus_ferme)}</Text></View>
                <View><Text style={styles.ambreLabel}>Dépenses de la ferme</Text><Text style={[styles.ambreValeur, { color: '#DC2626' }]}>{formatMontant(bilan.resume.total_depenses_ferme)}</Text></View>
              </View>
            </View>

            {bilan.bilan_comptable && (
              <>
                <View style={styles.carte}>
                  <Text style={styles.carteTitre}>Soldes actuels des caisses</Text>
                  {bilan.bilan_comptable.caisses.map(c => (
                    <View style={styles.ligneEntre} key={c.id}>
                      <View><Text style={styles.rapportTexte}>{c.nom}</Text><Text style={styles.carteSousTexte}>{c.type === 'ferme' ? 'Ferme' : c.projet_nom}</Text></View>
                      <Text style={styles.rapportTexte}>{formatMontant(c.solde)}</Text>
                    </View>
                  ))}
                  <View style={[styles.ligneEntre, styles.totalLigne]}>
                    <Text style={styles.totalLabel}>Total en caisse</Text>
                    <Text style={styles.totalValeur}>{formatMontant(bilan.bilan_comptable.total_caisses)}</Text>
                  </View>
                </View>

                <View style={styles.carteSituation}>
                  <Text style={styles.carteTitre}>Situation nette (actif − passif)</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginVertical: 10 }}>
                    <View style={styles.encartActif}>
                      <Text style={styles.encartActifLabel}>Actif</Text>
                      <Text style={styles.encartActifValeur}>{formatMontant(bilan.bilan_comptable.total_actif)}</Text>
                      <Text style={styles.encartActifDetail}>Caisses : {formatMontant(bilan.bilan_comptable.total_caisses)}</Text>
                      <Text style={styles.encartActifDetail}>Créances : {formatMontant(bilan.bilan_comptable.creances)}</Text>
                    </View>
                    <View style={styles.encartPassif}>
                      <Text style={styles.encartPassifLabel}>Passif</Text>
                      <Text style={styles.encartPassifValeur}>{formatMontant(bilan.bilan_comptable.total_passif)}</Text>
                      <Text style={styles.encartPassifDetail}>Dû investisseurs : {formatMontant(bilan.bilan_comptable.dettes_versements_investisseurs)}</Text>
                      <Text style={styles.encartPassifDetail}>Dép. engagées : {formatMontant(bilan.bilan_comptable.dettes_depenses_engagees)}</Text>
                    </View>
                  </View>
                  <View style={styles.situationNoire}>
                    <Text style={styles.situationLabel}>Situation nette</Text>
                    <Text style={[styles.situationValeur, { color: bilan.bilan_comptable.situation_nette >= 0 ? '#fff' : '#F87171' }]}>{formatMontant(bilan.bilan_comptable.situation_nette)}</Text>
                  </View>
                </View>
              </>
            )}

            {bilan.evolution_mensuelle?.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Évolution mensuelle</Text>
                <BarChart
                  data={{ labels: bilan.evolution_mensuelle.map(e => e.mois), datasets: [{ data: bilan.evolution_mensuelle.map(e => e.ventes) }] }}
                  width={largeurEcran - 28} height={200} chartConfig={configGraphique} fromZero style={{ marginTop: 8 }}
                />
              </View>
            )}

            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Projets concernés ({bilan.resume.nombre_projets})</Text>
              {bilan.projets.length === 0 ? <Text style={styles.vide}>Aucun projet sur cette période.</Text> : bilan.projets.map(p => (
                <View style={styles.ligneEntre} key={p.id}>
                  <Text style={styles.rapportTexte}>{p.nom}</Text>
                  <View style={[styles.badge, { backgroundColor: p.statut_cloture === 'cloture' ? '#F3F4F6' : '#ECFDF5' }]}>
                    <Text style={[styles.badgeTexte, { color: p.statut_cloture === 'cloture' ? '#4B5563' : '#047857' }]}>{p.statut_cloture === 'cloture' ? 'Clôturé' : 'Actif'}</Text>
                  </View>
                </View>
              ))}
            </View>

            {bilan.clotures?.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Historique des clôtures</Text>
                {bilan.clotures.map(c => (
                  <View key={c.id} style={styles.clotureBloc}>
                    <TouchableOpacity onPress={() => ouvrirCloture(c.projet_id)}>
                      <View style={styles.ligneEntre}>
                        <Text style={styles.rapportTexte}>{c.projet_nom}</Text>
                        <Text style={styles.carteSousTexte}>{new Date(c.created_at).toLocaleDateString('fr-FR')}</Text>
                      </View>
                      <Text style={styles.carteSousTexte}>Taux : {c.taux_perte_applique}% · Loyer : {formatMontant(c.loyer_total)} · Surplus : {formatMontant(c.surplus_ferme)}</Text>
                      <Text style={styles.lienIndigo}>{clotureOuverte === c.projet_id ? '▲ Masquer les versements' : '▼ Voir et gérer les versements'}</Text>
                    </TouchableOpacity>
                    {clotureOuverte === c.projet_id && detailCloture && detailCloture.versements.map(v => (
                      <View key={v.id} style={styles.versementLigne}>
                        <View><Text style={styles.versementNom}>{v.nom}</Text><Text style={styles.carteSousTexte}>{formatMontant(v.montant_verse)}</Text></View>
                        {v.statut_paiement === 'paye' ? (
                          <View style={styles.badgeVertPaye}><Text style={styles.badgeVertPayeTexte}>Payé ✓</Text></View>
                        ) : (
                          <TouchableOpacity style={styles.boutonPayer} onPress={() => marquerPaye(v.uuid_id || v.id)}>
                            <Text style={styles.boutonPayerTexte}>Marquer payé</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!bilan && !chargement && <Text style={styles.vide}>Choisis une période et clique "Générer le bilan"</Text>}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 8 },
  carteSousTexte: { fontSize: 11, color: '#9CA3AF' },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13 },
  raccourciChip: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  raccourciTexte: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  optionLigne: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionLigneActive: { backgroundColor: '#F3F4F6' },
  optionTexte: { fontSize: 12, color: '#374151' },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 20 },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 11 },
  carteNoireMontant: { color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 4 },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 4 },
  grille2mini: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  mini: { width: '47%', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  miniLabel: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  miniValeur: { fontSize: 14, fontWeight: '600', color: '#111827' },
  encartAmbre: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginBottom: 12 },
  encartAmbreTitre: { fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  grille3ambre: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ambreLabel: { fontSize: 10, color: '#B45309' },
  ambreValeur: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  rapportTexte: { fontSize: 12, color: '#374151', fontWeight: '500' },
  totalLigne: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  totalValeur: { fontSize: 13, fontWeight: '700', color: '#111827' },
  carteSituation: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#111827', padding: 14, marginBottom: 12 },
  encartActif: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10 },
  encartActifLabel: { fontSize: 11, color: '#059669', marginBottom: 2 },
  encartActifValeur: { fontSize: 13, fontWeight: '600', color: '#047857' },
  encartActifDetail: { fontSize: 10, color: '#059669', marginTop: 2 },
  encartPassif: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  encartPassifLabel: { fontSize: 11, color: '#DC2626', marginBottom: 2 },
  encartPassifValeur: { fontSize: 13, fontWeight: '600', color: '#B91C1C' },
  encartPassifDetail: { fontSize: 10, color: '#DC2626', marginTop: 2 },
  situationNoire: { backgroundColor: '#111827', borderRadius: 10, padding: 12, alignItems: 'center' },
  situationLabel: { color: '#9CA3AF', fontSize: 11 },
  situationValeur: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  clotureBloc: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB', paddingBottom: 10, marginBottom: 10 },
  lienIndigo: { fontSize: 11, color: '#4338CA', fontWeight: '600', marginTop: 4 },
  versementLigne: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  versementNom: { fontSize: 11, fontWeight: '600', color: '#111827' },
  badgeVertPaye: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeVertPayeTexte: { color: '#047857', fontSize: 10, fontWeight: '600' },
  boutonPayer: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPayerTexte: { color: '#fff', fontSize: 10, fontWeight: '600' },
});

export default BilanScreen;