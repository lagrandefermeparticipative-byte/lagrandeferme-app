import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Image, Linking } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';
import { useCache } from '../context/CacheContext';
import { useProjet } from '../context/ProjetContext';

const formatMontant = (m) => new Intl.NumberFormat('fr-FR').format(Math.round(m || 0)) + ' FCFA';

const couleurSante = (score) => {
  if (score >= 4) return { bg: '#ECFDF5', text: '#047857', dot: '#22C55E' };
  if (score >= 2) return { bg: '#FFF7ED', text: '#C2410C', dot: '#FB923C' };
  return { bg: '#FEF2F2', text: '#B91C1C', dot: '#EF4444' };
};
const couleurPhase = (phase) => {
  const map = {
    demarrage: { text: '#1D4ED8', label: 'Démarrage' },
    croissance: { text: '#4338CA', label: 'Croissance' },
    finition: { text: '#7C3AED', label: 'Finition' },
    vente: { text: '#059669', label: 'Vente' },
  };
  return map[phase] || { text: '#6B7280', label: phase };
};

export const VueRapportInvestisseur = ({ token, rapportId, onBack }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [rapport, setRapport] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [messagesRapport, setMessagesRapport] = useState([]);
  const [question, setQuestion] = useState('');
  const [envoiQuestion, setEnvoiQuestion] = useState(false);

  const charger = async () => {
    try {
      const [rapportRes, messagesRes] = await Promise.all([
        api.get(`/rapports/${rapportId}/complet`, { headers }),
        api.get('/messages', { headers }),
      ]);
      setRapport(rapportRes.data);
      setMessagesRapport(messagesRes.data.filter(m => m.rapport_id === rapportId));
    } catch (error) { console.log('Erreur rapport:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { charger(); }, []);

  const envoyerQuestion = async () => {
    if (!question.trim()) return;
    setEnvoiQuestion(true);
    try {
      await api.post('/messages', { contenu: question.trim(), rapport_id: rapportId }, { headers });
      setQuestion('');
      charger();
    } catch (error) { console.log('Erreur envoi:', error.message); }
    finally { setEnvoiQuestion(false); }
  };

  if (chargement || !rapport) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Header titre="Rapport" action={<TouchableOpacity onPress={onBack}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      </View>
    );
  }

  const monInvestissement = (rapport.investisseurs || [])[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre={`Rapport S${rapport.semaine}`} sousTitre={new Date(rapport.date_rapport).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        action={<TouchableOpacity onPress={onBack}><Text style={styles.lienRetourPetit}>← Retour</Text></TouchableOpacity>} />
      <ScrollView style={styles.conteneur}>
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Suivi opérationnel</Text>
          <View style={styles.grille2}>
            <View style={styles.miniGris}><Text style={styles.miniGrisLabel}>Effectif</Text><Text style={styles.miniGrisValeur}>{rapport.effectif_debut || '—'}</Text></View>
            <View style={styles.miniGris}><Text style={styles.miniGrisLabel}>Morts</Text><Text style={[styles.miniGrisValeur, { color: '#DC2626' }]}>{rapport.morts_semaine || 0}</Text></View>
          </View>

          {rapport.global?.sante_moyenne != null && (
            <View style={[styles.santeCarte, { backgroundColor: couleurSante(rapport.global.sante_moyenne).bg }]}>
              <Text style={[styles.santeLabel, { color: couleurSante(rapport.global.sante_moyenne).text }]}>Santé globale du cheptel</Text>
              <Text style={[styles.santeValeur, { color: couleurSante(rapport.global.sante_moyenne).text }]}>{rapport.global.sante_moyenne}/5 · {rapport.global.etat_global}</Text>
            </View>
          )}

          {(rapport.lots || []).map(l => {
            const c = couleurSante(l.sante_score);
            const p = couleurPhase(l.phase_production);
            return (
              <View key={l.id} style={[styles.lotCarte, { backgroundColor: c.bg }]}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.lotNom}>{l.lot_nom}</Text>
                  <Text style={[styles.lotSante, { color: c.text }]}>● Santé {l.sante_score}/5</Text>
                </View>
                <View style={styles.ligneEntre}>
                  <Text style={{ fontSize: 11, color: l.vaccination_effectuee ? '#047857' : '#9CA3AF', fontWeight: l.vaccination_effectuee ? '600' : '400' }}>
                    {l.vaccination_effectuee ? '✓ Vacciné' : 'Pas de vaccination'}
                  </Text>
                  <Text style={{ fontSize: 11, color: p.text, fontWeight: '600' }}>{p.label}</Text>
                </View>
              </View>
            );
          })}
          {rapport.observations && <Text style={styles.observationTexte}>{rapport.observations}</Text>}
        </View>

        {rapport.journal_activites && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Journal des activités</Text>
            <Text style={styles.journalTexte}>{rapport.journal_activites}</Text>
          </View>
        )}

        {rapport.photos?.length > 0 && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Photos de la semaine</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {rapport.photos.map(p => (
                <Image key={p.id} source={{ uri: p.url }} style={styles.photo} />
              ))}
            </View>
          </View>
        )}

        {rapport.financier && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Suivi financier</Text>
            <View style={styles.grille2}>
              <View style={styles.miniRouge}><Text style={styles.miniRougeLabel}>Dépenses réelles</Text><Text style={styles.miniRougeValeur}>{formatMontant(rapport.financier.depenses_reelles)}</Text></View>
              <View style={styles.miniVert}><Text style={styles.miniVertLabel}>Recettes réelles</Text><Text style={styles.miniVertValeur}>{formatMontant(rapport.financier.recettes_reelles)}</Text></View>
            </View>
            <View style={[styles.margeCarte, { backgroundColor: rapport.financier.marge_previsionnelle >= 0 ? '#ECFDF5' : '#FEF2F2' }]}>
              <Text style={[styles.margeLabel, { color: rapport.financier.marge_previsionnelle >= 0 ? '#047857' : '#B91C1C' }]}>Marge prévisionnelle</Text>
              <Text style={[styles.margeValeur, { color: rapport.financier.marge_previsionnelle >= 0 ? '#047857' : '#B91C1C' }]}>{rapport.financier.marge_previsionnelle >= 0 ? '+' : ''}{formatMontant(rapport.financier.marge_previsionnelle)}</Text>
            </View>
          </View>
        )}

        {monInvestissement && (
          <View style={styles.carteAmbre}>
            <Text style={styles.carteAmbreTitre}>💰 Mon investissement</Text>
            <View style={styles.grille2}>
              <Text style={styles.ambreLigne}>Investi : <Text style={styles.ambreGras}>{formatMontant(monInvestissement.montant_investi)}</Text></Text>
              <Text style={styles.ambreLigne}>Part : <Text style={styles.ambreGras}>{monInvestissement.pourcentage_detenu.toFixed(1)}%</Text></Text>
              <Text style={styles.ambreLigne}>Rendement : <Text style={styles.ambreGras}>{monInvestissement.rendement_promis}%</Text></Text>
              <Text style={styles.ambreLigne}>À verser : <Text style={styles.ambreGras}>{formatMontant(monInvestissement.montant_a_verser)}</Text></Text>
            </View>
          </View>
        )}

        {rapport.commentaire_admin && (
          <View style={styles.carteBleue}>
            <Text style={styles.carteBleueTitre}>Commentaire du gestionnaire</Text>
            <Text style={styles.carteBleueTexte}>{rapport.commentaire_admin}</Text>
          </View>
        )}

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Questions sur ce rapport</Text>
          {messagesRapport.length === 0 ? (
            <Text style={styles.vide}>Aucune question pour l'instant sur ce rapport.</Text>
          ) : messagesRapport.map(m => {
            const estGestionnaire = m.auteur_role === 'gestionnaire' || m.auteur_role === 'gestion_invest';
            return (
              <View key={m.id} style={[styles.messageBulle, estGestionnaire ? styles.messageGestionnaire : styles.messageInvestisseur]}>
                <Text style={styles.messageAuteur}>{estGestionnaire ? 'Gestionnaire' : 'Toi'}</Text>
                <Text style={styles.messageContenu}>{m.contenu}</Text>
                <Text style={styles.messageDate}>{new Date(m.created_at).toLocaleString('fr-FR')}</Text>
              </View>
            );
          })}
          <TextInput style={[styles.champ, { height: 60, marginTop: 8 }]} multiline placeholder="Écris ta question ici..." value={question} onChangeText={setQuestion} />
          <TouchableOpacity style={styles.boutonPrincipal} onPress={envoyerQuestion} disabled={envoiQuestion || !question.trim()}>
            <Text style={styles.boutonPrincipalTexte}>{envoiQuestion ? 'Envoi...' : 'Envoyer'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const VueMessages = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [nouveauMessage, setNouveauMessage] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/messages', { headers });
      setMessages(res.data);
    } catch (error) { console.log('Erreur messages:', error.message); }
    finally { setChargement(false); }
  };

  useEffect(() => { charger(); }, []);

  const envoyer = async () => {
    if (!nouveauMessage.trim()) return;
    setEnvoi(true);
    try {
      await api.post('/messages', { contenu: nouveauMessage.trim() }, { headers });
      setNouveauMessage(''); charger();
    } catch (error) { console.log('Erreur envoi:', error.message); }
    finally { setEnvoi(false); }
  };

  if (chargement) return <ActivityIndicator style={{ marginTop: 20 }} color="#111827" />;

  return (
    <View>
      {messages.length === 0 ? (
        <Text style={styles.vide}>Aucun message pour l'instant. Pose ta première question ci-dessous.</Text>
      ) : messages.map(m => {
        const estGestionnaire = m.auteur_role === 'gestionnaire' || m.auteur_role === 'gestion_invest';
        return (
          <View key={m.id} style={[styles.messageBulle, estGestionnaire ? styles.messageGestionnaire : styles.messageInvestisseur]}>
            <Text style={styles.messageAuteur}>{estGestionnaire ? 'Gestionnaire' : 'Toi'}{m.rapport_semaine ? ` · à propos du rapport S${m.rapport_semaine}` : ''}</Text>
            <Text style={styles.messageContenu}>{m.contenu}</Text>
            <Text style={styles.messageDate}>{new Date(m.created_at).toLocaleString('fr-FR')}</Text>
          </View>
        );
      })}
      <View style={styles.carte}>
        <TextInput style={[styles.champ, { height: 60 }]} multiline placeholder="Écris ton message..." value={nouveauMessage} onChangeText={setNouveauMessage} />
        <TouchableOpacity style={styles.boutonPrincipal} onPress={envoyer} disabled={envoi || !nouveauMessage.trim()}>
          <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Envoi...' : 'Envoyer'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const couleurSurvie = (taux) => {
  if (taux === null || taux === undefined) return { fond: '#F9FAFB', bordure: '#E5E7EB', texte: '#6B7280' };
  if (taux >= 90) return { fond: '#ECFDF5', bordure: '#A7F3D0', texte: '#047857' };
  if (taux >= 70) return { fond: '#FFFBEB', bordure: '#FDE68A', texte: '#92400E' };
  return { fond: '#FEF2F2', bordure: '#FECACA', texte: '#B91C1C' };
};

const progressionTemporelle = (dateDebut, dateFin) => {
  if (!dateDebut || !dateFin) return null;
  const debut = new Date(dateDebut).getTime();
  const fin = new Date(dateFin).getTime();
  const maintenant = Date.now();
  if (fin <= debut) return null;
  const pct = ((maintenant - debut) / (fin - debut)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

const InvestissementScreen = ({ token, projetActifId, utilisateurNom }) => {
  const { projetActif } = useProjet();
  const [detailsOuverts, setDetailsOuverts] = useState(false);
  const { getCache, setCache } = useCache();
  const headers = { Authorization: `Bearer ${token}` };
  const [onglet, setOnglet] = useState('investissement');
  const [investissement, setInvestissement] = useState(null);
  const [rapports, setRapports] = useState([]);
  const [chargement, setChargement] = useState(getCache(`investissement_${projetActifId}`) ? false : true);
  const [rapportOuvertId, setRapportOuvertId] = useState(null);
  const [messagesNonLus, setMessagesNonLus] = useState(0);

  const chargerNonLus = async () => {
    try {
      const res = await api.get('/messages/non-lus', { headers });
      setMessagesNonLus(res.data.non_lus);
    } catch (error) { console.log('Erreur non-lus:', error.message); }
  };
  const charger = async (forcer = false) => {
    const cleCache = `investissement_${projetActifId}`;
    if (!forcer) {
      const cache = getCache(cleCache);
      if (cache) {
        if (cache.investissement) setInvestissement(cache.investissement);
        setRapports(cache.rapports);
        setChargement(false);
        return;
      }
    }
    try {
      const [investRes, rapportsRes] = await Promise.all([
        api.get("/utilisateurs/mon-investissement", { headers }),
        api.get(`/rapports?projet_id=${projetActifId}`, { headers }),
      ]);
      const invest = investRes.data.length > 0 ? investRes.data[0] : null;
      if (invest) setInvestissement(invest);
      const rapportsEnvoyes = rapportsRes.data.filter(r => r.statut === "envoye");
      setRapports(rapportsEnvoyes);
      setCache(cleCache, { investissement: invest, rapports: rapportsEnvoyes });
    } catch (error) { console.log("Erreur investissement:", error.message); }
    finally { setChargement(false); }
  };
  useEffect(() => {
    if (projetActifId) { charger(); chargerNonLus(); }
  }, [projetActifId]);

  useEffect(() => { if (onglet !== 'messages') chargerNonLus(); else setMessagesNonLus(0); }, [onglet]);

  if (rapportOuvertId) {
    return <VueRapportInvestisseur token={token} rapportId={rapportOuvertId} onBack={() => setRapportOuvertId(null)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre={projetActif?.nom || "Mon investissement"} sousTitre="Mon investissement" sansRetour />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#111827" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
                    <View style={styles.ongletsLigne}>
            {['investissement', 'rapports', 'messages'].map(t => (
              <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>
                    {t === 'investissement' ? 'Mon invest.' : t === 'rapports' ? 'Rapports' : 'Messages'}
                  </Text>
                  {t === 'messages' && messagesNonLus > 0 && (
                    <View style={styles.badgeRouge}><Text style={styles.badgeRougeTexte}>{messagesNonLus}</Text></View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {onglet === 'investissement' && (
            investissement ? (
              <View style={{ gap: 14 }}>
                <View style={estilosApple.carteApple}>
                  <Text style={estilosApple.labelApple}>CE QUE VOUS ALLEZ RECEVOIR</Text>
                  <Text style={estilosApple.montantApple}>{formatMontant(investissement.mise * (1 + investissement.rendement_promis / 100))}</Text>
                  <Text style={estilosApple.sousTexteApple}>Sur votre mise de {formatMontant(investissement.mise)} · {((investissement.mise / investissement.total_investi) * 100).toFixed(1)}% du projet</Text>
                  <TouchableOpacity onPress={() => setDetailsOuverts(prev => !prev)}>
                    <Text style={estilosApple.lienDetails}>{detailsOuverts ? 'Masquer les détails' : 'Voir les détails'}</Text>
                  </TouchableOpacity>
                  {detailsOuverts && (
                    <View style={estilosApple.detailsBloc}>
                      <View style={estilosApple.ligneDetail}><Text style={estilosApple.detailLabel}>Rendement promis</Text><Text style={estilosApple.detailValeur}>{investissement.rendement_promis}%</Text></View>
                      <View style={estilosApple.ligneDetail}><Text style={estilosApple.detailLabel}>Coût total du projet</Text><Text style={estilosApple.detailValeur}>{formatMontant(investissement.total_investi)}</Text></View>
                    </View>
                  )}
                </View>

                {investissement.mou_url && (
                  <TouchableOpacity onPress={() => Linking.openURL(investissement.mou_url)} style={estilosApple.carteApple}>
                    <Text style={estilosApple.titreApple}>📄 Votre contrat</Text>
                    <Text style={estilosApple.sousTexteApple}>Toucher pour consulter le document</Text>
                  </TouchableOpacity>
                )}

                {(() => {
                  const taux = projetActif?.taux_survie_reel;
                  const accent = taux == null || taux >= 70 ? '#2D6A4F' : '#B08D57';
                  const messages = taux == null
                    ? { titre: 'Suivi en cours', sous: "Le cheptel démarre tout juste son suivi." }
                    : taux >= 90
                    ? { titre: 'Le cheptel se porte bien', sous: `${taux}% de sujets en bonne santé.` }
                    : taux >= 70
                    ? { titre: 'Le cheptel est suivi de près', sous: `${taux}% de sujets en bonne santé — une équipe s'en occupe au quotidien.` }
                    : { titre: 'Une attention particulière est portée au cheptel', sous: `${taux}% de sujets en bonne santé — le gestionnaire prend les mesures nécessaires.` };
                  const progression = progressionTemporelle(projetActif?.date_debut, projetActif?.date_fin);
                  return (
                    <View style={estilosApple.carteApple}>
                      <Text style={estilosApple.titreApple}>{messages.titre}</Text>
                      <Text style={estilosApple.sousTexteApple}>{messages.sous}</Text>
                      {progression !== null && (
                        <View>
                          <View style={estilosApple.barreFond}>
                            <View style={[estilosApple.barreRemplie, { width: `${progression}%`, backgroundColor: accent }]} />
                          </View>
                          <Text style={estilosApple.sousTexteApple}>Le projet avance bien, à {progression}% de son parcours</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                <View style={estilosApple.carteApple}>
                  <Text style={estilosApple.labelApple}>SUIVI DU VERSEMENT</Text>
                  <Text style={estilosApple.titreApple}>{investissement.statut_paiement === 'paye' ? 'Payé' : 'En cours de traitement'}</Text>
                </View>
              </View>
            ) : <Text style={styles.vide}>Aucun investissement trouvé</Text>
          )}

          {onglet === 'rapports' && (
            rapports.length === 0 ? <Text style={styles.vide}>Aucun rapport diffusé pour l'instant</Text> : rapports.map(r => (
              <TouchableOpacity key={r.id} style={styles.carte} onPress={() => setRapportOuvertId(r.uuid_id || r.id)}>
                <View style={styles.ligneEntre}>
                  <Text style={styles.carteTitre}>Rapport S{r.semaine}</Text>
                  <View style={[styles.badge, { backgroundColor: r.lu_par_moi ? '#F3F4F6' : '#ECFDF5' }]}>
                    <Text style={[styles.badgeTexte, { color: r.lu_par_moi ? '#6B7280' : '#047857' }]}>{r.lu_par_moi ? 'Lu ✓' : 'Nouveau'}</Text>
                  </View>
                </View>
                <Text style={styles.carteSousTexte}>{new Date(r.date_rapport).toLocaleDateString('fr-FR')} · Effectif {r.effectif_debut || '—'} · {r.morts_semaine || 0} morts</Text>
              </TouchableOpacity>
            ))
          )}

          {onglet === 'messages' && <VueMessages token={token} />}
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
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 8 },
  carteSousTexte: { fontSize: 11, color: '#6B7280' },
  vide: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, paddingVertical: 20 },
  lienRetourPetit: { color: '#6B7280', fontSize: 11 },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 14, marginTop: 8 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#111827' },
  ongletTexte: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  ongletTexteActif: { color: '#111827' },
  badgeRouge: { backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeRougeTexte: { color: '#fff', fontSize: 9, fontWeight: '700' },
  carteNoire: { backgroundColor: '#111827', borderRadius: 12, padding: 16, marginBottom: 12 },
  carteNoireLabel: { color: '#9CA3AF', fontSize: 11 },
  carteNoireMontant: { color: '#fff', fontSize: 22, fontWeight: '600' },
  carteNoireSousLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  grille2noire: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  miniNoire: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, width: '47%' },
  miniNoireLabel: { color: '#9CA3AF', fontSize: 10 },
  miniNoireValeur: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeTexte: { fontSize: 10, fontWeight: '600' },
  grille2: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  miniGris: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, alignItems: 'center' },
  miniGrisLabel: { fontSize: 10, color: '#9CA3AF' },
  miniGrisValeur: { fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 2 },
  miniRouge: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  miniRougeLabel: { fontSize: 10, color: '#DC2626' },
  miniRougeValeur: { fontSize: 12, fontWeight: '600', color: '#B91C1C' },
  miniVert: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 8, padding: 8 },
  miniVertLabel: { fontSize: 10, color: '#059669' },
  miniVertValeur: { fontSize: 12, fontWeight: '600', color: '#047857' },
  santeCarte: { borderRadius: 12, padding: 14, marginBottom: 10 },
  santeLabel: { fontSize: 11, marginBottom: 4 },
  santeValeur: { fontSize: 20, fontWeight: '700' },
  lotCarte: { borderRadius: 10, padding: 10, marginBottom: 8 },
  lotNom: { fontSize: 12, fontWeight: '600', color: '#111827' },
  lotSante: { fontSize: 11, fontWeight: '600' },
  observationTexte: { fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 6 },
  journalTexte: { fontSize: 12, color: '#4B5563', lineHeight: 18 },
  photo: { width: '31%', height: 80, borderRadius: 8 },
  margeCarte: { borderRadius: 10, padding: 12, marginTop: 8 },
  margeLabel: { fontSize: 11 },
  margeValeur: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  carteAmbre: { backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#FDE68A', borderRadius: 12, padding: 14, marginBottom: 10 },
  carteAmbreTitre: { fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: 8 },
  ambreLigne: { width: '47%', fontSize: 11, color: '#B45309', marginBottom: 4 },
  ambreGras: { fontWeight: '700', color: '#92400E' },
  carteBleue: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 14, marginBottom: 10 },
  carteBleueTitre: { fontSize: 11, fontWeight: '600', color: '#1E3A8A', marginBottom: 4 },
  carteBleueTexte: { fontSize: 12, color: '#1D4ED8' },
  messageBulle: { borderRadius: 12, padding: 10, marginBottom: 8, maxWidth: '85%' },
  messageGestionnaire: { backgroundColor: '#F3F4F6', alignSelf: 'flex-start' },
  messageInvestisseur: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', alignSelf: 'flex-end' },
  messageAuteur: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginBottom: 2 },
  messageContenu: { fontSize: 13, color: '#1F2937' },
  messageDate: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

const estilosApple = StyleSheet.create({
  carteApple: { backgroundColor: '#fff', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  labelApple: { color: '#6E6E73', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  montantApple: { color: '#1D1D1F', fontSize: 32, fontWeight: '700', letterSpacing: -0.5 },
  sousTexteApple: { color: '#6E6E73', fontSize: 13, marginTop: 6 },
  titreApple: { color: '#1D1D1F', fontSize: 14, fontWeight: '600' },
  lienDetails: { color: '#6E6E73', fontSize: 12, marginTop: 14, textDecorationLine: 'underline' },
  detailsBloc: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F5F5F7', gap: 8 },
  ligneDetail: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { color: '#6E6E73', fontSize: 12 },
  detailValeur: { color: '#1D1D1F', fontSize: 12, fontWeight: '600' },
  barreFond: { height: 5, backgroundColor: '#F5F5F7', borderRadius: 3, marginTop: 14, overflow: 'hidden' },
  barreRemplie: { height: 5, borderRadius: 3 },
});

export default InvestissementScreen;