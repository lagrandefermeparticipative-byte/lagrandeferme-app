import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import Header from '../components/Header';
import { useCache } from '../context/CacheContext';
import { useProjet } from '../context/ProjetContext';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

const getStatutBadge = (statut) => ({
  payee: { label: 'Payée', bg: '#ECFDF5', text: '#047857' },
  planifiee: { label: 'Planifiée', bg: '#F3F4F6', text: '#4B5563' },
  engagee: { label: 'Engagée', bg: '#EFF6FF', text: '#1D4ED8' },
  annulee: { label: 'Annulée', bg: '#FEF2F2', text: '#B91C1C' },
}[statut] || { label: statut, bg: '#F3F4F6', text: '#4B5563' });

const uploadVersCloudinary = async (uri, nom, mimeType) => {
  const formData = new FormData();
  formData.append('file', { uri, type: mimeType || 'application/octet-stream', name: nom || 'fichier' });
  formData.append('upload_preset', 'lagrandeferme');
  const res = await fetch('https://api.cloudinary.com/v1_1/dv9db2wle/auto/upload', { method: 'POST', body: formData });
  return res.json();
};

const GestionProjetScreen = ({ token, projetId, onRetour }) => {
  const { viderCache } = useCache();
  const { rechargerProjets, projetActifId } = useProjet();
  const headers = { Authorization: `Bearer ${token}` };
  const [projet, setProjet] = useState(null);
  const [investisseurs, setInvestisseurs] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [comptesExistants, setComptesExistants] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState('investisseurs');
  const [vue, setVue] = useState('liste'); // liste | nouvelInv | editInv | editProjet | nouvelleDepense
  const [invSelectionne, setInvSelectionne] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurForm, setErreurForm] = useState('');
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [assignations, setAssignations] = useState([]);
  const [comptesDisponibles, setComptesDisponibles] = useState([]);
  const [nouvelleAssignation, setNouvelleAssignation] = useState({ utilisateur_id: '', role: 'technicien' });
  const [uploadFactureEnCours, setUploadFactureEnCours] = useState({});
  const [saisiesRapides, setSaisiesRapides] = useState({});
  const [modeInvestisseur, setModeInvestisseur] = useState('nouveau');
  const [compteExistantChoisi, setCompteExistantChoisi] = useState('');

  const [form, setForm] = useState({
    nom: '', email: '', mot_de_passe: '', telephone: '', whatsapp: '',
    role: 'investisseur', mise: '', preference_paiement: 'Mobile Money',
    numero_mobile_money: '', coordonnees_bancaires: '', type_investisseur: 'retail',
  });
  const [editForm, setEditForm] = useState({});
  const [projetForm, setProjetForm] = useState({});
  const [newDepenseForm, setNewDepenseForm] = useState({
    libelle: '', categorie: 'Alimentation', montant_prevu: '', montant_reel: '',
    statut: 'planifiee', date_depense: '', fournisseur: '', note: '',
  });

  const chargerDonnees = async () => {
    try {
      const [projetRes, investRes, depensesRes, comptesRes, assignRes] = await Promise.all([
        api.get(`/projets/${projetId}`, { headers }),
        api.get(`/investisseurs/${projetId}`, { headers }),
        api.get(`/depenses?projet_id=${projetId}`, { headers }),
        api.get('/utilisateurs/liste', { headers }),
        api.get(`/projets/${projetId}/assignations`, { headers }),
      ]);
      setProjet(projetRes.data);
      setInvestisseurs(investRes.data);
      setComptesExistants(comptesRes.data);
      setComptesDisponibles(comptesRes.data);
      setAssignations(assignRes.data);
      const deps = depensesRes.data;
      setDepenses(deps);
      const init = {};
      deps.forEach(d => { init[d.id] = { montant_reel: String(d.montant_reel || ''), date_depense: d.date_depense ? d.date_depense.split('T')[0] : '', statut: d.statut || 'planifiee' }; });
      setSaisiesRapides(init);
    } catch (error) { console.log('Erreur GestionProjet:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { if (projetId) chargerDonnees(); }, [projetId]);

  const handleSaisieRapide = (id, champ, v) => setSaisiesRapides(prev => ({ ...prev, [id]: { ...prev[id], [champ]: v } }));

  const sauvegarderSaisieRapide = async (depense) => {
    const saisie = saisiesRapides[depense.id];
    if (!saisie) return;
    try {
      await api.put(`/depenses/${depense.uuid_id || depense.id}`, { montant_reel: parseFloat(saisie.montant_reel) || 0, date_depense: saisie.date_depense || null, statut: saisie.statut }, { headers });
      chargerDonnees();
    } catch (error) { console.log('Erreur sauvegarde:', error.message); }
  };

  const choisirEtUploaderFacture = async (depense) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
      if (result.canceled) return;
      const fichier = result.assets[0];
      setUploadFactureEnCours(prev => ({ ...prev, [depense.id]: true }));
      const cloudData = await uploadVersCloudinary(fichier.uri, fichier.name, fichier.mimeType);
      if (cloudData.secure_url) {
        await api.put(`/depenses/${depense.uuid_id || depense.id}`, { facture_url: cloudData.secure_url }, { headers });
        chargerDonnees();
        Alert.alert('Succès', 'Facture uploadée !');
      } else { Alert.alert('Erreur', 'Upload impossible.'); }
    } catch (error) { console.log('Erreur upload facture:', error.message); }
    finally { setUploadFactureEnCours(prev => ({ ...prev, [depense.id]: false })); }
  };

  const choisirEtUploaderMou = async (inv) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (result.canceled) return;
      const fichier = result.assets[0];
      setUploadEnCours(true);
      const cloudData = await uploadVersCloudinary(fichier.uri, fichier.name, fichier.mimeType);
      if (cloudData.secure_url) {
        await api.put(`/investisseurs/${inv.uuid_id || inv.id}`, { mou_url: cloudData.secure_url }, { headers });
        setInvSelectionne(prev => ({ ...prev, mou_url: cloudData.secure_url }));
        chargerDonnees();
        Alert.alert('Succès', 'Contrat uploadé avec succès !');
      } else { Alert.alert('Erreur', 'Upload impossible.'); }
    } catch (error) { console.log('Erreur upload MOU:', error.message); }
    finally { setUploadEnCours(false); }
  };

  const supprimerDepense = (id) => {
    Alert.alert('Supprimer', 'Supprimer cette dépense ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/depenses/${id}`, { headers }); chargerDonnees(); } catch (error) { console.log(error.message); }
      }},
    ]);
  };
  const handleAssignerUtilisateur = async () => {
    if (!nouvelleAssignation.utilisateur_id) return;
    try {
      await api.post(`/projets/${projetId}/assignations`, nouvelleAssignation, { headers });
      setNouvelleAssignation({ utilisateur_id: '', role: 'technicien' });
      chargerDonnees();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || 'Erreur lors de l\'assignation.');
    }
  };

  const handleRetirerAssignation = async (assignationId) => {
    try {
      await api.delete(`/projets/${projetId}/assignations/${assignationId}`, { headers });
      chargerDonnees();
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors du retrait.');
    }
  };

  const handleSupprimerProjet = () => {
    Alert.alert('Supprimer le projet', `Supprimer définitivement "${projet.nom}" ? Cette action est irréversible : toutes ses données (lots, dépenses, rapports) seront perdues.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/projets/${projet.uuid_id || projet.id}`, { headers });
          viderCache(`dashboard_${projetActifId}`);
          await rechargerProjets();
          onRetour();
        } catch (error) { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  const retirerDuProjet = (inv) => {
    Alert.alert('Retirer du projet', `Retirer ${inv.nom} du projet ? Son compte sera conservé.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/investisseurs/${inv.uuid_id || inv.id}`, { headers }); setVue('liste'); chargerDonnees(); } catch (error) { console.log(error.message); }
      }},
    ]);
  };

  const supprimerCompte = (inv) => {
    Alert.alert('Supprimer le compte', `Supprimer définitivement le compte de ${inv.nom} ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/utilisateurs/${inv.utilisateur_id}`, { headers }); setVue('liste'); chargerDonnees(); } catch (error) { console.log(error.message); }
      }},
    ]);
  };

  const ouvrirEdit = (inv) => {
    setInvSelectionne(inv);
    setEditForm({
      mise: String(inv.mise), preference_paiement: inv.preference_paiement || 'Mobile Money',
      numero_mobile_money: inv.numero_mobile_money || '', coordonnees_bancaires: inv.coordonnees_bancaires || '',
      statut_paiement: inv.statut_paiement || 'en_attente', date_paiement: inv.date_paiement ? inv.date_paiement.split('T')[0] : '',
      reference_transaction: inv.reference_transaction || '',
    });
    setVue('editInv');
  };

  const ouvrirEditProjet = () => {
    setProjetForm({
      nom: projet.nom || '', type_volaille: projet.type_volaille || '', objectif_sujets: String(projet.objectif_sujets || ''),
      taux_survie_vise: String(projet.taux_survie_vise || ''), stade_vente: projet.stade_vente || '',
      prix_vente_male: String(projet.prix_vente_male || ''), prix_vente_femelle: String(projet.prix_vente_femelle || ''),
      rendement_promis: String(projet.rendement_promis || ''), loyer_gestionnaire: String(projet.loyer_gestionnaire || ''),
      date_debut: projet.date_debut ? projet.date_debut.split('T')[0] : '', date_fin: projet.date_fin ? projet.date_fin.split('T')[0] : '',
      statut: projet.statut || 'actif',
    });
    setVue('editProjet');
  };

  const soumettreInvestisseur = async () => {
    setEnvoi(true); setErreurForm('');
    try {
      let userId;
      if (modeInvestisseur === 'existant') {
        if (!compteExistantChoisi) { setErreurForm('Choisis un compte existant.'); setEnvoi(false); return; }
        userId = parseInt(compteExistantChoisi);
      } else {
        const userRes = await api.post('/auth/creer', { nom: form.nom, email: form.email, mot_de_passe: form.mot_de_passe, telephone: form.telephone, whatsapp: form.whatsapp, role: form.role }, { headers });
        userId = userRes.data.utilisateur.id;
      }
      await api.post('/investisseurs', {
        utilisateur_id: userId, projet_id: projetId, mise: parseFloat(form.mise),
        preference_paiement: form.preference_paiement, numero_mobile_money: form.numero_mobile_money,
        coordonnees_bancaires: form.coordonnees_bancaires, statut_paiement: 'en_attente', type_investisseur: form.type_investisseur,
      }, { headers });
      setVue('liste'); setModeInvestisseur('nouveau'); setCompteExistantChoisi('');
      setForm({ nom: '', email: '', mot_de_passe: '', telephone: '', whatsapp: '', role: 'investisseur', mise: '', preference_paiement: 'Mobile Money', numero_mobile_money: '', coordonnees_bancaires: '', type_investisseur: 'retail' });
      chargerDonnees();
    } catch (error) { setErreurForm(error.response?.data?.message || 'Erreur lors de la création.'); }
    finally { setEnvoi(false); }
  };

  const soumettreEditInvestisseur = async () => {
    setEnvoi(true);
    try {
      await api.put(`/investisseurs/${invSelectionne.uuid_id || invSelectionne.id}`, editForm, { headers });
      setVue('liste'); chargerDonnees();
    } catch (error) { console.log('Erreur édition:', error.message); }
    finally { setEnvoi(false); }
  };

  const soumettreEditProjet = async () => {
    setEnvoi(true);
    try {
      await api.put(`/projets/${projetId}`, projetForm, { headers });
      setVue('liste'); chargerDonnees();
    } catch (error) { console.log('Erreur édition projet:', error.message); }
    finally { setEnvoi(false); }
  };

  const soumettreNouvelleDepense = async () => {
    setEnvoi(true);
    try {
      await api.post('/depenses', { ...newDepenseForm, projet_id: projetId }, { headers });
      setVue('liste');
      setNewDepenseForm({ libelle: '', categorie: 'Alimentation', montant_prevu: '', montant_reel: '', statut: 'planifiee', date_depense: '', fournisseur: '', note: '' });
      chargerDonnees();
    } catch (error) { console.log('Erreur nouvelle dépense:', error.message); }
    finally { setEnvoi(false); }
  };

  const totalInvesti = investisseurs.reduce((s, inv) => s + parseFloat(inv.mise || 0), 0);
  const totalPrevu = depenses.reduce((s, d) => s + parseFloat(d.montant_prevu || 0), 0);
  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);

  // ---------- FORMULAIRE NOUVELLE DÉPENSE ----------
  if (vue === 'nouvelleDepense') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouvelle dépense" action={<TouchableOpacity onPress={() => setVue('liste')}><Text style={styles.lienRetourPetit}>Annuler</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Libellé</Text>
            <TextInput style={styles.champ} placeholder="Ex: Achat maïs" value={newDepenseForm.libelle} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, libelle: v })} />
            <Text style={styles.label}>Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Alimentation', 'Sante & vaccins', 'Transport', 'Technicien', 'Infrastructure', 'Achat sujets', 'Autre'].map(c => (
                <TouchableOpacity key={c} onPress={() => setNewDepenseForm({ ...newDepenseForm, categorie: c })} style={[styles.chip, newDepenseForm.categorie === c && styles.chipActif]}>
                  <Text style={[styles.chipTexte, newDepenseForm.categorie === c && styles.chipTexteActif]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Montant prévu (F)</Text><TextInput style={styles.champ} keyboardType="numeric" value={newDepenseForm.montant_prevu} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, montant_prevu: v })} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Montant réel (F)</Text><TextInput style={styles.champ} keyboardType="numeric" value={newDepenseForm.montant_reel} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, montant_reel: v })} /></View>
            </View>
            <Text style={styles.label}>Statut</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['planifiee', 'engagee', 'payee', 'annulee'].map(s => (
                <TouchableOpacity key={s} onPress={() => setNewDepenseForm({ ...newDepenseForm, statut: s })} style={[styles.chip, newDepenseForm.statut === s && styles.chipActif]}>
                  <Text style={[styles.chipTexte, newDepenseForm.statut === s && styles.chipTexteActif]}>{getStatutBadge(s).label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Date</Text>
            <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={newDepenseForm.date_depense} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, date_depense: v })} />
            <Text style={styles.label}>Fournisseur</Text>
            <TextInput style={styles.champ} placeholder="Nom du fournisseur" value={newDepenseForm.fournisseur} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, fournisseur: v })} />
            <Text style={styles.label}>Note</Text>
            <TextInput style={[styles.champ, { height: 60 }]} multiline value={newDepenseForm.note} onChangeText={v => setNewDepenseForm({ ...newDepenseForm, note: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreNouvelleDepense} disabled={envoi}><Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------- FORMULAIRE NOUVEL INVESTISSEUR ----------
  if (vue === 'nouvelInv') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouvel investisseur" action={<TouchableOpacity onPress={() => setVue('liste')}><Text style={styles.lienRetourPetit}>Annuler</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 }}>
            <TouchableOpacity style={[styles.chipFlex, modeInvestisseur === 'nouveau' && styles.chipActif]} onPress={() => setModeInvestisseur('nouveau')}><Text style={[styles.chipTexte, modeInvestisseur === 'nouveau' && styles.chipTexteActif]}>Nouveau compte</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.chipFlex, modeInvestisseur === 'existant' && styles.chipActif]} onPress={() => setModeInvestisseur('existant')}><Text style={[styles.chipTexte, modeInvestisseur === 'existant' && styles.chipTexteActif]}>Compte existant</Text></TouchableOpacity>
          </View>

          {modeInvestisseur === 'existant' ? (
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>👤 Choisir un compte</Text>
              <Text style={styles.aide}>Par exemple toi-même, si tu investis aussi dans ce projet.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {comptesExistants.filter(c => !investisseurs.some(inv => inv.utilisateur_id_ref === c.id)).map(c => (
                  <TouchableOpacity key={c.id} onPress={() => setCompteExistantChoisi(String(c.id))} style={[styles.chip, compteExistantChoisi === String(c.id) && styles.chipActif]}>
                    <Text style={[styles.chipTexte, compteExistantChoisi === String(c.id) && styles.chipTexteActif]}>{c.nom}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>👤 Informations personnelles</Text>
              <Text style={styles.label}>Nom complet *</Text>
              <TextInput style={styles.champ} placeholder="Ex: AZIABOU Kossi" value={form.nom} onChangeText={v => setForm({ ...form, nom: v })} />
              <Text style={styles.label}>Email *</Text>
              <TextInput style={styles.champ} keyboardType="email-address" autoCapitalize="none" placeholder="email@exemple.com" value={form.email} onChangeText={v => setForm({ ...form, email: v })} />
              <Text style={styles.label}>Mot de passe *</Text>
              <TextInput style={styles.champ} secureTextEntry placeholder="Minimum 6 caractères" value={form.mot_de_passe} onChangeText={v => setForm({ ...form, mot_de_passe: v })} />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Text style={styles.label}>Téléphone</Text><TextInput style={styles.champ} placeholder="+228XXXXXXXX" value={form.telephone} onChangeText={v => setForm({ ...form, telephone: v })} /></View>
                <View style={{ flex: 1 }}><Text style={styles.label}>WhatsApp</Text><TextInput style={styles.champ} placeholder="+228XXXXXXXX" value={form.whatsapp} onChangeText={v => setForm({ ...form, whatsapp: v })} /></View>
              </View>
              <Text style={styles.label}>Rôle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[{ v: 'investisseur', l: 'Investisseur' }, { v: 'tech_invest', l: 'Technicien + Invest.' }, { v: 'gestion_invest', l: 'Gestion. + Invest.' }].map(r => (
                  <TouchableOpacity key={r.v} onPress={() => setForm({ ...form, role: r.v })} style={[styles.chip, form.role === r.v && styles.chipActif]}>
                    <Text style={[styles.chipTexte, form.role === r.v && styles.chipTexteActif]}>{r.l}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.carte}>
            <Text style={styles.carteTitre}>💰 Investissement</Text>
            <Text style={styles.label}>Mise (FCFA) *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={form.mise} onChangeText={v => setForm({ ...form, mise: v })} />
            <Text style={styles.label}>Type d'investisseur</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[{ v: 'retail', l: 'Classique' }, { v: 'landowner', l: 'Propriétaire terrien' }, { v: 'institutional', l: 'Institutionnel' }].map(t => (
                <TouchableOpacity key={t.v} onPress={() => setForm({ ...form, type_investisseur: t.v })} style={[styles.chip, form.type_investisseur === t.v && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.type_investisseur === t.v && styles.chipTexteActif]}>{t.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Mode de paiement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Mobile Money', 'Espèces', 'Virement bancaire'].map(m => (
                <TouchableOpacity key={m} onPress={() => setForm({ ...form, preference_paiement: m })} style={[styles.chip, form.preference_paiement === m && styles.chipActif]}>
                  <Text style={[styles.chipTexte, form.preference_paiement === m && styles.chipTexteActif]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Numéro Mobile Money</Text>
            <TextInput style={styles.champ} placeholder="+228XXXXXXXX" value={form.numero_mobile_money} onChangeText={v => setForm({ ...form, numero_mobile_money: v })} />
            <Text style={styles.label}>Coordonnées bancaires</Text>
            <TextInput style={styles.champ} placeholder="Banque · N° compte" value={form.coordonnees_bancaires} onChangeText={v => setForm({ ...form, coordonnees_bancaires: v })} />
          </View>
          {erreurForm !== '' && <Text style={styles.erreurTexte}>{erreurForm}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreInvestisseur} disabled={envoi}><Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création en cours...' : 'Créer le compte et ajouter au projet'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setErreurForm(''); setModeInvestisseur('nouveau'); setCompteExistantChoisi(''); }}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------- FORMULAIRE ÉDITION INVESTISSEUR ----------
  if (vue === 'editInv' && invSelectionne) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Modifier · ${invSelectionne.nom}`} action={<TouchableOpacity onPress={() => setVue('liste')}><Text style={styles.lienRetourPetit}>Annuler</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Mise (FCFA)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={editForm.mise} onChangeText={v => setEditForm({ ...editForm, mise: v })} />
            <Text style={styles.label}>Mode de paiement</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Mobile Money', 'Espèces', 'Virement bancaire'].map(m => (
                <TouchableOpacity key={m} onPress={() => setEditForm({ ...editForm, preference_paiement: m })} style={[styles.chip, editForm.preference_paiement === m && styles.chipActif]}>
                  <Text style={[styles.chipTexte, editForm.preference_paiement === m && styles.chipTexteActif]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Numéro Mobile Money</Text>
            <TextInput style={styles.champ} placeholder="+228XXXXXXXX" value={editForm.numero_mobile_money} onChangeText={v => setEditForm({ ...editForm, numero_mobile_money: v })} />
            <Text style={styles.label}>Coordonnées bancaires</Text>
            <TextInput style={styles.champ} placeholder="Banque · N° compte" value={editForm.coordonnees_bancaires} onChangeText={v => setEditForm({ ...editForm, coordonnees_bancaires: v })} />
            <Text style={styles.label}>Statut paiement</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ v: 'en_attente', l: 'En attente' }, { v: 'paye', l: 'Remboursé' }, { v: 'partiel', l: 'Partiel' }].map(s => (
                <TouchableOpacity key={s.v} onPress={() => setEditForm({ ...editForm, statut_paiement: s.v })} style={[styles.chipFlex, editForm.statut_paiement === s.v && styles.chipActif]}>
                  <Text style={[styles.chipTexte, editForm.statut_paiement === s.v && styles.chipTexteActif]}>{s.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Date paiement</Text>
            <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={editForm.date_paiement} onChangeText={v => setEditForm({ ...editForm, date_paiement: v })} />
            <Text style={styles.label}>Référence transaction</Text>
            <TextInput style={styles.champ} placeholder="N° transaction" value={editForm.reference_transaction} onChangeText={v => setEditForm({ ...editForm, reference_transaction: v })} />
          </View>

          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Contrat MOU</Text>
            {invSelectionne.mou_url ? (
              <TouchableOpacity onPress={() => Linking.openURL(invSelectionne.mou_url)} style={{ marginBottom: 10 }}>
                <Text style={styles.lienBleu}>📄 Voir le contrat</Text>
              </TouchableOpacity>
            ) : <Text style={styles.aide}>Aucun contrat uploadé</Text>}
            <TouchableOpacity style={styles.boutonUpload} onPress={() => choisirEtUploaderMou(invSelectionne)} disabled={uploadEnCours}>
              <Text style={styles.boutonUploadTexte}>{uploadEnCours ? '⏳ Upload en cours...' : `📎 ${invSelectionne.mou_url ? 'Remplacer' : 'Uploader'} le contrat MOU (PDF)`}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreEditInvestisseur} disabled={envoi}><Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer les modifications'}</Text></TouchableOpacity>

          <View style={styles.zoneDanger}>
            <Text style={styles.zoneDangerLabel}>Zone de danger</Text>
            <TouchableOpacity style={styles.boutonOrange} onPress={() => retirerDuProjet(invSelectionne)}><Text style={styles.boutonOrangeTexte}>Retirer du projet (garder le compte)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.boutonOrange, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', marginTop: 8 }]} onPress={() => supprimerCompte(invSelectionne)}><Text style={[styles.boutonOrangeTexte, { color: '#B91C1C' }]}>Supprimer le compte définitivement</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------- FORMULAIRE ÉDITION PROJET ----------
  if (vue === 'editProjet' && projet) {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Modifier le projet" action={<TouchableOpacity onPress={() => setVue('liste')}><Text style={styles.lienRetourPetit}>Annuler</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom du projet</Text>
            <TextInput style={styles.champ} value={projetForm.nom} onChangeText={v => setProjetForm({ ...projetForm, nom: v })} />
            <Text style={styles.label}>Type de volaille</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Pintade', 'Poulet', 'Dindon', 'Canard', 'Autre'].map(t => (
                <TouchableOpacity key={t} onPress={() => setProjetForm({ ...projetForm, type_volaille: t })} style={[styles.chip, projetForm.type_volaille === t && styles.chipActif]}>
                  <Text style={[styles.chipTexte, projetForm.type_volaille === t && styles.chipTexteActif]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Objectif (sujets)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.objectif_sujets} onChangeText={v => setProjetForm({ ...projetForm, objectif_sujets: v })} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Survie visée (%)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.taux_survie_vise} onChangeText={v => setProjetForm({ ...projetForm, taux_survie_vise: v })} /></View>
            </View>
            <Text style={styles.label}>Stade de vente</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['Adulte (finition)', 'Poussin', 'Intermédiaire'].map(s => (
                <TouchableOpacity key={s} onPress={() => setProjetForm({ ...projetForm, stade_vente: s })} style={[styles.chip, projetForm.stade_vente === s && styles.chipActif]}>
                  <Text style={[styles.chipTexte, projetForm.stade_vente === s && styles.chipTexteActif]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Prix mâle (F)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.prix_vente_male} onChangeText={v => setProjetForm({ ...projetForm, prix_vente_male: v })} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Prix femelle (F)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.prix_vente_femelle} onChangeText={v => setProjetForm({ ...projetForm, prix_vente_femelle: v })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Rendement promis (%)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.rendement_promis} onChangeText={v => setProjetForm({ ...projetForm, rendement_promis: v })} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Loyer gestionnaire (%)</Text><TextInput style={styles.champ} keyboardType="numeric" value={projetForm.loyer_gestionnaire} onChangeText={v => setProjetForm({ ...projetForm, loyer_gestionnaire: v })} /></View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Text style={styles.label}>Date début</Text><TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={projetForm.date_debut} onChangeText={v => setProjetForm({ ...projetForm, date_debut: v })} /></View>
              <View style={{ flex: 1 }}><Text style={styles.label}>Date fin prévue</Text><TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={projetForm.date_fin} onChangeText={v => setProjetForm({ ...projetForm, date_fin: v })} /></View>
            </View>
            <Text style={styles.label}>Statut</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[{ v: 'actif', l: 'Actif' }, { v: 'pause', l: 'En pause' }, { v: 'cloture', l: 'Clôturé' }].map(s => (
                <TouchableOpacity key={s.v} onPress={() => setProjetForm({ ...projetForm, statut: s.v })} style={[styles.chipFlex, projetForm.statut === s.v && styles.chipActif]}>
                  <Text style={[styles.chipTexte, projetForm.statut === s.v && styles.chipTexteActif]}>{s.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreEditProjet} disabled={envoi}><Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer les modifications'}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---------- VUE PRINCIPALE ----------
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre={projet?.nom || 'Gestion projet'} sousTitre="Investisseurs & Paramètres"
        action={
          onglet === 'investisseurs' ? <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('nouvelInv')}><Text style={styles.boutonPetitTexte}>+ Investisseur</Text></TouchableOpacity>
          : onglet === 'budget' ? <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('nouvelleDepense')}><Text style={styles.boutonPetitTexte}>+ Dépense</Text></TouchableOpacity>
          : null
        } />
      <View style={styles.sousOngletsLigne}>
        {['investisseurs', 'budget', 'details'].map(t => (
          <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.sousOnglet, onglet === t && styles.sousOngletActif]}>
            <Text style={[styles.sousOngletTexte, onglet === t && styles.sousOngletTexteActif]}>{t === 'investisseurs' ? 'Investisseurs' : t === 'budget' ? 'Budget' : 'Détails'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          {onglet === 'investisseurs' && (
            <View>
              {totalInvesti > 0 && (
                <View style={styles.carteNoire}>
                  <Text style={styles.carteNoireLabelSeul}>Total investi</Text>
                  <Text style={styles.carteNoireMontant}>{formatMontant(totalInvesti)}</Text>
                  <Text style={styles.carteNoireSousLabel}>{investisseurs.length} investisseur{investisseurs.length > 1 ? 's' : ''}</Text>
                </View>
              )}
              {investisseurs.length === 0 ? (
                <View style={styles.videCarte}>
                  <Text style={styles.vide}>Aucun investisseur pour ce projet</Text>
                  <TouchableOpacity style={styles.boutonPrincipalPetit} onPress={() => setVue('nouvelInv')}><Text style={styles.boutonPrincipalTexte}>Ajouter un investisseur</Text></TouchableOpacity>
                </View>
              ) : investisseurs.map(inv => {
                const pourcentage = totalInvesti > 0 ? ((inv.mise / totalInvesti) * 100).toFixed(1) : 0;
                return (
                  <View key={inv.id} style={styles.carte}>
                    <View style={styles.ligneEntre}>
                      <View>
                        <Text style={styles.carteTitre}>{inv.nom}</Text>
                        <Text style={styles.carteSousTexteSeul}>{inv.email}</Text>
                        {inv.type_investisseur && inv.type_investisseur !== 'retail' && (
                          <View style={styles.badgeBleu}><Text style={styles.badgeBleuTexte}>{inv.type_investisseur === 'landowner' ? 'Propriétaire terrien' : 'Institutionnel'}</Text></View>
                        )}
                      </View>
                      <View style={[styles.badge, { backgroundColor: inv.statut_paiement === 'paye' ? '#ECFDF5' : '#F3F4F6' }]}>
                        <Text style={[styles.badgeTexte, { color: inv.statut_paiement === 'paye' ? '#047857' : '#4B5563' }]}>{inv.statut_paiement === 'paye' ? 'Remboursé' : 'En attente'}</Text>
                      </View>
                    </View>
                    <View style={styles.grille3}>
                      <View style={styles.miniBox}><Text style={styles.miniLabel}>Mise</Text><Text style={styles.miniValeur}>{formatMontant(inv.mise)}</Text></View>
                      <View style={styles.miniBox}><Text style={styles.miniLabel}>Part</Text><Text style={styles.miniValeur}>{pourcentage}%</Text></View>
                      <View style={styles.miniBox}><Text style={styles.miniLabel}>Dû (20%)</Text><Text style={styles.miniValeur}>{formatMontant(inv.mise * 1.2)}</Text></View>
                    </View>
                    {inv.preference_paiement && <Text style={styles.carteSousTexte}>💳 {inv.preference_paiement}{inv.numero_mobile_money ? ' · ' + inv.numero_mobile_money : ''}</Text>}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {inv.mou_url ? (
                        <TouchableOpacity style={styles.actionBleue} onPress={() => Linking.openURL(inv.mou_url)}><Text style={styles.actionBleueTexte}>📄 Voir le contrat MOU</Text></TouchableOpacity>
                      ) : <View style={styles.actionDesactivee}><Text style={styles.actionDesactiveeTexte}>Pas de contrat</Text></View>}
                      <TouchableOpacity style={styles.actionGrise} onPress={() => ouvrirEdit(inv)}><Text style={styles.actionGriseTexte}>Modifier</Text></TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {onglet === 'budget' && (
            <View>
              <View style={styles.carteNoire}>
                <Text style={styles.carteNoireLabelSeul}>Budget total prévu</Text>
                <Text style={styles.carteNoireMontant}>{formatMontant(totalPrevu)}</Text>
                <View style={[styles.ligneEntre, { marginTop: 8 }]}>
                  <Text style={styles.carteNoireSousLabel}>Dépensé : {formatMontant(totalReel)}</Text>
                  <Text style={styles.carteNoireSousLabel}>{totalPrevu > 0 ? Math.round((totalReel / totalPrevu) * 100) : 0}% consommé</Text>
                </View>
              </View>
              {depenses.length === 0 ? (
                <View style={styles.videCarte}>
                  <Text style={styles.vide}>Aucune dépense prévue</Text>
                  <TouchableOpacity style={styles.boutonPrincipalPetit} onPress={() => setVue('nouvelleDepense')}><Text style={styles.boutonPrincipalTexte}>Ajouter une dépense</Text></TouchableOpacity>
                </View>
              ) : depenses.map(depense => {
                const saisie = saisiesRapides[depense.id] || {};
                const badge = getStatutBadge(saisie.statut || depense.statut);
                const montantReel = parseFloat(saisie.montant_reel) || 0;
                const ecart = montantReel - parseFloat(depense.montant_prevu || 0);
                return (
                  <View key={depense.id} style={styles.carte}>
                    <View style={styles.ligneEntre}>
                      <View><Text style={styles.carteTitre}>{depense.libelle}</Text><Text style={styles.carteSousTexteSeul}>{depense.categorie}</Text></View>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text></View>
                    </View>
                    <View style={[styles.ligneEntre, { marginVertical: 8 }]}>
                      <Text style={styles.carteSousTexte}>Prévu : <Text style={{ fontWeight: '600', color: '#111827' }}>{formatMontant(depense.montant_prevu)}</Text></Text>
                      {ecart !== 0 && <Text style={{ fontSize: 11, fontWeight: '600', color: ecart > 0 ? '#DC2626' : '#059669' }}>Écart : {ecart > 0 ? '+' : ''}{formatMontant(ecart)}</Text>}
                    </View>
                    <View style={styles.saisieRapideBloc}>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <View style={{ flex: 1 }}><Text style={styles.miniLabel}>Montant réel (F)</Text><TextInput style={styles.champPetit} keyboardType="numeric" value={saisie.montant_reel} onChangeText={v => handleSaisieRapide(depense.id, 'montant_reel', v)} /></View>
                        <View style={{ flex: 1 }}><Text style={styles.miniLabel}>Date</Text><TextInput style={styles.champPetit} placeholder="AAAA-MM-JJ" value={saisie.date_depense} onChangeText={v => handleSaisieRapide(depense.id, 'date_depense', v)} /></View>
                      </View>
                      <Text style={styles.miniLabel}>Statut</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {['planifiee', 'engagee', 'payee', 'annulee'].map(s => (
                          <TouchableOpacity key={s} onPress={() => handleSaisieRapide(depense.id, 'statut', s)} style={[styles.chip, saisie.statut === s && styles.chipActif]}>
                            <Text style={[styles.chipTexte, saisie.statut === s && styles.chipTexteActif]}>{getStatutBadge(s).label}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <TouchableOpacity style={styles.actionNoire} onPress={() => sauvegarderSaisieRapide(depense)}><Text style={styles.actionNoireTexte}>✓ Enregistrer</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.actionBleue} onPress={() => choisirEtUploaderFacture(depense)} disabled={uploadFactureEnCours[depense.id]}>
                          <Text style={styles.actionBleueTexte}>{uploadFactureEnCours[depense.id] ? '⏳...' : depense.facture_url ? '📎 Voir' : '📎 Facture'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerDepense(depense.uuid_id || depense.id)}><Text style={{ fontSize: 12 }}>🗑</Text></TouchableOpacity>
                      </View>
                      {depense.facture_url && <TouchableOpacity onPress={() => Linking.openURL(depense.facture_url)}><Text style={[styles.lienBleu, { marginTop: 6 }]}>Voir la facture uploadée</Text></TouchableOpacity>}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {onglet === 'details' && projet && (
            <View>
              <View style={styles.carte}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>Informations projet</Text>
                  <TouchableOpacity style={styles.boutonGrisPetit} onPress={ouvrirEditProjet}><Text style={styles.boutonGrisPetitTexte}>Modifier</Text></TouchableOpacity>
                </View>
                {[
                  { label: 'Nom', value: projet.nom }, { label: 'Type', value: projet.type_volaille },
                  { label: 'Objectif', value: `${projet.objectif_sujets} sujets` }, { label: 'Survie visée', value: `${projet.taux_survie_vise}%` },
                  { label: 'Stade vente', value: projet.stade_vente }, { label: 'Prix mâle', value: formatMontant(projet.prix_vente_male) },
                  { label: 'Prix femelle', value: formatMontant(projet.prix_vente_femelle) }, { label: 'Rendement promis', value: `${projet.rendement_promis}%` },
                  { label: 'Loyer gestionnaire', value: `${projet.loyer_gestionnaire}%` },
                  { label: 'Date début', value: projet.date_debut ? new Date(projet.date_debut).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Date fin prévue', value: projet.date_fin ? new Date(projet.date_fin).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Statut', value: projet.statut },
                ].map(item => (
                  <View key={item.label} style={styles.ligneInfo}><Text style={styles.infoLabel}>{item.label}</Text><Text style={styles.infoValeur}>{item.value}</Text></View>
                ))}
              </View>
              <View style={[styles.carte, { marginTop: 12 }]}>
                <Text style={styles.sousTitreCarte}>Équipe assignée</Text>
                {assignations.length === 0 ? (
                  <Text style={styles.infoTexte}>Personne n'est encore assigné à ce projet.</Text>
                ) : assignations.map(a => (
                  <View key={a.id} style={styles.ligneAssignation}>
                    <View>
                      <Text style={styles.assignationNom}>{a.nom}</Text>
                      <Text style={styles.assignationRole}>{a.role === 'technicien' ? 'Technicien' : 'Gestionnaire'} · {a.email}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRetirerAssignation(a.id)}><Text style={styles.lienRetirer}>Retirer</Text></TouchableOpacity>
                  </View>
                ))}
                <View style={styles.ligneLibelles}>
                  {comptesDisponibles.map(c => (
                    <TouchableOpacity key={c.id} onPress={() => setNouvelleAssignation(p => ({ ...p, utilisateur_id: c.id }))}
                      style={[styles.pastilleLib, nouvelleAssignation.utilisateur_id === c.id && styles.pastilleLibActive]}>
                      <Text style={styles.pastilleLibTexte}>{c.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.ligne2}>
                  <TouchableOpacity onPress={() => setNouvelleAssignation(p => ({ ...p, role: 'technicien' }))} style={[styles.bouton2, nouvelleAssignation.role === 'technicien' && styles.bouton2Actif]}>
                    <Text style={[styles.bouton2Texte, nouvelleAssignation.role === 'technicien' && styles.bouton2TexteActif]}>Technicien</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNouvelleAssignation(p => ({ ...p, role: 'gestionnaire' }))} style={[styles.bouton2, nouvelleAssignation.role === 'gestionnaire' && styles.bouton2Actif]}>
                    <Text style={[styles.bouton2Texte, nouvelleAssignation.role === 'gestionnaire' && styles.bouton2TexteActif]}>Gestionnaire</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.boutonPrincipal} onPress={handleAssignerUtilisateur}><Text style={styles.boutonPrincipalTexte}>+ Assigner</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.boutonSecondaire} onPress={onRetour}><Text style={styles.boutonSecondaireTexte}>← Retour au tableau de bord</Text></TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 }} onPress={handleSupprimerProjet}><Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600' }}>🗑 Supprimer ce projet</Text></TouchableOpacity>
            </View>
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
  sousOngletsLigne: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 16 },
  sousOnglet: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sousOngletActif: { borderBottomColor: '#111827' },
  sousOngletTexte: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  sousOngletTexteActif: { color: '#111827', fontWeight: '600' },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 11, color: '#6B7280' },
  carteSousTexteSeul: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginBottom: 12 },
  videCarte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E7EB', padding: 24, alignItems: 'center', marginBottom: 12 },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginTop: 12, marginBottom: 12 },
  carteNoireLabelSeul: { color: '#9CA3AF', fontSize: 11 },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  carteNoireMontant: { color: '#fff', fontSize: 20, fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  badgeBleu: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4, alignSelf: 'flex-start' },
  badgeBleuTexte: { color: '#1D4ED8', fontSize: 10, fontWeight: '600' },
  grille3: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 8 },
  miniBox: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, alignItems: 'center' },
  miniLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 4 },
  miniValeur: { fontSize: 11, fontWeight: '600', color: '#111827' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  actionBleue: { flex: 1, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionBleueTexte: { color: '#1D4ED8', fontSize: 11, fontWeight: '600' },
  actionDesactivee: { flex: 1, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionDesactiveeTexte: { color: '#9CA3AF', fontSize: 11 },
  actionRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  actionNoire: { flex: 1, backgroundColor: '#111827', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionNoireTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  saisieRapideBloc: { borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 10, marginTop: 4 },
  champPetit: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, fontSize: 12, color: '#111827' },
  boutonPetit: { backgroundColor: '#111827', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  boutonGrisPetit: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  boutonGrisPetitTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  boutonPrincipalPetit: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  aide: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', marginRight: 6, marginTop: 4 },
  chipFlex: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  chipActif: { backgroundColor: '#111827' },
  chipTexte: { fontSize: 11, color: '#6B7280' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  lienRetourPetit: { color: '#6B7280', fontSize: 11 },
  lienBleu: { color: '#1D4ED8', fontSize: 12, textDecorationLine: 'underline' },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 8, marginBottom: 8 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  sousTitreCarte: { fontSize: 13, fontWeight: '500', color: '#111827', marginBottom: 8 },
  infoTexte: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginBottom: 8 },
  ligneAssignation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8, marginBottom: 8 },
  assignationNom: { fontSize: 12, fontWeight: '500', color: '#111827' },
  assignationRole: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  lienRetirer: { fontSize: 11, color: '#DC2626' },
  ligneLibelles: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  pastilleLib: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pastilleLibActive: { backgroundColor: '#111827', borderColor: '#111827' },
  pastilleLibTexte: { fontSize: 10, color: '#4B5563' },
  ligne2: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  bouton2: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  bouton2Actif: { backgroundColor: '#111827' },
  bouton2Texte: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  bouton2TexteActif: { color: '#fff' },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  boutonUpload: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  boutonUploadTexte: { color: '#4B5563', fontSize: 12 },
  zoneDanger: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14, marginTop: 16 },
  zoneDangerLabel: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  boutonOrange: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonOrangeTexte: { color: '#C2410C', fontSize: 12, fontWeight: '600' },
  ligneInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoLabel: { fontSize: 11, color: '#6B7280' },
  infoValeur: { fontSize: 11, fontWeight: '600', color: '#111827' },
});

export default GestionProjetScreen;