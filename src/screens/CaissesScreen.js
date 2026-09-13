import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const CaissesScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [caisses, setCaisses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | detail | virement | reconciliation
  const [caisseSelectionnee, setCaisseSelectionnee] = useState(null);
  const [mouvements, setMouvements] = useState([]);
  const [chargementMouvements, setChargementMouvements] = useState(true);
  const [formAction, setFormAction] = useState(null);
  const [values, setValues] = useState({ montant: '', motif: '', note: '' });
  const [virement, setVirement] = useState({ caisse_source_id: '', caisse_dest_id: '', montant: '', motif: '', note: '' });
  const [reconciliation, setReconciliation] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const chargerCaisses = async () => {
    try {
      const res = await api.get('/caisses', { headers });
      setCaisses(res.data);
    } catch (error) { console.log('Erreur caisses:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { chargerCaisses(); }, []);

  const ouvrirCaisse = async (caisse) => {
    setCaisseSelectionnee(caisse);
    setVue('detail');
    setChargementMouvements(true);
    try {
      const res = await api.get(`/caisses/${caisse.uuid_id || caisse.id}/mouvements`, { headers });
      setMouvements(res.data);
    } catch (error) { console.log('Erreur mouvements:', error.message); }
    finally { setChargementMouvements(false); }
  };

  const supprimerMouvement = (id) => {
    Alert.alert('Supprimer', 'Supprimer ce mouvement ? Le solde sera recalculé.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/caisses/mouvements/${id}`, { headers });
          ouvrirCaisse(caisseSelectionnee);
        } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Suppression impossible.'); }
      }},
    ]);
  };

  const soumettreMouvement = async () => {
    if (!values.montant || !values.motif) { Alert.alert('Champs manquants', 'Montant et motif requis.'); return; }
    setEnvoi(true);
    try {
      const route = formAction === 'credit' ? 'crediter' : 'debiter';
      await api.post(`/caisses/${caisseSelectionnee.uuid_id || caisseSelectionnee.id}/${route}`, values, { headers });
      setValues({ montant: '', motif: '', note: '' }); setFormAction(null);
      ouvrirCaisse(caisseSelectionnee); chargerCaisses();
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const soumettreVirement = async () => {
    if (virement.caisse_source_id === virement.caisse_dest_id) { Alert.alert('Erreur', 'Les caisses doivent être différentes.'); return; }
    if (!virement.caisse_source_id || !virement.caisse_dest_id || !virement.montant || !virement.motif) { Alert.alert('Champs manquants', 'Tous les champs sont requis sauf la note.'); return; }
    setEnvoi(true);
    try {
      await api.post('/caisses/virement', virement, { headers });
      setVue('liste'); setVirement({ caisse_source_id: '', caisse_dest_id: '', montant: '', motif: '', note: '' });
      chargerCaisses();
    } catch (error) { Alert.alert('Erreur', "Virement impossible."); }
    finally { setEnvoi(false); }
  };

  const verifierCoherence = async (caisse) => {
    setCaisseSelectionnee(caisse);
    setVue('reconciliation');
    setReconciliation(null);
    try {
      const res = await api.get(`/caisses/${caisse.uuid_id || caisse.id}/reconciliation`, { headers });
      setReconciliation(res.data);
    } catch (error) { console.log('Erreur réconciliation:', error.message); }
  };

  const appliquerCorrection = async () => {
    setEnvoi(true);
    try {
      await api.post(`/caisses/${caisseSelectionnee.uuid_id || caisseSelectionnee.id}/reconciliation/appliquer`, {}, { headers });
      setVue('liste'); setReconciliation(null); chargerCaisses();
    } catch (error) { Alert.alert('Erreur', 'Correction impossible.'); }
    finally { setEnvoi(false); }
  };

  // --- VUE RÉCONCILIATION ---
  if (vue === 'reconciliation' && caisseSelectionnee) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Header titre="Vérifier la cohérence" sousTitre={caisseSelectionnee.nom} />
        <ScrollView style={styles.conteneur}>
          <TouchableOpacity onPress={() => { setVue('liste'); setReconciliation(null); }}><Text style={styles.lienRetour}>← Retour</Text></TouchableOpacity>
          {!reconciliation ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#111827" />
          ) : reconciliation.coherent ? (
            <View style={styles.encartVert}>
              <Text style={styles.encartVertTexte}>✓ La caisse est cohérente avec les vraies dépenses</Text>
            </View>
          ) : (
            <View style={styles.encartAmbre}>
              <Text style={styles.encartAmbreTitre}>Écart détecté</Text>
              <View style={styles.ligneEntre}><Text style={styles.ambreLabel}>Débité dans la caisse</Text><Text style={styles.ambreValeur}>{formatMontant(reconciliation.total_debite_caisse)}</Text></View>
              <View style={styles.ligneEntre}><Text style={styles.ambreLabel}>Vraies dépenses (Gestion)</Text><Text style={styles.ambreValeur}>{formatMontant(reconciliation.total_depenses_reelles)}</Text></View>
              <View style={[styles.ligneEntre, styles.ambreTotal]}><Text style={styles.ambreLabelGras}>Écart à corriger</Text><Text style={styles.ambreValeurGrasse}>{formatMontant(reconciliation.ecart)}</Text></View>
              <Text style={styles.ambreNote}>Cet écart vient probablement de dépenses faites avant la connexion "dépense → caisse", ou de mouvements supprimés pendant des tests.</Text>
              <TouchableOpacity style={styles.boutonAmbre} onPress={appliquerCorrection} disabled={envoi}>
                <Text style={styles.boutonAmbreTexte}>{envoi ? 'Correction...' : 'Corriger la caisse'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // --- VUE VIREMENT ---
  if (vue === 'virement') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Virement entre caisses" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Depuis</Text>
            {caisses.map(c => (
              <TouchableOpacity key={c.id} onPress={() => setVirement({ ...virement, caisse_source_id: String(c.uuid_id || c.id) })}
                style={[styles.optionLigne, virement.caisse_source_id === String(c.uuid_id || c.id) && styles.optionLigneActive]}>
                <Text style={styles.optionTexte}>{c.nom} ({formatMontant(c.solde)})</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Vers</Text>
            {caisses.map(c => (
              <TouchableOpacity key={c.id} onPress={() => setVirement({ ...virement, caisse_dest_id: String(c.uuid_id || c.id) })}
                style={[styles.optionLigne, virement.caisse_dest_id === String(c.uuid_id || c.id) && styles.optionLigneActive]}>
                <Text style={styles.optionTexte}>{c.nom} ({formatMontant(c.solde)})</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.label}>Montant (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={virement.montant} onChangeText={v => setVirement({ ...virement, montant: v })} />
            <Text style={styles.label}>Motif</Text>
            <TextInput style={styles.champ} placeholder="Ex: Avance de la ferme au projet" value={virement.motif} onChangeText={v => setVirement({ ...virement, motif: v })} />
            <Text style={styles.label}>Note (optionnel)</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={virement.note} onChangeText={v => setVirement({ ...virement, note: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreVirement} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Confirmer le virement'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE DÉTAIL CAISSE ---
  if (vue === 'detail' && caisseSelectionnee) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={caisseSelectionnee.nom} action={<TouchableOpacity onPress={() => { setVue('liste'); chargerCaisses(); }}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Solde actuel</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(caisseSelectionnee.solde)}</Text>
            <View style={styles.ligneEntre}>
              <Text style={styles.creditTexte}>+ {formatMontant(caisseSelectionnee.total_credit)}</Text>
              <Text style={styles.debitTexte}>- {formatMontant(caisseSelectionnee.total_debit)}</Text>
            </View>
          </View>

          {!formAction ? (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity style={styles.boutonCrediter} onPress={() => setFormAction('credit')}><Text style={styles.boutonCrediterTexte}>+ Créditer</Text></TouchableOpacity>
              <TouchableOpacity style={styles.boutonDebiter} onPress={() => setFormAction('debit')}><Text style={styles.boutonDebiterTexte}>− Débiter</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>{formAction === 'credit' ? 'Créditer la caisse' : 'Débiter la caisse'}</Text>
              <Text style={styles.label}>Montant (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" value={values.montant} onChangeText={v => setValues({ ...values, montant: v })} />
              <Text style={styles.label}>Motif</Text>
              <TextInput style={styles.champ} placeholder="Ex: Apport associés, Paiement fournisseur..." value={values.motif} onChangeText={v => setValues({ ...values, motif: v })} />
              <Text style={styles.label}>Note (optionnel)</Text>
              <TextInput style={[styles.champ, { height: 60 }]} multiline value={values.note} onChangeText={v => setValues({ ...values, note: v })} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={styles.boutonConfirmer} onPress={soumettreMouvement} disabled={envoi}>
                  <Text style={styles.boutonConfirmerTexte}>{envoi ? 'Enregistrement...' : 'Confirmer'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.boutonAnnuler} onPress={() => setFormAction(null)}>
                  <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitre}>Historique des mouvements</Text>
          {chargementMouvements ? <ActivityIndicator color="#111827" /> : mouvements.length === 0 ? (
            <Text style={styles.vide}>Aucun mouvement pour l'instant</Text>
          ) : mouvements.map(m => (
            <View style={styles.carte} key={m.id}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>{m.motif}</Text>
                <Text style={[styles.montantMouvement, { color: m.type === 'credit' ? '#059669' : '#DC2626' }]}>{m.type === 'credit' ? '+' : '−'}{formatMontant(m.montant)}</Text>
              </View>
              <Text style={styles.carteSousTexte}>
                {new Date(m.date_mouvement).toLocaleDateString('fr-FR')}
                {m.depense_libelle ? ` · Dépense : ${m.depense_libelle}` : ''}
                {m.caisse_liee_nom ? ` · Virement avec : ${m.caisse_liee_nom}` : ''}
              </Text>
              <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerMouvement(m.uuid_id || m.id)}>
                <Text style={styles.actionRougeTexte}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE LISTE ---
  const totalGlobal = caisses.reduce((s, c) => s + (c.solde || 0), 0);
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Caisses" sousTitre="Trésorerie de la ferme et des projets" sansRetour />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Total toutes caisses</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(totalGlobal)}</Text>
          </View>
          <TouchableOpacity style={styles.boutonIndigo} onPress={() => setVue('virement')}>
            <Text style={styles.boutonIndigoTexte}>⇄ Faire un virement entre caisses</Text>
          </TouchableOpacity>
          {caisses.map(caisse => (
            <TouchableOpacity key={caisse.id} style={styles.carte} onPress={() => ouvrirCaisse(caisse)}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>{caisse.nom}</Text>
                <View style={[styles.badge, { backgroundColor: caisse.type === 'ferme' ? '#F5F3FF' : '#EFF6FF' }]}>
                  <Text style={[styles.badgeTexte, { color: caisse.type === 'ferme' ? '#6D28D9' : '#1D4ED8' }]}>{caisse.type === 'ferme' ? 'Ferme' : 'Projet'}</Text>
                </View>
              </View>
              <Text style={styles.soldeTexte}>{formatMontant(caisse.solde)}</Text>
              {caisse.statut_tresorerie === 'a_credit' && (
                <Text style={styles.avertissementTexte}>⚠️ Travaille à crédit — dépensé plus que ce qui est vraiment crédité</Text>
              )}
              <View style={styles.ligneEntre}>
                <Text style={styles.creditTextePetit}>+ {formatMontant(caisse.total_credit)}</Text>
                <Text style={styles.debitTextePetit}>- {formatMontant(caisse.total_debit)}</Text>
              </View>
              <TouchableOpacity onPress={() => verifierCoherence(caisse)}>
                <Text style={styles.lienCoherence}>🔍 Vérifier la cohérence avec les vraies dépenses</Text>
              </TouchableOpacity>
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
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  vide: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  sectionTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 8, marginTop: 6 },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 12 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 12 },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '600', marginBottom: 8 },
  creditTexte: { color: '#4ADE80', fontSize: 11 },
  debitTexte: { color: '#F87171', fontSize: 11 },
  creditTextePetit: { color: '#059669', fontSize: 11 },
  debitTextePetit: { color: '#DC2626', fontSize: 11 },
  boutonCrediter: { flex: 1, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonCrediterTexte: { color: '#047857', fontSize: 13, fontWeight: '600' },
  boutonDebiter: { flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonDebiterTexte: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  boutonConfirmer: { flex: 1, backgroundColor: '#111827', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonConfirmerTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonAnnuler: { paddingHorizontal: 16, backgroundColor: '#F3F4F6', borderRadius: 10, justifyContent: 'center' },
  boutonAnnulerTexte: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  boutonIndigo: { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 },
  boutonIndigoTexte: { color: '#4338CA', fontSize: 13, fontWeight: '600' },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  soldeTexte: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 2 },
  avertissementTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600', marginTop: 2 },
  lienCoherence: { color: '#4338CA', fontSize: 11, fontWeight: '600', marginTop: 8 },
  lienRetour: { color: '#6B7280', fontSize: 12, marginBottom: 12 },
  lienRetourPetit: { color: '#6B7280', fontSize: 11 },
  montantMouvement: { fontSize: 13, fontWeight: '600' },
  actionRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionRougeTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  optionLigne: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionLigneActive: { backgroundColor: '#F3F4F6' },
  optionTexte: { fontSize: 12, color: '#374151' },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10 },
  encartVertTexte: { color: '#047857', fontSize: 13, fontWeight: '600' },
  encartAmbre: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginTop: 10 },
  encartAmbreTitre: { fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  ambreLabel: { fontSize: 11, color: '#B45309' },
  ambreValeur: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  ambreTotal: { borderTopWidth: 1, borderTopColor: '#FDE68A', paddingTop: 8, marginTop: 4 },
  ambreLabelGras: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  ambreValeurGrasse: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  ambreNote: { fontSize: 10, color: '#D97706', marginTop: 8, marginBottom: 10 },
  boutonAmbre: { backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonAmbreTexte: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default CaissesScreen;