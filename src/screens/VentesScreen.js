import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

const VentesScreen = ({ token }) => {
  const [ventes, setVentes] = useState([]);
  const [lots, setLots] = useState([]);
  const [projetId, setProjetId] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [rafraichissement, setRafraichissement] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const [form, setForm] = useState({
    lot_id: '', males_vendus: '0', femelles_vendues: '0', prix_male: '', prix_femelle: '',
  });

  const charger = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const projetsRes = await api.get('/projets', { headers });
      const id = projetsRes.data[0]?.id;
      setProjetId(id);
      if (id) {
        const [ventesRes, lotsRes] = await Promise.all([
          api.get(`/ventes?projet_id=${id}`, { headers }),
          api.get(`/lots?projet_id=${id}`, { headers }),
        ]);
        setVentes(ventesRes.data);
        setLots(lotsRes.data);
        if (lotsRes.data.length > 0 && !form.lot_id) {
          setForm(f => ({ ...f, lot_id: String(lotsRes.data[0].id) }));
        }
      }
    } catch (error) {
      console.log('Erreur ventes:', error.message);
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
    if (!form.lot_id) {
      Alert.alert('Champ manquant', 'Choisis un lot.');
      return;
    }
    setEnvoi(true);
    try {
      await api.post('/ventes', {
        projet_id: projetId,
        lot_id: parseInt(form.lot_id),
        date_vente: new Date().toISOString().split('T')[0],
        males_vendus: parseInt(form.males_vendus) || 0,
        femelles_vendues: parseInt(form.femelles_vendues) || 0,
        prix_male: parseFloat(form.prix_male) || 0,
        prix_femelle: parseFloat(form.prix_femelle) || 0,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setModalVisible(false);
      charger();
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Impossible d'enregistrer.");
    } finally {
      setEnvoi(false);
    }
  };

  const totalRecette = ventes.reduce((s, v) => s + parseFloat(v.recette_totale || 0), 0);

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F7F5' }}>
        <Header titre="Ventes" sansRetour />
        <View style={styles.centre}>
          <ActivityIndicator size="large" color="#80B918" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F5' }}>
      <Header titre="Ventes" sansRetour
        action={
          <TouchableOpacity style={styles.boutonAjout} onPress={() => setModalVisible(true)}>
            <Text style={styles.boutonAjoutTexte}>+ Nouvelle</Text>
          </TouchableOpacity>
        }
      />
      <FlatList
        style={styles.conteneur}
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={rafraichissement} onRefresh={onRefresh} />}
        data={ventes}
        keyExtractor={(v, i) => String(v.id || i)}
        ListHeaderComponent={
          <View style={styles.resumeCarte}>
            <Text style={styles.resumeChiffre}>{Number(totalRecette).toLocaleString('fr-FR')} F</Text>
            <Text style={styles.resumeLabel}>Total recette · {ventes.length} vente(s)</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.vide}>Aucune vente pour le moment.</Text>}
        renderItem={({ item: v }) => (
          <View style={styles.carte}>
            <Text style={styles.cardTitre}>{v.males_vendus} mâles · {v.femelles_vendues} femelles</Text>
            <Text style={styles.cardTexte}>{Number(v.recette_totale || 0).toLocaleString('fr-FR')} F</Text>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalFond}
        >
          <View style={styles.modalContenu}>
            <Text style={styles.modalTitre}>Nouvelle vente</Text>
            <ScrollView>
              <Text style={styles.label}>Lot</Text>
              <ScrollView horizontal style={{ marginBottom: 12 }}>
                {lots.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[styles.chipLot, form.lot_id === String(l.id) && styles.chipLotActif]}
                    onPress={() => setForm({ ...form, lot_id: String(l.id) })}
                  >
                    <Text style={[styles.chipLotTexte, form.lot_id === String(l.id) && styles.chipLotTexteActif]}>{l.nom}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput style={styles.champ} placeholder="Mâles vendus" keyboardType="numeric"
                value={form.males_vendus} onChangeText={v => setForm({ ...form, males_vendus: v })} />
              <TextInput style={styles.champ} placeholder="Femelles vendues" keyboardType="numeric"
                value={form.femelles_vendues} onChangeText={v => setForm({ ...form, femelles_vendues: v })} />
              <TextInput style={styles.champ} placeholder="Prix unitaire mâle" keyboardType="numeric"
                value={form.prix_male} onChangeText={v => setForm({ ...form, prix_male: v })} />
              <TextInput style={styles.champ} placeholder="Prix unitaire femelle" keyboardType="numeric"
                value={form.prix_femelle} onChangeText={v => setForm({ ...form, prix_femelle: v })} />
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
  cardTitre: { fontSize: 14, fontWeight: '600', color: '#1E2221', flex: 1 },
  cardTexte: { fontSize: 15, fontWeight: '700', color: '#80B918' },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContenu: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '85%' },
  modalTitre: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#1E2221' },
  label: { fontSize: 12, color: '#565757', marginBottom: 8, fontWeight: '600' },
  champ: { backgroundColor: '#F7F7F5', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 14 },
  chipLot: { backgroundColor: '#F7F7F5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  chipLotActif: { backgroundColor: '#80B918' },
  chipLotTexte: { fontSize: 13, color: '#565757', fontWeight: '600' },
  chipLotTexteActif: { color: '#182600' },
  modalBoutons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  boutonAnnuler: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#E2E2DE', alignItems: 'center' },
  boutonAnnulerTexte: { color: '#565757', fontWeight: '600' },
  boutonEnvoyer: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#80B918', alignItems: 'center' },
  boutonEnvoyerTexte: { color: '#182600', fontWeight: '700' },
});

export default VentesScreen;