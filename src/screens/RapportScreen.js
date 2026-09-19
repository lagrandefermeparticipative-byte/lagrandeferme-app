import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import Header from '../components/Header';
import { useCache } from '../context/CacheContext';

const PHASES = [
  { value: 'demarrage', label: 'Démarrage' },
  { value: 'croissance', label: 'Croissance' },
  { value: 'finition', label: 'Finition' },
  { value: 'vente', label: 'Vente' },
];
const PERIODES = { semaine: { label: 'Semaine', jours: 7 }, mois: { label: 'Mois', jours: 30 }, trimestre: { label: 'Trimestre', jours: 90 }, semestre: { label: 'Semestre', jours: 182 }, annee: { label: 'Année', jours: 365 } };

const getSemaineEnCours = (dateDebutProjet) => {
  const debut = dateDebutProjet ? new Date(dateDebutProjet) : new Date();
  const diff = Math.floor((new Date() - debut) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diff + 1);
};

const RapportScreen = ({ token, projetActifId }) => {
  const { getCache, setCache } = useCache();
  const headers = { Authorization: `Bearer ${token}` };
  const [dateDebutProjet, setDateDebutProjet] = useState(null);
  const semaine = getSemaineEnCours(dateDebutProjet);
  const [etape, setEtape] = useState('cheptel');
  const [lots, setLots] = useState([]);
  const [lotChoisi, setLotChoisi] = useState(null);
  const [effectifTotal, setEffectifTotal] = useState(0);
  const [chargement, setChargement] = useState(getCache(`rapport_init_${projetActifId}`) ? false : true);
  const [mortaliteEnvoyee, setMortaliteEnvoyee] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState('');
  const [mortaliteForm, setMortaliteForm] = useState({ lot_id: '', nombre: '0', cause: 'Inconnue', date_mortalite: new Date().toISOString().split('T')[0], observations: '' });
  const [lotsRapport, setLotsRapport] = useState([]);
  const [toutesDepenses, setToutesDepenses] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [periodeJournal, setPeriodeJournal] = useState('semaine');
  const [observations, setObservations] = useState('');

  const depensesFiltrees = (() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - PERIODES[periodeJournal].jours);
    return toutesDepenses.filter(d => new Date(d.created_at) >= limite);
  })();
  const chargerLots = async (lotsData) => {
    setLots(lotsData);
    const total = lotsData.reduce((s, l) => s + parseInt(l.vivants || l.quantite_initiale), 0);
    setEffectifTotal(total);
    if (lotsData.length > 0) { setLotChoisi(lotsData[0]); setMortaliteForm(f => ({ ...f, lot_id: String(lotsData[0].id) })); }
    setLotsRapport(lotsData.map(l => ({ lot_id: l.id, lot_nom: l.nom, sante_score: 3, vaccination_effectuee: false, vaccin_type: "", phase_production: l.phase_actuelle || "demarrage", note: "" })));
  };
  const chargerTout = async (forcer = false) => {
    const cleCache = `rapport_init_${projetActifId}`;
    if (!forcer) {
      const cache = getCache(cleCache);
      if (cache) {
        chargerLots(cache.lots);
        setToutesDepenses(cache.depenses);
        setChargement(false);
        return;
      }
    }
    try {
      const [lotsRes, depensesRes] = await Promise.all([
        api.get(`/lots?projet_id=${projetActifId}`, { headers }),
        api.get(`/depenses?projet_id=${projetActifId}`, { headers }),
      ]);
      chargerLots(lotsRes.data);
      const depensesFiltrees = depensesRes.data.filter(d => d.type_depense !== "ferme");
      setToutesDepenses(depensesFiltrees);
      setCache(cleCache, { lots: lotsRes.data, depenses: depensesFiltrees });
    } catch (error) { console.log("Erreur chargement rapport:", error.message); }
    finally { setChargement(false); }
  };
  useEffect(() => {
    if (projetActifId) {
      chargerTout();
      api.get(`/projets/${projetActifId}`, { headers }).then(res => setDateDebutProjet(res.data.date_debut)).catch(() => {});
    }
  }, [projetActifId]);


  const modifierLotRapport = (lot_id, champ, valeur) => {
    setLotsRapport(prev => prev.map(l => l.lot_id === lot_id ? { ...l, [champ]: valeur } : l));
  };

  const soumettreMortalite = async () => {
    setEnvoi(true); setErreur('');
    try {
      if (parseInt(mortaliteForm.nombre) > 0) {
        await api.post('/lots/mortalites', { ...mortaliteForm, lot_id: parseInt(mortaliteForm.lot_id), nombre: parseInt(mortaliteForm.nombre) }, { headers });
      }
      setMortaliteEnvoyee(true); setEtape('rapport');
    } catch (error) { setErreur('Erreur lors de la mise à jour du cheptel.'); }
    finally { setEnvoi(false); }
  };

  const santeMoyenne = lotsRapport.length > 0 ? (lotsRapport.reduce((s, l) => s + l.sante_score, 0) / lotsRapport.length) : 0;
  const etatGlobalLabel = santeMoyenne >= 4 ? 'Bon' : santeMoyenne >= 2.5 ? 'Moyen' : 'Préoccupant';

  const genererJournalTexte = () => {
    if (depensesFiltrees.length === 0) return 'Aucune dépense sur la période sélectionnée.';
    return depensesFiltrees.map(d => `- ${d.libelle} : ${new Intl.NumberFormat('fr-FR').format(Math.round(d.montant_reel || d.montant_prevu || 0))} F`).join('\n');
  };

  const ajouterPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
    if (result.canceled) return;
    setUploadEnCours(true);
    try {
      for (const asset of result.assets) {
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'photo.jpg' });
        formData.append('upload_preset', 'lagrandeferme');
        const cloudRes = await fetch('https://api.cloudinary.com/v1_1/dv9db2wle/image/upload', { method: 'POST', body: formData });
        const cloudData = await cloudRes.json();
        if (cloudData.secure_url) setPhotos(prev => [...prev, cloudData.secure_url]);
      }
    } catch (error) { Alert.alert('Erreur', "Envoi des photos impossible."); }
    finally { setUploadEnCours(false); }
  };

  const supprimerPhoto = (url) => setPhotos(prev => prev.filter(p => p !== url));

  const soumettreRapport = async () => {
    setEnvoi(true); setErreur('');
    try {
      await api.post('/rapports', {
        observations, journal_activites: genererJournalTexte(), projet_id: projetActifId, semaine,
        effectif_debut: effectifTotal, morts_semaine: parseInt(mortaliteForm.nombre) || 0, cause_mortalite: mortaliteForm.cause,
        date_rapport: new Date().toISOString().split('T')[0], lots: lotsRapport, photos,
      }, { headers });
      setSucces(true);
    } catch (error) { setErreur('Erreur lors de la soumission. Réessayez.'); }
    finally { setEnvoi(false); }
  };

  if (succes) {
    return (
      <View style={styles.succesConteneur}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
        <Text style={styles.succesTitre}>Rapport S{semaine} soumis</Text>
        <Text style={styles.succesTexte}>Le gestionnaire va le relire avant diffusion.</Text>
        <TouchableOpacity style={styles.boutonPrincipal} onPress={() => { setSucces(false); setEtape('cheptel'); setMortaliteEnvoyee(false); setPhotos([]); setObservations(''); chargerLots(); }}>
          <Text style={styles.boutonPrincipalTexte}>Nouveau rapport</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre={`Rapport S${semaine}`} sousTitre={new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} sansRetour />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.progressLigne}>
            <View style={[styles.progressBarreSegment, (etape === 'cheptel' || etape === 'rapport') && styles.progressActive]} />
            <View style={[styles.progressBarreSegment, etape === 'rapport' && styles.progressActive]} />
          </View>

          {etape === 'cheptel' && (
            <View>
              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Mise à jour du cheptel</Text>
                <Text style={styles.carteSousTexte}>Enregistre les morts de la semaine avant de soumettre le rapport.</Text>
                <View style={styles.effectifBloc}>
                  <Text style={styles.effectifLabel}>Effectif total actuel</Text>
                  <Text style={styles.effectifValeur}>{effectifTotal}</Text>
                  <Text style={styles.effectifSous}>pintades vivantes · {lots.length} lot{lots.length > 1 ? 's' : ''}</Text>
                </View>
                {lots.length > 1 && (
                  <>
                    <Text style={styles.label}>Lot concerné</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {lots.map(l => (
                        <TouchableOpacity key={l.id} onPress={() => { setLotChoisi(l); setMortaliteForm({ ...mortaliteForm, lot_id: String(l.id) }); }} style={[styles.chip, mortaliteForm.lot_id === String(l.id) && styles.chipActif]}>
                          <Text style={[styles.chipTexte, mortaliteForm.lot_id === String(l.id) && styles.chipTexteActif]}>{l.nom}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
                {lotChoisi && <Text style={styles.infoBleu}>{lotChoisi.nom} · {parseInt(lotChoisi.vivants || lotChoisi.quantite_initiale)} vivants · {lotChoisi.phase_actuelle}</Text>}
                <Text style={styles.label}>Nombre de morts cette semaine</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={mortaliteForm.nombre} onChangeText={v => setMortaliteForm({ ...mortaliteForm, nombre: v })} />
                <Text style={styles.label}>Cause principale</Text>
                <TextInput style={styles.champ} value={mortaliteForm.cause} onChangeText={v => setMortaliteForm({ ...mortaliteForm, cause: v })} placeholder="Maladie, prédateur, accident..." />
                <Text style={styles.label}>Observations sur les morts</Text>
                <TextInput style={[styles.champ, { height: 60 }]} multiline value={mortaliteForm.observations} onChangeText={v => setMortaliteForm({ ...mortaliteForm, observations: v })} />
              </View>
              {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
              <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreMortalite} disabled={envoi}>
                <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Mise à jour...' : 'Mettre à jour le cheptel →'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEtape('rapport')}><Text style={styles.lienPasser}>Passer cette étape</Text></TouchableOpacity>
            </View>
          )}

          {etape === 'rapport' && (
            <View>
              {mortaliteEnvoyee && (
                <View style={styles.encartVert}><Text style={styles.encartVertTexte}>✓ Cheptel mis à jour — {mortaliteForm.nombre} mort(s) enregistré(s)</Text></View>
              )}
              <View style={styles.carteNoire}>
                <Text style={styles.carteNoireLabel}>Santé globale (moyenne des lots)</Text>
                <Text style={styles.carteNoireMontant}>{santeMoyenne.toFixed(1)}/5 <Text style={styles.etatLabel}>{etatGlobalLabel}</Text></Text>
              </View>

              <Text style={styles.sectionTitre}>Santé, vaccination et étape par lot</Text>
              {lotsRapport.map(lr => (
                <View key={lr.lot_id} style={styles.carte}>
                  <Text style={styles.carteTitre}>{lr.lot_nom}</Text>
                  <Text style={styles.label}>Score de santé ({lr.sante_score}/5)</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {[0, 1, 2, 3, 4, 5].map(score => (
                      <TouchableOpacity key={score} onPress={() => modifierLotRapport(lr.lot_id, 'sante_score', score)}
                        style={[styles.scoreBouton, lr.sante_score === score && (score >= 4 ? styles.scoreVert : score >= 2 ? styles.scoreOrange : styles.scoreRouge)]}>
                        <Text style={[styles.scoreTexte, lr.sante_score === score && { color: '#fff' }]}>{score}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.checkboxLigne} onPress={() => modifierLotRapport(lr.lot_id, 'vaccination_effectuee', !lr.vaccination_effectuee)}>
                    <View style={[styles.checkbox, lr.vaccination_effectuee && styles.checkboxActif]}>{lr.vaccination_effectuee && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}</View>
                    <Text style={styles.checkboxTexte}>Vaccination effectuée cette semaine</Text>
                  </TouchableOpacity>
                  {lr.vaccination_effectuee && <TextInput style={styles.champ} placeholder="Type de vaccin" value={lr.vaccin_type} onChangeText={v => modifierLotRapport(lr.lot_id, 'vaccin_type', v)} />}
                  <Text style={styles.label}>Étape de production</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {PHASES.map(p => (
                      <TouchableOpacity key={p.value} onPress={() => modifierLotRapport(lr.lot_id, 'phase_production', p.value)} style={[styles.chip, lr.phase_production === p.value && styles.chipActif]}>
                        <Text style={[styles.chipTexte, lr.phase_production === p.value && styles.chipTexteActif]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.label}>Note (optionnel)</Text>
                  <TextInput style={[styles.champ, { height: 50 }]} multiline value={lr.note} onChangeText={v => modifierLotRapport(lr.lot_id, 'note', v)} />
                </View>
              ))}

              <View style={styles.carte}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>Journal des activités</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {Object.entries(PERIODES).map(([key, p]) => (
                      <TouchableOpacity key={key} onPress={() => setPeriodeJournal(key)} style={[styles.chipMini, periodeJournal === key && styles.chipActif]}>
                        <Text style={[styles.chipMiniTexte, periodeJournal === key && styles.chipTexteActif]}>{p.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {depensesFiltrees.length === 0 ? <Text style={styles.videTexte}>Aucune dépense sur cette période.</Text> : depensesFiltrees.map(d => (
                  <View key={d.id} style={styles.depenseLigne}><Text style={styles.depenseTexte}>{d.libelle}</Text><Text style={styles.depenseMontant}>{new Intl.NumberFormat('fr-FR').format(Math.round(d.montant_reel || d.montant_prevu || 0))} F</Text></View>
                ))}
              </View>

              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Photos de la semaine</Text>
                <TouchableOpacity style={styles.boutonPhoto} onPress={ajouterPhotos} disabled={uploadEnCours}>
                  <Text style={styles.boutonPhotoTexte}>{uploadEnCours ? 'Envoi en cours...' : '+ Ajouter des photos'}</Text>
                </TouchableOpacity>
                {photos.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {photos.map(url => (
                      <View key={url}>
                        <Image source={{ uri: url }} style={styles.photoMiniature} />
                        <TouchableOpacity style={styles.supprimerPhoto} onPress={() => supprimerPhoto(url)}><Text style={{ color: '#fff', fontSize: 10 }}>✕</Text></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.carte}>
                <Text style={styles.carteTitre}>Autres observations</Text>
                <TextInput style={[styles.champ, { height: 70 }]} multiline placeholder="Tout autre point à signaler..." value={observations} onChangeText={setObservations} />
              </View>

              {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
              <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettreRapport} disabled={envoi}>
                <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Envoi en cours...' : `Soumettre le rapport S${semaine}`}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEtape('cheptel')}><Text style={styles.lienPasser}>← Retour au cheptel</Text></TouchableOpacity>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  succesConteneur: { flex: 1, backgroundColor: '#F5F5F7', justifyContent: 'center', alignItems: 'center', padding: 24 },
  succesTitre: { fontSize: 18, fontWeight: '600', color: '#1D1D1F', marginBottom: 4 },
  succesTexte: { fontSize: 13, color: '#6E6E73', textAlign: 'center', marginBottom: 16 },
  progressLigne: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 16 },
  progressBarreSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA' },
  progressActive: { backgroundColor: '#1D1D1F' },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 11, color: '#6E6E73', marginBottom: 10 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  effectifBloc: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 12, marginBottom: 10 },
  effectifLabel: { fontSize: 11, color: '#6E6E73' },
  effectifValeur: { fontSize: 22, fontWeight: '600', color: '#1D1D1F' },
  effectifSous: { fontSize: 11, color: '#6E6E73' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', marginRight: 6, marginTop: 4 },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  chipMini: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F3F4F6', marginRight: 4 },
  chipMiniTexte: { fontSize: 10, color: '#6E6E73' },
  infoBleu: { fontSize: 11, color: '#1D4ED8', backgroundColor: '#EFF6FF', padding: 8, borderRadius: 8, marginTop: 8 },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 8, marginBottom: 8 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  lienPasser: { textAlign: 'center', color: '#6E6E73', fontSize: 13, marginTop: 10, marginBottom: 10 },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, padding: 10, marginBottom: 10 },
  encartVertTexte: { color: '#047857', fontSize: 11, fontWeight: '600' },
  carteNoire: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireLabel: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  carteNoireMontant: { color: '#1D1D1F', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 4 },
  etatLabel: { fontSize: 13, color: '#FB923C', fontWeight: '600' },
  sectionTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  scoreBouton: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', alignItems: 'center' },
  scoreVert: { backgroundColor: '#059669', borderColor: '#059669' },
  scoreOrange: { backgroundColor: '#F97316', borderColor: '#F97316' },
  scoreRouge: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  scoreTexte: { fontSize: 12, fontWeight: '600', color: '#6E6E73' },
  checkboxLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  checkboxTexte: { fontSize: 12, color: '#374151' },
  videTexte: { color: '#6E6E73', fontSize: 12, paddingVertical: 8 },
  depenseLigne: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F5F5F7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  depenseTexte: { fontSize: 11, color: '#374151' },
  depenseMontant: { fontSize: 11, color: '#6E6E73' },
  boutonPhoto: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  boutonPhotoTexte: { color: '#4B5563', fontSize: 12, fontWeight: '600' },
  photoMiniature: { width: 90, height: 80, borderRadius: 8 },
  supprimerPhoto: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});

export default RapportScreen;