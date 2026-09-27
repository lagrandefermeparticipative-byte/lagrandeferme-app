import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import Header from '../components/Header';

// Écran gamifié, écran d'accueil du stagiaire : streak de rapports, jalons
// débloqués, courbe du cheptel, derniers retours et compte à rebours avant
// la fin du stage. Équivalent mobile de MonParcours.js (web).
const MonParcoursScreen = ({ token }) => {
  const navigation = useNavigation();
  const headers = { Authorization: `Bearer ${token}` };
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [messageBoxOuverte, setMessageBoxOuverte] = useState(false);
  const [message, setMessage] = useState('');
  const [envoiMessage, setEnvoiMessage] = useState(false);
  const [messageEnvoye, setMessageEnvoye] = useState(false);

  useEffect(() => {
    api.get('/mon-parcours', { headers })
      .then((res) => setDonnees(res.data))
      .catch((error) => setErreur(error.response?.data?.message || 'Impossible de charger ton parcours.'))
      .finally(() => setChargement(false));
  }, [token]);

  // Le système de messagerie est déjà générique par utilisateur — le même
  // POST /messages qu'utilise un investisseur suffit pour le stagiaire.
  const envoyerMessage = async () => {
    if (!message.trim()) return;
    setEnvoiMessage(true);
    try {
      await api.post('/messages', { contenu: message.trim() }, { headers });
      setMessage('');
      setMessageEnvoye(true);
      setTimeout(() => setMessageEnvoye(false), 3000);
    } catch (error) {
      console.log('Erreur envoi message:', error.message);
    } finally {
      setEnvoiMessage(false);
    }
  };

  if (chargement) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre="Mon parcours" sansRetour />
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      </View>
    );
  }

  if (erreur || !donnees) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
        <Header titre="Mon parcours" sansRetour />
        <View style={styles.conteneur}>
          <View style={styles.encartErreur}><Text style={styles.encartErreurTexte}>{erreur || 'Aucune donnée disponible.'}</Text></View>
        </View>
      </View>
    );
  }

  const { cadre, streak, jalons, courbe_cheptel: courbeCheptel, jours_restants: joursRestants, derniers_retours: derniersRetours } = donnees;
  const maxEffectif = Math.max(1, ...courbeCheptel.map((c) => c.effectif || 0));

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Mon parcours" sousTitre={cadre?.projet_nom || ''} sansRetour />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carteNoire}>
          <Text style={styles.carteNoireLabel}>Encadré par</Text>
          <Text style={styles.carteNoireNom}>{cadre?.technicien_nom || 'Non renseigné'}</Text>
          {joursRestants !== null && joursRestants !== undefined && (
            <Text style={styles.carteNoireSousTexte}>
              {joursRestants >= 0
                ? `${joursRestants} jour${joursRestants > 1 ? 's' : ''} avant la fin du stage`
                : 'Stage terminé'}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.boutonPrincipal} onPress={() => navigation.navigate('Rapport')}>
          <Text style={styles.boutonPrincipalTexte}>✍️ Soumettre mon rapport de la semaine</Text>
        </TouchableOpacity>

        <View style={[styles.carte, styles.streakLigne]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitre}>{streak} semaine{streak > 1 ? 's' : ''} d'affilée</Text>
            <Text style={styles.streakSousTexte}>Rapport soumis chaque semaine, sans interruption</Text>
          </View>
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>Jalons</Text>
          <View style={styles.jalonsGrille}>
            {jalons.map((j) => (
              <View key={j.code} style={[styles.jalonCase, j.debloque ? styles.jalonDebloque : styles.jalonVerrouille]}>
                <Text style={styles.jalonEmoji}>{j.debloque ? '🏅' : '🔒'}</Text>
                <Text style={[styles.jalonLabel, j.debloque && styles.jalonLabelDebloque]}>{j.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>Évolution du cheptel</Text>
          {courbeCheptel.length === 0 ? (
            <Text style={styles.videTexte}>Pas encore de rapport soumis.</Text>
          ) : (
            <View style={styles.courbeLigne}>
              {courbeCheptel.map((c) => (
                <View key={c.semaine} style={styles.courbeColonne}>
                  <View style={styles.courbeBarreZone}>
                    <View style={[styles.courbeBarre, { height: `${Math.max(4, ((c.effectif || 0) / maxEffectif) * 100)}%` }]} />
                  </View>
                  <Text style={styles.courbeLabel}>S{c.semaine}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.carte}>
          <Text style={styles.sectionTitre}>Derniers retours</Text>
          {derniersRetours.length === 0 ? (
            <Text style={styles.videTexte}>Aucun retour pour le moment.</Text>
          ) : (
            derniersRetours.map((r, i) => (
              <View key={i} style={styles.retourLigne}>
                <Text style={styles.retourSemaine}>Semaine {r.semaine}</Text>
                {r.commentaire_technicien && <Text style={styles.retourTexte}>Technicien : {r.commentaire_technicien}</Text>}
                {r.commentaire_admin && <Text style={styles.retourTexte}>Gestion : {r.commentaire_admin}</Text>}
              </View>
            ))
          )}
        </View>

        {!messageBoxOuverte ? (
          <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setMessageBoxOuverte(true)}>
            <Text style={styles.boutonPrincipalTexte}>Écrire à la gestion</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.carte}>
            <Text style={styles.sectionTitre}>Message à la gestion</Text>
            <TextInput style={[styles.champ, { height: 70 }]} multiline placeholder="Ton message..." value={message} onChangeText={setMessage} />
            {messageEnvoye && <Text style={styles.messageEnvoyeTexte}>Message envoyé.</Text>}
            <View style={styles.ligneBoutons}>
              <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setMessageBoxOuverte(false)}>
                <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.boutonPrincipal, { flex: 1, marginTop: 0 }, (envoiMessage || !message.trim()) && styles.boutonDesactive]}
                onPress={envoyerMessage} disabled={envoiMessage || !message.trim()}>
                <Text style={styles.boutonPrincipalTexte}>{envoiMessage ? 'Envoi...' : 'Envoyer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  encartErreur: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 14, marginTop: 16 },
  encartErreurTexte: { color: '#DC2626', fontSize: 13 },
  carteNoire: { backgroundColor: '#1D1D1F', borderRadius: 20, padding: 18, marginBottom: 12 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 11, marginBottom: 4 },
  carteNoireNom: { color: '#fff', fontSize: 17, fontWeight: '600' },
  carteNoireSousTexte: { color: '#9CA3AF', fontSize: 11, marginTop: 8 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitre: { fontSize: 11, fontWeight: '600', color: '#6E6E73', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 10 },
  streakLigne: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakEmoji: { fontSize: 30 },
  streakTitre: { fontSize: 15, fontWeight: '600', color: '#1D1D1F' },
  streakSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 2 },
  jalonsGrille: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  jalonCase: { width: '47%', borderRadius: 12, borderWidth: 1, padding: 10, alignItems: 'center' },
  jalonDebloque: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  jalonVerrouille: { backgroundColor: '#F5F5F7', borderColor: '#F0F0F0', opacity: 0.6 },
  jalonEmoji: { fontSize: 20, marginBottom: 4 },
  jalonLabel: { fontSize: 11, color: '#6E6E73', textAlign: 'center' },
  jalonLabelDebloque: { color: '#B45309', fontWeight: '600' },
  videTexte: { fontSize: 12, color: '#9CA3AF' },
  courbeLigne: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 },
  courbeColonne: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  courbeBarreZone: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  courbeBarre: { width: '100%', backgroundColor: '#3B82F6', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  courbeLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 4 },
  retourLigne: { borderLeftWidth: 2, borderLeftColor: '#E5E5EA', paddingLeft: 10, marginBottom: 10 },
  retourSemaine: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  retourTexte: { fontSize: 13, color: '#374151' },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F', marginBottom: 8, textAlignVertical: 'top' },
  messageEnvoyeTexte: { color: '#047857', fontSize: 12, marginBottom: 8 },
  ligneBoutons: { flexDirection: 'row', gap: 10 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  boutonDesactive: { opacity: 0.4 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default MonParcoursScreen;
