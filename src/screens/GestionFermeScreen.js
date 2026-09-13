import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const getStatutBadge = (statut) => ({
  payee: { label: 'Payée', bg: '#ECFDF5', text: '#047857' },
  planifiee: { label: 'Planifiée', bg: '#F3F4F6', text: '#4B5563' },
  engagee: { label: 'Engagée', bg: '#EFF6FF', text: '#1D4ED8' },
  annulee: { label: 'Annulée', bg: '#FEF2F2', text: '#B91C1C' },
}[statut] || { label: statut, bg: '#F3F4F6', text: '#4B5563' });

// ---------- Vue détail du devis ----------
const VueDevis = ({ token, depense, onBack }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [nouvelleLigne, setNouvelleLigne] = useState({ libelle: '', montant_prevu: '' });
  const [ligneEnEdition, setLigneEnEdition] = useState(null);
  const [editValues, setEditValues] = useState({});

  const chargerLignes = async () => {
    try {
      const res = await api.get(`/depenses/${depense.uuid_id || depense.id}/lignes-devis`, { headers });
      setLignes(res.data);
    } catch (error) { console.log('Erreur lignes devis:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { chargerLignes(); }, []);

  const totalPrevu = lignes.reduce((s, l) => s + parseFloat(l.montant_prevu || 0), 0);
  const totalReel = lignes.reduce((s, l) => s + parseFloat(l.montant_reel || 0), 0);
  const ecartGlobal = totalReel - totalPrevu;

  const ajouterLigne = async () => {
    if (!nouvelleLigne.libelle || !nouvelleLigne.montant_prevu) return;
    try {
      await api.post(`/depenses/${depense.uuid_id || depense.id}/lignes-devis`, {
        libelle: nouvelleLigne.libelle, montant_prevu: parseFloat(nouvelleLigne.montant_prevu), ordre: lignes.length + 1,
      }, { headers });
      setNouvelleLigne({ libelle: '', montant_prevu: '' });
      chargerLignes();
    } catch (error) { console.log('Erreur ajout ligne:', error.message); }
  };

  const ajouterLigneImprevue = () => {
    Alert.prompt('Dépense imprévue', 'Libellé de la dépense imprévue :', async (libelle) => {
      if (!libelle) return;
      Alert.prompt('Dépense imprévue', 'Montant dépensé (F) :', async (montant) => {
        if (!montant) return;
        try {
          await api.post(`/depenses/${depense.uuid_id || depense.id}/lignes-devis`, {
            libelle, montant_prevu: 0, montant_reel: parseFloat(montant), ordre: lignes.length + 1,
            ajoutee_apres_coup: true, motif_ecart: 'depense_additionnelle',
          }, { headers });
          chargerLignes();
        } catch (error) { console.log('Erreur ligne imprévue:', error.message); }
      });
    });
  };

  const ouvrirEdition = (ligne) => {
    setLigneEnEdition(ligne.id);
    setEditValues({ montant_reel: String(ligne.montant_reel || ''), motif_ecart: ligne.motif_ecart || '', prix_marche_note: ligne.prix_marche_note || '' });
  };

  const enregistrerEdition = async (ligneId) => {
    try {
      await api.put(`/depenses/lignes-devis/${ligneId}`, {
        montant_reel: parseFloat(editValues.montant_reel) || 0,
        motif_ecart: editValues.motif_ecart || null,
        prix_marche_note: editValues.prix_marche_note || null,
      }, { headers });
      setLigneEnEdition(null);
      chargerLignes();
    } catch (error) { console.log('Erreur edition ligne:', error.message); }
  };

  const supprimerLigne = (ligneId) => {
    Alert.alert('Supprimer', 'Supprimer cette ligne ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/depenses/lignes-devis/${ligneId}`, { headers }); chargerLignes(); }
        catch (error) { console.log('Erreur suppression ligne:', error.message); }
      }},
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre={`Devis · ${depense.libelle}`} action={<TouchableOpacity onPress={onBack}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carteNoire}>
          <View style={styles.ligneEntre}><Text style={styles.carteNoireLabel}>Total prévu</Text><Text style={styles.carteNoireValeur}>{formatMontant(totalPrevu)}</Text></View>
          <View style={styles.ligneEntre}><Text style={styles.carteNoireLabel}>Total réel</Text><Text style={styles.carteNoireValeur}>{formatMontant(totalReel)}</Text></View>
          <View style={[styles.ligneEntre, styles.carteNoireSepare]}>
            <Text style={styles.carteNoireLabel}>Écart</Text>
            <Text style={[styles.carteNoireValeur, { color: ecartGlobal > 0 ? '#F87171' : '#4ADE80' }]}>{ecartGlobal > 0 ? '+' : ''}{formatMontant(ecartGlobal)}</Text>
          </View>
        </View>

        {chargement ? <ActivityIndicator style={{ marginTop: 20 }} color="#111827" /> : lignes.map(ligne => {
          const ecartLigne = parseFloat(ligne.montant_reel || 0) - parseFloat(ligne.montant_prevu || 0);
          const depassement = ecartLigne > 0;
          const enEdition = ligneEnEdition === ligne.id;
          return (
            <View key={ligne.id} style={styles.carte}>
              <View style={styles.ligneEntre}>
                <Text style={styles.carteTitre}>{ligne.libelle}</Text>
                {ligne.ajoutee_apres_coup && <View style={styles.badgeOrange}><Text style={styles.badgeOrangeTexte}>Imprévue</Text></View>}
              </View>
              <View style={[styles.ligneEntre, { marginTop: 4 }]}>
                <Text style={styles.carteSousTexte}>Prévu : {formatMontant(ligne.montant_prevu)}</Text>
                <Text style={styles.carteSousTexte}>Réel : {formatMontant(ligne.montant_reel)}</Text>
              </View>
              {depassement && ligne.motif_ecart && (
                <Text style={styles.motifEcart}>Dépassement : {ligne.motif_ecart === 'prix_marche' ? 'Prix du marché' : 'Dépense additionnelle'}{ligne.prix_marche_note ? ' — ' + ligne.prix_marche_note : ''}</Text>
              )}
              {enEdition ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.label}>Montant réel (F)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={editValues.montant_reel} onChangeText={v => setEditValues({ ...editValues, montant_reel: v })} />
                  {parseFloat(editValues.montant_reel || 0) > parseFloat(ligne.montant_prevu || 0) && (
                    <>
                      <Text style={styles.label}>Motif du dépassement</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['prix_marche', 'depense_additionnelle'].map(m => (
                          <TouchableOpacity key={m} onPress={() => setEditValues({ ...editValues, motif_ecart: m })} style={[styles.chipFlex, editValues.motif_ecart === m && styles.chipActif]}>
                            <Text style={[styles.chipTexte, editValues.motif_ecart === m && styles.chipTexteActif]}>{m === 'prix_marche' ? 'Prix du marché' : 'Dép. additionnelle'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {editValues.motif_ecart === 'prix_marche' && (
                        <TextInput style={[styles.champ, { height: 50, marginTop: 8 }]} multiline placeholder="Ex: Prix du sac de ciment passé de 5000 à 6500 F" value={editValues.prix_marche_note} onChangeText={v => setEditValues({ ...editValues, prix_marche_note: v })} />
                      )}
                    </>
                  )}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    <TouchableOpacity style={styles.actionNoire} onPress={() => enregistrerEdition(ligne.id)}><Text style={styles.actionNoireTexte}>Enregistrer</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionGrise} onPress={() => setLigneEnEdition(null)}><Text style={styles.actionGriseTexte}>Annuler</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  <TouchableOpacity style={styles.actionGrise} onPress={() => ouvrirEdition(ligne)}><Text style={styles.actionGriseTexte}>Saisir le réel</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerLigne(ligne.id)}><Text style={styles.actionRougeTexte}>🗑</Text></TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={styles.carte}>
          <Text style={styles.carteSousTexte}>Ajouter une ligne au devis</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            <TextInput style={[styles.champ, { flex: 1 }]} placeholder="Libellé" value={nouvelleLigne.libelle} onChangeText={v => setNouvelleLigne({ ...nouvelleLigne, libelle: v })} />
            <TextInput style={[styles.champ, { width: 90 }]} keyboardType="numeric" placeholder="Montant" value={nouvelleLigne.montant_prevu} onChangeText={v => setNouvelleLigne({ ...nouvelleLigne, montant_prevu: v })} />
          </View>
          <TouchableOpacity style={styles.actionNoire} onPress={ajouterLigne}><Text style={styles.actionNoireTexte}>+ Ajouter</Text></TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.boutonImprevue} onPress={ajouterLigneImprevue}>
          <Text style={styles.boutonImprevueTexte}>+ Signaler une dépense imprévue (non prévue au devis)</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

// ---------- Formulaire création / modification ----------
const FormDepenseFerme = ({ values, onChange, onSubmit, onCancel, titre, envoi, lignesDevis, setLignesDevis }) => {
  const totalPrevuDevis = lignesDevis.reduce((s, l) => s + (parseFloat(l.montant_prevu) || 0), 0);
  const ajouterLigne = () => setLignesDevis(prev => [...prev, { libelle: '', montant_prevu: '' }]);
  const modifierLigne = (i, champ, v) => setLignesDevis(prev => prev.map((l, idx) => idx === i ? { ...l, [champ]: v } : l));
  const supprimerLigne = (i) => setLignesDevis(prev => prev.filter((_, idx) => idx !== i));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre={titre} action={<TouchableOpacity onPress={onCancel}><Text style={styles.lienRetourPetit}>Annuler</Text></TouchableOpacity>} />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={styles.label}>Libellé</Text>
          <TextInput style={styles.champ} placeholder="Ex: Électricité, Construction enclos..." value={values.libelle} onChangeText={v => onChange('libelle', v)} />

          <Text style={styles.label}>Catégorie</Text>
          <TextInput style={styles.champ} placeholder="Ex: Infrastructure, Entretien..." value={values.categorie} onChangeText={v => onChange('categorie', v)} />
          <Text style={styles.aide}>Libre — tape ce qui décrit le mieux cette dépense.</Text>

          <Text style={styles.label}>Devis détaillé ?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.chipFlex, !values.a_devis && styles.chipActif]} onPress={() => onChange('a_devis', false)}>
              <Text style={[styles.chipTexte, !values.a_devis && styles.chipTexteActif]}>Non</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chipFlex, values.a_devis && styles.chipActif]} onPress={() => onChange('a_devis', true)}>
              <Text style={[styles.chipTexte, values.a_devis && styles.chipTexteActif]}>Oui</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aide}>{values.a_devis ? "Tu vas saisir un budget ligne par ligne ci-dessous. Le total se calcule automatiquement." : "Dépense simple, un seul montant global."}</Text>

          {values.a_devis ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Lignes du devis</Text>
              {lignesDevis.map((ligne, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <TextInput style={[styles.champ, { flex: 1 }]} placeholder="Ex: Ciment" value={ligne.libelle} onChangeText={v => modifierLigne(i, 'libelle', v)} />
                  <TextInput style={[styles.champ, { width: 80 }]} keyboardType="numeric" placeholder="0" value={ligne.montant_prevu} onChangeText={v => modifierLigne(i, 'montant_prevu', v)} />
                  <TouchableOpacity onPress={() => supprimerLigne(i)}><Text style={{ color: '#DC2626' }}>✕</Text></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.boutonGrisPetit} onPress={ajouterLigne}><Text style={styles.boutonGrisPetitTexte}>+ Ajouter une ligne</Text></TouchableOpacity>
              <View style={[styles.ligneEntre, { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
                <Text style={styles.carteSousTexte}>Total prévu</Text>
                <Text style={styles.carteTitre}>{formatMontant(totalPrevuDevis)}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Montant prévu (F)</Text>
                <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={values.montant_prevu} onChangeText={v => onChange('montant_prevu', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Montant réel (F)</Text>
                <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={values.montant_reel} onChangeText={v => onChange('montant_reel', v)} />
              </View>
            </View>
          )}

          <Text style={styles.label}>Statut</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['planifiee', 'engagee', 'payee', 'annulee'].map(s => (
              <TouchableOpacity key={s} onPress={() => onChange('statut', s)} style={[styles.chip, values.statut === s && styles.chipActif]}>
                <Text style={[styles.chipTexte, values.statut === s && styles.chipTexteActif]}>{getStatutBadge(s).label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Nature de la dépense</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.chipFlex, (values.nature || 'achat') === 'achat' && styles.chipActif]} onPress={() => onChange('multiple', { nature: 'achat', avancement_pourcentage: 0 })}>
              <Text style={[styles.chipTexte, (values.nature || 'achat') === 'achat' && styles.chipTexteActif]}>Achat simple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chipFlex, values.nature === 'chantier' && styles.chipActif]} onPress={() => onChange('nature', 'chantier')}>
              <Text style={[styles.chipTexte, values.nature === 'chantier' && styles.chipTexteActif]}>Chantier en cours</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aide}>{values.nature === 'chantier' ? "Un chantier suit un avancement progressif." : "Un achat simple n'a pas de progression à suivre."}</Text>

          {values.nature === 'chantier' && (
            <View>
              <Text style={styles.label}>Avancement du chantier ({values.avancement_pourcentage || 0}%)</Text>
              <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
                {[0, 25, 50, 75, 100].map(v => (
                  <TouchableOpacity key={v} onPress={() => onChange('avancement_pourcentage', v)} style={[styles.chip, values.avancement_pourcentage === v && styles.chipActif]}>
                    <Text style={[styles.chipTexte, values.avancement_pourcentage === v && styles.chipTexteActif]}>{v}%</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.label}>Date</Text>
          <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={values.date_depense} onChangeText={v => onChange('date_depense', v)} />

          <Text style={styles.label}>Fournisseur</Text>
          <TextInput style={styles.champ} placeholder="Nom du fournisseur" value={values.fournisseur} onChangeText={v => onChange('fournisseur', v)} />

          <Text style={styles.label}>Note</Text>
          <TextInput style={[styles.champ, { height: 60 }]} multiline placeholder="Informations complémentaires..." value={values.note} onChangeText={v => onChange('note', v)} />
        </View>

        <TouchableOpacity style={styles.boutonPrincipal} onPress={onSubmit} disabled={envoi}>
          <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonSecondaire} onPress={onCancel}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ---------- Page principale ----------
const videForm = { libelle: '', categorie: '', montant_prevu: '', montant_reel: '', statut: 'planifiee', date_depense: '', fournisseur: '', note: '', avancement_pourcentage: 0, a_devis: false, nature: 'achat' };

const GestionFermeScreen = ({ token, projetActifId }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [depenses, setDepenses] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [depenseSelectionnee, setDepenseSelectionnee] = useState(null);
  const [depensePourDevis, setDepensePourDevis] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [filtreCategorie, setFiltreCategorie] = useState('Toutes');
  const [lignesDevis, setLignesDevis] = useState([]);
  const [form, setForm] = useState(videForm);
  const [editForm, setEditForm] = useState(videForm);

  const chargerDonnees = async () => {
    try {
      const res = await api.get(`/depenses?projet_id=${projetActifId}`, { headers });
      setDepenses(res.data.filter(d => d.type_depense === 'ferme'));
    } catch (error) { console.log('Erreur dépenses ferme:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { if (projetActifId) chargerDonnees(); }, [projetActifId]);

  const ouvrirEdit = (depense) => {
    setDepenseSelectionnee(depense);
    setEditForm({
      libelle: depense.libelle || '', categorie: depense.categorie || '', montant_prevu: String(depense.montant_prevu || ''),
      montant_reel: String(depense.montant_reel || ''), statut: depense.statut || 'planifiee',
      date_depense: depense.date_depense ? depense.date_depense.split('T')[0] : '', fournisseur: depense.fournisseur || '', note: depense.note || '',
      avancement_pourcentage: depense.avancement_pourcentage || 0, a_devis: depense.a_devis || false,
      nature: (depense.avancement_pourcentage > 0) ? 'chantier' : 'achat',
    });
    setShowEditForm(true);
  };

  const supprimerDepense = (id) => {
    Alert.alert('Supprimer', 'Supprimer cette dépense ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/depenses/${id}`, { headers }); chargerDonnees(); }
        catch (error) { console.log('Erreur suppression:', error.message); }
      }},
    ]);
  };

  const soumettre = async () => {
    setEnvoi(true);
    try {
      const res = await api.post('/depenses', { ...form, type_depense: 'ferme', projet_id: projetActifId }, { headers });
      const nouvelleDepenseId = res.data.uuid_id || res.data.id;
      if (form.a_devis && lignesDevis.length > 0) {
        for (let i = 0; i < lignesDevis.length; i++) {
          const ligne = lignesDevis[i];
          if (!ligne.libelle || !ligne.montant_prevu) continue;
          await api.post(`/depenses/${nouvelleDepenseId}/lignes-devis`, { libelle: ligne.libelle, montant_prevu: parseFloat(ligne.montant_prevu), ordre: i + 1 }, { headers });
        }
      }
      setShowForm(false); setForm(videForm); setLignesDevis([]);
      chargerDonnees();
    } catch (error) { console.log('Erreur création:', error.message); }
    finally { setEnvoi(false); }
  };

  const soumettreEdit = async () => {
    setEnvoi(true);
    try {
      await api.put(`/depenses/${depenseSelectionnee.uuid_id || depenseSelectionnee.id}`, { ...editForm, type_depense: 'ferme' }, { headers });
      setShowEditForm(false);
      chargerDonnees();
    } catch (error) { console.log('Erreur édition:', error.message); }
    finally { setEnvoi(false); }
  };

  const totalPrevu = depenses.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);
  const ecart = totalReel - totalPrevu;
  const categories = ['Toutes', ...new Set(depenses.map(d => d.categorie || 'Autre'))];
  const depensesFiltrees = filtreCategorie === 'Toutes' ? depenses : depenses.filter(d => d.categorie === filtreCategorie);

  if (depensePourDevis) {
    return <VueDevis token={token} depense={depensePourDevis} onBack={() => { setDepensePourDevis(null); chargerDonnees(); }} />;
  }
  if (showForm) {
    return <FormDepenseFerme values={form} onChange={(champ, v) => champ === 'multiple' ? setForm({ ...form, ...v }) : setForm({ ...form, [champ]: v })} onSubmit={soumettre}
      onCancel={() => { setShowForm(false); setLignesDevis([]); }} titre="Nouvelle dépense · Ferme" envoi={envoi}
      lignesDevis={lignesDevis} setLignesDevis={setLignesDevis} />;
  }
  if (showEditForm && depenseSelectionnee) {
    return <FormDepenseFerme values={editForm} onChange={(champ, v) => champ === 'multiple' ? setEditForm({ ...editForm, ...v }) : setEditForm({ ...editForm, [champ]: v })} onSubmit={soumettreEdit}
      onCancel={() => setShowEditForm(false)} titre={`Modifier · ${depenseSelectionnee.libelle}`} envoi={envoi}
      lignesDevis={[]} setLignesDevis={() => {}} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Dépenses Ferme" sousTitre="Frais généraux · Associés" sansRetour
        action={<TouchableOpacity style={styles.boutonPetit} onPress={() => setShowForm(true)}><Text style={styles.boutonPetitTexte}>+ Dépense</Text></TouchableOpacity>} />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabelSeul}>Total dépensé (ferme)</Text>
            <Text style={styles.carteNoireMontant}>{formatMontant(totalReel)}</Text>
            <View style={[styles.ligneEntre, { marginTop: 8 }]}>
              <Text style={styles.carteNoireLabel}>Prévu : {formatMontant(totalPrevu)}</Text>
              <Text style={[styles.carteNoireLabel, { color: ecart > 0 ? '#F87171' : '#4ADE80' }]}>Écart : {ecart > 0 ? '+' : ''}{formatMontant(ecart)}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {categories.map(cat => (
              <TouchableOpacity key={cat} onPress={() => setFiltreCategorie(cat)} style={[styles.chip, filtreCategorie === cat && styles.chipActif]}>
                <Text style={[styles.chipTexte, filtreCategorie === cat && styles.chipTexteActif]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.compteur}>{depensesFiltrees.length} dépense{depensesFiltrees.length > 1 ? 's' : ''}</Text>

          {depensesFiltrees.length === 0 ? <Text style={styles.vide}>Aucune dépense de ferme pour l'instant</Text> : depensesFiltrees.map(depense => {
            const badge = getStatutBadge(depense.statut);
            const ecartLigne = (parseFloat(depense.montant_reel) || 0) - parseFloat(depense.montant_prevu || 0);
            const avancement = depense.avancement_pourcentage || 0;
            return (
              <View key={depense.id} style={styles.carte}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{depense.libelle}</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {depense.a_devis && <View style={styles.badgeIndigo}><Text style={styles.badgeIndigoTexte}>Devis</Text></View>}
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text></View>
                  </View>
                </View>
                <Text style={styles.carteSousTexte}>{depense.categorie}{depense.fournisseur ? ' · ' + depense.fournisseur : ''}{depense.date_depense ? ' · ' + new Date(depense.date_depense).toLocaleDateString('fr-FR') : ''}</Text>
                <View style={styles.grille3}>
                  <View><Text style={styles.miniLabel}>Prévu</Text><Text style={styles.miniValeur}>{formatMontant(depense.montant_prevu)}</Text></View>
                  <View><Text style={styles.miniLabel}>Réel</Text><Text style={styles.miniValeur}>{formatMontant(depense.montant_reel || 0)}</Text></View>
                  <View><Text style={styles.miniLabel}>Écart</Text><Text style={[styles.miniValeur, { color: ecartLigne > 0 ? '#DC2626' : ecartLigne < 0 ? '#059669' : '#6B7280' }]}>{ecartLigne > 0 ? '+' : ''}{formatMontant(ecartLigne)}</Text></View>
                </View>
                {avancement > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <View style={styles.ligneEntre}><Text style={styles.miniLabel}>Avancement chantier</Text><Text style={styles.miniLabel}>{avancement}%</Text></View>
                    <View style={styles.barreFond}><View style={[styles.barreRemplie, { width: `${Math.min(avancement, 100)}%` }]} /></View>
                  </View>
                )}
                {depense.note && <Text style={styles.note}>{depense.note}</Text>}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {depense.a_devis && <TouchableOpacity style={styles.actionIndigo} onPress={() => setDepensePourDevis(depense)}><Text style={styles.actionIndigoTexte}>Voir le devis</Text></TouchableOpacity>}
                  <TouchableOpacity style={styles.actionGrise} onPress={() => ouvrirEdit(depense)}><Text style={styles.actionGriseTexte}>Modifier</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerDepense(depense.uuid_id || depense.id)}><Text style={styles.actionRougeTexte}>🗑</Text></TouchableOpacity>
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
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 11, color: '#6B7280', marginTop: 4, marginBottom: 8 },
  compteur: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 30 },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 12 },
  carteNoireLabelSeul: { color: '#9CA3AF', fontSize: 11 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 11 },
  carteNoireValeur: { color: '#fff', fontSize: 13, fontWeight: '600' },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '600' },
  carteNoireSepare: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', marginRight: 6 },
  chipFlex: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  chipActif: { backgroundColor: '#111827', borderColor: '#111827' },
  chipTexte: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  chipTexteActif: { color: '#fff' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  badgeIndigo: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeIndigoTexte: { color: '#4338CA', fontSize: 10, fontWeight: '600' },
  badgeOrange: { backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeOrangeTexte: { color: '#C2410C', fontSize: 10, fontWeight: '600' },
  grille3: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  miniLabel: { fontSize: 10, color: '#9CA3AF' },
  miniValeur: { fontSize: 11, fontWeight: '600', color: '#111827' },
  barreFond: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  barreRemplie: { height: '100%', backgroundColor: '#111827', borderRadius: 3 },
  note: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 8 },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  actionRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  actionRougeTexte: { fontSize: 12 },
  actionIndigo: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionIndigoTexte: { color: '#4338CA', fontSize: 11, fontWeight: '600' },
  actionNoire: { backgroundColor: '#111827', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8, flex: 1 },
  actionNoireTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  boutonGrisPetit: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 6 },
  boutonGrisPetitTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  aide: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  motifEcart: { fontSize: 11, color: '#DC2626', marginBottom: 6 },
  lienRetourPetit: { color: '#6B7280', fontSize: 11 },
  boutonImprevue: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  boutonImprevueTexte: { color: '#C2410C', fontSize: 12, fontWeight: '600' },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default GestionFermeScreen;