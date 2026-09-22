import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

const TYPES_ACHETEUR = ['Particulier', 'Marché', 'Revendeur', 'Restaurant', 'Exportateur', 'Autre'];
const MODES_PAIEMENT = ['Mobile Money', 'Espèces', 'Virement', 'Crédit'];

// Le technicien enregistre une vente sur le terrain, sans pouvoir
// l'encaisser : elle est créée "en attente" et c'est le gestionnaire qui la
// valide ensuite depuis Commerce, via "Enregistrer un paiement".
const VenteTechnicienScreen = ({ token, onRetour }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [projets, setProjets] = useState([]);
  const [projetId, setProjetId] = useState('');
  const [lots, setLots] = useState([]);
  const [chargementProjets, setChargementProjets] = useState(true);
  const [erreurProjets, setErreurProjets] = useState('');
  const [erreurLots, setErreurLots] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const [form, setForm] = useState({
    lot_id: '',
    date_vente: new Date().toISOString().split('T')[0],
    males_vendus: '',
    femelles_vendues: '',
    prix_male: '4200',
    prix_femelle: '5000',
    acheteur: '',
    type_acheteur: 'Particulier',
    mode_paiement: 'Mobile Money',
    notes: '',
  });

  useEffect(() => {
    api.get('/projets/moi/technicien', { headers })
      .then(res => {
        setProjets(res.data);
        if (res.data.length > 0) setProjetId(res.data[0].uuid_id || res.data[0].id);
      })
      .catch(() => setErreurProjets('Impossible de charger tes projets — vérifie ta connexion.'))
      .finally(() => setChargementProjets(false));
  }, []);

  useEffect(() => {
    if (!projetId) return;
    setErreurLots('');
    api.get(`/lots?projet_id=${projetId}`, { headers })
      .then(res => {
        setLots(res.data);
        setForm(prev => ({ ...prev, lot_id: res.data.length > 0 ? (res.data[0].uuid_id || res.data[0].id) : '' }));
      })
      .catch(() => { setLots([]); setErreurLots('Impossible de charger les lots — vérifie ta connexion.'); });
  }, [projetId]);

  const lotChoisi = lots.find(l => (l.uuid_id || l.id) === form.lot_id);
  const vivantsDisponibles = lotChoisi ? parseInt(lotChoisi.vivants || lotChoisi.quantite_initiale) : null;
  const totalAVendre = (parseInt(form.males_vendus) || 0) + (parseInt(form.femelles_vendues) || 0);
  const depasseDisponible = vivantsDisponibles !== null && totalAVendre > vivantsDisponibles;

  const recetteEstimee = () => {
    const m = parseFloat(form.males_vendus) || 0;
    const f = parseFloat(form.femelles_vendues) || 0;
    const pm = parseFloat(form.prix_male) || 0;
    const pf = parseFloat(form.prix_femelle) || 0;
    return (m * pm) + (f * pf);
  };

  const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' F';

  const soumettre = async () => {
    if (!form.lot_id) { setErreur('Choisis le lot vendu avant de continuer.'); return; }
    if (totalAVendre <= 0) { setErreur('Indique au moins un sujet vendu.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post('/ventes', {
        ...form,
        projet_id: projetId,
        males_vendus: parseInt(form.males_vendus) || 0,
        femelles_vendues: parseInt(form.femelles_vendues) || 0,
        prix_male: parseFloat(form.prix_male),
        prix_femelle: parseFloat(form.prix_femelle),
      }, { headers });
      Alert.alert('Vente enregistrée', "En attente de validation par le gestionnaire.", [
        { text: 'OK', onPress: onRetour },
      ]);
    } catch (error) {
      setErreur(error.response?.data?.message || "Erreur lors de l'enregistrement de la vente.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre="Enregistrer une vente" sousTitre="Technicien"
        action={<TouchableOpacity onPress={onRetour}><Text style={{ fontSize: 13, fontWeight: '700', color: '#1D1D1F' }}>← Dashboard</Text></TouchableOpacity>} />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={styles.label}>Projet *</Text>
          {chargementProjets ? (
            <ActivityIndicator color="#1D1D1F" />
          ) : erreurProjets ? (
            <Text style={styles.erreurTexte}>{erreurProjets}</Text>
          ) : projets.length === 0 ? (
            <Text style={styles.infoTexte}>Aucun projet ne t'est assigné.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {projets.map(p => (
                <TouchableOpacity key={p.id} onPress={() => setProjetId(p.uuid_id || p.id)}
                  style={[styles.chip, projetId === (p.uuid_id || p.id) && styles.chipActif, { marginRight: 6 }]}>
                  <Text style={[styles.chipTexte, projetId === (p.uuid_id || p.id) && styles.chipTexteActif]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.label}>Lot vendu *</Text>
          {erreurLots !== '' && <Text style={styles.erreurTexte}>{erreurLots}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {lots.map(l => {
              const vivantsLot = parseInt(l.vivants ?? l.quantite_initiale);
              const epuise = vivantsLot <= 0;
              const venteNonActivee = !epuise && !l.vente_activee;
              const desactive = epuise || venteNonActivee;
              const id = l.uuid_id || l.id;
              return (
                <TouchableOpacity key={l.id} disabled={desactive} onPress={() => setForm({ ...form, lot_id: id })}
                  style={[styles.chip, form.lot_id === id && styles.chipActif, desactive && styles.chipDesactive, { marginRight: 6 }]}>
                  <Text style={[styles.chipTexte, form.lot_id === id && styles.chipTexteActif]}>
                    {l.nom} — {epuise ? 'épuisé' : venteNonActivee ? 'non activée' : `${vivantsLot} vivants`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {lotChoisi && <Text style={styles.infoTexte}>{vivantsDisponibles} sujets vivants dans ce lot avant cette vente</Text>}

          <Text style={styles.label}>Date de vente</Text>
          <TextInput style={styles.champ} value={form.date_vente} onChangeText={v => setForm({ ...form, date_vente: v })} placeholder="AAAA-MM-JJ" />

          <Text style={styles.label}>Mâles vendus</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={form.males_vendus} onChangeText={v => setForm({ ...form, males_vendus: v })} />
          <Text style={styles.label}>Prix mâle (F)</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={String(form.prix_male)} onChangeText={v => setForm({ ...form, prix_male: v })} />
          <Text style={styles.label}>Femelles vendues</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={form.femelles_vendues} onChangeText={v => setForm({ ...form, femelles_vendues: v })} />
          <Text style={styles.label}>Prix femelle (F)</Text>
          <TextInput style={styles.champ} keyboardType="numeric" value={String(form.prix_femelle)} onChangeText={v => setForm({ ...form, prix_femelle: v })} />

          {depasseDisponible && (
            <View style={styles.alerteOrangeLegere}>
              <Text style={styles.alerteOrangeLegereTexte}>⚠️ Tu essaies de vendre {totalAVendre} sujets mais ce lot n'en a que {vivantsDisponibles} de vivants.</Text>
            </View>
          )}

          {recetteEstimee() > 0 && (
            <View style={styles.carteVerte}>
              <Text style={styles.carteVerteLabel}>Recette totale</Text>
              <Text style={styles.carteVerteMontant}>{formatMontant(recetteEstimee())}</Text>
              <Text style={styles.carteVerteSousTexte}>Cette vente sera enregistrée "en attente" — le gestionnaire l'encaissera ensuite depuis Commerce.</Text>
            </View>
          )}

          <Text style={styles.label}>Acheteur</Text>
          <TextInput style={styles.champ} placeholder="Nom de l'acheteur" value={form.acheteur} onChangeText={v => setForm({ ...form, acheteur: v })} />

          <Text style={styles.label}>Type acheteur</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TYPES_ACHETEUR.map(t => (
              <TouchableOpacity key={t} onPress={() => setForm({ ...form, type_acheteur: t })} style={[styles.chip, form.type_acheteur === t && styles.chipActif]}>
                <Text style={[styles.chipTexte, form.type_acheteur === t && styles.chipTexteActif]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Mode de paiement prévu</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MODES_PAIEMENT.map(m => (
              <TouchableOpacity key={m} onPress={() => setForm({ ...form, mode_paiement: m })} style={[styles.chip, form.mode_paiement === m && styles.chipActif]}>
                <Text style={[styles.chipTexte, form.mode_paiement === m && styles.chipTexteActif]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput style={[styles.champ, { height: 70 }]} multiline value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} />
        </View>

        {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
        <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={envoi || projets.length === 0}>
          <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer la vente'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonSecondaire} onPress={onRetour}>
          <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  infoTexte: { fontSize: 11, color: '#6E6E73', marginTop: 6 },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipDesactive: { opacity: 0.4 },
  chipTexte: { fontSize: 12, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  alerteOrangeLegere: { backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 10, padding: 10, marginTop: 10 },
  alerteOrangeLegereTexte: { color: '#C2410C', fontSize: 12, fontWeight: '600' },
  carteVerte: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 10, padding: 12, marginTop: 10 },
  carteVerteLabel: { color: '#059669', fontSize: 11 },
  carteVerteMontant: { color: '#047857', fontSize: 18, fontWeight: '700', marginTop: 2 },
  carteVerteSousTexte: { color: '#059669', fontSize: 11, marginTop: 4 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default VenteTechnicienScreen;
