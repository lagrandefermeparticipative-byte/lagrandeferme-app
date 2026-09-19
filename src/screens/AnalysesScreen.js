import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';
const largeurEcran = Dimensions.get('window').width - 32;

const COULEURS_PIE = ['#1D1D1F', '#4B5563', '#6E6E73', '#D1D5DB', '#E5E5EA', '#F3F4F6'];

const configGraphique = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(17, 24, 39, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  barPercentage: 0.6,
  propsForLabels: { fontSize: 9 },
};

const AnalysesScreen = ({ token, projetActifId }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [depenses, setDepenses] = useState([]);
  const [lots, setLots] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [rapports, setRapports] = useState([]);
  const [projet, setProjet] = useState(null);
  const [onglet, setOnglet] = useState('bilan');
  const [chargement, setChargement] = useState(true);

  const charger = async () => {
    try {
      const [depensesRes, lotsRes, ventesRes, rapportsRes, projetRes] = await Promise.all([
        api.get(`/depenses?projet_id=${projetActifId}`, { headers }),
        api.get(`/lots?projet_id=${projetActifId}`, { headers }),
        api.get(`/ventes?projet_id=${projetActifId}`, { headers }),
        api.get(`/rapports?projet_id=${projetActifId}`, { headers }),
        api.get(`/projets/${projetActifId}`, { headers }),
      ]);
      setDepenses(depensesRes.data.filter(d => d.type_depense !== 'ferme'));
      setLots(lotsRes.data);
      setVentes(ventesRes.data);
      setRapports(rapportsRes.data);
      setProjet(projetRes.data);
    } catch (error) { console.log('Erreur analyses:', error.message); }
    finally { setChargement(false); }
  };

  const dejaCharge = useRef(false);
  useEffect(() => {
    if (projetActifId && !dejaCharge.current) {
      charger();
      dejaCharge.current = true;
    }
  }, [projetActifId]);

  const totalDepensesReelles = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
  const totalDepensesPrevues = depenses.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
  const totalRecettes = ventes.reduce((s, v) => s + parseFloat(v.recette_totale || 0), 0);
  const totalRecettesPayees = ventes.filter(v => v.statut_paiement === 'payee').reduce((s, v) => s + parseFloat(v.recette_totale || 0), 0);
  const totalSujetsInitiaux = lots.reduce((s, l) => s + parseInt(l.quantite_initiale || 0), 0);
  const totalVivants = lots.reduce((s, l) => s + parseInt(l.vivants || l.quantite_initiale || 0), 0);
  const totalVendus = ventes.reduce((s, v) => s + (parseInt(v.males_vendus) || 0) + (parseInt(v.femelles_vendues) || 0), 0);
  const totalMorts = totalSujetsInitiaux - totalVivants;
  const tauxSurvie = totalSujetsInitiaux > 0 ? ((totalVivants / totalSujetsInitiaux) * 100).toFixed(1) : 0;

  const profitNet = totalRecettes - totalDepensesReelles;
  const rendementReel = totalDepensesReelles > 0 ? ((profitNet / totalDepensesReelles) * 100).toFixed(1) : 0;
  const coutRevient = totalSujetsInitiaux > 0 ? Math.round(totalDepensesReelles / totalSujetsInitiaux) : 0;
  const coutRevientPrevu = totalSujetsInitiaux > 0 ? Math.round(totalDepensesPrevues / totalSujetsInitiaux) : 0;

  const prixMale = projet?.prix_vente_male || 4200;
  const prixFemelle = projet?.prix_vente_femelle || 5000;
  const recetteProjetee = totalVivants * ((prixMale + prixFemelle) / 2);
  const rendementProjecte = totalDepensesReelles > 0 ? (((recetteProjetee - totalDepensesReelles) / totalDepensesReelles) * 100).toFixed(1) : 0;

  const dataDepensesParCategorie = Object.entries(
    depenses.reduce((acc, d) => {
      const cat = d.categorie || 'Autre';
      acc[cat] = (acc[cat] || 0) + parseFloat(d.montant_reel || 0);
      return acc;
    }, {})
  ).map(([name, value], i) => ({ name: name.substring(0, 10), population: Math.round(value), color: COULEURS_PIE[i % COULEURS_PIE.length], legendFontColor: '#6E6E73', legendFontSize: 10 }))
   .filter(d => d.population > 0)
   .sort((a, b) => b.population - a.population);

  const dataBudget = depenses.slice(0, 6);
  const dataSurvie = lots.map(l => {
    const vivants = parseInt(l.vivants || l.quantite_initiale);
    const morts = parseInt(l.quantite_initiale) - vivants;
    return { name: l.nom, vivants, morts, taux: ((vivants / parseInt(l.quantite_initiale)) * 100).toFixed(1) };
  });

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre="Analyses" sousTitre={projet?.nom} />
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Analyses" sousTitre={projet?.nom || 'Pintades 2026'} />
      <ScrollView style={styles.conteneur}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ongletsLigne}>
          {['bilan', 'elevage', 'budget', 'ventes'].map(t => (
            <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
              <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>
                {t === 'bilan' ? 'Bilan' : t === 'elevage' ? 'Élevage' : t === 'budget' ? 'Budget' : 'Ventes'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {onglet === 'bilan' && (
          <View>
            <View style={styles.carteNoire}>
              <Text style={styles.carteNoireLabel}>Coût de revient / pintade</Text>
              <Text style={styles.carteNoireMontant}>{formatMontant(coutRevient)}</Text>
              <Text style={styles.carteNoireSousLabel}>Prévu : {formatMontant(coutRevientPrevu)} / pintade</Text>
              <View style={styles.grille2noire}>
                <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>Rendement réel</Text><Text style={[styles.miniNoireValeur, { color: rendementReel >= 20 ? '#4ADE80' : '#FB923C' }]}>{rendementReel}%</Text></View>
                <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>Rendement projeté</Text><Text style={[styles.miniNoireValeur, { color: rendementProjecte >= 20 ? '#4ADE80' : '#FB923C' }]}>{rendementProjecte}%</Text></View>
              </View>
            </View>
            <View style={styles.grille2mini}>
              <View style={styles.mini}><Text style={styles.miniLabel}>Dépenses réelles</Text><Text style={styles.miniValeur}>{formatMontant(totalDepensesReelles)}</Text><Text style={styles.carteSousTexte}>Prévu : {formatMontant(totalDepensesPrevues)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Recettes</Text><Text style={styles.miniValeur}>{formatMontant(totalRecettes)}</Text><Text style={styles.carteSousTexte}>Encaissé : {formatMontant(totalRecettesPayees)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Profit net actuel</Text><Text style={[styles.miniValeur, { color: profitNet >= 0 ? '#059669' : '#DC2626' }]}>{formatMontant(profitNet)}</Text></View>
              <View style={styles.mini}><Text style={styles.miniLabel}>Recette projetée</Text><Text style={[styles.miniValeur, { color: '#2563EB' }]}>{formatMontant(recetteProjetee)}</Text><Text style={styles.carteSousTexte}>{totalVivants} vivants</Text></View>
            </View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Indicateurs clés</Text>
              <LigneInfo label="Sujets initial" value={totalSujetsInitiaux} />
              <LigneInfo label="Vivants actuels" value={totalVivants} />
              <LigneInfo label="Total morts" value={totalMorts} />
              <LigneInfo label="Vendus" value={totalVendus} />
              <LigneInfo label="Taux survie" value={`${tauxSurvie}%`} />
              <LigneInfo label="Rapports soumis" value={rapports.length} />
              <LigneInfo label="Rendement promis" value={`${projet?.rendement_promis || 20}%`} />
            </View>
          </View>
        )}

        {onglet === 'elevage' && (
          <View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Survie par lot</Text>
              {dataSurvie.map(lot => (
                <View key={lot.name} style={{ marginTop: 10 }}>
                  <View style={styles.ligneEntre}>
                    <Text style={styles.lotNom}>{lot.name}</Text>
                    <Text style={[styles.lotTaux, { color: lot.taux >= 95 ? '#059669' : lot.taux >= 85 ? '#EA580C' : '#DC2626' }]}>{lot.taux}% · {lot.vivants} vivants / {lot.morts} morts</Text>
                  </View>
                  <View style={styles.progressFond}>
                    <View style={[styles.progressBarre, { width: `${lot.taux}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            {dataSurvie.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Survie vivants vs morts</Text>
                <BarChart
                  data={{ labels: dataSurvie.map(l => l.name.substring(0, 6)), datasets: [{ data: dataSurvie.map(l => l.vivants) }] }}
                  width={largeurEcran - 28} height={180} chartConfig={configGraphique} fromZero
                  style={{ marginTop: 8 }}
                />
              </View>
            )}
            {rapports.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Historique rapports</Text>
                {rapports.slice(0, 5).map(r => (
                  <View style={styles.ligneEntre} key={r.id}>
                    <Text style={styles.rapportTexte}>S{r.semaine} · {new Date(r.date_rapport).toLocaleDateString('fr-FR')}</Text>
                    <Text style={styles.mortsTexte}>{r.morts_semaine || 0} morts</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {onglet === 'budget' && (
          <View>
            {dataBudget.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Prévu vs Réel (top 6)</Text>
                <BarChart
                  data={{ labels: dataBudget.map(d => d.libelle.substring(0, 6)), datasets: [{ data: dataBudget.map(d => parseFloat(d.montant_reel || 0)) }] }}
                  width={largeurEcran - 28} height={180} chartConfig={configGraphique} fromZero
                  style={{ marginTop: 8 }}
                />
              </View>
            )}
            {dataDepensesParCategorie.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Répartition par catégorie</Text>
                <PieChart
                  data={dataDepensesParCategorie} width={largeurEcran - 28} height={180}
                  chartConfig={configGraphique} accessor="population" backgroundColor="transparent" paddingLeft="0"
                />
              </View>
            )}
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Détail par catégorie</Text>
              {dataDepensesParCategorie.map(d => <LigneInfo key={d.name} label={d.name} value={formatMontant(d.population)} />)}
            </View>
          </View>
        )}

        {onglet === 'ventes' && (
          <View>
            <View style={styles.grille2noireIndep}>
              <View style={styles.carteNoireGrille}><Text style={styles.carteNoireLabel}>Total vendus</Text><Text style={styles.carteNoireMontant}>{totalVendus}</Text><Text style={styles.carteNoireSousLabel}>sur {totalVivants} vivants</Text></View>
              <View style={styles.carteNoireGrille}><Text style={styles.carteNoireLabel}>Recettes totales</Text><Text style={styles.carteNoireMontant}>{formatMontant(totalRecettes)}</Text><Text style={styles.carteNoireSousLabel}>Encaissé : {formatMontant(totalRecettesPayees)}</Text></View>
            </View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Projection finale</Text>
              <LigneInfo label="Pintades restantes" value={totalVivants - totalVendus} />
              <LigneInfo label="Prix moyen estimé" value={formatMontant((prixMale + prixFemelle) / 2)} />
              <LigneInfo label="Recette projetée" value={formatMontant(recetteProjetee)} />
              <LigneInfo label="Recette déjà réalisée" value={formatMontant(totalRecettes)} />
              <LigneInfo label="Recette restante estimée" value={formatMontant(recetteProjetee - totalRecettes)} />
            </View>
            {ventes.length > 0 && (
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Historique ventes</Text>
                {ventes.map(v => (
                  <View style={styles.ligneEntre} key={v.id}>
                    <View>
                      <Text style={styles.rapportTexte}>{v.acheteur || 'Inconnu'}</Text>
                      <Text style={styles.carteSousTexte}>{new Date(v.date_vente).toLocaleDateString('fr-FR')} · {v.males_vendus}M + {v.femelles_vendues}F</Text>
                    </View>
                    <Text style={styles.rapportTexte}>{formatMontant(v.recette_totale)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const LigneInfo = ({ label, value }) => (
  <View style={styles.ligneEntre}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValeur}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  carteSousTexte: { fontSize: 11, color: '#6E6E73' },
  ongletsLigne: { marginTop: 8, marginBottom: 14 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#1D1D1F' },
  ongletTexte: { fontSize: 13, color: '#6E6E73', fontWeight: '500' },
  ongletTexteActif: { color: '#1D1D1F' },
  carteNoire: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireGrille: { flex: 1, backgroundColor: '#1D1D1F', borderRadius: 12, padding: 14 },
  grille2noireIndep: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  carteNoireLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  carteNoireMontant: { color: '#1D1D1F', fontSize: 20, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  carteNoireSousLabel: { color: '#6E6E73', fontSize: 10, marginTop: 4 },
  grille2noire: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniNoire: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8 },
  miniNoireLabel: { color: '#6E6E73', fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  miniNoireValeur: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  grille2mini: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  mini: { width: '47%', backgroundColor: '#fff', borderRadius: 16, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  miniLabel: { fontSize: 11, color: '#6E6E73', marginBottom: 2 },
  miniValeur: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  infoLabel: { fontSize: 12, color: '#6E6E73' },
  infoValeur: { fontSize: 12, fontWeight: '600', color: '#1D1D1F' },
  lotNom: { fontSize: 11, fontWeight: '600', color: '#374151' },
  lotTaux: { fontSize: 10, fontWeight: '600' },
  progressFond: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 4, overflow: 'hidden' },
  progressBarre: { height: '100%', backgroundColor: '#1D1D1F', borderRadius: 4 },
  rapportTexte: { fontSize: 12, color: '#374151', fontWeight: '500' },
  mortsTexte: { fontSize: 11, color: '#EF4444' },
});

export default AnalysesScreen;