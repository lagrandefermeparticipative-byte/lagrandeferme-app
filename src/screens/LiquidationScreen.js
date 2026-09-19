import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const formatMontant = (m) => m === null || m === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(Math.round(m)) + ' F';

// Deux issues distinctes de la clôture normale (à capital garanti) pour un
// projet en échec : Liquidation (remboursement au prorata du cash restant)
// ou Relance (report du cash + capital investisseur vers un nouveau projet,
// sans remboursement, projet d'origine non clôturé).
const LiquidationScreen = ({ token, route, navigation }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const projetId = route.params?.projetId;
  const [projet, setProjet] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [mode, setMode] = useState(null); // 'liquidation' | 'relance' | null

  const [choixReproducteurs, setChoixReproducteurs] = useState('');
  const [valeurReproducteurs, setValeurReproducteurs] = useState('');
  const [previsualisation, setPrevisualisation] = useState(null);
  const [chargementPrevisu, setChargementPrevisu] = useState(false);
  const [justification, setJustification] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  const [nouveauProjet, setNouveauProjet] = useState({ nom: '', type_volaille: '', objectif_sujets: '', taux_survie_vise: '90' });

  useEffect(() => {
    api.get(`/projets/${projetId}`, { headers }).then(res => setProjet(res.data)).finally(() => setChargement(false));
  }, [projetId]);

  const chargerPrevisualisation = useCallback(async () => {
    setChargementPrevisu(true);
    try {
      const params = new URLSearchParams();
      if (choixReproducteurs) params.append('choix_reproducteurs', choixReproducteurs);
      if (choixReproducteurs === 'transfert_ferme' && valeurReproducteurs) params.append('valeur_reproducteurs', valeurReproducteurs);
      const res = await api.get(`/liquidations/${projetId}/previsualiser?${params.toString()}`, { headers });
      setPrevisualisation(res.data);
    } catch (error) { console.log('Erreur prévisualisation liquidation:', error.message); }
    finally { setChargementPrevisu(false); }
  }, [projetId, choixReproducteurs, valeurReproducteurs]);

  useEffect(() => {
    if (mode === 'liquidation') chargerPrevisualisation();
  }, [mode, chargerPrevisualisation]);

  const confirmerLiquidation = () => {
    if (!justification.trim()) { setErreur('Une justification est obligatoire.'); return; }
    Alert.alert('Liquider ce projet ?', 'Cette action est irréversible : le cash disponible sera réparti et débité de la caisse maintenant.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Liquider', style: 'destructive', onPress: async () => {
        setEnvoi(true); setErreur('');
        try {
          const res = await api.post(`/liquidations/${projetId}/liquider`, {
            justification: justification.trim(),
            choix_reproducteurs: choixReproducteurs || null,
            valeur_reproducteurs: choixReproducteurs === 'transfert_ferme' ? parseFloat(valeurReproducteurs) || 0 : null,
          }, { headers });
          setResultat(res.data);
        } catch (error) {
          setErreur(error.response?.data?.message || 'Erreur lors de la liquidation.');
        } finally { setEnvoi(false); }
      }},
    ]);
  };

  const confirmerRelance = () => {
    if (!justification.trim()) { setErreur('Une justification est obligatoire.'); return; }
    if (!nouveauProjet.nom.trim() || !nouveauProjet.type_volaille.trim() || !nouveauProjet.objectif_sujets) {
      setErreur('Complète les informations du nouveau projet (nom, type, objectif).');
      return;
    }
    Alert.alert('Relancer ce projet ?', `Vers "${nouveauProjet.nom}" — le cash restant et le capital investisseur seront reportés, sans remboursement.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Relancer', style: 'destructive', onPress: async () => {
        setEnvoi(true); setErreur('');
        try {
          const res = await api.post(`/liquidations/${projetId}/relancer`, {
            justification: justification.trim(),
            nouveau_projet: {
              ...nouveauProjet,
              objectif_sujets: parseInt(nouveauProjet.objectif_sujets),
              taux_survie_vise: parseFloat(nouveauProjet.taux_survie_vise) || 90,
            },
          }, { headers });
          setResultat(res.data);
        } catch (error) {
          setErreur(error.response?.data?.message || 'Erreur lors de la relance.');
        } finally { setEnvoi(false); }
      }},
    ]);
  };

  if (chargement) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}><Header titre="Liquidation / Relance" /><ActivityIndicator style={{ marginTop: 30 }} color="#111827" /></View>;
  }

  if (resultat) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <Header titre="Terminé" sansRetour />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>{resultat.message}</Text>
            {resultat.total_reparti_investisseurs !== undefined && (
              <Text style={styles.carteSousTexte}>Créanciers payés : {formatMontant(resultat.total_creances_payees)} · Loyer ferme : {formatMontant(resultat.loyer_ferme)} · Réparti aux investisseurs : {formatMontant(resultat.total_reparti_investisseurs)}</Text>
            )}
            {resultat.nouveau_projet_id && (
              <Text style={styles.carteSousTexte}>Nouveau projet créé (id {resultat.nouveau_projet_id}).</Text>
            )}
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={() => navigation.navigate('Accueil')}>
            <Text style={styles.boutonPrincipalTexte}>Retour au tableau de bord</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre="Liquidation / Relance" sousTitre={projet?.nom || ''} />
      <ScrollView style={styles.conteneur}>

        {!mode && (
          <>
            <View style={styles.alerteAmbre}>
              <Text style={styles.alerteAmbreTexte}>Ces deux modes sont réservés à un projet en échec, où le capital des investisseurs ne peut plus être garanti. Pour une fin de projet normale, utilise la clôture classique depuis le Dashboard.</Text>
            </View>
            <TouchableOpacity style={styles.carteChoix} onPress={() => setMode('liquidation')}>
              <Text style={styles.carteTitre}>Liquidation</Text>
              <Text style={styles.carteSousTexte}>Le cash disponible en caisse est réparti aux investisseurs au prorata de ce qu'ils ont réellement versé, après paiement des créanciers du projet. Le projet est définitivement fermé.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.carteChoix} onPress={() => setMode('relance')}>
              <Text style={styles.carteTitre}>Relance</Text>
              <Text style={styles.carteSousTexte}>Le cash restant et le capital des investisseurs sont reportés vers un nouveau projet, sans remboursement. Ce projet reste ouvert pour le suivi de ce qu'il reste dessus.</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'liquidation' && (
          <>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Liquidation</Text>

              {previsualisation?.nb_reproducteurs_actifs > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.carteSousTexte}>{previsualisation.nb_reproducteurs_actifs} reproducteur(s) retenu(s) encore actif(s) sur ce projet :</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity onPress={() => setChoixReproducteurs('vendre')} style={[styles.chip, choixReproducteurs === 'vendre' && styles.chipActif]}>
                      <Text style={[styles.chipTexte, choixReproducteurs === 'vendre' && styles.chipTexteActif]}>Les vendre d'abord</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setChoixReproducteurs('transfert_ferme')} style={[styles.chip, choixReproducteurs === 'transfert_ferme' && styles.chipActif]}>
                      <Text style={[styles.chipTexte, choixReproducteurs === 'transfert_ferme' && styles.chipTexteActif]}>Transférer au capital ferme</Text>
                    </TouchableOpacity>
                  </View>
                  {choixReproducteurs === 'transfert_ferme' && (
                    <>
                      <Text style={styles.label}>Valeur estimée transférée par la ferme (F)</Text>
                      <TextInput style={styles.champ} keyboardType="numeric" value={valeurReproducteurs} onChangeText={setValeurReproducteurs} />
                    </>
                  )}
                </View>
              )}

              {chargementPrevisu ? (
                <ActivityIndicator style={{ marginVertical: 12 }} color="#111827" />
              ) : previsualisation?.bloque ? (
                <View style={styles.alerteRouge}>
                  {previsualisation.blocages.map((b, i) => <Text key={i} style={styles.alerteRougeTexte}>⚠️ {b}</Text>)}
                </View>
              ) : previsualisation && (
                <View style={{ marginTop: 8 }}>
                  <View style={styles.encartGris}>
                    <View style={styles.ligneEntre}><Text style={styles.miniLabelPetit}>Cash disponible</Text><Text style={styles.miniValeurPetite}>{formatMontant(previsualisation.cash_disponible)}</Text></View>
                    <View style={styles.ligneEntre}><Text style={styles.miniLabelPetit}>Créanciers payés</Text><Text style={styles.miniValeurPetite}>{formatMontant(previsualisation.creances.total_paye)} / {formatMontant(previsualisation.creances.total_du)}</Text></View>
                    <View style={styles.ligneEntre}><Text style={styles.miniLabelPetit}>Loyer ferme (2%)</Text><Text style={styles.miniValeurPetite}>{formatMontant(previsualisation.loyer_ferme)}</Text></View>
                    <View style={styles.ligneEntre}><Text style={styles.miniLabelPetit}>Pool investisseurs</Text><Text style={styles.miniValeurPetite}>{formatMontant(previsualisation.pool_investisseurs)}</Text></View>
                  </View>
                  {previsualisation.investisseurs.map(inv => (
                    <View key={inv.utilisateur_id} style={styles.ligneEntre}>
                      <Text style={styles.carteSousTexte}>{inv.nom}</Text>
                      <Text style={styles.carteSousTexte}>{formatMontant(inv.part_recue)} <Text style={{ color: '#DC2626' }}>(-{formatMontant(inv.perte)})</Text></Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Justification (obligatoire)</Text>
              <TextInput style={[styles.champ, { height: 60 }]} multiline value={justification} onChangeText={setJustification} placeholder="Explique la cause de l'échec et la décision..." />

              {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}

              <TouchableOpacity style={styles.boutonRouge} onPress={confirmerLiquidation} disabled={envoi || previsualisation?.bloque || !previsualisation}>
                <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Liquidation en cours...' : 'Liquider définitivement le projet'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setMode(null); setPrevisualisation(null); }}>
              <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
            </TouchableOpacity>
          </>
        )}

        {mode === 'relance' && (
          <>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Nouveau projet</Text>
              <Text style={styles.label}>Nom *</Text>
              <TextInput style={styles.champ} value={nouveauProjet.nom} onChangeText={v => setNouveauProjet({ ...nouveauProjet, nom: v })} placeholder="Ex: Poulets 2026" />
              <Text style={styles.label}>Type de volaille *</Text>
              <TextInput style={styles.champ} value={nouveauProjet.type_volaille} onChangeText={v => setNouveauProjet({ ...nouveauProjet, type_volaille: v })} placeholder="Ex: Poulet" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Objectif sujets *</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={nouveauProjet.objectif_sujets} onChangeText={v => setNouveauProjet({ ...nouveauProjet, objectif_sujets: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Survie visée (%)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={nouveauProjet.taux_survie_vise} onChangeText={v => setNouveauProjet({ ...nouveauProjet, taux_survie_vise: v })} />
                </View>
              </View>
              <Text style={styles.infoTexte}>Le nouveau projet repart avec un contrat entièrement indépendant, sans lien avec l'échec de celui-ci.</Text>

              <Text style={styles.label}>Justification (obligatoire)</Text>
              <TextInput style={[styles.champ, { height: 60 }]} multiline value={justification} onChangeText={setJustification} placeholder="Explique la cause de l'échec et la décision de relancer..." />

              {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}

              <TouchableOpacity style={styles.boutonOrangeGrand} onPress={confirmerRelance} disabled={envoi}>
                <Text style={styles.boutonOrangeTexte}>{envoi ? 'Relance en cours...' : 'Relancer vers ce nouveau projet'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setMode(null)}>
              <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
            </TouchableOpacity>
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteChoix: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#111827' },
  carteSousTexte: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  encartGris: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 8, marginBottom: 6 },
  miniLabelPetit: { fontSize: 11, color: '#6B7280' },
  miniValeurPetite: { fontSize: 11, fontWeight: '600', color: '#111827' },
  alerteAmbre: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 10, marginBottom: 10 },
  alerteAmbreTexte: { fontSize: 11, color: '#92400E' },
  alerteRouge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginTop: 8, gap: 4 },
  alerteRougeTexte: { fontSize: 11, color: '#B91C1C' },
  label: { fontSize: 11, color: '#6B7280', marginBottom: 4, marginTop: 8 },
  champ: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#111827' },
  chip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  chipActif: { backgroundColor: '#111827' },
  chipTexte: { fontSize: 11, color: '#6B7280' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  infoTexte: { fontSize: 11, color: '#9CA3AF', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginTop: 8 },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginTop: 8 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonRouge: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 13, fontWeight: '600' },
  boutonOrangeGrand: { backgroundColor: '#EA580C', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  boutonOrangeTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

export default LiquidationScreen;
