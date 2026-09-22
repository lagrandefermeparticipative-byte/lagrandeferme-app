import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

// Projets pas encore lancés, ouverts à la réservation de parts — une simple
// promesse non engageante, sans paiement, pour que le gestionnaire sache qui
// contacter à l'ouverture réelle du projet. Miroir de ProjetsAVenir.js web.
const ProjetsAVenirScreen = ({ token }) => {
  const navigation = useNavigation();
  const headers = { Authorization: `Bearer ${token}` };
  const { utilisateur, modeVue } = useAuth();
  // Un gestion_invest basculé en mode Investisseur ne doit jamais voir la
  // vue gestionnaire (bouton "+ Projet", liste nominative des réservations
  // avec emails/téléphones d'autres personnes) — c'est le mode affiché qui
  // tranche, jamais uniquement le rôle global.
  const estGestionnaire = utilisateur?.role === 'gestionnaire' || (utilisateur?.role === 'gestion_invest' && modeVue !== 'investisseur');
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [projetOuvert, setProjetOuvert] = useState(null);
  const [reservationsParProjet, setReservationsParProjet] = useState({});
  const [reservationsOuvertes, setReservationsOuvertes] = useState(null);
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [erreurChargement, setErreurChargement] = useState('');

  const charger = () => {
    setErreurChargement('');
    api.get('/projets/a-venir', { headers })
      .then(res => setProjets(res.data))
      .catch(() => { setProjets([]); setErreurChargement('Impossible de charger les projets — vérifie ta connexion.'); })
      .finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const ouvrirReservation = (projet) => {
    setProjetOuvert(projet);
    setMontant('');
    setNote('');
    setErreur('');
  };

  const confirmerReservation = async () => {
    if (!montant || parseFloat(montant) <= 0) { setErreur('Montant invalide.'); return; }
    setEnvoi(true); setErreur('');
    try {
      await api.post(`/reservations/${projetOuvert.uuid_id || projetOuvert.id}`, { montant_reserve: parseFloat(montant), note: note.trim() || null }, { headers });
      setProjetOuvert(null);
      charger();
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur lors de la réservation.');
    } finally {
      setEnvoi(false);
    }
  };

  const annuler = (projet) => {
    Alert.alert('Annuler', 'Annuler ta réservation sur ce projet ?', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: async () => {
        try {
          const mesRes = await api.get('/reservations/moi', { headers });
          const laMienne = mesRes.data.find(r => r.projet_id === projet.id && r.statut === 'active');
          if (laMienne) {
            await api.delete(`/reservations/${laMienne.uuid_id || laMienne.id}`, { headers });
            charger();
          }
        } catch (error) { Alert.alert('Erreur', 'Annulation impossible.'); }
      }},
    ]);
  };

  const voirReservations = async (projet) => {
    if (reservationsOuvertes === projet.id) { setReservationsOuvertes(null); return; }
    setReservationsOuvertes(projet.id);
    if (!reservationsParProjet[projet.id]) {
      try {
        const res = await api.get(`/reservations/projet/${projet.uuid_id || projet.id}`, { headers });
        setReservationsParProjet(prev => ({ ...prev, [projet.id]: res.data }));
      } catch (error) { console.log('Erreur réservations:', error.message); }
    }
  };

  if (projetOuvert) {
    const dejaReserve = parseFloat(projetOuvert.total_reserve || 0);
    const objectif = parseFloat(projetOuvert.objectif_collecte || 0);
    const restant = objectif > 0 ? Math.max(0, objectif - dejaReserve) : null;
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Réserver des parts" />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>{projetOuvert.nom}</Text>
            {projetOuvert.description ? <Text style={styles.carteSousTexte}>{projetOuvert.description}</Text> : null}
            {restant !== null && <Text style={styles.infoTexte}>Reste {formatMontant(restant)} à réserver sur l'objectif de {formatMontant(objectif)}</Text>}

            <Text style={styles.label}>Montant que tu comptes investir (F)</Text>
            <TextInput style={styles.champ} keyboardType="numeric" value={montant} onChangeText={setMontant} placeholder="Ex: 200000" />

            <Text style={styles.label}>Note (optionnel)</Text>
            <TextInput style={[styles.champ, { height: 60 }]} multiline value={note} onChangeText={setNote} placeholder="Une précision à transmettre au gestionnaire..." />

            <Text style={styles.infoTexte}>C'est une promesse, pas un engagement de paiement — le gestionnaire te contactera pour finaliser quand le projet démarrera réellement.</Text>

            {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}

            <TouchableOpacity style={styles.boutonPrincipal} onPress={confirmerReservation} disabled={envoi}>
              <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Réserver'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setProjetOuvert(null)}>
              <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Prochains projets"
        action={estGestionnaire ? (
          <TouchableOpacity style={styles.boutonAjout} onPress={() => navigation.navigate('NouveauProjetAVenir')}>
            <Text style={styles.boutonAjoutTexte}>+ Projet</Text>
          </TouchableOpacity>
        ) : null} />
      <ScrollView style={styles.conteneur}>
        {chargement ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#1D1D1F" />
        ) : erreurChargement ? (
          <View style={styles.videCarte}>
            <Text style={styles.erreurTexte}>{erreurChargement}</Text>
          </View>
        ) : projets.length === 0 ? (
          <View style={styles.videCarte}>
            <Text style={styles.vide}>Aucun projet à venir pour l'instant. Reviens bientôt !</Text>
          </View>
        ) : projets.map(p => {
          const objectif = parseFloat(p.objectif_collecte || 0);
          const reserve = parseFloat(p.total_reserve || 0);
          const pct = objectif > 0 ? Math.min(100, Math.round((reserve / objectif) * 100)) : null;
          const maReservation = parseFloat(p.ma_reservation || 0);
          return (
            <View key={p.id} style={styles.carte}>
              <Text style={styles.carteTitre}>{p.nom}</Text>
              <Text style={styles.carteSousTexte}>{p.type_volaille} · {p.objectif_sujets} sujets visés{p.date_lancement_prevue ? ` · lancement prévu ${new Date(p.date_lancement_prevue).toLocaleDateString('fr-FR')}` : ''}</Text>
              {p.description ? <Text style={styles.description}>{p.description}</Text> : null}

              {objectif > 0 && (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.barreFond}>
                    <View style={[styles.barreRemplie, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.infoTexteBarre}>{formatMontant(reserve)} réservés sur {formatMontant(objectif)} ({pct}%)</Text>
                </View>
              )}

              {estGestionnaire ? (
                <>
                  <TouchableOpacity style={styles.boutonGris} onPress={() => voirReservations(p)}>
                    <Text style={styles.boutonGrisTexte}>{reservationsOuvertes === p.id ? 'Masquer les réservations' : 'Voir les réservations'}</Text>
                  </TouchableOpacity>
                  {reservationsOuvertes === p.id && (
                    !reservationsParProjet[p.id] ? (
                      <ActivityIndicator style={{ marginTop: 10 }} color="#6E6E73" />
                    ) : reservationsParProjet[p.id].length === 0 ? (
                      <Text style={styles.vide}>Aucune réservation pour l'instant.</Text>
                    ) : reservationsParProjet[p.id].map(r => (
                      <View key={r.id} style={styles.ligneReservation}>
                        <View style={styles.ligneEntre}>
                          <Text style={styles.reservationNom}>{r.utilisateur_nom}</Text>
                          <Text style={styles.reservationNom}>{formatMontant(r.montant_reserve)}</Text>
                        </View>
                        <Text style={styles.reservationDetail}>{r.email}{r.telephone ? ` · ${r.telephone}` : ''} · {r.statut === 'annulee' ? 'Annulée' : 'Active'}</Text>
                        {r.note ? <Text style={styles.reservationNote}>{r.note}</Text> : null}
                      </View>
                    ))
                  )}
                </>
              ) : maReservation > 0 ? (
                <View style={[styles.ligneReservation, styles.ligneEntre]}>
                  <Text style={styles.reservationNom}>Ta réservation : {formatMontant(maReservation)}</Text>
                  <TouchableOpacity onPress={() => annuler(p)}><Text style={styles.lienAnnuler}>Annuler</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.boutonPrincipal} onPress={() => ouvrirReservation(p)}>
                  <Text style={styles.boutonPrincipalTexte}>Réserver des parts</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  vide: { fontSize: 13, color: '#6E6E73', textAlign: 'center', paddingVertical: 12 },
  videCarte: { backgroundColor: '#fff', borderRadius: 20, padding: 30, marginTop: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 15, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 4 },
  description: { fontSize: 13, color: '#374151', marginTop: 8 },
  barreFond: { height: 5, backgroundColor: '#F5F5F7', borderRadius: 3, overflow: 'hidden' },
  barreRemplie: { height: 5, borderRadius: 3, backgroundColor: '#2D6A4F' },
  infoTexteBarre: { fontSize: 11, color: '#6E6E73', marginTop: 6 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 13, fontWeight: '600' },
  boutonGris: { backgroundColor: '#F5F5F7', borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  boutonGrisTexte: { color: '#1D1D1F', fontSize: 13, fontWeight: '600' },
  boutonAjout: { backgroundColor: '#1D1D1F', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  boutonAjoutTexte: { color: '#fff', fontSize: 11, fontWeight: '600' },
  ligneReservation: { backgroundColor: '#F5F5F7', borderRadius: 14, padding: 12, marginTop: 10 },
  reservationNom: { fontSize: 12, fontWeight: '600', color: '#1D1D1F' },
  reservationDetail: { fontSize: 11, color: '#6E6E73', marginTop: 4 },
  reservationNote: { fontSize: 11, color: '#6E6E73', marginTop: 4, fontStyle: 'italic' },
  lienAnnuler: { color: '#DC2626', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, color: '#6E6E73', marginTop: 12, marginBottom: 4 },
  champ: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#1D1D1F' },
  infoTexte: { fontSize: 11, color: '#6E6E73', marginTop: 10 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginTop: 8 },
});

export default ProjetsAVenirScreen;
