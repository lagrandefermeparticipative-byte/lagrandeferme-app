import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const STATUTS = {
  ponte: { label: 'Ponte', bg: '#FDF2F8', text: '#BE185D' },
  couveuse: { label: 'En couveuse', bg: '#FFF7ED', text: '#C2410C' },
  eclosion: { label: 'Éclosion', bg: '#ECFDF5', text: '#047857' },
  termine: { label: 'Terminé', bg: '#F3F4F6', text: '#4B5563' },
};

const ReproductionScreen = ({ token, projetActifId }) => {
  const navigation = useNavigation();
  const headers = { Authorization: `Bearer ${token}` };
  const [cycles, setCycles] = useState([]);
  const [cycleActif, setCycleActif] = useState(null);
  const [collectes, setCollectes] = useState([]);
  const [onglet, setOnglet] = useState('synthese');
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | cycle | couveuse | collecte | eclosion
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const [formCycle, setFormCycle] = useState({ generation: 'G1', nom: '', projet_id: '', lot_origine_id: '' });
  const [lotsDuProjetCycle, setLotsDuProjetCycle] = useState([]);
  const [formCouveuse, setFormCouveuse] = useState({ prestataire_couveuse: '', date_envoi_couveuse: '', oeufs_envoyes: '', cout_couveuse: '', duree_incubation: '28', date_eclosion_prevue: '' });
  const [formCollecte, setFormCollecte] = useState({ date_collecte: new Date().toISOString().split('T')[0], nombre_oeufs: '', observations: '', date_debut_periode: '', date_fin_periode: '' });
  const [collecteEnEdition, setCollecteEnEdition] = useState(null);
  const [formEclosion, setFormEclosion] = useState({ date_eclosion_reelle: new Date().toISOString().split('T')[0], poussins_eclos: '', poussins_viables: '', observations: '', projet_suivant_id: '' });
  const [tousProjets, setTousProjets] = useState([]);
  const [erreurProjets, setErreurProjets] = useState('');

  useEffect(() => {
    api.get('/projets', { headers }).then(res => setTousProjets(res.data))
      .catch(() => { setTousProjets([]); setErreurProjets('Impossible de charger les projets — vérifie ta connexion.'); });
  }, []);

  const charger = async () => {
    try {
      const res = await api.get(`/reproduction/${projetActifId}`, { headers });
      setCycles(res.data);
      if (res.data.length > 0) {
        const actif = res.data.find(c => c.statut !== 'termine') || res.data[0];
        setCycleActif(actif);
        chargerCollectes(actif.uuid_id || actif.id);
      } else {
        setCycleActif(null);
        setCollectes([]);
      }
    } catch (error) { console.log('Erreur reproduction:', error.message); }
    finally { setChargement(false); }
  };

  const chargerCollectes = async (cycleId) => {
    try {
      const res = await api.get(`/reproduction/${cycleId}/collectes`, { headers });
      setCollectes(res.data);
    } catch (error) { console.log('Erreur collectes:', error.message); }
  };

  useEffect(() => {
    if (projetActifId) {
      setChargement(true);
      charger();
    }
  }, [projetActifId]);

  const ouvrirFormCycle = () => {
    setFormCycle(prev => ({ ...prev, projet_id: projetActifId, lot_origine_id: '' }));
    setErreur('');
    setVue('cycle');
  };

  // Le lot d'origine dépend du projet choisi dans le formulaire — pas
  // forcément celui actuellement affiché, puisqu'on peut créer un cycle
  // pour n'importe quel projet de la ferme.
  useEffect(() => {
    if (vue !== 'cycle' || !formCycle.projet_id) { setLotsDuProjetCycle([]); return; }
    api.get(`/lots?projet_id=${formCycle.projet_id}`, { headers })
      .then(res => setLotsDuProjetCycle(res.data))
      .catch(() => setLotsDuProjetCycle([]));
  }, [vue, formCycle.projet_id]);

  const creerCycle = async () => {
    if (!formCycle.projet_id) { setErreur('Choisis le projet pour lequel créer ce cycle.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/reproduction', formCycle, { headers });
      const projetDifferent = formCycle.projet_id !== projetActifId;
      setVue('liste');
      setFormCycle({ generation: 'G1', nom: '', projet_id: '', lot_origine_id: '' });
      charger();
      if (projetDifferent) {
        const nomProjet = tousProjets.find(p => (p.uuid_id || p.id) === formCycle.projet_id)?.nom;
        Alert.alert('Cycle créé', `Créé pour "${nomProjet || 'l\'autre projet'}" — bascule sur ce projet (sélecteur en haut) pour le voir.`);
      }
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors de la création du cycle.'); }
    finally { setEnvoi(false); }
  };

  const ouvrirFormCouveuse = () => {
    setFormCouveuse({
      prestataire_couveuse: cycleActif?.prestataire_couveuse || '',
      date_envoi_couveuse: cycleActif?.date_envoi_couveuse ? cycleActif.date_envoi_couveuse.split('T')[0] : '',
      oeufs_envoyes: cycleActif?.oeufs_envoyes || '',
      cout_couveuse: cycleActif?.cout_couveuse || '',
      duree_incubation: cycleActif?.duree_incubation || '28',
      date_eclosion_prevue: cycleActif?.date_eclosion_prevue ? cycleActif.date_eclosion_prevue.split('T')[0] : '',
    });
    setErreur('');
    setVue('couveuse');
  };

  const enregistrerCouveuse = async () => {
    setEnvoi(true); setErreur('');
    try {
      await api.put(`/reproduction/${cycleActif.uuid_id || cycleActif.id}`, formCouveuse, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || "Erreur lors de l'enregistrement."); }
    finally { setEnvoi(false); }
  };

  const ouvrirFormCollecte = (collecte = null) => {
    if (collecte) {
      setCollecteEnEdition(collecte);
      setFormCollecte({
        date_collecte: collecte.date_collecte ? collecte.date_collecte.split('T')[0] : '',
        nombre_oeufs: String(collecte.nombre_oeufs || ''),
        observations: collecte.observations || '',
        date_debut_periode: collecte.date_debut_periode ? collecte.date_debut_periode.split('T')[0] : '',
        date_fin_periode: collecte.date_fin_periode ? collecte.date_fin_periode.split('T')[0] : '',
      });
    } else {
      setCollecteEnEdition(null);
      setFormCollecte({ date_collecte: new Date().toISOString().split('T')[0], nombre_oeufs: '', observations: '', date_debut_periode: '', date_fin_periode: '' });
    }
    setErreur('');
    setVue('collecte');
  };

  const enregistrerCollecte = async () => {
    if (!formCollecte.nombre_oeufs) { setErreur("Nombre d'œufs requis."); return; }
    setEnvoi(true); setErreur('');
    try {
      if (collecteEnEdition) {
        await api.put(`/reproduction/collectes/${collecteEnEdition.id}`, formCollecte, { headers });
      } else {
        await api.post(`/reproduction/${cycleActif.uuid_id || cycleActif.id}/collectes`, formCollecte, { headers });
      }
      setVue('liste'); setCollecteEnEdition(null);
      setFormCollecte({ date_collecte: new Date().toISOString().split('T')[0], nombre_oeufs: '', observations: '', date_debut_periode: '', date_fin_periode: '' });
      charger(); chargerCollectes(cycleActif.uuid_id || cycleActif.id);
    } catch (error) { setErreur(error.response?.data?.message || "Erreur lors de l'enregistrement de la collecte."); }
    finally { setEnvoi(false); }
  };

  const supprimerCollecte = (collecte) => {
    Alert.alert('Supprimer', 'Supprimer cette collecte ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/reproduction/collectes/${collecte.id}`, { headers });
          charger(); chargerCollectes(cycleActif.uuid_id || cycleActif.id);
        } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Suppression impossible.'); }
      }},
    ]);
  };

  const ouvrirFormEclosion = () => {
    const projetDuCycle = tousProjets.find(p => p.id === cycleActif?.projet_id);
    setFormEclosion(prev => ({
      ...prev,
      projet_suivant_id: prev.projet_suivant_id || (projetDuCycle ? (projetDuCycle.uuid_id || projetDuCycle.id) : ''),
    }));
    setErreur('');
    setVue('eclosion');
  };

  const enregistrerEclosion = async () => {
    setEnvoi(true); setErreur('');
    try {
      const poussinsEclos = parseInt(formEclosion.poussins_eclos) || 0;
      const poussinsViables = parseInt(formEclosion.poussins_viables) || 0;
      const tauxEclosion = cycleActif.oeufs_envoyes > 0 ? ((poussinsEclos / cycleActif.oeufs_envoyes) * 100).toFixed(1) : 0;
      await api.put(`/reproduction/${cycleActif.uuid_id || cycleActif.id}`, {
        ...formEclosion, poussins_eclos: poussinsEclos, poussins_viables: poussinsViables, taux_eclosion: tauxEclosion, statut: 'termine',
        projet_suivant_id: formEclosion.projet_suivant_id || null,
      }, { headers });
      setVue('liste'); charger();
    } catch (error) { setErreur(error.response?.data?.message || "Erreur lors de l'enregistrement."); }
    finally { setEnvoi(false); }
  };

  const supprimerCycle = (cycle) => {
    Alert.alert('Supprimer', `Supprimer le cycle "${cycle.generation}${cycle.nom ? ' · ' + cycle.nom : ''}" ? Cette action est irréversible.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/reproduction/${cycle.uuid_id || cycle.id}`, { headers });
          if (cycleActif?.id === cycle.id) setCycleActif(null);
          charger();
        } catch (error) { Alert.alert('Erreur', error.response?.data?.message || 'Suppression impossible.'); }
      }},
    ]);
  };

  const progressionIncubation = () => {
    if (!cycleActif?.date_envoi_couveuse || !cycleActif?.duree_incubation) return 0;
    const debut = new Date(cycleActif.date_envoi_couveuse);
    const joursEcoules = Math.floor((new Date() - debut) / 86400000);
    return Math.min(100, Math.round((joursEcoules / cycleActif.duree_incubation) * 100));
  };

  // --- FORMULAIRE NOUVEAU CYCLE ---
  if (vue === 'cycle') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouveau cycle de reproduction" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.infoTexte}>On garde la création simple — tu pourras ajouter les détails de couveuse ensuite.</Text>

            <Text style={styles.label}>Projet *</Text>
            {erreurProjets !== '' && <Text style={styles.erreurTexte}>{erreurProjets}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {tousProjets.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setFormCycle({ ...formCycle, projet_id: p.uuid_id || p.id, lot_origine_id: '' })}
                  style={[styles.chip, formCycle.projet_id === (p.uuid_id || p.id) && styles.chipActif, { marginRight: 6 }]}>
                  <Text style={[styles.chipTexte, formCycle.projet_id === (p.uuid_id || p.id) && styles.chipTexteActif]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Génération</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['G1','G2','G3','G4','G5'].map(g => (
                <TouchableOpacity key={g} onPress={() => setFormCycle({ ...formCycle, generation: g })} style={[styles.chip, formCycle.generation === g && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formCycle.generation === g && styles.chipTexteActif]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.champ, { marginTop: 6 }]} placeholder="Ou une autre étiquette libre" value={formCycle.generation} onChangeText={v => setFormCycle({ ...formCycle, generation: v })} />
            <Text style={styles.infoTexte}>Juste une étiquette — pas besoin de créer une génération formelle pour des sujets déjà dans un lot en cours.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Generations')}>
              <Text style={styles.lienGenerations}>Voir/gérer les générations existantes →</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Nom du cycle</Text>
            <TextInput style={styles.champ} placeholder="Ex: Cycle Nov. 2026" value={formCycle.nom} onChangeText={v => setFormCycle({ ...formCycle, nom: v })} />

            <Text style={styles.label}>Lot d'origine (optionnel)</Text>
            {!formCycle.projet_id ? (
              <Text style={styles.infoTexte}>Choisis d'abord un projet.</Text>
            ) : lotsDuProjetCycle.length === 0 ? (
              <Text style={styles.infoTexte}>Aucun lot dans ce projet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity onPress={() => setFormCycle({ ...formCycle, lot_origine_id: '' })}
                  style={[styles.chip, formCycle.lot_origine_id === '' && styles.chipActif, { marginRight: 6 }]}>
                  <Text style={[styles.chipTexte, formCycle.lot_origine_id === '' && styles.chipTexteActif]}>Aucun lot précis</Text>
                </TouchableOpacity>
                {lotsDuProjetCycle.map(l => (
                  <TouchableOpacity key={l.id} onPress={() => setFormCycle({ ...formCycle, lot_origine_id: l.uuid_id || l.id })}
                    style={[styles.chip, formCycle.lot_origine_id === (l.uuid_id || l.id) && styles.chipActif, { marginRight: 6 }]}>
                    <Text style={[styles.chipTexte, formCycle.lot_origine_id === (l.uuid_id || l.id) && styles.chipTexteActif]}>{l.nom}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <Text style={styles.infoTexte}>Précise de quel lot viennent les reproducteurs — utile si le projet a plusieurs lots.</Text>
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={creerCycle} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création...' : 'Créer le cycle'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- FORMULAIRE COUVEUSE ---
  if (vue === 'couveuse') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Détails de la couveuse" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Prestataire</Text>
            <TextInput style={styles.champ} placeholder="Ex: Ferme Adjonou" value={formCouveuse.prestataire_couveuse} onChangeText={v => setFormCouveuse({ ...formCouveuse, prestataire_couveuse: v })} />
            <Text style={styles.label}>Date envoi (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formCouveuse.date_envoi_couveuse} onChangeText={v => setFormCouveuse({ ...formCouveuse, date_envoi_couveuse: v })} />
            <Text style={styles.label}>Œufs envoyés</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(formCouveuse.oeufs_envoyes)} onChangeText={v => setFormCouveuse({ ...formCouveuse, oeufs_envoyes: v })} />
            <Text style={styles.label}>Coût couveuse (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(formCouveuse.cout_couveuse)} onChangeText={v => setFormCouveuse({ ...formCouveuse, cout_couveuse: v })} />
            <Text style={styles.label}>Durée incubation (jours)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(formCouveuse.duree_incubation)} onChangeText={v => setFormCouveuse({ ...formCouveuse, duree_incubation: v })} />
            <Text style={styles.label}>Date éclosion prévue (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formCouveuse.date_eclosion_prevue} onChangeText={v => setFormCouveuse({ ...formCouveuse, date_eclosion_prevue: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerCouveuse} disabled={envoi}>
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

  // --- FORMULAIRE COLLECTE ---
  if (vue === 'collecte') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={collecteEnEdition ? 'Modifier la collecte' : "Collecte d'œufs"} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Date de collecte (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formCollecte.date_collecte} onChangeText={v => setFormCollecte({ ...formCollecte, date_collecte: v })} />
            <Text style={styles.label}>Nombre d'œufs *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={String(formCollecte.nombre_oeufs)} onChangeText={v => setFormCollecte({ ...formCollecte, nombre_oeufs: v })} />
            <Text style={styles.label}>Début période de ponte</Text>
            <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={formCollecte.date_debut_periode} onChangeText={v => setFormCollecte({ ...formCollecte, date_debut_periode: v })} />
            <Text style={styles.label}>Fin période de ponte</Text>
            <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={formCollecte.date_fin_periode} onChangeText={v => setFormCollecte({ ...formCollecte, date_fin_periode: v })} />
            <Text style={styles.infoTexte}>La vague de ponte concernée par cette collecte — utile si plusieurs pontes se succèdent sur le même cycle.</Text>
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formCollecte.observations} onChangeText={v => setFormCollecte({ ...formCollecte, observations: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerCollecte} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : (collecteEnEdition ? 'Enregistrer les modifications' : 'Enregistrer la collecte')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setCollecteEnEdition(null); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- FORMULAIRE ÉCLOSION ---
  if (vue === 'eclosion') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Résultats d'éclosion" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Date d'éclosion réelle (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formEclosion.date_eclosion_reelle} onChangeText={v => setFormEclosion({ ...formEclosion, date_eclosion_reelle: v })} />
            <Text style={styles.label}>Poussins éclos</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formEclosion.poussins_eclos} onChangeText={v => setFormEclosion({ ...formEclosion, poussins_eclos: v })} />
            <Text style={styles.label}>Poussins viables</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formEclosion.poussins_viables} onChangeText={v => setFormEclosion({ ...formEclosion, poussins_viables: v })} />
            {formEclosion.poussins_eclos !== '' && cycleActif?.oeufs_envoyes && (
              <View style={styles.encartVert}>
                <Text style={styles.encartVertLabel}>Taux d'éclosion estimé</Text>
                <Text style={styles.encartVertValeur}>{((parseInt(formEclosion.poussins_eclos) / cycleActif.oeufs_envoyes) * 100).toFixed(1)}%</Text>
              </View>
            )}
            <Text style={styles.label}>Projet où placer les poussins viables (optionnel)</Text>
            {erreurProjets !== '' && <Text style={styles.erreurTexte}>{erreurProjets}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity onPress={() => setFormEclosion({ ...formEclosion, projet_suivant_id: '' })}
                style={[styles.chip, formEclosion.projet_suivant_id === '' && styles.chipActif, { marginRight: 6 }]}>
                <Text style={[styles.chipTexte, formEclosion.projet_suivant_id === '' && styles.chipTexteActif]}>Aucun</Text>
              </TouchableOpacity>
              {tousProjets.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setFormEclosion({ ...formEclosion, projet_suivant_id: p.uuid_id || p.id })}
                  style={[styles.chip, formEclosion.projet_suivant_id === (p.uuid_id || p.id) && styles.chipActif, { marginRight: 6 }]}>
                  <Text style={[styles.chipTexte, formEclosion.projet_suivant_id === (p.uuid_id || p.id) && styles.chipTexteActif]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.infoTexte}>Pré-rempli avec le projet de ce cycle. Si choisi, un lot "Reproduction interne" est créé automatiquement, déjà prêt à la vente (pas besoin d'attendre la Finition).</Text>
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formEclosion.observations} onChangeText={v => setFormEclosion({ ...formEclosion, observations: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerEclosion} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : "Enregistrer l'éclosion"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE PRINCIPALE ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Reproduction" sousTitre={cycleActif ? `${cycleActif.generation} · ${cycleActif.nom || ''}` : 'Aucun cycle actif'}
        avecSelecteurProjet
        action={
          <TouchableOpacity style={styles.boutonPetit} onPress={ouvrirFormCycle}>
            <Text style={styles.boutonPetitTexte}>+ Cycle</Text>
          </TouchableOpacity>
        }
      />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : cycles.length === 0 ? (
        <ScrollView style={styles.conteneur}>
          <View style={styles.videCarte}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🥚</Text>
            <Text style={styles.vide}>Aucun cycle de reproduction enregistré</Text>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={ouvrirFormCycle}>
              <Text style={styles.boutonPrincipalTexte}>Créer le premier cycle</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.conteneur}>
          {cycles.length > 1 && (
            <ScrollView horizontal style={{ marginTop: 8, marginBottom: 10 }} showsHorizontalScrollIndicator={false}>
              {cycles.map(c => (
                <TouchableOpacity key={c.id} onPress={() => { setCycleActif(c); chargerCollectes(c.uuid_id || c.id); }}
                  style={[styles.cycleChip, cycleActif?.id === c.id && styles.cycleChipActif]}>
                  <Text style={[styles.cycleChipTexte, cycleActif?.id === c.id && styles.cycleChipTexteActif]}>{c.generation} {c.nom ? `· ${c.nom}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.ongletsLigne}>
            {['synthese', 'ponte', 'couveuse', 'historique'].map(t => (
              <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
                <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>
                  {t === 'synthese' ? 'Synthèse' : t === 'ponte' ? 'Ponte' : t === 'couveuse' ? 'Couveuse' : 'Historique'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {onglet === 'synthese' && cycleActif && (
            <View>
              <View style={styles.carteNoire}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteNoireTitre}>{cycleActif.generation} · {cycleActif.nom || 'Cycle en cours'}</Text>
                  <View style={[styles.badge, { backgroundColor: STATUTS[cycleActif.statut]?.bg || '#F3F4F6' }]}>
                    <Text style={[styles.badgeTexte, { color: STATUTS[cycleActif.statut]?.text || '#4B5563' }]}>{STATUTS[cycleActif.statut]?.label || cycleActif.statut}</Text>
                  </View>
                </View>
                {cycleActif.lot_origine_nom && (
                  <Text style={styles.carteNoireSousTexte}>Lot d'origine : {cycleActif.lot_origine_nom}</Text>
                )}
                <View style={styles.grille2noire}>
                  <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>Œufs collectés</Text><Text style={styles.miniNoireValeur}>{cycleActif.oeufs_collectes || 0}</Text></View>
                  <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>En couveuse</Text><Text style={styles.miniNoireValeur}>{cycleActif.oeufs_envoyes || '—'}</Text></View>
                </View>
              </View>

              {cycleActif.date_envoi_couveuse && (
                <View style={styles.carte}>
                  <Text style={styles.carteTitre}>Incubation · {cycleActif.prestataire_couveuse}</Text>
                  <View style={[styles.ligneEntre, { marginTop: 8 }]}>
                    <Text style={styles.progressLabel}>Progression</Text>
                    <Text style={styles.progressLabel}>{progressionIncubation()}% · {cycleActif.duree_incubation} jours</Text>
                  </View>
                  <View style={styles.progressFond}>
                    <View style={[styles.progressBarreOrange, { width: `${progressionIncubation()}%` }]} />
                  </View>
                  {cycleActif.statut !== 'termine' && (
                    <TouchableOpacity style={styles.boutonVert} onPress={ouvrirFormEclosion}>
                      <Text style={styles.boutonVertTexte}>Enregistrer les résultats d'éclosion</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {cycleActif.poussins_viables && (
                <View style={styles.carte}>
                  <Text style={styles.carteTitre}>Résultats éclosion</Text>
                  <LigneInfo label="Œufs envoyés" value={cycleActif.oeufs_envoyes} />
                  <LigneInfo label="Poussins éclos" value={cycleActif.poussins_eclos} />
                  <LigneInfo label="Poussins viables" value={cycleActif.poussins_viables} />
                  <LigneInfo label="Taux d'éclosion" value={`${cycleActif.taux_eclosion}%`} />
                </View>
              )}
            </View>
          )}

          {onglet === 'ponte' && cycleActif && (
            <View>
              <View style={styles.ligneEntre}>
                <Text style={styles.sectionTitre}>Collectes · {collectes.length} entrées</Text>
                <TouchableOpacity style={styles.boutonPetit} onPress={() => ouvrirFormCollecte()}>
                  <Text style={styles.boutonPetitTexte}>+ Collecte</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Résumé de la ponte</Text>
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.miniLabel}>Total œufs</Text>
                  <Text style={styles.miniValeurGrande}>{cycleActif.oeufs_collectes || 0}</Text>
                </View>
                <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7' }}>
                  <Text style={styles.miniLabel}>Période ponte (toutes vagues)</Text>
                  <Text style={styles.infoValeur}>
                    {cycleActif.periode_ponte_debut ? new Date(cycleActif.periode_ponte_debut).toLocaleDateString('fr-FR') : '—'}
                    {cycleActif.periode_ponte_fin ? ' → ' + new Date(cycleActif.periode_ponte_fin).toLocaleDateString('fr-FR') : ''}
                  </Text>
                </View>
              </View>
              {collectes.length === 0 ? (
                <View style={styles.videCarte}>
                  <Text style={styles.vide}>Aucune collecte enregistrée</Text>
                  <TouchableOpacity style={styles.boutonPrincipal} onPress={() => ouvrirFormCollecte()}>
                    <Text style={styles.boutonPrincipalTexte}>Enregistrer une collecte</Text>
                  </TouchableOpacity>
                </View>
              ) : collectes.map(c => (
                <View style={styles.carte} key={c.id}>
                  <View style={styles.ligneEntre}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.carteTitre}>{new Date(c.date_collecte).toLocaleDateString('fr-FR')}</Text>
                      {c.date_debut_periode && (
                        <Text style={styles.vagueTexte}>
                          Vague : {new Date(c.date_debut_periode).toLocaleDateString('fr-FR')}
                          {c.date_fin_periode ? ' → ' + new Date(c.date_fin_periode).toLocaleDateString('fr-FR') : ''}
                        </Text>
                      )}
                      {c.observations && <Text style={styles.infoTexte}>{c.observations}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#1D1D1F' }}>{c.nombre_oeufs} 🥚</Text>
                      <TouchableOpacity onPress={() => ouvrirFormCollecte(c)}><Text style={styles.iconeAction}>✏️</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => supprimerCollecte(c)}><Text style={styles.iconeAction}>🗑</Text></TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {onglet === 'couveuse' && cycleActif && (
            <View>
              <View style={styles.carte}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>Détails couveuse</Text>
                  <TouchableOpacity onPress={ouvrirFormCouveuse}><Text style={styles.lienModifier}>Modifier</Text></TouchableOpacity>
                </View>
                <LigneInfo label="Prestataire" value={cycleActif.prestataire_couveuse || '—'} />
                <LigneInfo label="Œufs envoyés" value={cycleActif.oeufs_envoyes || '—'} />
                <LigneInfo label="Coût" value={cycleActif.cout_couveuse ? formatMontant(cycleActif.cout_couveuse) : '—'} />
                <LigneInfo label="Durée incubation" value={`${cycleActif.duree_incubation || 28} jours`} />
              </View>
              {cycleActif.statut !== 'termine' && (
                <TouchableOpacity style={styles.boutonPrincipal} onPress={ouvrirFormEclosion}>
                  <Text style={styles.boutonPrincipalTexte}>Enregistrer les résultats d'éclosion</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {onglet === 'historique' && cycles.map(cycle => (
            <View style={styles.carte} key={cycle.id}>
              <View style={styles.ligneEntre}>
                <View>
                  <Text style={styles.carteTitre}>{cycle.generation} · {cycle.nom || 'Sans nom'}</Text>
                  {cycle.lot_origine_nom && <Text style={styles.infoTexte}>Lot : {cycle.lot_origine_nom}</Text>}
                </View>
                <View style={[styles.badge, { backgroundColor: STATUTS[cycle.statut]?.bg || '#F3F4F6' }]}>
                  <Text style={[styles.badgeTexte, { color: STATUTS[cycle.statut]?.text || '#4B5563' }]}>{STATUTS[cycle.statut]?.label || cycle.statut}</Text>
                </View>
              </View>
              <View style={styles.grille3}>
                <View style={styles.miniStat}><Text style={styles.miniStatLabel}>Œufs</Text><Text style={styles.miniStatValeur}>{cycle.oeufs_collectes || 0}</Text></View>
                <View style={styles.miniStat}><Text style={styles.miniStatLabel}>Poussins</Text><Text style={styles.miniStatValeur}>{cycle.poussins_viables || '—'}</Text></View>
                <View style={styles.miniStat}><Text style={styles.miniStatLabel}>Éclosion</Text><Text style={styles.miniStatValeur}>{cycle.taux_eclosion ? cycle.taux_eclosion + '%' : '—'}</Text></View>
              </View>
              <TouchableOpacity style={styles.actionRouge} onPress={() => supprimerCycle(cycle)}>
                <Text style={styles.actionRougeTexte}>🗑 Supprimer ce cycle</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginBottom: 4, marginTop: 4 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  infoTexte: { fontSize: 12, color: '#6E6E73', marginBottom: 8, marginTop: 4 },
  lienGenerations: { fontSize: 11, color: '#1D4ED8', marginBottom: 12, marginTop: -4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 12, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#1D1D1F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  boutonVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  boutonVertTexte: { color: '#047857', fontSize: 12, fontWeight: '600' },
  encartVert: { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 12, marginTop: 10 },
  encartVertLabel: { fontSize: 11, color: '#059669' },
  encartVertValeur: { fontSize: 18, fontWeight: '600', color: '#047857' },
  videCarte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E5EA', padding: 30, alignItems: 'center', marginTop: 20 },
  vide: { color: '#6E6E73', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  cycleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', marginRight: 8 },
  cycleChipActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  cycleChipTexte: { fontSize: 12, color: '#6E6E73', fontWeight: '600' },
  cycleChipTexteActif: { color: '#fff' },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', marginBottom: 14 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#1D1D1F' },
  ongletTexte: { fontSize: 13, color: '#6E6E73', fontWeight: '500' },
  ongletTexteActif: { color: '#1D1D1F' },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireTitre: { color: '#fff', fontSize: 13, fontWeight: '600' },
  carteNoireSousTexte: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  grille2noire: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  miniNoire: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, width: '47%' },
  miniNoireLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  miniNoireValeur: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  progressLabel: { fontSize: 11, color: '#6E6E73' },
  progressFond: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  progressBarreOrange: { height: '100%', backgroundColor: '#FB923C', borderRadius: 4 },
  sectionTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  miniLabel: { fontSize: 11, color: '#6E6E73' },
  miniValeurGrande: { fontSize: 20, fontWeight: '600', color: '#1D1D1F', marginTop: 2 },
  lienModifier: { fontSize: 11, color: '#6E6E73', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoLabel: { fontSize: 12, color: '#6E6E73', paddingVertical: 6 },
  infoValeur: { fontSize: 12, fontWeight: '600', color: '#1D1D1F', paddingVertical: 6 },
  vagueTexte: { fontSize: 11, color: '#BE185D', marginTop: 2 },
  iconeAction: { fontSize: 14 },
  grille3: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F7' },
  miniStat: { alignItems: 'center' },
  miniStatLabel: { fontSize: 10, color: '#6E6E73' },
  miniStatValeur: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  actionRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionRougeTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
});

export default ReproductionScreen;
