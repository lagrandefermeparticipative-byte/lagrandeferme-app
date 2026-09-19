import React, { useState, useEffect, useRef } from 'react';
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
  const [vue, setVue] = useState('liste'); // liste | cycle | ponte | couveuse | collecte | eclosion
  const [envoi, setEnvoi] = useState(false);

  const [formCycle, setFormCycle] = useState({ generation: 'G1', nom: '' });
  const [formPonte, setFormPonte] = useState({ nb_femelles: '', nb_males: '', date_debut_ponte: '', date_fin_ponte: '' });
  const [formCouveuse, setFormCouveuse] = useState({ prestataire_couveuse: '', date_envoi_couveuse: '', oeufs_envoyes: '', cout_couveuse: '', duree_incubation: '28', date_eclosion_prevue: '' });
  const [formCollecte, setFormCollecte] = useState({ date_collecte: new Date().toISOString().split('T')[0], nombre_oeufs: '', observations: '' });
  const [formEclosion, setFormEclosion] = useState({ date_eclosion_reelle: new Date().toISOString().split('T')[0], poussins_eclos: '', poussins_viables: '', observations: '' });

  const charger = async () => {
    try {
      const res = await api.get(`/reproduction/${projetActifId}`, { headers });
      setCycles(res.data);
      if (res.data.length > 0) {
        const actif = res.data.find(c => c.statut !== 'termine') || res.data[0];
        setCycleActif(actif);
        chargerCollectes(actif.uuid_id || actif.id);
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

  const dejaCharge = useRef(false);
  useEffect(() => {
    if (projetActifId && !dejaCharge.current) {
      charger();
      dejaCharge.current = true;
    }
  }, [projetActifId]);
  useEffect(() => {
    if (projetActifId && !dejaCharge.current) {
      charger();
      dejaCharge.current = true;
    }
  }, [projetActifId]);

  const creerCycle = async () => {
    setEnvoi(true);
    try {
      await api.post('/reproduction', { ...formCycle, projet_id: projetActifId }, { headers });
      setVue('liste'); setFormCycle({ generation: 'G1', nom: '' }); charger();
    } catch (error) { Alert.alert('Erreur', 'Création impossible.'); }
    finally { setEnvoi(false); }
  };

  const enregistrerPonte = async () => {
    setEnvoi(true);
    try {
      await api.put(`/reproduction/${cycleActif.uuid_id || cycleActif.id}`, formPonte, { headers });
      setVue('liste'); charger();
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const enregistrerCouveuse = async () => {
    setEnvoi(true);
    try {
      await api.put(`/reproduction/${cycleActif.uuid_id || cycleActif.id}`, formCouveuse, { headers });
      setVue('liste'); charger();
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const enregistrerCollecte = async () => {
    if (!formCollecte.nombre_oeufs) { Alert.alert('Champ manquant', 'Nombre d\'œufs requis.'); return; }
    setEnvoi(true);
    try {
      await api.post(`/reproduction/${cycleActif.uuid_id || cycleActif.id}/collectes`, formCollecte, { headers });
      setVue('liste'); setFormCollecte({ date_collecte: new Date().toISOString().split('T')[0], nombre_oeufs: '', observations: '' });
      charger(); chargerCollectes(cycleActif.uuid_id || cycleActif.id);
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const enregistrerEclosion = async () => {
    setEnvoi(true);
    try {
      const poussinsEclos = parseInt(formEclosion.poussins_eclos) || 0;
      const poussinsViables = parseInt(formEclosion.poussins_viables) || 0;
      const tauxEclosion = cycleActif.oeufs_envoyes > 0 ? ((poussinsEclos / cycleActif.oeufs_envoyes) * 100).toFixed(1) : 0;
      await api.put(`/reproduction/${cycleActif.uuid_id || cycleActif.id}`, {
        ...formEclosion, poussins_eclos: poussinsEclos, poussins_viables: poussinsViables, taux_eclosion: tauxEclosion, statut: 'termine',
      }, { headers });
      setVue('liste'); charger();
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const supprimerCycle = (cycle) => {
    Alert.alert('Supprimer', `Supprimer le cycle "${cycle.generation}${cycle.nom ? ' · ' + cycle.nom : ''}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/reproduction/${cycle.uuid_id || cycle.id}`, { headers }); charger(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
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
            <Text style={styles.infoTexte}>On garde la création simple — tu pourras ajouter les détails de ponte et couveuse ensuite.</Text>
            <Text style={styles.label}>Génération</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {['G1','G2','G3','G4','G5'].map(g => (
                <TouchableOpacity key={g} onPress={() => setFormCycle({ ...formCycle, generation: g })} style={[styles.chip, formCycle.generation === g && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formCycle.generation === g && styles.chipTexteActif]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Generations')}>
              <Text style={styles.lienGenerations}>Voir/gérer les générations existantes →</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Nom du cycle</Text>
            <TextInput style={styles.champ} placeholder="Ex: Cycle Nov. 2026" value={formCycle.nom} onChangeText={v => setFormCycle({ ...formCycle, nom: v })} />
          </View>
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

  // --- FORMULAIRE PONTE ---
  if (vue === 'ponte') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Détails de la ponte" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Femelles</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formPonte.nb_femelles} onChangeText={v => setFormPonte({ ...formPonte, nb_femelles: v })} />
            <Text style={styles.label}>Mâles</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formPonte.nb_males} onChangeText={v => setFormPonte({ ...formPonte, nb_males: v })} />
            <Text style={styles.label}>Début ponte (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formPonte.date_debut_ponte} onChangeText={v => setFormPonte({ ...formPonte, date_debut_ponte: v })} />
            <Text style={styles.label}>Fin ponte (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formPonte.date_fin_ponte} onChangeText={v => setFormPonte({ ...formPonte, date_fin_ponte: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerPonte} disabled={envoi}>
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
            <TextInput style={styles.champ} keyboardType="numeric" value={formCouveuse.oeufs_envoyes} onChangeText={v => setFormCouveuse({ ...formCouveuse, oeufs_envoyes: v })} />
            <Text style={styles.label}>Coût couveuse (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formCouveuse.cout_couveuse} onChangeText={v => setFormCouveuse({ ...formCouveuse, cout_couveuse: v })} />
            <Text style={styles.label}>Durée incubation (jours)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formCouveuse.duree_incubation} onChangeText={v => setFormCouveuse({ ...formCouveuse, duree_incubation: v })} />
            <Text style={styles.label}>Date éclosion prévue (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formCouveuse.date_eclosion_prevue} onChangeText={v => setFormCouveuse({ ...formCouveuse, date_eclosion_prevue: v })} />
          </View>
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
        <Header titre="Collecte d'œufs" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Date de collecte (AAAA-MM-JJ)</Text>
            <TextInput style={styles.champ} value={formCollecte.date_collecte} onChangeText={v => setFormCollecte({ ...formCollecte, date_collecte: v })} />
            <Text style={styles.label}>Nombre d'œufs *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={formCollecte.nombre_oeufs} onChangeText={v => setFormCollecte({ ...formCollecte, nombre_oeufs: v })} />
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formCollecte.observations} onChangeText={v => setFormCollecte({ ...formCollecte, observations: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerCollecte} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer la collecte'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
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
            <Text style={styles.label}>Observations</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formEclosion.observations} onChangeText={v => setFormEclosion({ ...formEclosion, observations: v })} />
          </View>
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
        action={
          <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('cycle')}>
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
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('cycle')}>
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
                <View style={styles.grille2noire}>
                  <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>Femelles</Text><Text style={styles.miniNoireValeur}>{cycleActif.nb_femelles || '—'}</Text></View>
                  <View style={styles.miniNoire}><Text style={styles.miniNoireLabel}>Mâles</Text><Text style={styles.miniNoireValeur}>{cycleActif.nb_males || '—'}</Text></View>
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
                    <TouchableOpacity style={styles.boutonVert} onPress={() => setVue('eclosion')}>
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
                <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('collecte')}>
                  <Text style={styles.boutonPetitTexte}>+ Collecte</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.carte}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>Effectifs & dates de ponte</Text>
                  <TouchableOpacity onPress={() => setVue('ponte')}><Text style={styles.lienModifier}>Modifier</Text></TouchableOpacity>
                </View>
                <View style={styles.grille2}>
                  <View><Text style={styles.miniLabel}>Total œufs</Text><Text style={styles.miniValeurGrande}>{cycleActif.oeufs_collectes || 0}</Text></View>
                  <View><Text style={styles.miniLabel}>Taux ponte moyen</Text>
                    <Text style={[styles.miniValeurGrande, { color: '#BE185D' }]}>
                      {cycleActif.nb_femelles && collectes.length > 0 ? `${((cycleActif.oeufs_collectes / (cycleActif.nb_femelles * collectes.length)) * 100).toFixed(1)}%` : '—'}
                    </Text>
                  </View>
                </View>
              </View>
              {collectes.length === 0 ? (
                <View style={styles.videCarte}>
                  <Text style={styles.vide}>Aucune collecte enregistrée</Text>
                  <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('collecte')}>
                    <Text style={styles.boutonPrincipalTexte}>Enregistrer une collecte</Text>
                  </TouchableOpacity>
                </View>
              ) : collectes.map(c => (
                <View style={styles.carte} key={c.id}>
                  <View style={styles.ligneEntre}>
                    <Text style={styles.carteTitre}>{new Date(c.date_collecte).toLocaleDateString('fr-FR')}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1D1D1F' }}>{c.nombre_oeufs} 🥚</Text>
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
                  <TouchableOpacity onPress={() => setVue('couveuse')}><Text style={styles.lienModifier}>Modifier</Text></TouchableOpacity>
                </View>
                <LigneInfo label="Prestataire" value={cycleActif.prestataire_couveuse || '—'} />
                <LigneInfo label="Œufs envoyés" value={cycleActif.oeufs_envoyes || '—'} />
                <LigneInfo label="Coût" value={cycleActif.cout_couveuse ? formatMontant(cycleActif.cout_couveuse) : '—'} />
                <LigneInfo label="Durée incubation" value={`${cycleActif.duree_incubation || 28} jours`} />
              </View>
              {cycleActif.statut !== 'termine' && (
                <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('eclosion')}>
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
                </View>
                <View style={[styles.badge, { backgroundColor: STATUTS[cycle.statut]?.bg || '#F3F4F6' }]}>
                  <Text style={[styles.badgeTexte, { color: STATUTS[cycle.statut]?.text || '#4B5563' }]}>{STATUTS[cycle.statut]?.label || cycle.statut}</Text>
                </View>
              </View>
              <View style={styles.infoWebBloc}>
                <Text style={styles.infoWebTexte}>Suppression disponible depuis le site web</Text>
              </View>
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
  infoWebBloc: { backgroundColor: "#F5F5F7", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  infoWebTexte: { color: "#6E6E73", fontSize: 11 },
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  infoTexte: { fontSize: 12, color: '#6E6E73', marginBottom: 8 },
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
  carteNoire: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireTitre: { color: '#fff', fontSize: 13, fontWeight: '600' },
  grille2noire: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  miniNoire: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, width: '47%' },
  miniNoireLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  miniNoireValeur: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 11, fontWeight: '600' },
  progressLabel: { fontSize: 11, color: '#6E6E73' },
  progressFond: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  progressBarreOrange: { height: '100%', backgroundColor: '#FB923C', borderRadius: 4 },
  sectionTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  grille2: { flexDirection: 'row', gap: 20, marginTop: 10 },
  miniLabel: { fontSize: 11, color: '#6E6E73' },
  miniValeurGrande: { fontSize: 20, fontWeight: '600', color: '#1D1D1F', marginTop: 2 },
  lienModifier: { fontSize: 11, color: '#6E6E73', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoLabel: { fontSize: 12, color: '#6E6E73', paddingVertical: 6 },
  infoValeur: { fontSize: 12, fontWeight: '600', color: '#1D1D1F', paddingVertical: 6 },
  actionRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  actionRougeTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
});

export default ReproductionScreen;