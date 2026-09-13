import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const STATUTS = {
  payee: { label: 'Payée', bg: '#ECFDF5', text: '#047857' },
  planifiee: { label: 'Planifiée', bg: '#F3F4F6', text: '#4B5563' },
  engagee: { label: 'Engagée', bg: '#EFF6FF', text: '#1D4ED8' },
  annulee: { label: 'Annulée', bg: '#FEF2F2', text: '#B91C1C' },
};

const CATEGORIES = ['Alimentation', 'Sante & vaccins', 'Transport', 'Technicien', 'Infrastructure', 'Achat sujets', 'Autre'];

const GestionScreen = ({ token, projetActifId, projetNom }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [depenses, setDepenses] = useState([]);
  const [lots, setLots] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('budget');
  const [vue, setVue] = useState('liste'); // liste | nouveau | modifier | payer | historique
  const [depenseSelectionnee, setDepenseSelectionnee] = useState(null);
  const [categorieOuverte, setCategorieOuverte] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [alerteDepassement, setAlerteDepassement] = useState(null);
  const [paiementsHistorique, setPaiementsHistorique] = useState([]);
  const [chargementHistorique, setChargementHistorique] = useState(false);

  const [form, setForm] = useState({ libelle: '', categorie: 'Alimentation', montant_prevu: '', montant_reel: '', statut: 'planifiee', date_depense: '', fournisseur: '', note: '' });
  const [paiement, setPaiement] = useState({ depense_id: '', montant: '', description: '' });

  const charger = async () => {
    try {
      const [depensesRes, lotsRes] = await Promise.all([
        api.get(`/depenses?projet_id=${projetActifId}`, { headers }),
        api.get(`/lots?projet_id=${projetActifId}`, { headers }),
      ]);
      setDepenses(depensesRes.data.filter(d => d.type_depense !== 'ferme'));
      setLots(lotsRes.data);
    } catch (error) { console.log('Erreur gestion:', error.message); }
    finally { setChargement(false); }
  };

  const dejaCharge = useRef(false);
  useEffect(() => {
    if (projetActifId && !dejaCharge.current) {
      charger();
      dejaCharge.current = true;
    }
  }, [projetActifId]);

  const creerDepense = async () => {
    if (!form.libelle) { setErreur('Libellé requis.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/depenses', { ...form, projet_id: projetActifId, type_depense: 'projet' }, { headers });
      setVue('liste'); setForm({ libelle: '', categorie: 'Alimentation', montant_prevu: '', montant_reel: '', statut: 'planifiee', date_depense: '', fournisseur: '', note: '' });
      charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerModification = async () => {
    setEnvoi(true); setErreur('');
    try {
      await api.put(`/depenses/${depenseSelectionnee.uuid_id || depenseSelectionnee.id}`, { ...form, type_depense: 'projet' }, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerPaiement = async () => {
    if (!paiement.depense_id || !paiement.montant) { setErreur('Dépense et montant requis.'); return; }
    setEnvoi(true); setErreur('');
    try {
      const depenseCible = depenses.find(d => d.id === parseInt(paiement.depense_id));
      const res = await api.post(`/depenses/${paiement.depense_id}/paiements`, { montant: parseFloat(paiement.montant), description: paiement.description }, { headers });
      setVue('liste'); setPaiement({ depense_id: '', montant: '', description: '' });
      if (res.data.depassement) setAlerteDepassement({ libelle: depenseCible?.libelle || '', montant: res.data.montant_depassement });
      charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const ouvrirHistorique = async (depense) => {
    setDepenseSelectionnee(depense);
    setVue('historique');
    setChargementHistorique(true);
    try {
      const res = await api.get(`/depenses/${depense.uuid_id || depense.id}/paiements`, { headers });
      setPaiementsHistorique(res.data);
    } catch (error) { Alert.alert('Erreur', "Chargement impossible."); }
    finally { setChargementHistorique(false); }
  };

  const supprimerDepense = (depense) => {
    Alert.alert('Supprimer', 'Supprimer cette dépense ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/depenses/${depense.uuid_id || depense.id}`, { headers }); charger(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  const totalPintades = lots.reduce((s, l) => s + parseInt(l.vivants || l.quantite_initiale || 0), 0);
  const totalPrevu = depenses.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
  const ecart = totalReel - totalPrevu;
  const pourcentageConsomme = totalPrevu > 0 ? Math.round((totalReel / totalPrevu) * 100) : 0;
  const coutParPintade = totalPintades > 0 ? Math.round(totalReel / totalPintades) : 0;

  const groupParCategorie = () => {
    const groupes = {};
    depenses.forEach(d => {
      const cat = d.categorie || 'Autre';
      if (!groupes[cat]) groupes[cat] = { prevu: 0, reel: 0 };
      groupes[cat].prevu += parseFloat(d.montant_prevu || 0);
      groupes[cat].reel += parseFloat(d.montant_reel || 0);
    });
    return Object.entries(groupes).sort((a, b) => b[1].reel - a[1].reel);
  };

  const categoriesUtilisees = [...new Set(depenses.map(d => d.categorie || 'Autre'))];

  // --- FORMULAIRE (nouveau/modifier partagé) ---
  if (vue === 'nouveau' || vue === 'modifier') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={vue === 'nouveau' ? 'Nouvelle dépense' : `Modifier · ${depenseSelectionnee?.libelle}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Catégorie</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} onPress={() => setForm({ ...form, categorie: c })} style={[styles.chip, form.categorie === c && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.categorie === c && styles.chipTexteActif]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Libellé</Text>
            <TextInput style={styles.champ} placeholder="Ex: Achat maïs" value={form.libelle} onChangeText={v => setForm({ ...form, libelle: v })} />
            <Text style={styles.label}>Montant prévu (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(form.montant_prevu)} onChangeText={v => setForm({ ...form, montant_prevu: v })} />
            <Text style={styles.label}>Montant réel (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(form.montant_reel)} onChangeText={v => setForm({ ...form, montant_reel: v })} />
            <Text style={styles.label}>Statut</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {Object.keys(STATUTS).map(s => (
                <TouchableOpacity key={s} onPress={() => setForm({ ...form, statut: s })} style={[styles.chip, form.statut === s && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.statut === s && styles.chipTexteActif]}>{STATUTS[s].label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Fournisseur</Text>
            <TextInput style={styles.champ} value={form.fournisseur} onChangeText={v => setForm({ ...form, fournisseur: v })} />
            <Text style={styles.label}>Note</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={form.note} onChangeText={v => setForm({ ...form, note: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={vue === 'nouveau' ? creerDepense : enregistrerModification} disabled={envoi}>
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

  // --- FORMULAIRE PAIEMENT ---
  if (vue === 'payer') {
    const depenseChoisie = depenses.find(d => d.id === parseInt(paiement.depense_id));
    const nouveauTotal = depenseChoisie ? (parseFloat(depenseChoisie.montant_reel) || 0) + (parseFloat(paiement.montant) || 0) : 0;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Payer une dépense prévue" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Dépense concernée</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {depenses.map(d => (
                <TouchableOpacity key={d.id} onPress={() => setPaiement({ ...paiement, depense_id: String(d.id) })}
                  style={[styles.optionLigne, paiement.depense_id === String(d.id) && styles.optionLigneActive]}>
                  <Text style={styles.optionTexte}>{d.libelle} ({d.categorie}) — {formatMontant(d.montant_reel || 0)} / {formatMontant(d.montant_prevu)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Montant payé (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={paiement.montant} onChangeText={v => setPaiement({ ...paiement, montant: v })} />
            <Text style={styles.label}>Qu'as-tu acheté exactement ? (optionnel)</Text>
            <TextInput style={styles.champ} placeholder="Ex: 3 sacs de soja au marché" value={paiement.description} onChangeText={v => setPaiement({ ...paiement, description: v })} />
            {depenseChoisie && (
              <View style={styles.encartGris}>
                <Text style={styles.encartGrisLabel}>Nouveau montant réel après ce paiement</Text>
                <Text style={styles.encartGrisValeur}>{formatMontant(nouveauTotal)}</Text>
              </View>
            )}
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerPaiement} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer le paiement'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- HISTORIQUE PAIEMENTS ---
  if (vue === 'historique' && depenseSelectionnee) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Header titre={`Historique · ${depenseSelectionnee.libelle}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Montant réel total</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(depenseSelectionnee.montant_reel)}</Text>
            <Text style={styles.carteNoireSousLabel}>Prévu : {formatMontant(depenseSelectionnee.montant_prevu)}</Text>
          </View>
          {chargementHistorique ? <ActivityIndicator color="#111827" /> : paiementsHistorique.length === 0 ? (
            <Text style={styles.vide}>Aucun paiement enregistré</Text>
          ) : paiementsHistorique.map(p => (
            <View style={styles.carte} key={p.id}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>{formatMontant(p.montant)}</Text>
                <Text style={styles.carteSousTexte}>{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</Text>
              </View>
              {p.description && <Text style={styles.carteSousTexte}>{p.description}</Text>}
            </View>
          ))}
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>← Retour</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // --- VUE PRINCIPALE ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Gestion" sousTitre={`${projetNom || 'Chargement...'} · Projet`}
        action={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.boutonVertPetit} onPress={() => setVue('payer')}>
              <Text style={styles.boutonPetitTexte}>Payer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonPetit} onPress={() => { setForm({ libelle: '', categorie: 'Alimentation', montant_prevu: '', montant_reel: '', statut: 'planifiee', date_depense: '', fournisseur: '', note: '' }); setVue('nouveau'); }}>
              <Text style={styles.boutonPetitTexte}>+ Dépense</Text>
            </TouchableOpacity>
          </View>
        }
      />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          {alerteDepassement && (
            <View style={styles.alerteRouge}>
              <View style={{ flex: 1 }}>
                <Text style={styles.alerteRougeTitre}>⚠️ Budget dépassé</Text>
                <Text style={styles.alerteRougeTexte}>"{alerteDepassement.libelle}" dépasse le prévu de {formatMontant(alerteDepassement.montant)}</Text>
              </View>
              <TouchableOpacity onPress={() => setAlerteDepassement(null)}><Text style={{ color: '#F87171' }}>✕</Text></TouchableOpacity>
            </View>
          )}

          <View style={styles.ongletsLigne}>
            {['budget', 'depenses'].map(t => (
              <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
                <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>{t === 'budget' ? 'Budget' : 'Dépenses'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {onglet === 'budget' && (
            <View>
              <View style={styles.carteNoire}>
                <Text style={styles.carteNoireLabel}>Budget consommé</Text>
                <Text style={styles.carteNoireMontant}>{pourcentageConsomme}%</Text>
                <View style={styles.progressFondNoir}>
                  <View style={[styles.progressBarreBlanche, { width: `${Math.min(pourcentageConsomme, 100)}%` }]} />
                </View>
                <View style={[styles.ligneEntre, { marginTop: 8 }]}>
                  <Text style={styles.carteNoireSousLabel}>{formatMontant(totalReel)} dépensé</Text>
                  <Text style={styles.carteNoireSousLabel}>{formatMontant(totalPrevu)} prévu</Text>
                </View>
              </View>
              <View style={styles.grille2mini}>
                <View style={styles.mini}>
                  <Text style={styles.miniLabel}>Écart budget</Text>
                  <Text style={[styles.miniValeur, { color: ecart > 0 ? '#DC2626' : '#059669' }]}>{ecart > 0 ? '+' : ''}{formatMontant(ecart)}</Text>
                </View>
                <View style={styles.mini}>
                  <Text style={styles.miniLabel}>Coût / pintade</Text>
                  <Text style={styles.miniValeur}>{formatMontant(coutParPintade)}</Text>
                  <Text style={styles.carteSousTexte}>{totalPintades} vivantes</Text>
                </View>
              </View>
              <Text style={styles.sectionTitre}>Par catégorie</Text>
              {groupParCategorie().map(([cat, vals]) => {
                const pct = vals.prevu > 0 ? Math.round((vals.reel / vals.prevu) * 100) : 0;
                return (
                  <View style={styles.carte} key={cat}>
                    <View style={styles.ligneEntre}>
                      <Text style={styles.carteTitre}>{cat}</Text>
                      <Text style={[styles.pctTexte, pct > 100 && { color: '#DC2626' }]}>{pct}%</Text>
                    </View>
                    <View style={styles.progressFond}>
                      <View style={[styles.progressBarre, { width: `${Math.min(pct, 100)}%`, backgroundColor: pct > 100 ? '#F87171' : '#111827' }]} />
                    </View>
                    <View style={styles.ligneEntre}>
                      <Text style={styles.carteSousTexte}>Réel : {formatMontant(vals.reel)}</Text>
                      <Text style={styles.carteSousTexte}>Prévu : {formatMontant(vals.prevu)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {onglet === 'depenses' && (
            depenses.length === 0 ? <Text style={styles.vide}>Aucune dépense pour l'instant</Text> :
            categoriesUtilisees.map(cat => {
              const depensesCat = depenses.filter(d => d.categorie === cat);
              const totalPrevuCat = depensesCat.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
              const totalReelCat = depensesCat.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
              const ouverte = categorieOuverte === cat;
              return (
                <View style={styles.carteAccordeon} key={cat}>
                  <TouchableOpacity style={styles.accordeonHeader} onPress={() => setCategorieOuverte(ouverte ? null : cat)}>
                    <View>
                      <Text style={styles.carteTitre}>{cat}</Text>
                      <Text style={styles.carteSousTexte}>{depensesCat.length} dépense{depensesCat.length > 1 ? 's' : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.carteTitre}>{formatMontant(totalReelCat)}</Text>
                      <Text style={styles.carteSousTexte}>/ {formatMontant(totalPrevuCat)}</Text>
                    </View>
                  </TouchableOpacity>
                  {ouverte && depensesCat.map(depense => {
                    const badge = STATUTS[depense.statut] || STATUTS.planifiee;
                    const ecartLigne = (parseFloat(depense.montant_reel) || 0) - parseFloat(depense.montant_prevu || 0);
                    return (
                      <View style={styles.carteDepense} key={depense.id}>
                        <View style={styles.ligneEntre}>
                          <Text style={styles.carteTitre}>{depense.libelle}</Text>
                          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.carteSousTexte}>{depense.fournisseur}</Text>
                        <View style={styles.grille3mini}>
                          <View><Text style={styles.miniLabelPetit}>Prévu</Text><Text style={styles.miniValeurPetite}>{formatMontant(depense.montant_prevu)}</Text></View>
                          <View><Text style={styles.miniLabelPetit}>Réel</Text><Text style={styles.miniValeurPetite}>{formatMontant(depense.montant_reel || 0)}</Text></View>
                          <View><Text style={styles.miniLabelPetit}>Écart</Text><Text style={[styles.miniValeurPetite, { color: ecartLigne > 0 ? '#DC2626' : ecartLigne < 0 ? '#059669' : '#6B7280' }]}>{ecartLigne > 0 ? '+' : ''}{formatMontant(ecartLigne)}</Text></View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <TouchableOpacity style={styles.actionVerte} onPress={() => ouvrirHistorique(depense)}><Text style={styles.actionVerteTexte}>Historique</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.actionGrise} onPress={() => { setDepenseSelectionnee(depense); setForm({ libelle: depense.libelle, categorie: depense.categorie, montant_prevu: String(depense.montant_prevu || ''), montant_reel: String(depense.montant_reel || ''), statut: depense.statut, date_depense: depense.date_depense || '', fournisseur: depense.fournisseur || '', note: depense.note || '' }); setVue('modifier'); }}><Text style={styles.actionGriseTexte}>Modifier</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerDepense(depense)}><Text style={styles.actionRougeTexte}>🗑</Text></TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
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
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActif: { backgroundColor: '#111827' },
  chipTexte: { fontSize: 11, color: '#6B7280' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 12 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonVertPetit: { backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  optionLigne: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  optionLigneActive: { backgroundColor: '#F3F4F6' },
  optionTexte: { fontSize: 12, color: '#374151' },
  encartGris: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 10 },
  encartGrisLabel: { fontSize: 11, color: '#6B7280' },
  encartGrisValeur: { fontSize: 15, fontWeight: '600', color: '#111827' },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 20 },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 12 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 12 },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '600' },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  progressFondNoir: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressBarreBlanche: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  progressFond: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginVertical: 6, overflow: 'hidden' },
  progressBarre: { height: '100%', borderRadius: 3 },
  grille2mini: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  mini: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 },
  miniLabel: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  miniValeur: { fontSize: 15, fontWeight: '600', color: '#111827' },
  sectionTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 10 },
  pctTexte: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  alerteRouge: { flexDirection: 'row', backgroundColor: '#FEF2F2', borderWidth: 2, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 12 },
  alerteRougeTitre: { fontSize: 13, fontWeight: '600', color: '#B91C1C' },
  alerteRougeTexte: { fontSize: 11, color: '#DC2626', marginTop: 2 },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 14, marginTop: 8 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#111827' },
  ongletTexte: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  ongletTexteActif: { color: '#111827' },
  carteAccordeon: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', marginBottom: 8, overflow: 'hidden' },
  accordeonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  carteDepense: { backgroundColor: '#F9FAFB', margin: 8, borderRadius: 10, padding: 12 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  grille3mini: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  miniLabelPetit: { fontSize: 10, color: '#9CA3AF' },
  miniValeurPetite: { fontSize: 11, fontWeight: '600', color: '#111827' },
  actionVerte: { flex: 1, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  actionVerteTexte: { color: '#047857', fontSize: 10, fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 10, fontWeight: '600' },
  actionRouge: { paddingHorizontal: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, justifyContent: 'center' },
  actionRougeTexte: { fontSize: 12 },
});

export default GestionScreen;