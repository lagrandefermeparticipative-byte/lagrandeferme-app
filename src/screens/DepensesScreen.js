import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

const DepensesScreen = ({ token }) => {
  const [depenses, setDepenses] = useState([]);
  const [projetId, setProjetId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [form, setForm] = useState({ libelle: '', montant_prevu: '', montant_reel: '' });

  const charger = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const projetsRes = await api.get('/projets', { headers });
      const id = projetsRes.data[0]?.id;
      setProjetId(id);
      if (id) {
        const depensesRes = await api.get(`/depenses?projet_id=${id}`, { headers });
        setDepenses(depensesRes.data);
      }
    } catch (error) {
      console.log('Erreur dépenses:', error.message);
    } finally {
      setChargement(false);
      setRafraichissement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const onRefresh = () => {
    setRafraichissement(true);
    charger();
  };

  const soumettre = async () => {
    if (!form.libelle) {
      Alert.alert('Champ manquant', 'Le libellé est obligatoire.');
      return;
    }
    setEnvoi(true);
    try {
      await api.post('/depenses', {
        projet_id: projetId,
        libelle: form.libelle,
        montant_prevu: parseFloat(form.montant_prevu) || 0,
        montant_reel: parseFloat(form.montant_reel) || 0,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setModalVisible(false);
      setForm({ libelle: '', montant_prevu: '', montant_reel: '' });
      charger();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Impossible d'enregistrer.");
    } finally {
      setEnvoi(false);
    }
  };

  const totalReel = depenses.reduce((s, d) => s + parseFloat(d.montant_reel || 0), 0);

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F7F7F5" }}>
        <Header titre="Dépenses" sansRetour />
        <View style={styles.centre}>
          <ActivityIndicator size="large" color="#80B918" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F5' }}>
      <Header titre="Dépenses" sansRetour
        action={
          <TouchableOpacity style={styles.boutonAjout} onPress={() => setModalVisible(true)}>
            <Text style={styles.boutonAjoutTexte}>+ Nouvelle</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        style={styles.conteneur}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={onRefresh} />}
      >

        <View style={styles.resumeCarte}>
          <Text style={styles.resumeChiffre}>{Number(totalReel).toLocaleString('fr-FR')} F</Text>
          <Text style={styles.resumeLabel}>Total dépensé · {depenses.length} dépense(s)</Text>
        </View>

        {depenses.length === 0 && <Text style={styles.vide}>Aucune dépense pour le moment.</Text>}
        {depenses.map((d, i) => (
          <View style={styles.carte} key={d.id || i}>
            <Text style={styles.cardTitre}>{d.libelle}</Text>
            <Text style={styles.cardTexte}>{Number(d.montant_reel || 0).toLocaleString('fr-FR')} F</Text>
          </View>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalFond}
        >
          <View style={styles.modalContenu}>
            <Text style={styles.modalTitre}>Nouvelle dépense</Text>
            <ScrollView>
              <TextInput style={styles.champ} placeholder="Libellé (ex: Aliment)"
                value={form.libelle} onChangeText={v => setForm({ ...form, libelle: v })} />
              <TextInput style={styles.champ} placeholder="Montant prévu" keyboardType="numeric"
                value={form.montant_prevu} onChangeText={v => setForm({ ...form, montant_prevu: v })} />
              <TextInput style={styles.champ} placeholder="Montant réel" keyboardType="numeric"
                value={form.montant_reel} onChangeText={v => setForm({ ...form, montant_reel: v })} />
            </ScrollView>
            <View style={styles.modalBoutons}>
              <TouchableOpacity style={styles.boutonAnnuler} onPress={() => setModalVisible(false)}>
                <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.boutonEnvoyer} onPress={soumettre} disabled={envoi}>
                <Text style={styles.boutonEnvoyerTexte}>{envoi ? 'Envoi...' : 'Enregistrer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: '#F7F7F5', padding: 20, paddingTop: 60 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F7F5' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titre: { fontSize: 24, fontWeight: '700', color: '#1E2221' },
  boutonAjout: { backgroundColor: '#80B918', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  boutonAjoutTexte: { color: '#182600', fontWeight: '700', fontSize: 13 },
  resumeCarte: { backgroundColor: '#23292A', borderRadius: 14, padding: 20, marginBottom: 20 },
  resumeChiffre: { fontSize: 24, fontWeight: '700', color: '#F6D92A' },
  resumeLabel: { fontSize: 12, color: '#9AA29B', marginTop: 4 },
  vide: { color: '#888', fontStyle: 'italic' },
  carte: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitre: { fontSize: 15, fontWeight: '600', color: '#1E2221' },
  cardTexte: { fontSize: 15, fontWeight: '700', color: '#c0392b' },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContenu: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitre: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#1E2221' },
  champ: { backgroundColor: '#F7F7F5', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 14 },
  modalBoutons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  boutonAnnuler: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E2DE', alignItems: 'center' },
  boutonAnnulerTexte: { color: '#565757', fontWeight: '600' },
  boutonEnvoyer: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#80B918', alignItems: 'center' },
  boutonEnvoyerTexte: { color: '#182600', fontWeight: '700' },
});

export default DepensesScreen;