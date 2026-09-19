import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';
const CATEGORIES = ['Outils', 'Matériel élevage', 'Transport', 'Infrastructure', 'Électronique', 'Autre'];
const ETATS = { bon: { label: 'Bon état', bg: '#ECFDF5', text: '#047857' }, moyen: { label: 'État moyen', bg: '#FFF7ED', text: '#C2410C' }, hors_service: { label: 'Hors service', bg: '#FEF2F2', text: '#B91C1C' } };
const VIDE = { nom: '', categorie: 'Outils', quantite: '1', etat: 'bon', valeur_estimee: '', date_acquisition: '', note: '', projet_origine_id: '' };

const EquipementsScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [equipements, setEquipements] = useState([]);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | nouveau | modifier
  const [equipementSelectionne, setEquipementSelectionne] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState('Toutes');
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      const [eqRes, projetsRes] = await Promise.all([
        api.get('/equipements', { headers }),
        api.get('/projets', { headers }),
      ]);
      setEquipements(eqRes.data);
      setProjets(projetsRes.data);
    } catch (error) { console.log('Erreur équipements:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { charger(); }, []);

  const creerEquipement = async () => {
    if (!form.nom) { Alert.alert('Champ manquant', 'Le nom est obligatoire.'); return; }
    setEnvoi(true);
    try {
      await api.post('/equipements', form, { headers });
      setVue('liste'); setForm(VIDE); charger();
    } catch (error) { Alert.alert('Erreur', 'Enregistrement impossible.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerModification = async () => {
    setEnvoi(true);
    try {
      await api.put(`/equipements/${equipementSelectionne.uuid_id || equipementSelectionne.id}`, form, { headers });
      setVue('liste'); charger();
    } catch (error) { Alert.alert('Erreur', 'Modification impossible.'); }
    finally { setEnvoi(false); }
  };

  const supprimerEquipement = (eq) => {
    Alert.alert('Supprimer', 'Supprimer cet équipement ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/equipements/${eq.uuid_id || eq.id}`, { headers }); charger(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  const categories = ['Toutes', ...CATEGORIES];
  const equipementsFiltres = filtreCategorie === 'Toutes' ? equipements : equipements.filter(e => e.categorie === filtreCategorie);
  const valeurTotale = equipements.reduce((s, e) => s + (parseFloat(e.valeur_estimee) || 0), 0);

  // --- FORMULAIRE (nouveau/modifier) ---
  if (vue === 'nouveau' || vue === 'modifier') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={vue === 'nouveau' ? 'Nouvel équipement' : `Modifier · ${equipementSelectionne?.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom *</Text>
            <TextInput style={styles.champ} placeholder="Ex: Brouette, Groupe électrogène..." value={form.nom} onChangeText={v => setForm({ ...form, nom: v })} />
            <Text style={styles.label}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, categorie: c })} style={[styles.chip, form.categorie === c && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.categorie === c && styles.chipTexteActif]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Quantité</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={String(form.quantite)} onChangeText={v => setForm({ ...form, quantite: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>État</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {Object.keys(ETATS).map(e => (
                    <TouchableOpacity key={e} onPress={() => setForm({ ...form, etat: e })} style={[styles.chip, form.etat === e && styles.chipActif]}>
                      <Text style={[styles.chipTexte, form.etat === e && styles.chipTexteActif]}>{ETATS[e].label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
            <Text style={styles.label}>Valeur estimée (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(form.valeur_estimee)} onChangeText={v => setForm({ ...form, valeur_estimee: v })} />
            <Text style={styles.label}>Payé par</Text>
            <TouchableOpacity onPress={() => setForm({ ...form, projet_origine_id: '' })} style={[styles.optionLigne, !form.projet_origine_id && styles.optionLigneActive]}>
              <Text style={styles.optionTexte}>La ferme (frais généraux)</Text>
            </TouchableOpacity>
            {projets.map(p => (
              <TouchableOpacity key={p.id} onPress={() => setForm({ ...form, projet_origine_id: String(p.uuid_id || p.id) })} style={[styles.optionLigne, form.projet_origine_id === String(p.uuid_id || p.id) && styles.optionLigneActive]}>
                <Text style={styles.optionTexte}>Le projet — {p.nom}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.infoTexte}>Si un projet a payé cet équipement, ça débite sa propre caisse plutôt que celle de la ferme — mais l'équipement reste dans cet inventaire commun.</Text>
            <Text style={styles.label}>Note</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={form.note} onChangeText={v => setForm({ ...form, note: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={vue === 'nouveau' ? creerEquipement : enregistrerModification} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE LISTE ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Équipements" sousTitre="Inventaire de la ferme"
        action={<TouchableOpacity style={styles.boutonPetit} onPress={() => { setForm(VIDE); setVue('nouveau'); }}><Text style={styles.boutonPetitTexte}>+ Équipement</Text></TouchableOpacity>}
      />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Valeur totale estimée</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(valeurTotale)}</Text>
            <Text style={styles.carteNoireSousLabel}>{equipements.length} équipement{equipements.length > 1 ? 's' : ''}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {categories.map(cat => (
              <TouchableOpacity key={cat} onPress={() => setFiltreCategorie(cat)} style={[styles.filtreChip, filtreCategorie === cat && styles.filtreChipActif]}>
                <Text style={[styles.filtreChipTexte, filtreCategorie === cat && styles.filtreChipTexteActif]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {equipementsFiltres.length === 0 ? (
            <View style={styles.videCarte}>
              <Text style={styles.vide}>Aucun équipement enregistré</Text>
              <TouchableOpacity style={styles.boutonPrincipal} onPress={() => { setForm(VIDE); setVue('nouveau'); }}>
                <Text style={styles.boutonPrincipalTexte}>Ajouter un équipement</Text>
              </TouchableOpacity>
            </View>
          ) : equipementsFiltres.map(eq => {
            const badge = ETATS[eq.etat] || ETATS.bon;
            return (
              <View style={styles.carte} key={eq.id}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{eq.nom}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text></View>
                </View>
                <Text style={styles.carteSousTexte}>{eq.categorie} · Quantité : {eq.quantite}{eq.valeur_estimee ? ` · ${formatMontant(eq.valeur_estimee)}` : ''}</Text>
                {eq.projet_origine_nom && <Text style={styles.projetTexte}>💰 Payé par le projet {eq.projet_origine_nom}</Text>}
                {eq.note && <Text style={styles.noteTexte}>{eq.note}</Text>}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <TouchableOpacity style={styles.actionGrise} onPress={() => { setEquipementSelectionne(eq); setForm({ nom: eq.nom, categorie: eq.categorie || 'Outils', quantite: String(eq.quantite || 1), etat: eq.etat || 'bon', valeur_estimee: String(eq.valeur_estimee || ''), date_acquisition: eq.date_acquisition || '', note: eq.note || '', projet_origine_id: eq.projet_origine_id || '' }); setVue('modifier'); }}>
                    <Text style={styles.actionGriseTexte}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerEquipement(eq)}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 4 },
  projetTexte: { fontSize: 11, color: '#4F46E5', marginTop: 4 },
  noteTexte: { fontSize: 11, color: '#6E6E73', fontStyle: 'italic', marginTop: 4 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  optionLigne: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionLigneActive: { backgroundColor: '#F3F4F6' },
  optionTexte: { fontSize: 12, color: '#374151' },
  infoTexte: { fontSize: 10, color: '#6E6E73', marginTop: 8, lineHeight: 14 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#1D1D1F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videCarte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E5EA', padding: 30, alignItems: 'center' },
  vide: { color: '#6E6E73', fontSize: 13, marginBottom: 10 },
  carteNoire: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireLabel: { color: '#6E6E73', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  carteNoireMontant: { color: '#1D1D1F', fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  carteNoireSousLabel: { color: '#6E6E73', fontSize: 11, marginTop: 4 },
  filtreChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', marginRight: 6 },
  filtreChipActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  filtreChipTexte: { fontSize: 12, color: '#6E6E73', fontWeight: '600' },
  filtreChipTexteActif: { color: '#fff' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  actionRouge: { paddingHorizontal: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, justifyContent: 'center' },
});

export default EquipementsScreen;