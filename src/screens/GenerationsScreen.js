import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => m === null || m === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(Math.round(m)) + ' F';

const STATUTS = {
  planifie: { label: 'Planifiée', bg: '#F3F4F6', text: '#4B5563' },
  actif: { label: 'Active', bg: '#EFF6FF', text: '#1D4ED8' },
  croissance: { label: 'Croissance', bg: '#EEF2FF', text: '#4338CA' },
  reproducteur: { label: 'Reproductrice', bg: '#FFF7ED', text: '#C2410C' },
  partiellement_vendu: { label: 'Partiellement vendue', bg: '#FFFBEB', text: '#B45309' },
  cloture: { label: 'Clôturée', bg: '#ECFDF5', text: '#047857' },
};

const labelMouvement = (type) => ({
  ACHAT: '🛒 Achat', NAISSANCE: '🐣 Naissance', MORTALITE: '💀 Mortalité',
  SELECTION_REPRO: '🐔 Sélection reproducteur', VENTE: '💰 Vente',
}[type] || type);

const GenerationsScreen = ({ token, projetActifId }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [generations, setGenerations] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | nouvelle | cout
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ code: '', origine: 'achat', date_debut: new Date().toISOString().split('T')[0] });

  const [generationOuverte, setGenerationOuverte] = useState(null);
  const [mouvementsParGeneration, setMouvementsParGeneration] = useState({});
  const [chargementMouvements, setChargementMouvements] = useState(false);

  const [generationEnCout, setGenerationEnCout] = useState(null);
  const [coutForm, setCoutForm] = useState({ depense_id: '', montant_affecte: '', note: '' });
  const [envoiCout, setEnvoiCout] = useState(false);
  const [erreurCout, setErreurCout] = useState('');

  const charger = async () => {
    try {
      const [genRes, depensesRes] = await Promise.all([
        api.get(`/generations?projet_id=${projetActifId}`, { headers }),
        api.get(`/depenses?projet_id=${projetActifId}`, { headers }),
      ]);
      setGenerations(genRes.data);
      setDepenses(depensesRes.data);
    } catch (error) { console.log('Erreur generations:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { if (projetActifId) charger(); }, [projetActifId]);

  const trouverCode = (id) => generations.find(g => g.id === id)?.code;

  const toggleMouvements = async (generationId) => {
    if (generationOuverte === generationId) { setGenerationOuverte(null); return; }
    setGenerationOuverte(generationId);
    if (!mouvementsParGeneration[generationId]) {
      setChargementMouvements(true);
      try {
        const res = await api.get(`/generations/${generationId}/mouvements-animaux`, { headers });
        setMouvementsParGeneration(prev => ({ ...prev, [generationId]: res.data }));
      } catch (error) { console.log('Erreur mouvements animaux:', error.message); }
      finally { setChargementMouvements(false); }
    }
  };

  const ouvrirCoutForm = (generation) => {
    setGenerationEnCout(generation);
    setCoutForm({ depense_id: '', montant_affecte: '', note: '' });
    setErreurCout('');
    setVue('cout');
  };

  const confirmerCout = async () => {
    if (!coutForm.depense_id) { setErreurCout('Choisis la dépense à ventiler.'); return; }
    setEnvoiCout(true);
    setErreurCout('');
    try {
      await api.post(`/generations/${generationEnCout.id}/couts`, {
        depense_id: parseInt(coutForm.depense_id),
        montant_affecte: parseFloat(coutForm.montant_affecte),
        note: coutForm.note,
        cle_repartition: 'manuelle',
      }, { headers });
      setVue('liste'); setGenerationEnCout(null);
      charger();
    } catch (error) {
      setErreurCout(error.response?.data?.message || "Erreur lors de l'affectation du coût.");
    } finally { setEnvoiCout(false); }
  };

  const creerGeneration = async () => {
    if (!form.code.trim()) { setErreur('Le code est obligatoire.'); return; }
    setEnvoi(true);
    setErreur('');
    try {
      await api.post('/generations', { ...form, projet_id: projetActifId }, { headers });
      setVue('liste');
      setForm({ code: '', origine: 'achat', date_debut: new Date().toISOString().split('T')[0] });
      charger();
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur lors de la création.');
    } finally { setEnvoi(false); }
  };

  if (vue === 'cout' && generationEnCout) {
    const depenseChoisie = depenses.find(d => d.id === parseInt(coutForm.depense_id));
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Affecter un coût · ${generationEnCout.code}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.infoTexte}>Ventile une part d'une dépense déjà réelle vers cette génération, à titre analytique — ne crée jamais de nouvelle dépense ni de mouvement de caisse.</Text>
            <Text style={styles.label}>Dépense à ventiler *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {depenses.map(d => (
                <TouchableOpacity key={d.id} onPress={() => setCoutForm({ ...coutForm, depense_id: String(d.id) })}
                  style={[styles.chip, coutForm.depense_id === String(d.id) && styles.chipActif]}>
                  <Text style={[styles.chipTexte, coutForm.depense_id === String(d.id) && styles.chipTexteActif]}>{d.libelle} — {formatMontant(d.montant_reel)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Montant affecté (F) *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={coutForm.montant_affecte} onChangeText={v => setCoutForm({ ...coutForm, montant_affecte: v })} />
            {depenseChoisie && <Text style={styles.infoTexte}>Montant réel de cette dépense : {formatMontant(depenseChoisie.montant_reel)}</Text>}
            <Text style={styles.label}>Note (optionnel)</Text>
            <TextInput style={[styles.champ, { height: 60 }]} multiline value={coutForm.note} onChangeText={v => setCoutForm({ ...coutForm, note: v })} />
          </View>
          {erreurCout !== '' && <Text style={styles.erreurTexte}>{erreurCout}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={confirmerCout} disabled={envoiCout}>
            <Text style={styles.boutonPrincipalTexte}>{envoiCout ? 'Enregistrement...' : 'Affecter ce coût'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setGenerationEnCout(null); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (vue === 'nouvelle') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouvelle génération" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Code (ex. G1) *</Text>
            <TextInput style={styles.champ} placeholder="G1" value={form.code} onChangeText={v => setForm({ ...form, code: v })} />
            <Text style={styles.label}>Origine</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ v: 'achat', l: 'Achat externe' }, { v: 'autre', l: 'Autre' }].map(o => (
                <TouchableOpacity key={o.v} onPress={() => setForm({ ...form, origine: o.v })} style={[styles.chip, form.origine === o.v && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.origine === o.v && styles.chipTexteActif]}>{o.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.infoTexte}>Les générations issues de reproduction interne sont créées automatiquement à l'éclosion, depuis l'écran Reproduction.</Text>
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={creerGeneration} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création...' : 'Créer la génération'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Générations" action={<TouchableOpacity style={styles.boutonAjout} onPress={() => setVue('nouvelle')}><Text style={styles.boutonAjoutTexte}>+ Génération</Text></TouchableOpacity>} />
      <ScrollView style={styles.conteneur}>
        {chargement ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#1D1D1F" />
        ) : generations.length === 0 ? (
          <View style={styles.videCarte}>
            <Text style={styles.vide}>Aucune génération enregistrée pour ce projet</Text>
            <TouchableOpacity style={styles.boutonPrincipalPetit} onPress={() => setVue('nouvelle')}><Text style={styles.boutonPrincipalTexte}>Créer G1</Text></TouchableOpacity>
          </View>
        ) : generations.map(g => {
          const badge = STATUTS[g.statut] || { label: g.statut, bg: '#F3F4F6', text: '#4B5563' };
          return (
            <View key={g.id} style={styles.carte}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>{g.code}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text></View>
              </View>
              <Text style={styles.carteSousTexte}>
                {g.origine === 'reproduction_interne' ? '🐣 Née sur la ferme' : g.origine === 'achat' ? '🛒 Achat externe' : 'Autre'}
                {g.generation_parente_id ? ` · issue de ${trouverCode(g.generation_parente_id) || '…'}` : ''}
              </Text>

              <View style={styles.grille4}>
                <View style={styles.miniBox}><Text style={styles.miniValeur}>{g.quantite_initiale_totale ?? 0}</Text><Text style={styles.miniLabel}>Reçus</Text></View>
                <View style={styles.miniBox}><Text style={[styles.miniValeur, { color: '#DC2626' }]}>{g.total_morts ?? 0}</Text><Text style={styles.miniLabel}>Morts</Text></View>
                <View style={styles.miniBox}><Text style={[styles.miniValeur, { color: '#C2410C' }]}>{g.total_reproducteurs_actifs ?? 0}</Text><Text style={styles.miniLabel}>Reproducteurs</Text></View>
                <View style={styles.miniBox}><Text style={[styles.miniValeur, { color: '#047857' }]}>{g.disponibles ?? 0}</Text><Text style={styles.miniLabel}>Disponibles</Text></View>
              </View>

              {g.cout_unitaire_production !== null && g.cout_unitaire_production !== undefined && (
                <View style={styles.encartIndigo}>
                  <Text style={styles.encartIndigoTexte}>Coût de production : {formatMontant(g.cout_unitaire_production)}/sujet ({formatMontant(g.cout_total_affecte)} pour {g.effectif_produit} sujets)</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={styles.actionIndigo} onPress={() => ouvrirCoutForm(g)}><Text style={styles.actionIndigoTexte}>Affecter un coût</Text></TouchableOpacity>
                <TouchableOpacity style={styles.actionGrise} onPress={() => toggleMouvements(g.id)}>
                  <Text style={styles.actionGriseTexte}>{generationOuverte === g.id ? 'Masquer les mouvements' : 'Voir les mouvements'}</Text>
                </TouchableOpacity>
              </View>

              {generationOuverte === g.id && (
                <View style={styles.mouvementsBloc}>
                  {chargementMouvements && !mouvementsParGeneration[g.id] ? (
                    <ActivityIndicator color="#6E6E73" />
                  ) : (mouvementsParGeneration[g.id] || []).length === 0 ? (
                    <Text style={styles.vide}>Aucun mouvement enregistré</Text>
                  ) : mouvementsParGeneration[g.id].map(m => (
                    <View key={m.id} style={styles.ligneMouvement}>
                      <Text style={styles.mouvementTexte}>{labelMouvement(m.type_mouvement)}</Text>
                      <Text style={styles.mouvementValeur}>{m.quantite}</Text>
                      <Text style={styles.mouvementDate}>{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 2, marginBottom: 10 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  grille4: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7', marginBottom: 6 },
  miniBox: { alignItems: 'center', flex: 1 },
  miniValeur: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  miniLabel: { fontSize: 9, color: '#6E6E73', marginTop: 2 },
  encartIndigo: { backgroundColor: '#EEF2FF', borderRadius: 10, padding: 8, marginTop: 4, marginBottom: 4 },
  encartIndigoTexte: { fontSize: 11, color: '#4338CA' },
  actionIndigo: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  actionIndigoTexte: { fontSize: 11, color: '#4338CA', fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { fontSize: 11, color: '#4B5563', fontWeight: '600' },
  mouvementsBloc: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7', gap: 6 },
  ligneMouvement: { flexDirection: 'row', justifyContent: 'space-between' },
  mouvementTexte: { fontSize: 11, color: '#4B5563' },
  mouvementValeur: { fontSize: 11, fontWeight: '600', color: '#1D1D1F' },
  mouvementDate: { fontSize: 10, color: '#6E6E73' },
  vide: { fontSize: 12, color: '#6E6E73', textAlign: 'center', paddingVertical: 12 },
  videCarte: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E5EA', borderStyle: 'dashed', padding: 24, alignItems: 'center', marginTop: 12 },
  boutonPrincipalPetit: { backgroundColor: '#1D1D1F', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 8 },
  boutonAjout: { backgroundColor: '#1D1D1F', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  boutonAjoutTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  label: { fontSize: 11, color: '#6E6E73', marginBottom: 4, marginTop: 8 },
  champ: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1D1D1F' },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  infoTexte: { fontSize: 11, color: '#6E6E73', backgroundColor: '#F5F5F7', borderRadius: 8, padding: 8, marginTop: 8, marginBottom: 4 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 13, fontWeight: '600' },
});

export default GenerationsScreen;
