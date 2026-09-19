import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import NouveauProjetScreen from './NouveauProjetScreen';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';
import { useProjet } from '../context/ProjetContext';
import { useCache } from '../context/CacheContext';
import { VueRapportInvestisseur } from './InvestissementScreen';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

const couleurSurvie = (taux) => {
  if (taux === null || taux === undefined) return { texte: '#6E6E73' };
  if (taux >= 90) return { texte: '#2D6A4F' };
  if (taux >= 70) return { texte: '#B08D57' };
  return { texte: '#C0392B' };
};

const progressionTemporelle = (dateDebut, dateFin) => {
  if (!dateDebut || !dateFin) return null;
  const debut = new Date(dateDebut).getTime();
  const fin = new Date(dateFin).getTime();
  const maintenant = Date.now();
  if (fin <= debut) return null;
  const pct = ((maintenant - debut) / (fin - debut)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const DashboardScreen = ({ token, projetActifId, utilisateurNom }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const navigation = useNavigation();
  const { choisirProjet } = useProjet();
  const { getCache, setCache } = useCache();
  const scrollMessagesRef = useRef(null);
    const [rapportOuvertId, setRapportOuvertId] = useState(null);
  const [onglet, setOnglet] = useState('dashboard');
  const [projets, setProjets] = useState([]);
  const [rapports, setRapports] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationOuverte, setConversationOuverte] = useState(null);
  const [filMessages, setFilMessages] = useState([]);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [chargement, setChargement] = useState(getCache(`dashboard_${projetActifId}`) ? false : true);
  const [vue, setVue] = useState('liste'); // liste | nouveauProjet
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [motifsRefus, setMotifsRefus] = useState({});
  const [afficherMotif, setAfficherMotif] = useState({});

  const [form, setForm] = useState({
    nom: '', type_volaille: 'Pintade', objectif_sujets: '', taux_survie_vise: '90',
    prix_vente_male: '', prix_vente_femelle: '', rendement_promis: '20', loyer_gestionnaire: '2',
    prix_achat_poussin: '',
  });
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [investisseurs, setInvestisseurs] = useState([{ utilisateur_id: '', nom: '', mise: '', pourcentage: 0 }]);
    const [projetCloture, setProjetCloture] = useState(null);
  const [bonusForm, setBonusForm] = useState({ pourcentage: '', justification: '' });
  const [envoiBonus, setEnvoiBonus] = useState(false);
  const [bonusConfirme, setBonusConfirme] = useState('');
  const [clotureForm, setClotureForm] = useState({ taux_perte_reel: '', taux_perte_applique: '', justification: '', sujets_retenus_reproduction: '', lot_id_reproduction: '' });
  const [previsualisation, setPrevisualisation] = useState(null);
  const [chargementPrevisualisation, setChargementPrevisualisation] = useState(false);
  const [envoiCloture, setEnvoiCloture] = useState(false);
  const [erreurCloture, setErreurCloture] = useState('');
  const [clotureReussie, setClotureReussie] = useState(null);
  const [lotsProjet, setLotsProjet] = useState([]);
    const [showDiffusion, setShowDiffusion] = useState(false);
  const [messageDiffusion, setMessageDiffusion] = useState('');
  const [envoiDiffusion, setEnvoiDiffusion] = useState(false);
  const [diffusionConfirmee, setDiffusionConfirmee] = useState('');
  const [budget, setBudget] = useState({
    mais_qte: '', mais_prix: '', soja_qte: '', soja_prix: '',
    ingredients_qte: '', ingredients_prix: '', aliment_complet_qte: '', aliment_complet_prix: '',
    vaccins: '', antibiotiques: '', deparasitants: '', vitamines: '',
    ustensiles: '', charbon: '', electricite: '',
    communication: '', transport_achats: '', transport_livraisons: '',
    salaire_technicien: '', nb_mois: '', imprevus: '',
  });

  const charger = async (forcer = false) => {
    const cleCache = `dashboard_${projetActifId}`;
    if (!forcer) {
      const cache = getCache(cleCache);
      if (cache) {
        setProjets(cache.projets);
        setRapports(cache.rapports);
        setChargement(false);
        return;
      }
    }
    try {
      const [projetsRes, rapportsRes] = await Promise.all([
        api.get('/projets', { headers }),
        api.get(`/rapports?projet_id=${projetActifId}`, { headers }),
      ]);
      setProjets(projetsRes.data);
      setRapports(rapportsRes.data);
      setCache(cleCache, { projets: projetsRes.data, rapports: rapportsRes.data });
    } catch (error) { console.log('Erreur dashboard:', error.message); }
    finally { setChargement(false); }
  };

  const chargerConversations = async () => {
    try {
      const res = await api.get('/messages/conversations', { headers });
      setConversations(res.data);
    } catch (error) { console.log('Erreur conversations:', error.message); }
  };

  useEffect(() => { if (projetActifId) { charger(); chargerConversations(); chargerUtilisateurs(); } }, [projetActifId]);

  const chargerUtilisateurs = async () => {
    try {
      const res = await api.get('/utilisateurs/liste', { headers });
      setUtilisateurs(res.data);
    } catch (error) { console.log('Erreur utilisateurs:', error.message); }
  };
  useEffect(() => { if (onglet === 'messages' && !conversationOuverte) chargerConversations(); }, [onglet]);

  const ouvrirConversation = async (investisseurId) => {
    setConversationOuverte(investisseurId);
    try {
      const res = await api.get(`/messages/${investisseurId}`, { headers });
      setFilMessages(res.data);
    } catch (error) { console.log('Erreur fil:', error.message); }
  };

    const envoyerDiffusionTous = async () => {
    if (!messageDiffusion.trim()) return;
    setEnvoiDiffusion(true); setDiffusionConfirmee('');
    try {
      const res = await api.post('/messages/diffusion', { projet_id: projetActifId, contenu: messageDiffusion.trim() }, { headers });
      setDiffusionConfirmee(res.data.message || 'Message envoyé à tous les investisseurs.');
      setMessageDiffusion('');
      chargerConversations();
    } catch (error) { console.log('Erreur diffusion:', error.message); }
    finally { setEnvoiDiffusion(false); }
  };
  const envoyerReponse = async () => {
    if (!nouveauMessage.trim() || !conversationOuverte) return;
    try {
      await api.post('/messages', { contenu: nouveauMessage.trim(), investisseur_id: conversationOuverte }, { headers });
      setNouveauMessage('');
      const res = await api.get(`/messages/${conversationOuverte}`, { headers });
      setFilMessages(res.data);
      chargerConversations();
      setTimeout(() => scrollMessagesRef.current?.scrollToEnd({ animated: true }), 100);
      setTimeout(() => scrollMessagesRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) { Alert.alert('Erreur', "Envoi impossible."); }
  };

  const validerRapport = async (id) => {
    try { await api.put(`/rapports/${id}/valider`, {}, { headers }); charger(); }
    catch { Alert.alert('Erreur', 'Validation impossible.'); }
  };

  const refuserRapport = async (id) => {
    try {
      await api.put(`/rapports/${id}/refuser`, { motif: motifsRefus[id] || '' }, { headers });
      setAfficherMotif({ ...afficherMotif, [id]: false });
      charger();
    } catch { Alert.alert('Erreur', 'Refus impossible.'); }
  };

  const creerProjet = async () => {
    if (!form.nom || !form.objectif_sujets) { setErreur('Nom et objectif de sujets sont obligatoires.'); return; }
    setEnvoi(true); setErreur('');
    try {
      const projetRes = await api.post('/projets', {
        nom: form.nom, type_volaille: form.type_volaille, objectif_sujets: parseInt(form.objectif_sujets),
        taux_survie_vise: parseFloat(form.taux_survie_vise),
        prix_vente_male: parseFloat(form.prix_vente_male) || null, prix_vente_femelle: parseFloat(form.prix_vente_femelle) || null,
        rendement_promis: parseFloat(form.rendement_promis), loyer_gestionnaire: parseFloat(form.loyer_gestionnaire),
      }, { headers });
      const projetId = projetRes.data.id;

      const depensesPrev = [
        { libelle: 'Achat sujets', categorie: 'Achat sujets', montant_prevu: achatSujets() },
        { libelle: 'Maïs', categorie: 'Alimentation', montant_prevu: (parseFloat(budget.mais_qte) || 0) * (parseFloat(budget.mais_prix) || 0) },
        { libelle: 'Soja', categorie: 'Alimentation', montant_prevu: (parseFloat(budget.soja_qte) || 0) * (parseFloat(budget.soja_prix) || 0) },
        { libelle: 'Ingrédients divers', categorie: 'Alimentation', montant_prevu: (parseFloat(budget.ingredients_qte) || 0) * (parseFloat(budget.ingredients_prix) || 0) },
        { libelle: 'Aliment complet', categorie: 'Alimentation', montant_prevu: (parseFloat(budget.aliment_complet_qte) || 0) * (parseFloat(budget.aliment_complet_prix) || 0) },
        { libelle: 'Vaccins', categorie: 'Sante & vaccins', montant_prevu: parseFloat(budget.vaccins) || 0 },
        { libelle: 'Antibiotiques', categorie: 'Sante & vaccins', montant_prevu: parseFloat(budget.antibiotiques) || 0 },
        { libelle: 'Déparasitants', categorie: 'Sante & vaccins', montant_prevu: parseFloat(budget.deparasitants) || 0 },
        { libelle: 'Vitamines', categorie: 'Sante & vaccins', montant_prevu: parseFloat(budget.vitamines) || 0 },
        { libelle: 'Ustensiles', categorie: 'Infrastructure', montant_prevu: parseFloat(budget.ustensiles) || 0 },
        { libelle: 'Charbon', categorie: 'Infrastructure', montant_prevu: parseFloat(budget.charbon) || 0 },
        { libelle: 'Électricité', categorie: 'Infrastructure', montant_prevu: parseFloat(budget.electricite) || 0 },
        { libelle: 'Communication', categorie: 'Autre', montant_prevu: communication() },
        { libelle: 'Transport achats', categorie: 'Transport', montant_prevu: parseFloat(budget.transport_achats) || 0 },
        { libelle: 'Transport livraisons', categorie: 'Transport', montant_prevu: parseFloat(budget.transport_livraisons) || 0 },
        { libelle: 'Salaires techniciens', categorie: 'Technicien', montant_prevu: technicien() },
        { libelle: 'Imprévus', categorie: 'Autre', montant_prevu: imprevus() },
      ].filter(d => d.montant_prevu > 0);

      for (const dep of depensesPrev) {
        await api.post('/depenses', { ...dep, projet_id: projetId, statut: 'planifiee' }, { headers });
      }
            for (const inv of investisseurs.filter(i => i.utilisateur_id && i.mise)) {
        await api.post('/investisseurs', {
          utilisateur_id: parseInt(inv.utilisateur_id),
          projet_id: projetId,
          mise: parseFloat(inv.mise),
          preference_paiement: 'Mobile Money',
          statut_paiement: 'en_attente',
        }, { headers });
      }

      setVue('liste');
      setForm({ nom: '', type_volaille: 'Pintade', objectif_sujets: '', taux_survie_vise: '90', prix_vente_male: '', prix_vente_femelle: '', rendement_promis: '20', loyer_gestionnaire: '2', prix_achat_poussin: '' });
      setBudget({ mais_qte: '', mais_prix: '', soja_qte: '', soja_prix: '', ingredients_qte: '', ingredients_prix: '', aliment_complet_qte: '', aliment_complet_prix: '', vaccins: '', antibiotiques: '', deparasitants: '', vitamines: '', ustensiles: '', charbon: '', electricite: '', communication: '', transport_achats: '', transport_livraisons: '', salaire_technicien: '', nb_mois: '', imprevus: '' });
            setInvestisseurs([{ utilisateur_id: '', nom: '', mise: '', pourcentage: 0 }]);
      charger();
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors de la création.'); }
    finally { setEnvoi(false); }
  };

    const achatSujets = () => (parseFloat(form.prix_achat_poussin) || 0) * (parseFloat(form.objectif_sujets) || 0);
  const alimentation = () =>
    ((parseFloat(budget.mais_qte) || 0) * (parseFloat(budget.mais_prix) || 0)) +
    ((parseFloat(budget.soja_qte) || 0) * (parseFloat(budget.soja_prix) || 0)) +
    ((parseFloat(budget.ingredients_qte) || 0) * (parseFloat(budget.ingredients_prix) || 0)) +
    ((parseFloat(budget.aliment_complet_qte) || 0) * (parseFloat(budget.aliment_complet_prix) || 0));
  const sante = () => (parseFloat(budget.vaccins) || 0) + (parseFloat(budget.antibiotiques) || 0) + (parseFloat(budget.deparasitants) || 0) + (parseFloat(budget.vitamines) || 0);
  const infrastructure = () => (parseFloat(budget.ustensiles) || 0) + (parseFloat(budget.charbon) || 0) + (parseFloat(budget.electricite) || 0);
  const transport = () => (parseFloat(budget.transport_achats) || 0) + (parseFloat(budget.transport_livraisons) || 0);
  const technicien = () => (parseFloat(budget.salaire_technicien) || 0) * (parseFloat(budget.nb_mois) || 0);
  const imprevus = () => parseFloat(budget.imprevus) || 0;
  const communication = () => parseFloat(budget.communication) || 0;
  const budgetTotal = () => achatSujets() + alimentation() + sante() + infrastructure() + communication() + transport() + technicien() + imprevus();
  const ajouterInvestisseur = () => setInvestisseurs(prev => [...prev, { utilisateur_id: '', nom: '', mise: '', pourcentage: 0 }]);
  const supprimerInvestisseur = (index) => setInvestisseurs(prev => prev.filter((_, i) => i !== index));

  const modifierInvestisseur = (index, champ, valeur) => {
    setInvestisseurs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [champ]: valeur };
      if (champ === 'utilisateur_id') {
        const user = utilisateurs.find(u => u.id === parseInt(valeur));
        if (user) updated[index].nom = user.nom;
      }
      const total = updated.reduce((s, inv) => s + (parseFloat(inv.mise) || 0), 0);
      updated.forEach(inv => { inv.pourcentage = total > 0 ? ((parseFloat(inv.mise) || 0) / total * 100).toFixed(1) : 0; });
      return updated;
    });
  };

  const totalInvesti = () => investisseurs.reduce((s, inv) => s + (parseFloat(inv.mise) || 0), 0);
    const ouvrirCloture = async (projet) => {
    setProjetCloture(projet);
    setBonusForm({ pourcentage: projet.bonus_pourcentage || '', justification: projet.bonus_justification || '' });
    setClotureForm({ taux_perte_reel: '', taux_perte_applique: '', justification: '', sujets_retenus_reproduction: '', lot_id_reproduction: '' });
    setPrevisualisation(null);
    setBonusConfirme('');
    setErreurCloture('');
    setClotureReussie(null);
    try {
      const res = await api.get(`/lots?projet_id=${projet.uuid_id || projet.id}`, { headers });
      setLotsProjet(res.data);
    } catch (error) { console.log('Erreur lots:', error.message); }
  };

  const envoyerBonus = async () => {
    if (bonusForm.pourcentage === '' || !bonusForm.justification.trim()) return;
    setEnvoiBonus(true); setBonusConfirme('');
    try {
      await api.put(`/clotures/${projetCloture.uuid_id || projetCloture.id}/bonus`, {
        bonus_pourcentage: parseFloat(bonusForm.pourcentage), justification: bonusForm.justification.trim(),
      }, { headers });
      setBonusConfirme('Bonus enregistré pour tous les investisseurs de ce projet.');
      if (previsualisation) chargerPrevisualisation();
    } catch (error) { Alert.alert('Erreur', 'Enregistrement du bonus impossible.'); }
    finally { setEnvoiBonus(false); }
  };

  const chargerPrevisualisation = async () => {
    if (!clotureForm.taux_perte_applique) return;
    setChargementPrevisualisation(true);
    try {
      const bonusParam = bonusForm.pourcentage !== '' ? `&bonus_pourcentage=${bonusForm.pourcentage}` : '';
      const res = await api.get(`/clotures/${projetCloture.uuid_id || projetCloture.id}/previsualiser?taux_perte_applique=${clotureForm.taux_perte_applique}${bonusParam}`, { headers });
      setPrevisualisation(res.data);
    } catch (error) { console.log('Erreur prévisualisation:', error.message); }
    finally { setChargementPrevisualisation(false); }
  };

  const confirmerCloture = async () => {
    if (!clotureForm.justification.trim()) { setErreurCloture('Une justification est obligatoire.'); return; }
    if (parseInt(clotureForm.sujets_retenus_reproduction) > 0 && !clotureForm.lot_id_reproduction) {
      setErreurCloture('Précise de quel lot proviennent les sujets retenus pour la reproduction.');
      return;
    }
    setEnvoiCloture(true); setErreurCloture('');
    try {
      const res = await api.post(`/clotures/${projetCloture.uuid_id || projetCloture.id}/cloturer`, {
        taux_perte_reel: parseFloat(clotureForm.taux_perte_reel) || null,
        taux_perte_applique: parseFloat(clotureForm.taux_perte_applique),
        justification: clotureForm.justification.trim(),
        sujets_retenus_reproduction: parseInt(clotureForm.sujets_retenus_reproduction) || 0,
        lot_id_reproduction: clotureForm.lot_id_reproduction || null,
      }, { headers });
      setClotureReussie(res.data);
      charger();
    } catch (error) { setErreurCloture(error.response?.data?.message || 'Erreur lors de la clôture.'); }
    finally { setEnvoiCloture(false); }
  };
  const rapportsEnAttente = rapports.filter(r => !r.valide_gestionnaire);
  const totalNonLus = conversations.reduce((s, c) => s + parseInt(c.non_lus || 0), 0);

  // --- VUE BONUS & CLÔTURE ---
  if (projetCloture) {
    if (clotureReussie) {
      return (
        <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
          <Header titre="Projet clôturé" action={<TouchableOpacity onPress={() => setProjetCloture(null)}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
          <View style={styles.centre}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
            <Text style={styles.succesTitre}>Projet clôturé avec succès</Text>
            <Text style={styles.succesTexte}>Les versements ont été calculés et verrouillés.</Text>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setProjetCloture(null)}>
              <Text style={styles.boutonPrincipalTexte}>Retour au tableau de bord</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={`Bonus & Clôture · ${projetCloture.nom}`} action={<TouchableOpacity onPress={() => setProjetCloture(null)}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Bonus pour tous les investisseurs</Text>
            <Text style={styles.label}>Bonus (%)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={bonusForm.pourcentage} onChangeText={v => setBonusForm({ ...bonusForm, pourcentage: v })} />
            <Text style={styles.label}>Justification</Text>
            <TextInput style={[styles.champ, { height: 60 }]} multiline value={bonusForm.justification} onChangeText={v => setBonusForm({ ...bonusForm, justification: v })} />
            {bonusConfirme !== '' && <Text style={styles.succesInline}>{bonusConfirme}</Text>}
            <TouchableOpacity style={styles.boutonSecondaireNoir} onPress={envoyerBonus} disabled={envoiBonus || bonusForm.pourcentage === '' || !bonusForm.justification.trim()}>
              <Text style={styles.boutonSecondaireNoirTexte}>{envoiBonus ? 'Enregistrement...' : 'Enregistrer le bonus'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.carteOrange}>
            <Text style={styles.carteTitre}>Le projet a échoué en cours de route ?</Text>
            <Text style={styles.carteSousTexte}>Si le capital ne peut pas être garanti, utilise la Liquidation (remboursement au prorata) ou la Relance (report vers un nouveau projet) plutôt que la clôture normale ci-dessous.</Text>
            <TouchableOpacity style={styles.boutonOrangeGrand} onPress={() => navigation.navigate('Liquidation', { projetId: projetCloture.uuid_id || projetCloture.id })}>
              <Text style={styles.boutonOrangeTexte}>Liquider ou relancer ce projet</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Clôturer le projet</Text>
            <Text style={styles.label}>Taux de perte réel (%)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={clotureForm.taux_perte_reel} onChangeText={v => setClotureForm({ ...clotureForm, taux_perte_reel: v })} />
            <Text style={styles.label}>Taux de perte appliqué (%)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={clotureForm.taux_perte_applique} onChangeText={v => setClotureForm({ ...clotureForm, taux_perte_applique: v })} onBlur={chargerPrevisualisation} />

            {chargementPrevisualisation ? <ActivityIndicator style={{ marginVertical: 10 }} color="#1D1D1F" /> : previsualisation && (
              <View style={styles.encartPrevisu}>
                <Text style={styles.encartPrevisuTitre}>Prévisualisation</Text>
                {previsualisation.versements?.map((v, i) => (
                  <View key={i} style={styles.ligneEntre}>
                    <Text style={styles.previsuNom}>{v.nom}</Text>
                    <Text style={styles.previsuMontant}>{formatMontant(v.montant_verse)}</Text>
                  </View>
                ))}
              </View>
            )}

            {previsualisation?.totaux?.creance_restante > 0 && (
              <View style={styles.alerteRouge}>
                <Text style={styles.alerteRougeTexte}>⚠️ {formatMontant(previsualisation.totaux.creance_restante)} de créances non encaissées sur les ventes de ce projet.</Text>
                <Text style={styles.alerteRougeTexteSecondaire}>Enregistrez les paiements manquants (écran Commerce) avant de pouvoir clôturer.</Text>
              </View>
            )}

            <Text style={styles.label}>Sujets retenus pour reproduction</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={clotureForm.sujets_retenus_reproduction} onChangeText={v => setClotureForm({ ...clotureForm, sujets_retenus_reproduction: v })} />
            {parseInt(clotureForm.sujets_retenus_reproduction) > 0 && (
              <>
                <Text style={styles.label}>Lot d'origine de ces sujets</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {lotsProjet.map(l => (
                    <TouchableOpacity key={l.id} onPress={() => setClotureForm({ ...clotureForm, lot_id_reproduction: String(l.uuid_id || l.id) })}
                      style={[styles.chip, clotureForm.lot_id_reproduction === String(l.uuid_id || l.id) && styles.chipActif]}>
                      <Text style={[styles.chipTexte, clotureForm.lot_id_reproduction === String(l.uuid_id || l.id) && styles.chipTexteActif]}>{l.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.label}>Justification de la clôture</Text>
            <TextInput style={[styles.champ, { height: 60 }]} multiline value={clotureForm.justification} onChangeText={v => setClotureForm({ ...clotureForm, justification: v })} />

            {erreurCloture !== '' && <Text style={styles.erreurTexte}>{erreurCloture}</Text>}

            <TouchableOpacity style={styles.boutonRouge} onPress={() => Alert.alert('Clôturer ce projet ?', 'Cette action est définitive et verrouille les versements.', [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Clôturer', style: 'destructive', onPress: confirmerCloture },
            ])} disabled={envoiCloture || previsualisation?.totaux?.creance_restante > 0}>
              <Text style={styles.boutonPrincipalTexte}>{envoiCloture ? 'Clôture en cours...' : 'Clôturer définitivement le projet'}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }
  // --- FORMULAIRE NOUVEAU PROJET ---
  if (rapportOuvertId) {
    return <VueRapportInvestisseur token={token} rapportId={rapportOuvertId} onBack={() => setRapportOuvertId(null)} />;
  }
  if (vue === 'nouveauProjet') {
    return (
      <NouveauProjetScreen token={token} onTermine={() => setVue('liste')} onAnnuler={() => setVue('liste')} />
    );
  }

  // --- VUE PRINCIPALE avec sous-onglets ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Tableau de bord" sousTitre="Gestionnaire" sansRetour
        action={<TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('nouveauProjet')}><Text style={styles.boutonPetitTexte}>+ Projet</Text></TouchableOpacity>}
      />
      <View style={styles.sousOngletsLigne}>
        {['dashboard', 'rapports', 'messages'].map(t => (
          <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.sousOnglet, onglet === t && styles.sousOngletActif]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.sousOngletTexte, onglet === t && styles.sousOngletTexteActif]}>
                {t === 'dashboard' ? 'Tableau de bord' : t === 'rapports' ? 'Rapports' : 'Messages'}
              </Text>
              {t === 'rapports' && rapportsEnAttente.length > 0 && (
                <View style={styles.badgeRouge}><Text style={styles.badgeRougeTexte}>{rapportsEnAttente.length}</Text></View>
              )}
              {t === 'messages' && totalNonLus > 0 && (
                <View style={styles.badgeRouge}><Text style={styles.badgeRougeTexte}>{totalNonLus}</Text></View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      {onglet === "messages" && conversationOuverte ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={{ padding: 12 }} onPress={() => setConversationOuverte(null)}><Text style={styles.lienRetour}>← Retour aux conversations</Text></TouchableOpacity>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0} style={{ flex: 1 }}>
          <ScrollView style={styles.conteneur} ref={scrollMessagesRef} onContentSizeChange={() => scrollMessagesRef.current?.scrollToEnd({ animated: false })}>
            {filMessages.map((m, i) => {
              const dateMsg = new Date(m.created_at).toLocaleDateString('fr-FR');
              const dateMsgPrecedent = i > 0 ? new Date(filMessages[i - 1].created_at).toLocaleDateString('fr-FR') : null;
              const nouvelleDate = dateMsg !== dateMsgPrecedent;
              const estMoi = m.auteur_role === 'gestionnaire' || m.auteur_role === 'gestion_invest';
              return (
                <View key={m.id}>
                  {nouvelleDate && <Text style={styles.dateSeparateur}>{dateMsg}</Text>}
                  <View style={[styles.messageBulle, estMoi ? styles.messageMoi : styles.messageAutre]}>
                    <Text style={styles.messageContenu}>{m.contenu}</Text>
                    <Text style={styles.messageDate}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>
          <View style={[styles.carte, { marginHorizontal: 16, marginBottom: 0, borderRadius: 0 }]}>
            <TextInput style={[styles.champ, { height: 60 }]} multiline placeholder="Répondre..." value={nouveauMessage} onChangeText={setNouveauMessage} />
            <TouchableOpacity style={styles.boutonPrincipal} onPress={envoyerReponse}><Text style={styles.boutonPrincipalTexte}>Envoyer</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
        </View>
      ) : chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          {onglet === 'dashboard' && (
            <View>
              <Text style={styles.salutation}>Bonjour, {utilisateurNom?.split(' ')[0]?.toUpperCase() || ''} 👋</Text>
              <Text style={styles.dateTexte}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Text>

              <View style={styles.grille2}>
                <View style={styles.carteStat}><Text style={styles.statLabel}>PROJETS ACTIFS</Text><Text style={styles.statChiffre}>{projets.filter(p => p.statut_cloture !== 'cloture').length}</Text></View>
                <View style={styles.carteStat}><Text style={styles.statLabel}>RAPPORTS EN ATTENTE</Text><Text style={[styles.statChiffre, { color: rapportsEnAttente.length > 0 ? '#B08D57' : '#1D1D1F' }]}>{rapportsEnAttente.length}</Text></View>
              </View>

              <Text style={styles.sectionTitre}>PROJETS EN COURS</Text>
              {projets.length === 0 ? <Text style={styles.vide}>Aucun projet pour l'instant</Text> : projets.map(p => (
                (() => {
                  const couleurs = couleurSurvie(p.taux_survie_reel);
                  const progression = progressionTemporelle(p.date_debut, p.date_fin);
                  return (
                <TouchableOpacity style={styles.carte} key={p.id} onPress={() => { choisirProjet(p.uuid_id || p.id); navigation.navigate("Elevage"); }}>
                  <View style={styles.ligneEntre}>
                    <Text style={styles.carteTitre}>{p.nom}</Text>
                    <View style={[styles.badge, { backgroundColor: p.statut_cloture === 'cloture' ? '#F5F5F7' : 'rgba(45,106,79,0.1)' }]}>
                      <Text style={[styles.badgeTexte, { color: p.statut_cloture === 'cloture' ? '#6E6E73' : '#2D6A4F' }]}>{p.statut_cloture === 'cloture' ? 'Clôturé' : 'Actif'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.carteSousTexte, { color: couleurs.texte }]}>{p.type_volaille} · {p.objectif_sujets} sujets{p.taux_survie_reel != null ? ` · ${p.taux_survie_reel}% de survie` : ''}</Text>
                  {progression !== null && (
                    <View style={styles.barreProgressionConteneur}>
                      <View style={[styles.barreProgressionRemplie, { width: `${progression}%`, backgroundColor: couleurs.texte }]} />
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TouchableOpacity style={styles.actionGrise} onPress={(e) => { e.stopPropagation(); navigation.navigate('GestionProjet', { projetId: p.uuid_id || p.id }); }}><Text style={styles.actionGriseTexte}>Gérer</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.actionIndigo} onPress={(e) => { e.stopPropagation(); ouvrirCloture(p); }}><Text style={styles.actionIndigoTexte}>Bonus & Clôture</Text></TouchableOpacity>
                  </View>
                </TouchableOpacity>
                  );
                })()
              ))}
            </View>
          )}

          {onglet === 'rapports' && (
            <View>
              {rapportsEnAttente.length > 0 && (
                <View>
                  <Text style={styles.sectionTitre}>En attente de validation ({rapportsEnAttente.length})</Text>
                  {rapportsEnAttente.map(r => (
                    <View style={styles.carteRapport} key={r.id}>
                      <View style={styles.ligneEntre}>
                        <Text style={styles.carteTitre}>Semaine {r.semaine}</Text>
                        <View style={styles.badgeAttente}><Text style={styles.badgeAttenteTexte}>En attente</Text></View>
                      </View>
                      <Text style={styles.carteSousTexte}>{new Date(r.date_rapport).toLocaleDateString('fr-FR')} · Effectif {r.effectif_debut || '—'} · {r.morts_semaine || 0} morts</Text>
                      {afficherMotif[r.id] ? (
                        <View style={{ marginTop: 8 }}>
                          <TextInput style={styles.champ} placeholder="Motif du refus" value={motifsRefus[r.id] || ''} onChangeText={v => setMotifsRefus({ ...motifsRefus, [r.id]: v })} />
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                            <TouchableOpacity style={styles.actionRouge} onPress={() => refuserRapport(r.id)}><Text style={styles.actionRougeTexte}>Confirmer le refus</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.actionGrise} onPress={() => setAfficherMotif({ ...afficherMotif, [r.id]: false })}><Text style={styles.actionGriseTexte}>Annuler</Text></TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                          <TouchableOpacity style={styles.actionVerte} onPress={() => validerRapport(r.id)}><Text style={styles.actionVerteTexte}>✓ Valider</Text></TouchableOpacity>
                          <TouchableOpacity style={styles.actionRouge} onPress={() => setAfficherMotif({ ...afficherMotif, [r.id]: true })}><Text style={styles.actionRougeTexte}>✕ Refuser</Text></TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.sectionTitre}>Rapports validés</Text>
              {rapports.filter(r => r.valide_gestionnaire).length === 0 ? <Text style={styles.vide}>Aucun rapport validé pour l'instant</Text> : rapports.filter(r => r.valide_gestionnaire).map(r => (
                <TouchableOpacity style={styles.carteRapport} key={r.id} onPress={() => setRapportOuvertId(r.uuid_id || r.id)}>
                  <Text style={styles.carteTitre}>Semaine {r.semaine}</Text>
                  <Text style={styles.carteSousTexte}>{new Date(r.date_rapport).toLocaleDateString('fr-FR')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {onglet === "messages" && conversationOuverte === null && (
              <View>
                {!showDiffusion ? (
                  <TouchableOpacity style={styles.boutonDiffusion} onPress={() => setShowDiffusion(true)}>
                    <Text style={styles.boutonDiffusionTexte}>📢 Envoyer un message à tous les investisseurs</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.carte}>
                    <Text style={styles.carteTitre}>Message pour tous les investisseurs du projet</Text>
                    <TextInput style={[styles.champ, { height: 70 }]} multiline placeholder="Ce message sera envoyé individuellement à chaque investisseur..." value={messageDiffusion} onChangeText={setMessageDiffusion} />
                    {diffusionConfirmee !== '' && <Text style={styles.succesInline}>{diffusionConfirmee}</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TouchableOpacity style={styles.boutonSecondaireNoir} onPress={envoyerDiffusionTous} disabled={envoiDiffusion || !messageDiffusion.trim()}>
                        <Text style={styles.boutonSecondaireNoirTexte}>{envoiDiffusion ? 'Envoi...' : 'Envoyer à tous'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionGrise} onPress={() => { setShowDiffusion(false); setDiffusionConfirmee(''); }}>
                        <Text style={styles.actionGriseTexte}>Fermer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                {conversations.length === 0 ? <Text style={styles.vide}>Aucune conversation pour l'instant</Text> : conversations.map(c => (
              <TouchableOpacity key={c.investisseur_id} style={styles.carte} onPress={() => ouvrirConversation(c.investisseur_id)}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{c.investisseur_nom}</Text>
                  {c.non_lus > 0 && <View style={styles.badgeRouge}><Text style={styles.badgeRougeTexte}>{c.non_lus}</Text></View>}
                </View>
                <Text style={styles.carteSousTexte} numberOfLines={1}>{c.dernier_message}</Text>
              </TouchableOpacity>
                ))}
              </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const BudgetLigneQte = ({ label, qteField, prixField, budget, setBudget }) => {
  const total = (parseFloat(budget[qteField]) || 0) * (parseFloat(budget[prixField]) || 0);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.budgetLigneLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetSousLabel}>Qté (sacs)</Text>
          <TextInput style={styles.champPetit} keyboardType="numeric" placeholder="0" value={budget[qteField]} onChangeText={v => setBudget({ ...budget, [qteField]: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetSousLabel}>Prix/sac (F)</Text>
          <TextInput style={styles.champPetit} keyboardType="numeric" placeholder="0" value={budget[prixField]} onChangeText={v => setBudget({ ...budget, [prixField]: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetSousLabel}>Total</Text>
          <View style={styles.totalBox}><Text style={styles.totalTexte}>{total > 0 ? new Intl.NumberFormat('fr-FR').format(total) + ' F' : '—'}</Text></View>
        </View>
      </View>
    </View>
  );
};

const BudgetLigneMontant = ({ label, champ, budget, setBudget }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.budgetLigneLabel}>{label}</Text>
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <View style={{ flex: 1 }}>
        <Text style={styles.budgetSousLabel}>Montant (F)</Text>
        <TextInput style={styles.champPetit} keyboardType="numeric" placeholder="0" value={budget[champ]} onChangeText={v => setBudget({ ...budget, [champ]: v })} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.budgetSousLabel}>Total</Text>
        <View style={styles.totalBox}><Text style={styles.totalTexte}>{(parseFloat(budget[champ]) || 0) > 0 ? new Intl.NumberFormat('fr-FR').format(parseFloat(budget[champ])) + ' F' : '—'}</Text></View>
      </View>
    </View>
  </View>
);
const styles = StyleSheet.create({
  barreProgressionConteneur: { height: 5, backgroundColor: '#F5F5F7', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  barreProgressionRemplie: { height: 5, backgroundColor: '#1D1D1F', borderRadius: 3 },
  dateSeparateur: { textAlign: "center", fontSize: 11, color: "#6E6E73", backgroundColor: "#F3F4F6", alignSelf: "center", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginVertical: 10 },
  messageDate: { fontSize: 9, color: "#B0B7C3", marginTop: 4, alignSelf: "flex-end" },
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sousOngletsLigne: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingHorizontal: 16 },
  sousOnglet: { paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sousOngletActif: { borderBottomColor: '#1D1D1F' },
  sousOngletTexte: { fontSize: 13, color: '#6E6E73', fontWeight: '500' },
  sousOngletTexteActif: { color: '#1D1D1F', fontWeight: '600' },
  badgeRouge: { backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeRougeTexte: { color: '#fff', fontSize: 9, fontWeight: '700' },
  salutation: { fontSize: 24, fontWeight: '700', color: '#1D1D1F', marginTop: 8, letterSpacing: -0.4 },
  dateTexte: { fontSize: 13, color: '#6E6E73', marginBottom: 18 },
  grille2: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  carteStat: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statLabel: { fontSize: 11, color: '#6E6E73', marginBottom: 8, fontWeight: '600', letterSpacing: 0.4 },
  statChiffre: { fontSize: 28, fontWeight: '700', color: '#1D1D1F', letterSpacing: -0.5 },
  sectionTitre: { fontSize: 12, fontWeight: '600', color: '#6E6E73', marginTop: 14, marginBottom: 12, letterSpacing: 0.4 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteOrange: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  boutonOrangeGrand: { backgroundColor: '#B08D57', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  boutonOrangeTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  carteRapport: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 15, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 13, color: '#6E6E73', marginTop: 4 },
  vide: { color: '#6E6E73', fontSize: 13, marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  badgeAttente: { backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeAttenteTexte: { color: '#C2410C', fontSize: 10, fontWeight: '600' },
  actionVerte: { flex: 1, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionVerteTexte: { color: '#047857', fontSize: 11, fontWeight: '600' },
  actionRouge: { flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionRougeTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  actionIndigo: { flex: 1, backgroundColor: '#EEF2FF', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionIndigoTexte: { color: '#4338CA', fontSize: 11, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#1D1D1F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  infoTexte: { fontSize: 10, color: '#6E6E73', marginTop: 12, lineHeight: 14 },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 12 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
    budgetLigneLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 },
  budgetSousLabel: { fontSize: 10, color: '#6E6E73', marginBottom: 4 },
  champPetit: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 8, fontSize: 12, color: '#1D1D1F' },
  totalBox: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  totalTexte: { fontSize: 12, fontWeight: '600', color: '#1D1D1F' },
    lienAjouter: { color: '#4338CA', fontSize: 12, fontWeight: '600' },
  investisseurBloc: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', marginRight: 6 },
  chipActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  pourcentageTexte: { fontSize: 11, color: '#4338CA', marginTop: 4 },
  lienSupprimer: { color: '#DC2626', fontSize: 11, marginTop: 8 },
  encartTotal: { backgroundColor: '#1D1D1F', borderRadius: 10, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  encartTotalLabel: { color: '#6E6E73', fontSize: 12 },
  encartTotalValeur: { color: '#fff', fontSize: 14, fontWeight: '700' },
    lienRetourPetit: { color: '#6E6E73', fontSize: 11 },
  succesTitre: { fontSize: 16, fontWeight: '600', color: '#1D1D1F', marginTop: 8 },
  succesTexte: { fontSize: 13, color: '#6E6E73', marginTop: 4, textAlign: 'center' },
  succesInline: { color: '#047857', fontSize: 12, marginTop: 8 },
  boutonSecondaireNoir: { backgroundColor: '#1D1D1F', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  boutonSecondaireNoirTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonRouge: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  encartPrevisu: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, marginVertical: 10 },
  encartPrevisuTitre: { fontSize: 12, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  alerteRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginTop: 8 },
  alerteRougeTexte: { fontSize: 11, fontWeight: '600', color: '#B91C1C' },
  alerteRougeTexteSecondaire: { fontSize: 10, color: '#DC2626', marginTop: 4 },
  previsuNom: { fontSize: 12, color: '#374151' },
  previsuMontant: { fontSize: 12, fontWeight: '600', color: '#1D1D1F' },
  lienRetour: { color: '#6E6E73', fontSize: 12, marginBottom: 12 },
  messageBulle: { borderRadius: 12, padding: 10, marginBottom: 8, maxWidth: '85%' },
  messageMoi: { backgroundColor: '#F3F4F6', alignSelf: 'flex-end' },
  messageAutre: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'flex-start' },
  dateSeparateur: { textAlign: 'center', fontSize: 11, color: '#6E6E73', backgroundColor: '#F3F4F6', alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginVertical: 10 },
  messageContenu: { fontSize: 16, color: '#1D1D1F', fontWeight: '600' },
  boutonDiffusionTexte: { color: '#4338CA', fontSize: 13, fontWeight: '600' },
});

export default DashboardScreen;