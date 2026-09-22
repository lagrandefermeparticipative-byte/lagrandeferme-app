import React, { useState, useEffect, useRef } from 'react';
import { useCache } from '../context/CacheContext';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const BADGES = {
  demarrage: { label: 'Démarrage', bg: '#EFF6FF', text: '#1D4ED8' },
  croissance: { label: 'Croissance', bg: '#FFF7ED', text: '#C2410C' },
  finition: { label: 'Finition', bg: '#ECFDF5', text: '#047857' },
  vente: { label: 'Vente', bg: '#F5F3FF', text: '#6D28D9' },
};

const ElevageScreen = ({ token, projetActifId }) => {
    const { getCache, setCache } = useCache();
  const headers = { Authorization: `Bearer ${token}` };
  const [lots, setLots] = useState([]);
  const [projet, setProjet] = useState(null);
  const [mortalites, setMortalites] = useState([]);
  const [chargement, setChargement] = useState(getCache(`elevage_${projetActifId}`) ? false : true);
  const [vue, setVue] = useState('liste'); // liste | nouveau | modifier | mortalite | historique
  const [lotSelectionne, setLotSelectionne] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const [form, setForm] = useState({
    nom: '', date_arrivee: new Date().toISOString().split('T')[0], fournisseur: '',
    quantite_initiale: '', prix_unitaire: '1000', enclos: 'Enclos A',
    transport_type: 'Livraison fournisseur', transport_cout: '0', etat_sanitaire: 'Bon état', observations: '',
  });
  const ENCLOS_OPTIONS = ['Enclos A', 'Enclos B', 'Enclos C', 'Enclos D'];
  const TRANSPORT_OPTIONS = ['Livraison fournisseur', 'Nous sommes allés chercher'];
  const ETAT_SANITAIRE_OPTIONS = ['Bon état', 'Quelques sujets faibles', 'Problème détecté'];
  const [editForm, setEditForm] = useState({ males: '', femelles: '', enclos: '', observations: '' });
  const [mortForm, setMortForm] = useState({ nombre: '', cause: 'Inconnue', observations: '' });
  const [reproForm, setReproForm] = useState({ nombre_sujets: '', note: '' });
  const [tousProjets, setTousProjets] = useState([]);
  const [erreurProjets, setErreurProjets] = useState('');
  const [transfertForm, setTransfertForm] = useState({
    projet_destination_id: '', males_transferes: '', femelles_transferes: '',
    valorise: false, valeur: '', acheteur_note: '',
  });
  const [sexageForm, setSexageForm] = useState({ males: '', femelles: '' });

  useEffect(() => {
    api.get('/projets', { headers }).then(res => setTousProjets(res.data))
      .catch(() => { setTousProjets([]); setErreurProjets('Impossible de charger les projets — vérifie ta connexion.'); });
  }, []);
  const charger = async (forcer = false) => {
    const cleCache = `elevage_${projetActifId}`;
    if (!forcer) {
      const cache = getCache(cleCache);
      if (cache) {
        setLots(cache.lots);
        setProjet(cache.projet);
        setChargement(false);
        return;
      }
    }
    try {
      const [lotsRes, projetRes] = await Promise.all([
        api.get(`/lots?projet_id=${projetActifId}`, { headers }),
        api.get(`/projets/${projetActifId}`, { headers }),
      ]);
      setLots(lotsRes.data);
      setProjet(projetRes.data);
      setCache(cleCache, { lots: lotsRes.data, projet: projetRes.data });
    } catch (error) {
      console.log("Erreur élevage:", error.message);
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => {
    if (projetActifId) charger();
  }, [projetActifId]);

  const chargerMortalites = async (lotId) => {
    try {
      const res = await api.get(`/lots/${lotId}/mortalites`, { headers });
      setMortalites(res.data);
    } catch (error) { console.log('Erreur mortalités:', error.message); }
  };

  const creerLot = async () => {
    if (!form.nom || !form.quantite_initiale) { setErreur('Nom et quantité sont obligatoires.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/lots', { ...form, projet_id: projetActifId, quantite_initiale: parseInt(form.quantite_initiale), prix_unitaire: parseFloat(form.prix_unitaire), transport_cout: parseFloat(form.transport_cout) }, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerModification = async () => {
    setEnvoi(true); setErreur('');
    try {
      await api.put(`/lots/${lotSelectionne.uuid_id || lotSelectionne.id}`, editForm, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerMortalite = async () => {
    if (!mortForm.nombre) { setErreur('Nombre requis.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/lots/mortalites', { ...mortForm, nombre: parseInt(mortForm.nombre), lot_id: lotSelectionne.uuid_id || lotSelectionne.id, date_mortalite: new Date().toISOString().split('T')[0] }, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const extraireReproducteurs = async () => {
    if (!reproForm.nombre_sujets) { setErreur('Nombre requis.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post(`/lots/${lotSelectionne.uuid_id || lotSelectionne.id}/reproducteurs`, {
        nombre_sujets: parseInt(reproForm.nombre_sujets), note: reproForm.note,
      }, { headers });
      setVue('liste'); charger(true);
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur.'); }
    finally { setEnvoi(false); }
  };

  const soumettreTransfert = async () => {
    const malesNum = parseInt(transfertForm.males_transferes) || 0;
    const femellesNum = parseInt(transfertForm.femelles_transferes) || 0;
    if (!transfertForm.projet_destination_id) { setErreur('Choisis le projet de destination.'); return; }
    if (malesNum + femellesNum <= 0) { setErreur('Indique au moins un sujet à transférer.'); return; }
    if (transfertForm.valorise && (!transfertForm.valeur || parseFloat(transfertForm.valeur) <= 0)) { setErreur('Une valeur positive est requise pour un transfert valorisé.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post(`/lots/${lotSelectionne.uuid_id || lotSelectionne.id}/transferer`, {
        ...transfertForm, males_transferes: malesNum, femelles_transferes: femellesNum,
        valeur: transfertForm.valorise ? parseFloat(transfertForm.valeur) : null,
      }, { headers });
      setVue('liste'); charger(true);
      Alert.alert('Transfert effectué', 'Le lot a bien été transféré.');
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors du transfert.'); }
    finally { setEnvoi(false); }
  };

  const soumettreSexage = async () => {
    const malesNum = parseInt(sexageForm.males) || 0;
    const femellesNum = parseInt(sexageForm.femelles) || 0;
    if (malesNum + femellesNum <= 0) { setErreur('Indique au moins un sujet.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.put(`/lots/${lotSelectionne.uuid_id || lotSelectionne.id}/sexer`, { males: malesNum, femelles: femellesNum }, { headers });
      setVue('liste'); charger(true);
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors du sexage.'); }
    finally { setEnvoi(false); }
  };

  const activerVente = (lot) => {
    Alert.alert('Activer la vente', `Activer la vente pour "${lot.nom}" ? Cette action est définitive.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Activer', onPress: async () => {
        try { await api.put(`/lots/${lot.uuid_id || lot.id}/activer-vente`, {}, { headers }); charger(true); }
        catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Activation impossible.'); }
      }},
    ]);
  };

  const supprimerLot = (lot) => {
    Alert.alert('Supprimer', `Supprimer ${lot.nom} ? Action irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/lots/${lot.uuid_id || lot.id}`, { headers }); charger(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  const totalRecus = lots.reduce((s, l) => s + parseInt(l.quantite_initiale || 0), 0);
  const totalVivants = lots.reduce((s, l) => s + parseInt(l.vivants || l.quantite_initiale || 0), 0);
  const totalMorts = lots.reduce((s, l) => s + parseInt(l.total_morts || 0), 0);
  const totalVendus = lots.reduce((s, l) => s + parseInt(l.total_vendus || 0), 0);
  const tauxSurvie = totalRecus > 0 ? ((totalVivants / totalRecus) * 100).toFixed(1) : 100;
  const objectif = projet?.objectif_sujets || 1000;
  const progression = Math.round((totalRecus / objectif) * 100);
  const projetEntierementVendu = lots.length > 0 && totalVivants === 0 && totalVendus > 0 && totalVendus === totalRecus;

  // --- VUE HISTORIQUE ---
  if (vue === 'historique' && lotSelectionne) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre={`Historique · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteNoire}>
            <Text style={styles.carteNoireLabel}>Total morts</Text>
            <Text style={styles.carteNoireMontant}>{lotSelectionne.total_morts || 0}</Text>
            <Text style={styles.carteNoireSousLabel}>Taux survie : {lotSelectionne.taux_survie || 100}% · {parseInt(lotSelectionne.vivants || lotSelectionne.quantite_initiale)} vivants</Text>
          </View>
          {mortalites.length === 0 ? <Text style={styles.vide}>Aucune mortalité enregistrée</Text> : mortalites.map(m => (
            <View style={styles.carte} key={m.id}>
              <View style={styles.ligneEntre}>
                <Text style={styles.mortTitre}>-{m.nombre} mort{m.nombre > 1 ? 's' : ''}</Text>
                <Text style={styles.carteSousTexte}>{new Date(m.date_mortalite).toLocaleDateString('fr-FR')}</Text>
              </View>
              <Text style={styles.carteSousTexte}>Cause : {m.cause}</Text>
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

  // --- VUE MORTALITÉ ---
  if (vue === 'mortalite' && lotSelectionne) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Mortalité · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.alerteRouge}>
            <Text style={styles.alerteRougeTexte}>Effectif actuel : {parseInt(lotSelectionne.vivants || lotSelectionne.quantite_initiale)} vivants</Text>
          </View>
          <View style={styles.carte}>
            <Text style={styles.label}>Nombre de morts *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={mortForm.nombre} onChangeText={v => setMortForm({ ...mortForm, nombre: v })} />
            <Text style={styles.label}>Cause</Text>
            <TextInput style={styles.champ} value={mortForm.cause} onChangeText={v => setMortForm({ ...mortForm, cause: v })} placeholder="Maladie, prédateur, accident..." />
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={mortForm.observations} onChangeText={v => setMortForm({ ...mortForm, observations: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonRouge} onPress={enregistrerMortalite} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer la mortalité'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE EXTRACTION REPRODUCTEURS ---
  if (vue === 'reproducteurs' && lotSelectionne) {
    const dispo = parseInt(lotSelectionne.vivants || lotSelectionne.quantite_initiale);
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Extraire des reproducteurs · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.alerteOrangeLegere}>
            <Text style={styles.alerteOrangeLegereTexte}>{dispo} sujets disponibles dans ce lot avant cette extraction</Text>
          </View>
          <View style={styles.carte}>
            <Text style={styles.label}>Nombre de sujets à extraire *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={reproForm.nombre_sujets} onChangeText={v => setReproForm({ ...reproForm, nombre_sujets: v })} />
            <Text style={styles.label}>Note (optionnel)</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={reproForm.note} onChangeText={v => setReproForm({ ...reproForm, note: v })} placeholder="Ex: reproducteurs pour la prochaine génération..." />
            <Text style={styles.infoTexte}>Ces sujets quittent définitivement le pool disponible à la vente de ce lot, même s'ils changent de statut plus tard.</Text>
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonOrangeGrand} onPress={extraireReproducteurs} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Extraire les reproducteurs'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE TRANSFÉRER ---
  if (vue === 'transfert' && lotSelectionne) {
    const vivantsLot = parseInt(lotSelectionne.vivants || lotSelectionne.quantite_initiale);
    const totalTransfere = (parseInt(transfertForm.males_transferes) || 0) + (parseInt(transfertForm.femelles_transferes) || 0);
    const projetsDestination = tousProjets.filter(p => (p.uuid_id || p.id) !== projetActifId);
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Transférer · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.alerteOrangeLegere}>
            <Text style={styles.alerteOrangeLegereTexte}>{vivantsLot} sujets disponibles dans ce lot avant ce transfert</Text>
          </View>
          <View style={styles.carte}>
            <Text style={styles.label}>Projet de destination *</Text>
            {erreurProjets !== '' && <Text style={styles.erreurTexte}>{erreurProjets}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {projetsDestination.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setTransfertForm({ ...transfertForm, projet_destination_id: p.uuid_id || p.id })}
                  style={[styles.chip, transfertForm.projet_destination_id === (p.uuid_id || p.id) && styles.chipActif, { marginRight: 6, marginBottom: 6 }]}>
                  <Text style={[styles.chipTexte, transfertForm.projet_destination_id === (p.uuid_id || p.id) && styles.chipTexteActif]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Mâles à transférer</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={transfertForm.males_transferes} onChangeText={v => setTransfertForm({ ...transfertForm, males_transferes: v })} />
            <Text style={styles.label}>Femelles à transférer</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={transfertForm.femelles_transferes} onChangeText={v => setTransfertForm({ ...transfertForm, femelles_transferes: v })} />
            <TouchableOpacity style={styles.ligneCheckboxTransfert} onPress={() => setTransfertForm({ ...transfertForm, valorise: !transfertForm.valorise })}>
              <View style={[styles.checkbox, transfertForm.valorise && styles.checkboxCoche]}>{transfertForm.valorise && <Text style={styles.checkboxTexte}>✓</Text>}</View>
              <Text style={styles.checkboxLabel}>Valoriser ce transfert (le projet de destination a d'autres investisseurs)</Text>
            </TouchableOpacity>
            {transfertForm.valorise && (
              <View>
                <Text style={styles.label}>Valeur du transfert (F) *</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={transfertForm.valeur} onChangeText={v => setTransfertForm({ ...transfertForm, valeur: v })} />
                <Text style={styles.infoTexte}>Enregistré comme une vente payée pour ce projet, et comme un achat de sujets pour le projet de destination.</Text>
              </View>
            )}
          </View>
          {totalTransfere > vivantsLot && (
            <View style={styles.alerteOrangeLegere}>
              <Text style={styles.alerteOrangeLegereTexte}>⚠️ Tu essaies de transférer {totalTransfere} sujets mais ce lot n'en a que {vivantsLot} de disponibles.</Text>
            </View>
          )}
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreTransfert} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Transférer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE SEXAGE ---
  if (vue === 'sexage' && lotSelectionne) {
    const vivantsLot = parseInt(lotSelectionne.vivants || lotSelectionne.quantite_initiale);
    const totalSexe = (parseInt(sexageForm.males) || 0) + (parseInt(sexageForm.femelles) || 0);
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Sexer · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.alerteOrangeLegere}>
            <Text style={styles.alerteOrangeLegereTexte}>{vivantsLot} sujets vivants dans ce lot — le total mâles + femelles doit correspondre exactement à ce nombre.</Text>
          </View>
          <View style={styles.carte}>
            <Text style={styles.label}>Mâles *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={sexageForm.males} onChangeText={v => setSexageForm({ ...sexageForm, males: v })} />
            <Text style={styles.label}>Femelles *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={sexageForm.femelles} onChangeText={v => setSexageForm({ ...sexageForm, femelles: v })} />
            <Text style={styles.infoTexte}>Total saisi : {totalSexe} {totalSexe !== vivantsLot ? `(devrait être ${vivantsLot})` : '✓'}</Text>
            <Text style={styles.infoTexte}>Une fois enregistré, le sexage de ce lot est définitif et ne pourra plus être refait.</Text>
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonViolet} onPress={soumettreSexage} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer le sexage'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE MODIFIER ---
  if (vue === 'modifier' && lotSelectionne) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Modifier · ${lotSelectionne.nom}`} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <View style={styles.alerteInfo}>
              <Text style={styles.alerteInfoTexte}>Phase actuelle : {BADGES[lotSelectionne.phase_calculee]?.label || 'Démarrage'}</Text>
              <Text style={styles.infoTexte}>Calculée automatiquement depuis la date d'arrivée et les durées du projet — plus modifiable à la main.</Text>
            </View>
            <Text style={styles.label}>Mâles</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={editForm.males} onChangeText={v => setEditForm({ ...editForm, males: v })} />
            <Text style={styles.label}>Femelles</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={editForm.femelles} onChangeText={v => setEditForm({ ...editForm, femelles: v })} />
            <Text style={styles.label}>Enclos</Text>
            <TextInput style={styles.champ} value={editForm.enclos} onChangeText={v => setEditForm({ ...editForm, enclos: v })} />
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={editForm.observations} onChangeText={v => setEditForm({ ...editForm, observations: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerModification} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer les modifications'}</Text>
          </TouchableOpacity>
          <View style={styles.zoneDanger}>
            <Text style={styles.zoneDangerLabel}>Zone de danger</Text>
            <TouchableOpacity style={styles.boutonSupprimer} onPress={() => { setVue('liste'); supprimerLot(lotSelectionne); }}>
              <Text style={styles.boutonSupprimerTexte}>Supprimer ce lot</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE NOUVEAU LOT ---
  if (vue === 'nouveau') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouveau lot" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom du lot *</Text>
            <TextInput style={styles.champ} placeholder="Ex: Lot 5" value={form.nom} onChangeText={v => setForm({ ...form, nom: v })} />
            <Text style={styles.label}>Fournisseur</Text>
            <TextInput style={styles.champ} value={form.fournisseur} onChangeText={v => setForm({ ...form, fournisseur: v })} />
            <Text style={styles.label}>Quantité totale *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={form.quantite_initiale} onChangeText={v => setForm({ ...form, quantite_initiale: v })} />
            <Text style={styles.label}>Prix unitaire (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={form.prix_unitaire} onChangeText={v => setForm({ ...form, prix_unitaire: v })} />
            <Text style={styles.label}>Enclos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ENCLOS_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setForm({ ...form, enclos: opt })}
                  style={[styles.chip, form.enclos === opt && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.enclos === opt && styles.chipTexteActif]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Transport</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TRANSPORT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setForm({ ...form, transport_type: opt })}
                  style={[styles.chip, form.transport_type === opt && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.transport_type === opt && styles.chipTexteActif]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Coût transport (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={form.transport_cout} onChangeText={v => setForm({ ...form, transport_cout: v })} />
            <Text style={styles.label}>État sanitaire à l'arrivée</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {ETAT_SANITAIRE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setForm({ ...form, etat_sanitaire: opt })}
                  style={[styles.chip, form.etat_sanitaire === opt && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.etat_sanitaire === opt && styles.chipTexteActif]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={form.observations} onChangeText={v => setForm({ ...form, observations: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={creerLot} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer le lot'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE LISTE (par défaut) ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Elevage" sousTitre={`${totalVivants} vivants / ${totalRecus} reçus`}
        avecSelecteurProjet
        action={
          <TouchableOpacity style={styles.boutonPetit} onPress={() => { setForm({ ...form, nom: '', quantite_initiale: '' }); setVue('nouveau'); }}>
            <Text style={styles.boutonPetitTexte}>+ Lot</Text>
          </TouchableOpacity>
        }
      />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <View style={styles.ligneEntre}>
              <Text style={styles.progressLabel}>Objectif {objectif} sujets</Text>
              <Text style={styles.progressLabel}>{totalRecus} reçus · {progression}%</Text>
            </View>
            <View style={styles.progressFond}>
              <View style={[styles.progressBarre, { width: `${Math.min(progression, 100)}%` }]} />
            </View>
          </View>

          <View style={styles.grille3}>
            <View style={styles.stat}><Text style={styles.statChiffre}>{totalRecus}</Text><Text style={styles.statLabel}>Reçus</Text></View>
            <View style={styles.stat}><Text style={[styles.statChiffre, { color: '#DC2626' }]}>{totalMorts}</Text><Text style={styles.statLabel}>Morts</Text></View>
            <View style={styles.stat}><Text style={styles.statChiffre}>{totalVivants}</Text><Text style={styles.statLabel}>Vivants</Text></View>
            <View style={styles.stat}><Text style={[styles.statChiffre, { color: tauxSurvie >= 90 ? '#059669' : '#EA580C' }]}>{tauxSurvie}%</Text><Text style={styles.statLabel}>Survie</Text></View>
          </View>

          {projetEntierementVendu && (
            <View style={styles.bandeauViolet}>
              <Text style={styles.bandeauVioletTexte}>🎉 Tous les sujets de ce projet ont été vendus.</Text>
            </View>
          )}

          <Text style={styles.sectionTitre}>{lots.length} lot{lots.length > 1 ? 's' : ''} actif{lots.length > 1 ? 's' : ''}</Text>

          {lots.length === 0 ? (
            <View style={styles.videCarte}>
              <Text style={styles.vide}>Aucun lot enregistré</Text>
              <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('nouveau')}>
                <Text style={styles.boutonPrincipalTexte}>Ajouter un lot</Text>
              </TouchableOpacity>
            </View>
          ) : lots.map(lot => {
            const vivants = parseInt(lot.vivants || lot.quantite_initiale);
            const morts = parseInt(lot.total_morts || 0);
            const vendus = parseInt(lot.total_vendus || 0);
            const reproducteurs = parseInt(lot.total_reproduction || 0);
            const survie = lot.taux_survie || 100;
            const epuise = vivants <= 0;
            let badge;
            if (epuise) {
              const toutVendu = vendus > 0 && morts === 0 && reproducteurs === 0;
              badge = toutVendu ? { label: 'Entièrement vendu', bg: '#F5F3FF', text: '#6D28D9' } : { label: 'Cheptel épuisé', bg: '#E5E5EA', text: '#374151' };
            } else {
              badge = BADGES[lot.phase_calculee] || BADGES.demarrage;
            }
            const peutActiverVente = !epuise && lot.phase_calculee === 'finition' && !lot.vente_activee;
            const especeSexageDifferable = ['Pintade', 'Poulet de chair', 'Dinde', 'Canard'].includes(projet?.type_volaille);
            const peutSexer = especeSexageDifferable && !epuise && lot.phase_calculee !== 'demarrage' && !lot.date_sexage;
            return (
              <View style={styles.carteLot} key={lot.id}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{lot.nom}</Text>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>
                {epuise && (
                  <Text style={styles.carteSousTexte}>
                    {vendus} vendu{vendus > 1 ? 's' : ''}
                    {reproducteurs > 0 ? ` · ${reproducteurs} en reproduction` : ''}
                    {morts > 0 ? ` · ${morts} mort${morts > 1 ? 's' : ''}` : ''}
                  </Text>
                )}
                <Text style={styles.carteSousTexte}>{new Date(lot.date_arrivee).toLocaleDateString('fr-FR')} · {lot.fournisseur} · {lot.enclos}</Text>
                <Text style={styles.italique}>{lot.origine_lot === 'reproduction_interne' ? '🐣 Né sur la ferme' : lot.origine_lot === 'autre' ? 'Autre origine' : '🛒 Acheté'}</Text>

                {(lot.date_sexage || lot.males > 0 || lot.femelles > 0) ? (
                  <Text style={styles.carteSousTexte}>♂ {lot.males} mâles · ♀ {lot.femelles} femelles</Text>
                ) : especeSexageDifferable ? (
                  <Text style={styles.italique}>{lot.phase_calculee === 'demarrage' ? 'Sexage pas encore possible (sujets trop jeunes)' : 'Sexage non encore effectué'}</Text>
                ) : null}

                <View style={styles.grille4}>
                  <View style={styles.miniStat}><Text style={styles.miniStatChiffre}>{lot.quantite_initiale}</Text><Text style={styles.miniStatLabel}>Reçus</Text></View>
                  <View style={styles.miniStat}><Text style={styles.miniStatChiffre}>{vivants}</Text><Text style={styles.miniStatLabel}>Vivants</Text></View>
                  <View style={styles.miniStat}><Text style={[styles.miniStatChiffre, { color: '#DC2626' }]}>{morts}</Text><Text style={styles.miniStatLabel}>Morts</Text></View>
                  <View style={styles.miniStat}><Text style={[styles.miniStatChiffre, { color: survie >= 90 ? '#059669' : '#EA580C' }]}>{survie}%</Text><Text style={styles.miniStatLabel}>Survie</Text></View>
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  <TouchableOpacity style={styles.actionRouge} onPress={() => { setLotSelectionne(lot); setMortForm({ nombre: '', cause: 'Inconnue', observations: '' }); setVue('mortalite'); }}>
                    <Text style={styles.actionRougeTexte}>+ Mortalité</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBleue} onPress={() => { setLotSelectionne(lot); chargerMortalites(lot.uuid_id || lot.id); setVue('historique'); }}>
                    <Text style={styles.actionBleueTexte}>Historique</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionGrise} onPress={() => { setLotSelectionne(lot); setEditForm({ males: lot.males || '', femelles: lot.femelles || '', enclos: lot.enclos || '', observations: lot.observations || '' }); setVue('modifier'); }}>
                    <Text style={styles.actionGriseTexte}>Modifier</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.actionOrange} onPress={() => { setLotSelectionne(lot); setReproForm({ nombre_sujets: '', note: '' }); setErreur(''); setVue('reproducteurs'); }}>
                  <Text style={styles.actionOrangeTexte}>🐔 Extraire des reproducteurs</Text>
                </TouchableOpacity>
                {!epuise && (
                  <TouchableOpacity style={styles.actionBleueLarge} onPress={() => { setLotSelectionne(lot); setTransfertForm({ projet_destination_id: '', males_transferes: '', femelles_transferes: '', valorise: false, valeur: '', acheteur_note: '' }); setErreur(''); setVue('transfert'); }}>
                    <Text style={styles.actionBleueLargeTexte}>↔️ Transférer vers un autre projet</Text>
                  </TouchableOpacity>
                )}
                {peutSexer && (
                  <TouchableOpacity style={styles.actionVioletLarge} onPress={() => { setLotSelectionne(lot); setSexageForm({ males: '', femelles: '' }); setErreur(''); setVue('sexage'); }}>
                    <Text style={styles.actionVioletLargeTexte}>♂♀ Sexer ce lot</Text>
                  </TouchableOpacity>
                )}
                {peutActiverVente && (
                  <TouchableOpacity style={styles.boutonVert} onPress={() => activerVente(lot)}>
                    <Text style={styles.boutonPrincipalTexte}>✅ Activer la vente</Text>
                  </TouchableOpacity>
                )}
                {lot.vente_activee && !epuise && (
                  <Text style={styles.venteActiveeTexte}>✅ Vente activée pour ce lot</Text>
                )}
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
  progressLabel: { fontSize: 11, color: '#6E6E73' },
  progressFond: { height: 5, backgroundColor: '#F5F5F7', borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  progressBarre: { height: '100%', backgroundColor: '#1D1D1F', borderRadius: 3 },
  grille3: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statChiffre: { fontSize: 22, fontWeight: '700', color: '#1D1D1F', letterSpacing: -0.3 },
  statLabel: { fontSize: 10, color: '#6E6E73', marginTop: 4, fontWeight: '600', letterSpacing: 0.3 },
  sectionTitre: { fontSize: 12, fontWeight: '600', color: '#6E6E73', marginBottom: 12, letterSpacing: 0.4 },
  videCarte: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E5EA', padding: 30, alignItems: 'center' },
  vide: { color: '#6E6E73', fontSize: 13, marginBottom: 12 },
  carteLot: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 15, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 13, color: '#6E6E73', marginTop: 4 },
  italique: { fontSize: 12, color: '#6E6E73', fontStyle: 'italic', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  grille4: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7' },
  miniStat: { alignItems: 'center' },
  miniStatChiffre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  miniStatLabel: { fontSize: 10, color: '#6E6E73' },
  actionRouge: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  actionRougeTexte: { color: '#C0392B', fontSize: 11, fontWeight: '600' },
  actionBleue: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  actionBleueTexte: { color: '#1D4ED8', fontSize: 11, fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F5F5F7', borderRadius: 12, paddingVertical: 9, alignItems: 'center' },
  actionGriseTexte: { color: '#6E6E73', fontSize: 11, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#1D1D1F', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 12, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 12 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonRouge: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  alerteRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginTop: 8 },
  alerteRougeTexte: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  mortTitre: { color: '#DC2626', fontSize: 13, fontWeight: '600' },
  carteNoire: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginTop: 8, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.3, fontWeight: '600', letterSpacing: 0.4 },
  carteNoireMontant: { color: '#1D1D1F', fontSize: 30, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  carteNoireSousLabel: { color: '#6E6E73', fontSize: 13, marginTop: 6 },
  zoneDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14, marginTop: 16 },
  zoneDangerLabel: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  boutonSupprimer: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonSupprimerTexte: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  infoTexte: { fontSize: 11, color: '#6E6E73', marginTop: 6 },
  alerteInfo: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, marginBottom: 4 },
  alerteInfoTexte: { fontSize: 12, color: '#6E6E73', fontWeight: '600' },
  alerteOrangeLegere: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 4 },
  alerteOrangeLegereTexte: { color: '#C2410C', fontSize: 12, fontWeight: '600' },
  actionOrange: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionOrangeTexte: { color: '#C2410C', fontSize: 11, fontWeight: '600' },
  boutonOrangeGrand: { backgroundColor: '#EA580C', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonVert: { backgroundColor: '#059669', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  venteActiveeTexte: { color: '#059669', fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  bandeauViolet: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 12, padding: 12, marginBottom: 16 },
  bandeauVioletTexte: { color: '#6D28D9', fontSize: 13, fontWeight: '600' },
  ligneCheckboxTransfert: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxCoche: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  checkboxTexte: { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkboxLabel: { fontSize: 12, color: '#1D1D1F', flex: 1 },
  actionBleueLarge: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionBleueLargeTexte: { color: '#1D4ED8', fontSize: 11, fontWeight: '600' },
  actionVioletLarge: { backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionVioletLargeTexte: { color: '#6D28D9', fontSize: 11, fontWeight: '600' },
  boutonViolet: { backgroundColor: '#6D28D9', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
});

export default ElevageScreen;
