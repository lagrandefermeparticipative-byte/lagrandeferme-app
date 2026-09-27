import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';
import { useProjet } from '../context/ProjetContext';

// Vue d'ensemble pour un technicien qui supervise plusieurs projets : les
// données agrégées d'abord, la liste détaillée "Mes projets" ensuite.
const DashboardTechnicienScreen = ({ token, onVoirProjets, onOuvrirProjet, onEnregistrerVente }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const { choisirProjet } = useProjet();
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);

  // Rapports des stagiaires encadrés, en attente de validation par ce
  // technicien — indépendamment des projets propres du technicien, car un
  // encadrement peut porter sur un projet dont il n'est pas lui-même
  // l'agronome principal.
  const [rapportsStagiaires, setRapportsStagiaires] = useState([]);
  const [chargementStagiaires, setChargementStagiaires] = useState(true);
  const [rapportOuvertId, setRapportOuvertId] = useState(null);
  const [commentaireRefus, setCommentaireRefus] = useState('');
  const [refusEnCoursId, setRefusEnCoursId] = useState(null);
  const [actionEnCours, setActionEnCours] = useState(false);
  const [erreurStagiaires, setErreurStagiaires] = useState('');

  useEffect(() => {
    api.get('/projets/moi/technicien/dashboard', { headers })
      .then(res => setDonnees(res.data))
      .catch(() => setDonnees(null))
      .finally(() => setChargement(false));
    chargerRapportsStagiaires();
  }, [token]);

  const chargerRapportsStagiaires = async () => {
    setChargementStagiaires(true);
    try {
      const res = await api.get('/rapports/a-valider-stagiaires', { headers });
      setRapportsStagiaires(res.data);
    } catch (error) {
      console.log('Erreur rapports stagiaires:', error.message);
    } finally {
      setChargementStagiaires(false);
    }
  };

  const validerRapport = async (id) => {
    setActionEnCours(true); setErreurStagiaires('');
    try {
      await api.put(`/rapports/${id}/valider-technicien`, {}, { headers });
      await chargerRapportsStagiaires();
      setRapportOuvertId(null);
    } catch (error) { setErreurStagiaires('Erreur lors de la validation du rapport.'); }
    finally { setActionEnCours(false); }
  };

  const refuserRapport = async (id) => {
    if (!commentaireRefus.trim()) return;
    setActionEnCours(true); setErreurStagiaires('');
    try {
      await api.put(`/rapports/${id}/refuser-technicien`, { commentaire: commentaireRefus.trim() }, { headers });
      setCommentaireRefus(''); setRefusEnCoursId(null);
      await chargerRapportsStagiaires();
      setRapportOuvertId(null);
    } catch (error) { setErreurStagiaires('Erreur lors du refus du rapport.'); }
    finally { setActionEnCours(false); }
  };

  const ouvrirProjet = (projetId) => {
    choisirProjet(projetId);
    onOuvrirProjet();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Tableau de bord" sousTitre="Technicien" sansRetour />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={[styles.carteTitre, { marginBottom: 8 }]}>Rapports de mes stagiaires à valider</Text>
          {chargementStagiaires ? (
            <Text style={styles.vide}>Chargement...</Text>
          ) : rapportsStagiaires.length === 0 ? (
            <Text style={styles.vide}>Aucun rapport de stagiaire en attente.</Text>
          ) : (
            <View>
              {erreurStagiaires !== '' && <Text style={styles.erreurTexte}>{erreurStagiaires}</Text>}
              {rapportsStagiaires.map((r) => {
                const idAffichage = r.uuid_id || r.id;
                const ouvert = rapportOuvertId === idAffichage;
                return (
                  <View key={idAffichage} style={styles.rapportBloc}>
                    <TouchableOpacity style={styles.ligneEntre} onPress={() => setRapportOuvertId(ouvert ? null : idAffichage)}>
                      <View>
                        <Text style={styles.rapportNom}>{r.stagiaire_nom} — {r.projet_nom}</Text>
                        <Text style={styles.rapportSemaine}>Semaine {r.semaine}</Text>
                      </View>
                      {!!r.ecart_effectif && (
                        <View style={styles.badgeEcart}><Text style={styles.badgeEcartTexte}>⚠️ Écart</Text></View>
                      )}
                    </TouchableOpacity>

                    {ouvert && (
                      <View style={{ marginTop: 10 }}>
                        {!!r.ecart_effectif && (
                          <View style={styles.encartRouge}>
                            <Text style={styles.encartRougeTitre}>⚠️ Écart d'effectif constaté : {r.ecart_effectif > 0 ? '+' : ''}{r.ecart_effectif}</Text>
                            <Text style={styles.encartRougeTexte}>{r.explication_ecart || 'Aucune explication fournie.'}</Text>
                          </View>
                        )}
                        <View style={styles.encartGris}>
                          <Text style={styles.encartGrisLigne}><Text style={styles.encartGrisLabel}>Effectif début : </Text>{r.effectif_debut ?? '—'}</Text>
                          {r.effectif_constate !== null && r.effectif_constate !== undefined && (
                            <Text style={styles.encartGrisLigne}><Text style={styles.encartGrisLabel}>Effectif constaté : </Text>{r.effectif_constate}</Text>
                          )}
                          <Text style={styles.encartGrisLigne}><Text style={styles.encartGrisLabel}>Morts semaine : </Text>{r.morts_semaine ?? 0} ({r.cause_mortalite || '—'})</Text>
                        </View>
                        {!!r.journal_activites && (
                          <View style={[styles.encartGris, { marginTop: 8 }]}>
                            <Text style={styles.encartGrisLabel}>Journal d'activités</Text>
                            <Text style={styles.encartGrisLigne}>{r.journal_activites}</Text>
                          </View>
                        )}

                        {refusEnCoursId === idAffichage ? (
                          <View style={{ marginTop: 8 }}>
                            <TextInput style={[styles.champRefus]} multiline placeholder="Explique ce qu'il faut corriger (obligatoire)..." value={commentaireRefus} onChangeText={setCommentaireRefus} />
                            <View style={styles.ligneActions}>
                              <TouchableOpacity style={[styles.boutonRefuserConfirmer, (actionEnCours || !commentaireRefus.trim()) && styles.boutonDesactive]}
                                disabled={actionEnCours || !commentaireRefus.trim()} onPress={() => refuserRapport(idAffichage)}>
                                <Text style={styles.boutonBlancTexte}>Confirmer le refus</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.boutonAnnuler} onPress={() => { setRefusEnCoursId(null); setCommentaireRefus(''); }}>
                                <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View style={[styles.ligneActions, { marginTop: 8 }]}>
                            <TouchableOpacity style={[styles.boutonValider, actionEnCours && styles.boutonDesactive]} disabled={actionEnCours} onPress={() => validerRapport(idAffichage)}>
                              <Text style={styles.boutonBlancTexte}>Valider</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.boutonAnnuler} disabled={actionEnCours} onPress={() => setRefusEnCoursId(idAffichage)}>
                              <Text style={styles.boutonAnnulerTexte}>Refuser avec commentaire</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {chargement ? (
          <ActivityIndicator style={{ marginTop: 30 }} color="#1D1D1F" />
        ) : !donnees || donnees.nb_projets === 0 ? (
          <View style={styles.videCarte}>
            <Text style={styles.vide}>Aucun projet ne t'est encore assigné.</Text>
          </View>
        ) : (
          <View>
            <View style={styles.grille2}>
              <View style={styles.carteStat}>
                <Text style={styles.statLabel}>EFFECTIF VIVANT</Text>
                <Text style={styles.statChiffre}>{donnees.effectif_vivant_total}</Text>
                <Text style={styles.statSousTexte}>sur {donnees.nb_projets} projet{donnees.nb_projets > 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.carteStat}>
                <Text style={styles.statLabel}>SURVIE MOYENNE</Text>
                <Text style={styles.statChiffre}>{donnees.taux_survie_moyen !== null ? `${donnees.taux_survie_moyen}%` : '—'}</Text>
              </View>
            </View>

            {donnees.rapports_en_attente > 0 && (
              <View style={[styles.carte, styles.ligneEntre]}>
                <Text style={styles.carteTitre}>Rapports à soumettre cette semaine</Text>
                <View style={styles.badgeAmbre}>
                  <Text style={styles.badgeAmbreTexte}>{donnees.rapports_en_attente}</Text>
                </View>
              </View>
            )}

            {donnees.alertes.length > 0 && (
              <View style={styles.carte}>
                <Text style={[styles.carteTitre, { marginBottom: 8 }]}>Projets à surveiller</Text>
                {donnees.alertes.map(a => (
                  <TouchableOpacity key={a.projet_id} onPress={() => ouvrirProjet(a.projet_id)} style={styles.ligneAlerte}>
                    <Text style={styles.alerteNom}>{a.nom}</Text>
                    <Text style={[styles.alerteValeur, { color: a.urgence === 'urgent' ? '#C0392B' : '#B08D57' }]}>{a.taux_survie_reel}% de survie</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.boutonPrincipal} onPress={onVoirProjets}>
              <Text style={styles.boutonPrincipalTexte}>Voir mes projets</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={onEnregistrerVente}>
              <Text style={styles.boutonSecondaireTexte}>Enregistrer une vente</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { padding: 16 },
  vide: { fontSize: 13, color: '#6E6E73', textAlign: 'center' },
  videCarte: { backgroundColor: '#fff', borderRadius: 20, padding: 30, marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  grille2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  carteStat: { flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  statLabel: { fontSize: 10, color: '#6E6E73', fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  statChiffre: { fontSize: 24, fontWeight: '700', color: '#1D1D1F' },
  statSousTexte: { fontSize: 11, color: '#6E6E73', marginTop: 4 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  badgeAmbre: { backgroundColor: 'rgba(176,141,87,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeAmbreTexte: { fontSize: 12, fontWeight: '700', color: '#B08D57' },
  ligneAlerte: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  alerteNom: { fontSize: 12, color: '#1D1D1F' },
  alerteValeur: { fontSize: 12, fontWeight: '600' },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#1D1D1F', fontSize: 14, fontWeight: '600' },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginBottom: 8 },
  rapportBloc: { borderWidth: 1, borderColor: '#F0F0F0', borderRadius: 14, padding: 12, marginBottom: 10 },
  rapportNom: { fontSize: 13, fontWeight: '600', color: '#1D1D1F' },
  rapportSemaine: { fontSize: 11, color: '#6E6E73', marginTop: 2 },
  badgeEcart: { backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeEcartTexte: { fontSize: 11, fontWeight: '700', color: '#DC2626' },
  encartRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginBottom: 8 },
  encartRougeTitre: { color: '#B91C1C', fontSize: 11, fontWeight: '700' },
  encartRougeTexte: { color: '#DC2626', fontSize: 11, marginTop: 4 },
  encartGris: { backgroundColor: '#F5F5F7', borderRadius: 10, padding: 10 },
  encartGrisLabel: { color: '#6E6E73', fontWeight: '600' },
  encartGrisLigne: { fontSize: 11, color: '#1D1D1F', marginBottom: 2 },
  champRefus: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 12, color: '#1D1D1F', height: 60, textAlignVertical: 'top' },
  ligneActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  boutonValider: { flex: 1, backgroundColor: '#1D1D1F', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonRefuserConfirmer: { flex: 1, backgroundColor: '#DC2626', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonAnnuler: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  boutonAnnulerTexte: { fontSize: 12, fontWeight: '600', color: '#1D1D1F' },
  boutonBlancTexte: { fontSize: 12, fontWeight: '600', color: '#fff' },
  boutonDesactive: { opacity: 0.5 },
});

export default DashboardTechnicienScreen;
