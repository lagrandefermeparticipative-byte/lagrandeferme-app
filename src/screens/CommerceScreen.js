import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

const STATUTS_VENTE = {
  payee: { label: 'Payée', bg: '#ECFDF5', text: '#047857' },
  en_attente: { label: 'En attente', bg: '#F3F4F6', text: '#4B5563' },
  partielle: { label: 'Part. payée', bg: '#FFF7ED', text: '#C2410C' },
};

const TYPES_ACHETEUR = ['Particulier', 'Marché', 'Revendeur', 'Restaurant', 'Exportateur', 'Autre'];
const MODES_PAIEMENT = ['Mobile Money', 'Espèces', 'Virement', 'Crédit'];

const CommerceScreen = ({ token, projetActifId }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [ventes, setVentes] = useState([]);
  const [acheteurs, setAcheteurs] = useState([]);
  const [lots, setLots] = useState([]);
  const [projet, setProjet] = useState(null);
  const [tousProjets, setTousProjets] = useState([]);
  const [projetVenteId, setProjetVenteId] = useState(projetActifId);
  const [lotsProjetVente, setLotsProjetVente] = useState([]);
  const [erreurLotsProjetVente, setErreurLotsProjetVente] = useState('');
  const [lotsDisponibles, setLotsDisponibles] = useState([]);
  const [chargementDisponibles, setChargementDisponibles] = useState(true);
  const lotSouhaiteRef = useRef(null);
  const [onglet, setOnglet] = useState('ventes');
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState('liste'); // liste | vente | acheteur
  const [acheteurEnEdition, setAcheteurEnEdition] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const [formVente, setFormVente] = useState({
    lot_id: '', date_vente: new Date().toISOString().split('T')[0],
    males_vendus: '', femelles_vendues: '', prix_male: '4200', prix_femelle: '5000',
    acheteur: '', type_acheteur: 'Particulier', mode_paiement: 'Mobile Money', notes: '',
  });
  // Paiement réel d'une vente — seul point d'entrée qui encaisse la caisse.
  const [venteEnPaiement, setVenteEnPaiement] = useState(null);
  const [montantPaiement, setMontantPaiement] = useState('');
  const [formAcheteur, setFormAcheteur] = useState({ nom: '', type: 'Particulier', telephone: '', email: '', mode_paiement_prefere: 'Mobile Money', notes: '' });

  const charger = async () => {
    try {
      const [ventesRes, acheteursRes, projetRes, lotsRes] = await Promise.all([
        api.get('/ventes', { headers }),
        api.get('/acheteurs', { headers }),
        api.get(`/projets/${projetActifId}`, { headers }),
        api.get(`/lots?projet_id=${projetActifId}`, { headers }),
      ]);
      setVentes(ventesRes.data);
      setAcheteurs(acheteursRes.data);
      setLots(lotsRes.data);
      setProjet(projetRes.data);
      setFormVente(prev => ({
        ...prev,
        prix_male: String(projetRes.data.prix_vente_male || 4200),
        prix_femelle: String(projetRes.data.prix_vente_femelle || 5000),
        lot_id: lotsRes.data.length > 0 ? String(lotsRes.data[0].uuid_id || lotsRes.data[0].id) : '',
      }));
    } catch (error) { console.log('Erreur commerce:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => {
    if (projetActifId) {
      setChargement(true);
      charger();
    }
  }, [projetActifId]);

  useEffect(() => {
    api.get('/projets', { headers }).then(res => setTousProjets(res.data)).catch(error => console.log('Erreur chargement projets:', error.message));
  }, []);

  useEffect(() => {
    if (!projetVenteId) return;
    setErreurLotsProjetVente('');
    api.get(`/lots?projet_id=${projetVenteId}`, { headers })
      .then(res => {
        setLotsProjetVente(res.data);
        const lotVoulu = lotSouhaiteRef.current;
        lotSouhaiteRef.current = null;
        setFormVente(prev => ({ ...prev, lot_id: lotVoulu || (res.data.length > 0 ? String(res.data[0].uuid_id || res.data[0].id) : '') }));
      })
      .catch(() => { setLotsProjetVente([]); setErreurLotsProjetVente('Impossible de charger les lots — vérifie ta connexion.'); });
  }, [projetVenteId]);

  // Ce qui change concrètement quand un lot passe en "vente activée" : il
  // apparaît ici, groupé par projet, prêt à être vendu en un clic. Un seul
  // aller-retour serveur (au lieu d'un fetch par projet).
  const chargerLotsDisponibles = () => {
    setChargementDisponibles(true);
    api.get('/lots/disponibles-vente', { headers })
      .then(res => setLotsDisponibles(res.data))
      .catch(error => { console.log('Erreur lots disponibles à la vente:', error.message); setLotsDisponibles([]); })
      .finally(() => setChargementDisponibles(false));
  };

  useEffect(() => { chargerLotsDisponibles(); }, []);

  const demarrerVenteLot = (lot) => {
    lotSouhaiteRef.current = String(lot.uuid_id || lot.id);
    setProjetVenteId(lot.projet_uuid_id || lot.projet_id);
    setVue('vente');
  };

  const recetteEstimee = () => {
    const m = parseFloat(formVente.males_vendus) || 0;
    const f = parseFloat(formVente.femelles_vendues) || 0;
    return (m * parseFloat(formVente.prix_male || 0)) + (f * parseFloat(formVente.prix_femelle || 0));
  };

  const lotChoisi = lotsProjetVente.find(l => String(l.uuid_id || l.id) === formVente.lot_id);
  const vivantsDisponibles = lotChoisi ? parseInt(lotChoisi.vivants || lotChoisi.quantite_initiale) : null;
  const totalAVendre = (parseInt(formVente.males_vendus) || 0) + (parseInt(formVente.femelles_vendues) || 0);
  const depasseDisponible = vivantsDisponibles !== null && totalAVendre > vivantsDisponibles;

  const creerVente = async () => {
    if (!formVente.lot_id) { Alert.alert('Champ manquant', 'Choisis le lot vendu.'); return; }
    setEnvoi(true);
    try {
      const nomLotVendu = lotChoisi?.nom;
      const resteApresVente = vivantsDisponibles !== null ? vivantsDisponibles - totalAVendre : null;
      await api.post('/ventes', {
        ...formVente, projet_id: projetVenteId,
        males_vendus: parseInt(formVente.males_vendus) || 0,
        femelles_vendues: parseInt(formVente.femelles_vendues) || 0,
        prix_male: parseFloat(formVente.prix_male), prix_femelle: parseFloat(formVente.prix_femelle),
        recette_totale: recetteEstimee(),
      }, { headers });
      setVue('liste'); charger(); chargerLotsDisponibles();
      if (resteApresVente !== null && resteApresVente <= 0) {
        Alert.alert('Vente enregistrée', `Le lot "${nomLotVendu}" est maintenant entièrement vendu.`);
      } else {
        Alert.alert('Vente enregistrée', 'La vente a bien été enregistrée.');
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Enregistrement impossible.");
    } finally { setEnvoi(false); }
  };

  const ouvrirPaiement = (vente) => {
    const reste = parseFloat(vente.recette_totale || 0) - parseFloat(vente.montant_paye || 0);
    setVenteEnPaiement(vente);
    setMontantPaiement(reste > 0 ? String(reste) : '');
    setVue('paiement');
  };

  const confirmerPaiement = async () => {
    if (!montantPaiement || parseFloat(montantPaiement) <= 0) return;
    setEnvoi(true);
    try {
      await api.post(`/ventes/${venteEnPaiement.uuid_id || venteEnPaiement.id}/paiements`, {
        montant: parseFloat(montantPaiement),
      }, { headers });
      setVue('liste'); setVenteEnPaiement(null); setMontantPaiement('');
      charger();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Enregistrement du paiement impossible.");
    } finally { setEnvoi(false); }
  };

  const creerOuModifierAcheteur = async () => {
    setEnvoi(true);
    try {
      if (acheteurEnEdition) await api.put(`/acheteurs/${acheteurEnEdition.uuid_id || acheteurEnEdition.id}`, formAcheteur, { headers });
      else await api.post('/acheteurs', formAcheteur, { headers });
      setVue('liste'); setAcheteurEnEdition(null);
      setFormAcheteur({ nom: '', type: 'Particulier', telephone: '', email: '', mode_paiement_prefere: 'Mobile Money', notes: '' });
      charger();
    } catch (error) { Alert.alert('Erreur', "Enregistrement impossible."); }
    finally { setEnvoi(false); }
  };

  const supprimerVente = (vente) => {
    Alert.alert('Supprimer', 'Supprimer cette vente ? La caisse et le stock du lot seront ajustés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/ventes/${vente.uuid_id || vente.id}`, { headers }); charger(); chargerLotsDisponibles(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  const supprimerAcheteur = (acheteur) => {
    Alert.alert('Supprimer', `Supprimer "${acheteur.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await api.delete(`/acheteurs/${acheteur.uuid_id || acheteur.id}`, { headers }); charger(); }
        catch { Alert.alert('Erreur', 'Suppression impossible.'); }
      }},
    ]);
  };

  // Chaque projet a sa propre caisse — voir l'argent qui rentre mélangé
  // entre tous les projets n'a pas de sens, d'où ce regroupement.
  const ventesParProjet = ventes.reduce((acc, v) => {
    const nom = v.projet_nom || 'Projet inconnu';
    if (!acc[nom]) acc[nom] = [];
    acc[nom].push(v);
    return acc;
  }, {});

  // --- FORMULAIRE VENTE ---
  if (vue === 'vente') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Nouvelle vente" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Projet *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {tousProjets.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setProjetVenteId(p.uuid_id || p.id)}
                  style={[styles.chip, String(projetVenteId) === String(p.uuid_id || p.id) && styles.chipActif]}>
                  <Text style={[styles.chipTexte, String(projetVenteId) === String(p.uuid_id || p.id) && styles.chipTexteActif]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.label, { marginTop: 12 }]}>Lot vendu *</Text>
            {erreurLotsProjetVente !== '' && <Text style={styles.erreurTexte}>{erreurLotsProjetVente}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {lotsProjetVente.map(l => {
                const vivantsLot = parseInt(l.vivants ?? l.quantite_initiale);
                const epuise = vivantsLot <= 0;
                const venteNonActivee = !epuise && !l.vente_activee;
                const desactive = epuise || venteNonActivee;
                return (
                  <TouchableOpacity key={l.id} disabled={desactive}
                    onPress={() => setFormVente({ ...formVente, lot_id: String(l.uuid_id || l.id) })}
                    style={[styles.chip, formVente.lot_id === String(l.uuid_id || l.id) && styles.chipActif, desactive && { opacity: 0.4 }]}>
                    <Text style={[styles.chipTexte, formVente.lot_id === String(l.uuid_id || l.id) && styles.chipTexteActif]}>
                      {l.nom}{epuise ? ' (épuisé)' : venteNonActivee ? ' (vente non activée)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {lotChoisi && <Text style={styles.infoTexte}>{vivantsDisponibles} sujets vivants dans ce lot</Text>}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mâles vendus</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={formVente.males_vendus} onChangeText={v => setFormVente({ ...formVente, males_vendus: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prix mâle (F)</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={formVente.prix_male} onChangeText={v => setFormVente({ ...formVente, prix_male: v })} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Femelles vendues</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={formVente.femelles_vendues} onChangeText={v => setFormVente({ ...formVente, femelles_vendues: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prix femelle (F)</Text>
                <TextInput style={styles.champ} keyboardType="numeric" value={formVente.prix_femelle} onChangeText={v => setFormVente({ ...formVente, prix_femelle: v })} />
              </View>
            </View>

            {depasseDisponible && (
              <View style={styles.alerteRougeLegere}>
                <Text style={styles.alerteRougeLegereTexte}>⚠️ Tu essaies de vendre {totalAVendre} sujets mais ce lot n'en a que {vivantsDisponibles} de vivants.</Text>
              </View>
            )}

            {recetteEstimee() > 0 && (
              <View style={styles.encartVert}>
                <Text style={styles.encartVertLabel}>Recette totale</Text>
                <Text style={styles.encartVertValeur}>{formatMontant(recetteEstimee())}</Text>
                <Text style={styles.encartVertSous}>Vente créée "en attente" — l'encaissement se fera via un paiement dédié.</Text>
              </View>
            )}

            <Text style={styles.label}>Acheteur</Text>
            {acheteurs.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {acheteurs.map(a => (
                    <TouchableOpacity key={a.id} onPress={() => setFormVente({ ...formVente, acheteur: a.nom })} style={[styles.chip, formVente.acheteur === a.nom && styles.chipActif]}>
                      <Text style={[styles.chipTexte, formVente.acheteur === a.nom && styles.chipTexteActif]}>{a.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            <TextInput style={styles.champ} placeholder="Nom de l'acheteur (ou choisis ci-dessus)" value={formVente.acheteur} onChangeText={v => setFormVente({ ...formVente, acheteur: v })} />

            <Text style={styles.label}>Type acheteur</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TYPES_ACHETEUR.map(t => (
                <TouchableOpacity key={t} onPress={() => setFormVente({ ...formVente, type_acheteur: t })} style={[styles.chip, formVente.type_acheteur === t && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formVente.type_acheteur === t && styles.chipTexteActif]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Mode de paiement</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MODES_PAIEMENT.map(m => (
                <TouchableOpacity key={m} onPress={() => setFormVente({ ...formVente, mode_paiement: m })} style={[styles.chip, formVente.mode_paiement === m && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formVente.mode_paiement === m && styles.chipTexteActif]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formVente.notes} onChangeText={v => setFormVente({ ...formVente, notes: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={creerVente} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer la vente'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setVue('liste')}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- PAIEMENT D'UNE VENTE ---
  if (vue === 'paiement' && venteEnPaiement) {
    const reste = parseFloat(venteEnPaiement.recette_totale || 0) - parseFloat(venteEnPaiement.montant_paye || 0);
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Enregistrer un paiement" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Vente : {venteEnPaiement.acheteur || 'Acheteur inconnu'} — {formatMontant(venteEnPaiement.recette_totale)}</Text>
            <Text style={styles.carteSousTexte}>Déjà encaissé : {formatMontant(venteEnPaiement.montant_paye)} · Reste dû : {formatMontant(reste)}</Text>
            <Text style={styles.label}>Montant reçu maintenant (F) *</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={montantPaiement} onChangeText={setMontantPaiement} />
            <Text style={styles.infoTexte}>Ce paiement créditera immédiatement la caisse du projet.</Text>
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={confirmerPaiement} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Confirmer le paiement'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setVenteEnPaiement(null); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- FORMULAIRE ACHETEUR ---
  if (vue === 'acheteur') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre={acheteurEnEdition ? "Modifier l'acheteur" : 'Nouvel acheteur'} />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom *</Text>
            <TextInput style={styles.champ} value={formAcheteur.nom} onChangeText={v => setFormAcheteur({ ...formAcheteur, nom: v })} />
            <Text style={styles.label}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {TYPES_ACHETEUR.slice(0, 5).map(t => (
                <TouchableOpacity key={t} onPress={() => setFormAcheteur({ ...formAcheteur, type: t })} style={[styles.chip, formAcheteur.type === t && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formAcheteur.type === t && styles.chipTexteActif]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.champ} placeholder="+228XXXXXXXX" value={formAcheteur.telephone} onChangeText={v => setFormAcheteur({ ...formAcheteur, telephone: v })} />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.champ} placeholder="email@example.com" value={formAcheteur.email} onChangeText={v => setFormAcheteur({ ...formAcheteur, email: v })} />
            <Text style={styles.label}>Mode paiement préféré</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {MODES_PAIEMENT.slice(0, 3).map(m => (
                <TouchableOpacity key={m} onPress={() => setFormAcheteur({ ...formAcheteur, mode_paiement_prefere: m })} style={[styles.chip, formAcheteur.mode_paiement_prefere === m && styles.chipActif]}>
                  <Text style={[styles.chipTexte, formAcheteur.mode_paiement_prefere === m && styles.chipTexteActif]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline value={formAcheteur.notes} onChangeText={v => setFormAcheteur({ ...formAcheteur, notes: v })} />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={creerOuModifierAcheteur} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : acheteurEnEdition ? 'Enregistrer les modifications' : "Enregistrer l'acheteur"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setAcheteurEnEdition(null); }}>
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
      <Header titre="Commerce" sousTitre="Acheteurs & Ventes"
        action={
          onglet === 'ventes' ? (
            <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('vente')}><Text style={styles.boutonPetitTexte}>+ Vente</Text></TouchableOpacity>
          ) : onglet === 'acheteurs' ? (
            <TouchableOpacity style={styles.boutonPetit} onPress={() => setVue('acheteur')}><Text style={styles.boutonPetitTexte}>+ Acheteur</Text></TouchableOpacity>
          ) : null
        }
      />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.ongletsLigne}>
            {['a_vendre', 'ventes', 'acheteurs'].map(t => (
              <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
                <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>{t === 'a_vendre' ? 'À vendre' : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {onglet === 'a_vendre' && (
            chargementDisponibles ? (
              <View style={styles.centre}><ActivityIndicator size="small" color="#1D1D1F" /></View>
            ) : lotsDisponibles.length === 0 ? (
              <View style={styles.videCarte}>
                <Text style={styles.vide}>Aucun lot n'est actuellement ouvert à la vente.</Text>
                <Text style={[styles.infoTexte, { textAlign: 'center' }]}>Active la vente d'un lot depuis l'écran Élevage d'un projet pour qu'il apparaisse ici.</Text>
              </View>
            ) : lotsDisponibles.map(lot => (
              <View style={styles.carte} key={lot.id}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{lot.projet_nom}</Text>
                  <View style={styles.badge2Vert}><Text style={styles.badge2VertTexte}>Vente activée</Text></View>
                </View>
                <Text style={styles.carteSousTexte}>{lot.nom} · {parseInt(lot.vivants ?? lot.quantite_initiale)} sujets vivants disponibles</Text>
                <TouchableOpacity style={[styles.boutonPrincipal, { marginTop: 10 }]} onPress={() => demarrerVenteLot(lot)}>
                  <Text style={styles.boutonPrincipalTexte}>Vendre depuis ce lot</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {onglet === 'ventes' && (
            <View>
              {ventes.length === 0 ? (
                <View style={styles.videCarte}>
                  <Text style={styles.vide}>Aucune vente enregistrée</Text>
                  <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('vente')}>
                    <Text style={styles.boutonPrincipalTexte}>Enregistrer une vente</Text>
                  </TouchableOpacity>
                </View>
              ) : Object.entries(ventesParProjet).map(([nomProjet, ventesProjet]) => {
                const recetteProjet = ventesProjet.reduce((s, v) => s + parseFloat(v.recette_totale || 0), 0);
                const payeeProjet = ventesProjet.reduce((s, v) => s + parseFloat(v.montant_paye || 0), 0);
                const enAttenteProjet = recetteProjet - payeeProjet;
                const vendusProjet = ventesProjet.reduce((s, v) => s + (parseInt(v.males_vendus) || 0) + (parseInt(v.femelles_vendues) || 0), 0);
                const ventesNonSoldees = ventesProjet.filter(v => v.statut_paiement !== 'payee');
                const sujetsEnAttenteProjet = ventesNonSoldees.reduce((s, v) => s + (parseInt(v.males_vendus) || 0) + (parseInt(v.femelles_vendues) || 0), 0);
                return (
                  <View key={nomProjet} style={{ marginBottom: 16 }}>
                    <Text style={[styles.groupeTitre, { marginBottom: 8, paddingHorizontal: 2 }]}>{nomProjet}</Text>
                    <View style={styles.carteNoire}>
                      <Text style={styles.carteNoireLabel}>Total encaissé</Text>
                      <Text style={styles.carteNoireMontant}>{formatMontant(payeeProjet)}</Text>
                      <View style={{ gap: 8, marginTop: 12 }}>
                        <View style={[styles.miniNoire, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                          <Text style={styles.miniNoireLabel}>Sujets vendus</Text>
                          <Text style={styles.miniNoireValeur}>{vendusProjet}</Text>
                        </View>
                        <View style={[styles.miniNoire, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                          <Text style={styles.miniNoireLabel}>En attente</Text>
                          <Text style={styles.miniNoireValeur}>{formatMontant(enAttenteProjet)} · {sujetsEnAttenteProjet} sujet{sujetsEnAttenteProjet > 1 ? 's' : ''}</Text>
                        </View>
                        <View style={[styles.miniNoire, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                          <Text style={styles.miniNoireLabel}>Total des ventes</Text>
                          <Text style={styles.miniNoireValeur}>{formatMontant(recetteProjet)}</Text>
                        </View>
                      </View>
                    </View>
                    {ventesProjet.map(vente => {
                      const badge = STATUTS_VENTE[vente.statut_paiement] || STATUTS_VENTE.en_attente;
                      return (
                        <View style={styles.carte} key={vente.id}>
                          <View style={styles.ligneEntre}>
                            <Text style={styles.carteTitre}>{vente.acheteur || 'Acheteur inconnu'}</Text>
                            <View style={[styles.badge, { backgroundColor: badge.bg }]}><Text style={[styles.badgeTexte, { color: badge.text }]}>{badge.label}</Text></View>
                          </View>
                          <Text style={styles.carteSousTexte}>{new Date(vente.date_vente).toLocaleDateString('fr-FR')} · {vente.lot_nom || 'Lot inconnu'} · {vente.type_acheteur}</Text>
                          <View style={styles.grille3}>
                            <View style={styles.statBleue}><Text style={styles.statBleueTexte}>{vente.males_vendus}</Text><Text style={styles.statBleueLabel}>Mâles{parseInt(vente.males_vendus) > 0 ? ` · ${formatMontant(vente.prix_male)}` : ''}</Text></View>
                            <View style={styles.statRose}><Text style={styles.statRoseTexte}>{vente.femelles_vendues}</Text><Text style={styles.statRoseLabel}>Femelles{parseInt(vente.femelles_vendues) > 0 ? ` · ${formatMontant(vente.prix_femelle)}` : ''}</Text></View>
                            <View style={styles.statVerte}><Text style={styles.statVerteTexte}>{formatMontant(vente.recette_totale)}</Text><Text style={styles.statVerteLabel}>Recette</Text></View>
                          </View>
                          {vente.statut_paiement !== 'en_attente' && (
                            <Text style={styles.carteSousTexte}>Encaissé : {formatMontant(vente.montant_paye)} · Reste : {formatMontant(vente.recette_totale - vente.montant_paye)}</Text>
                          )}
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                            {vente.statut_paiement !== 'payee' && (
                              <TouchableOpacity style={styles.actionVerte} onPress={() => ouvrirPaiement(vente)}><Text style={styles.actionVerteTexte}>Enregistrer un paiement</Text></TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.actionRouge2} onPress={() => supprimerVente(vente)}><Text style={styles.actionRouge2Texte}>Supprimer</Text></TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}

          {onglet === 'acheteurs' && (
            acheteurs.length === 0 ? (
              <View style={styles.videCarte}>
                <Text style={styles.vide}>Aucun acheteur enregistré</Text>
                <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setVue('acheteur')}>
                  <Text style={styles.boutonPrincipalTexte}>Ajouter un acheteur</Text>
                </TouchableOpacity>
              </View>
            ) : acheteurs.map(acheteur => (
              <View style={styles.carte} key={acheteur.id}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>{acheteur.nom}</Text>
                  <View style={styles.badgeBleu}><Text style={styles.badgeBleuTexte}>{acheteur.type}</Text></View>
                </View>
                {acheteur.telephone && <Text style={styles.carteSousTexte}>📞 {acheteur.telephone}</Text>}
                {acheteur.email && <Text style={styles.carteSousTexte}>✉️ {acheteur.email}</Text>}
                <Text style={styles.carteSousTexte}>💳 {acheteur.mode_paiement_prefere}</Text>
                {acheteur.credit_du > 0 && <Text style={styles.creditTexte}>Crédit dû : {formatMontant(acheteur.credit_du)}</Text>}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                  <TouchableOpacity style={styles.actionGrise} onPress={() => { setAcheteurEnEdition(acheteur); setFormAcheteur({ nom: acheteur.nom, type: acheteur.type, telephone: acheteur.telephone || '', email: acheteur.email || '', mode_paiement_prefere: acheteur.mode_paiement_prefere, notes: acheteur.notes || '' }); setVue('acheteur'); }}>
                    <Text style={styles.actionGriseTexte}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionRouge2} onPress={() => supprimerAcheteur(acheteur)}><Text style={styles.actionRouge2Texte}>Supprimer</Text></TouchableOpacity>
                </View>
              </View>
            ))
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
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 2 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', marginRight: 6, marginBottom: 6 },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  infoTexte: { fontSize: 11, color: '#6E6E73', marginTop: 6 },
  alerteRougeLegere: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, padding: 8, marginTop: 10 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginBottom: 4 },
  alerteRougeLegereTexte: { color: '#DC2626', fontSize: 11 },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, padding: 12, marginTop: 10 },
  encartVertLabel: { fontSize: 11, color: '#059669' },
  encartVertValeur: { fontSize: 18, fontWeight: '600', color: '#047857' },
  encartVertSous: { fontSize: 10, color: '#059669', marginTop: 4 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  boutonPetit: { backgroundColor: '#1D1D1F', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  boutonPetitTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videCarte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E5E5EA', padding: 30, alignItems: 'center' },
  vide: { color: '#6E6E73', fontSize: 13, marginBottom: 10 },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E5EA', marginBottom: 14, marginTop: 8 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#1D1D1F' },
  ongletTexte: { fontSize: 13, color: '#6E6E73', fontWeight: '500' },
  ongletTexteActif: { color: '#1D1D1F' },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  carteNoireMontant: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.5 },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 8 },
  grille2noire: { flexDirection: 'row', gap: 8, marginTop: 12 },
  miniNoire: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8 },
  miniNoireLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  miniNoireValeur: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  badgeBleu: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeBleuTexte: { color: '#1D4ED8', fontSize: 10, fontWeight: '600' },
  badge2Vert: { backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badge2VertTexte: { color: '#047857', fontSize: 10, fontWeight: '600' },
  groupeTitre: { fontSize: 14, fontWeight: '700', color: '#1D1D1F' },
  groupeSousTexte: { fontSize: 11, color: '#6E6E73' },
  grille3: { flexDirection: 'row', gap: 6, marginTop: 8 },
  statBleue: { flex: 1, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, alignItems: 'center' },
  statBleueTexte: { color: '#1D4ED8', fontSize: 13, fontWeight: '600' },
  statBleueLabel: { color: '#3B82F6', fontSize: 10 },
  statRose: { flex: 1, backgroundColor: '#FDF2F8', borderRadius: 8, padding: 8, alignItems: 'center' },
  statRoseTexte: { color: '#BE185D', fontSize: 13, fontWeight: '600' },
  statRoseLabel: { color: '#EC4899', fontSize: 10 },
  statVerte: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8, alignItems: 'center' },
  statVerteTexte: { color: '#047857', fontSize: 13, fontWeight: '600' },
  statVerteLabel: { color: '#10B981', fontSize: 10 },
  actionVerte: { flex: 1, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionVerteTexte: { color: '#047857', fontSize: 11, fontWeight: '600' },
  actionGrise: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionGriseTexte: { color: '#4B5563', fontSize: 11, fontWeight: '600' },
  actionRouge2: { flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionRouge2Texte: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  creditTexte: { color: '#DC2626', fontSize: 11, fontWeight: '600', marginTop: 4 },
});

export default CommerceScreen;