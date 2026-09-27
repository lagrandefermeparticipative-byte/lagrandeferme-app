import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TYPES_DOCUMENT = [
  { code: 'rapport_stage', label: 'Rapport de stage' },
  { code: 'memoire', label: 'Mémoire' },
  { code: 'projet_professionnel', label: 'Projet professionnel' },
];

// Flux bloquant en 3 étapes pour tout nouveau compte stagiaire, avant accès
// au reste de l'appli : consentement RGPD, petit questionnaire, choix du
// type de document de stage à produire. Équivalent mobile de
// OnboardingStagiaire.js (web) — voir Racine dans App.js pour le blocage.
const OnboardingStagiaireScreen = () => {
  const { token, mettreAJourUtilisateur } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [etape, setEtape] = useState(1);
  const [consentement, setConsentement] = useState(false);
  const [etablissement, setEtablissement] = useState('');
  const [aspiration1, setAspiration1] = useState('');
  const [aspiration2, setAspiration2] = useState('');
  const [typeDocument, setTypeDocument] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const suivant = () => setEtape((e) => Math.min(3, e + 1));
  const precedent = () => setEtape((e) => Math.max(1, e - 1));

  const terminer = async () => {
    if (!typeDocument) {
      setErreur('Choisis le type de document que tu vas produire.');
      return;
    }
    setEnvoi(true);
    setErreur('');
    try {
      const aspirations = [aspiration1, aspiration2].filter(Boolean).join('\n');
      const res = await api.put('/utilisateurs/moi/onboarding', {
        consentement_donnees_accepte: true,
        etablissement,
        aspirations,
        type_document_stage: typeDocument,
      }, { headers });
      await mettreAJourUtilisateur({ onboarding_complete: true, ...res.data });
    } catch (error) {
      setErreur(error.response?.data?.message || 'Une erreur est survenue, réessaie.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.conteneur}>
        <Text style={styles.etapeTexte}>Étape {etape} / 3</Text>
        <View style={styles.progressLigne}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.progressSegment, n <= etape && styles.progressActive]} />
          ))}
        </View>

        {etape === 1 && (
          <View>
            <Text style={styles.titre}>Bienvenue dans ton parcours de stage</Text>
            <Text style={styles.texte}>
              Pendant ton stage, les activités que tu enregistres (rapports hebdomadaires,
              signalements) sont utilisées pour assurer ton suivi par ton technicien encadrant
              et le gestionnaire de la ferme. Aucune de ces données n'est partagée en dehors de
              l'encadrement de ton stage.
            </Text>
            <TouchableOpacity style={styles.consentementLigne} onPress={() => setConsentement(!consentement)}>
              <View style={[styles.checkbox, consentement && styles.checkboxActif]}>
                {consentement && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
              </View>
              <Text style={styles.consentementTexte}>J'ai compris et j'accepte l'utilisation de mes données d'activité dans le cadre de mon suivi de stage.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.boutonPrincipal, !consentement && styles.boutonDesactive]} onPress={suivant} disabled={!consentement}>
              <Text style={styles.boutonPrincipalTexte}>Continuer</Text>
            </TouchableOpacity>
          </View>
        )}

        {etape === 2 && (
          <View>
            <Text style={styles.titre}>Parlons un peu de ton stage</Text>
            <Text style={styles.texte}>Quelques questions rapides, pour mieux t'accompagner.</Text>
            <Text style={styles.label}>Établissement</Text>
            <TextInput style={styles.champ} value={etablissement} onChangeText={setEtablissement} placeholder="Nom de ton école / université" />
            <Text style={styles.label}>Qu'attends-tu de ce stage ?</Text>
            <TextInput style={styles.champ} value={aspiration1} onChangeText={setAspiration1} placeholder="En quelques mots" />
            <Text style={styles.label}>Un domaine qui t'intéresse particulièrement ?</Text>
            <TextInput style={styles.champ} value={aspiration2} onChangeText={setAspiration2} placeholder="Élevage, gestion, commerce..." />
            <View style={styles.ligneBoutons}>
              <TouchableOpacity style={styles.boutonSecondaire} onPress={precedent}><Text style={styles.boutonSecondaireTexte}>Retour</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.boutonPrincipal, { flex: 1, marginTop: 0 }]} onPress={suivant}><Text style={styles.boutonPrincipalTexte}>Continuer</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {etape === 3 && (
          <View>
            <Text style={styles.titre}>Un dernier point</Text>
            <Text style={styles.texte}>Quel document vas-tu produire à l'issue de ce stage ?</Text>
            {TYPES_DOCUMENT.map((opt) => (
              <TouchableOpacity key={opt.code} onPress={() => setTypeDocument(opt.code)}
                style={[styles.optionLigne, typeDocument === opt.code && styles.optionLigneActive]}>
                <View style={[styles.radio, typeDocument === opt.code && styles.radioActif]}>
                  {typeDocument === opt.code && <View style={styles.radioPoint} />}
                </View>
                <Text style={styles.optionTexte}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
            <View style={styles.ligneBoutons}>
              <TouchableOpacity style={styles.boutonSecondaire} onPress={precedent}><Text style={styles.boutonSecondaireTexte}>Retour</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.boutonPrincipal, { flex: 1, marginTop: 0 }, envoi && styles.boutonDesactive]} onPress={terminer} disabled={envoi}>
                <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Terminer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { padding: 24, paddingTop: 70, flexGrow: 1, justifyContent: 'center' },
  etapeTexte: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  progressLigne: { flexDirection: 'row', gap: 4, marginBottom: 24 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA' },
  progressActive: { backgroundColor: '#1D1D1F' },
  titre: { fontSize: 18, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  texte: { fontSize: 13, color: '#6E6E73', marginBottom: 16, lineHeight: 19 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 10, padding: 10, fontSize: 13, color: '#1D1D1F' },
  consentementLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0', padding: 14, marginBottom: 16 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  consentementTexte: { flex: 1, fontSize: 13, color: '#374151' },
  optionLigne: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 12, marginBottom: 8 },
  optionLigneActive: { borderColor: '#1D1D1F', backgroundColor: '#F5F5F7' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActif: { borderColor: '#1D1D1F' },
  radioPoint: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#1D1D1F' },
  optionTexte: { fontSize: 13, color: '#374151' },
  erreurTexte: { color: '#DC2626', fontSize: 12, marginTop: 4, marginBottom: 4 },
  ligneBoutons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  boutonDesactive: { opacity: 0.4 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default OnboardingStagiaireScreen;
