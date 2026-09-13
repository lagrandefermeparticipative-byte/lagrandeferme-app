import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const RattrapageFermeScreen = ({ token, onTerminer, onPasser }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [soldeCaisseFerme, setSoldeCaisseFerme] = useState('');
  const [equipements, setEquipements] = useState([{ nom: '', categorie: '', quantite: '', valeur_estimee: '' }]);

  const ajouterEquipement = () => setEquipements(prev => [...prev, { nom: '', categorie: '', quantite: '', valeur_estimee: '' }]);
  const retirerEquipement = (i) => setEquipements(prev => prev.filter((_, idx) => idx !== i));
  const changerEquipement = (i, champ, valeur) => {
    setEquipements(prev => {
      const copie = [...prev];
      copie[i] = { ...copie[i], [champ]: valeur };
      return copie;
    });
  };

  const soumettre = async () => {
    setEnvoi(true); setErreur('');
    try {
      await api.post('/organisations/rattrapage-ferme', {
        equipements: equipements.filter(e => e.nom),
        solde_caisse_ferme_actuel: soldeCaisseFerme,
      }, { headers });
      onTerminer();
    } catch (error) {
      setErreur(error.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally { setEnvoi(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre="État actuel de votre ferme" sansRetour />
      <ScrollView style={styles.conteneur}>
        <View style={styles.encartBleu}>
          <Text style={styles.encartBleuTexte}>Avant de rattraper vos productions une par une, quelques infos sur la ferme elle-même — ce qui lui appartient à elle, pas à un projet précis.</Text>
        </View>

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Équipements déjà possédés</Text>
          {equipements.map((eq, i) => (
            <View key={i} style={styles.equipementBloc}>
              <TextInput style={styles.champ} placeholder="Nom (ex: Abreuvoirs, Groupe électrogène...)" value={eq.nom} onChangeText={v => changerEquipement(i, 'nom', v)} />
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                <TextInput style={[styles.champ, { flex: 1 }]} keyboardType="numeric" placeholder="Quantité" value={eq.quantite} onChangeText={v => changerEquipement(i, 'quantite', v)} />
                <TextInput style={[styles.champ, { flex: 1 }]} keyboardType="numeric" placeholder="Valeur estimée (F)" value={eq.valeur_estimee} onChangeText={v => changerEquipement(i, 'valeur_estimee', v)} />
              </View>
              {equipements.length > 1 && (
                <TouchableOpacity onPress={() => retirerEquipement(i)}><Text style={styles.lienRetirer}>Retirer</Text></TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={ajouterEquipement}><Text style={styles.lienAjouter}>+ Ajouter un équipement</Text></TouchableOpacity>
        </View>

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Caisse de la ferme</Text>
          <Text style={styles.label}>Combien reste-t-il réellement dans la caisse ferme aujourd'hui (F) ?</Text>
          <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={soldeCaisseFerme} onChangeText={setSoldeCaisseFerme} />
          <Text style={styles.aide}>Différent de la caisse d'un projet précis — c'est l'argent de la ferme elle-même.</Text>
        </View>

        {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}

        <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={envoi}>
          <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Continuer → Vos productions'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonSecondaire} onPress={onPasser}>
          <Text style={styles.boutonSecondaireTexte}>Passer cette étape</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  encartBleu: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 16 },
  encartBleuTexte: { color: '#1D4ED8', fontSize: 12 },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 12 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 10 },
  equipementBloc: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 10, marginBottom: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  lienRetirer: { color: '#DC2626', fontSize: 11, marginTop: 6 },
  lienAjouter: { color: '#4B5563', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  aide: { fontSize: 10, color: '#9CA3AF', marginTop: 6 },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginBottom: 8 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default RattrapageFermeScreen;