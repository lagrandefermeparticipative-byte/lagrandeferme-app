import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';

const CATEGORIES_ELEVAGE = [
  { id: 'aviculture', nom: 'Aviculture', icone: '🐦', disponible: true },
  { id: 'bovin', nom: 'Bovin', icone: '🐄', disponible: false },
  { id: 'ovin', nom: 'Ovin', icone: '🐑', disponible: false },
  { id: 'caprin', nom: 'Caprin', icone: '🐐', disponible: false },
  { id: 'porcin', nom: 'Porcin', icone: '🐖', disponible: false },
  { id: 'cuniculture', nom: 'Cuniculture', icone: '🐇', disponible: false },
  { id: 'pisciculture', nom: 'Pisciculture', icone: '🐟', disponible: false },
  { id: 'apiculture', nom: 'Apiculture', icone: '🐝', disponible: false },
  { id: 'heliciculture', nom: 'Héliciculture', icone: '🐌', disponible: false },
];

const ESPECES_AVICULTURE = [
  { nom: 'Poulet de chair', objectifFixe: 'viande' },
  { nom: 'Poule pondeuse', objectifFixe: 'oeufs' },
  { nom: 'Pintade', objectifFixe: null },
  { nom: 'Dinde', objectifFixe: null },
  { nom: 'Canard', objectifFixe: null },
  { nom: 'Oie', objectifFixe: null },
  { nom: 'Caille', objectifFixe: null },
  { nom: 'Autruche', objectifFixe: null },
];

const formInitial = {
  nom: '', espece: 'Pintade', objectif_elevage: 'viande', reproduction_active: false,
  objectif_sujets: '', taux_survie_vise: '90', stade_vente: 'Adulte (finition)',
  prix_vente_femelle: '', rendement_promis: '20', loyer_gestionnaire: '2',
  date_debut: '', date_fin: '',
  effectif_actuel: '', morts_cumules: '', date_arrivee_reelle: '',
  depense_aliment: '', depense_sante: '', depense_autres: '', solde_caisse_actuel: '',
  budget_aliment_prevu: '', budget_sante_prevu: '', budget_autres_prevu: '',
};

const DemarrageRattrapageScreen = ({ token, onTerminer, onAnnuler }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [etape, setEtape] = useState(1);
  const [succes, setSucces] = useState(false);
  const [categorieChoisie, setCategorieChoisie] = useState('aviculture');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [comptesExistants, setComptesExistants] = useState([]);
  const [form, setForm] = useState(formInitial);
  const [investisseurs, setInvestisseurs] = useState([{ mode: 'nouveau', utilisateur_id: '', nom: '', email: '', mot_de_passe: '', telephone: '', mise: '' }]);

  useEffect(() => {
    api.get('/utilisateurs/liste', { headers }).then(res => setComptesExistants(res.data)).catch(() => {});
  }, []);

  const ajouterInvestisseur = () => setInvestisseurs(prev => [...prev, { mode: 'nouveau', utilisateur_id: '', nom: '', email: '', mot_de_passe: '', telephone: '', mise: '' }]);
  const retirerInvestisseur = (i) => setInvestisseurs(prev => prev.filter((_, idx) => idx !== i));
  const changerInvestisseur = (i, champ, valeur) => {
    setInvestisseurs(prev => {
      const copie = [...prev];
      copie[i] = { ...copie[i], [champ]: valeur };
      if (champ === 'utilisateur_id') {
        const compte = comptesExistants.find(c => c.id === parseInt(valeur));
        copie[i].nom = compte ? compte.nom : '';
      }
      return copie;
    });
  };

  const especeActuelle = ESPECES_AVICULTURE.find(x => x.nom === form.espece);

  const ajouterAutreProduction = () => {
    setForm(formInitial);
    setInvestisseurs([{ mode: 'nouveau', utilisateur_id: '', nom: '', email: '', mot_de_passe: '', telephone: '', mise: '' }]);
    setEtape(1);
    setSucces(false);
  };

  const soumettre = async () => {
    setEnvoi(true); setErreur('');
    try {
      const investisseursFinaux = [];
      for (const inv of investisseurs.filter(i => i.mise)) {
        if (inv.mode === 'existant') {
          if (!inv.utilisateur_id) continue;
          investisseursFinaux.push({ utilisateur_id: inv.utilisateur_id, mise: inv.mise });
        } else {
          if (!inv.nom || !inv.mot_de_passe || (!inv.email && !inv.telephone)) continue;
          const userRes = await api.post('/auth/creer', {
            nom: inv.nom, email: inv.email || undefined, mot_de_passe: inv.mot_de_passe,
            telephone: inv.telephone || undefined, role: 'investisseur',
          }, { headers });
          investisseursFinaux.push({ utilisateur_id: userRes.data.utilisateur.id, mise: inv.mise });
        }
      }
      await api.post('/projets/demarrage-rattrapage', { ...form, investisseurs: investisseursFinaux }, { headers });
      setSucces(true);
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur lors de la création.');
    } finally { setEnvoi(false); }
  };

  if (succes) {
    return (
      <View style={[styles.conteneur, styles.centre]}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
        <Text style={styles.succesTitre}>Production enregistrée</Text>
        <Text style={styles.succesTexte}>Avez-vous une autre production à rattraper (une autre espèce ou un autre élevage) ?</Text>
        <TouchableOpacity style={styles.boutonPrincipal} onPress={ajouterAutreProduction}>
          <Text style={styles.boutonPrincipalTexte}>Oui, ajouter une autre production</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonSecondaire} onPress={onTerminer}>
          <Text style={styles.boutonSecondaireTexte}>Non, terminé — aller au tableau de bord</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const titre = etape === 1 ? "Infos générales" : etape === 2 ? "État actuel de l'élevage" : etape === 3 ? "Situation financière" : "Investisseurs déjà engagés";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F5F5F7' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Header titre={titre} sansRetour />
      <ScrollView style={styles.conteneur}>
        <View style={styles.progressLigne}>
          {[1, 2, 3, 4].map(step => <View key={step} style={[styles.progressSegment, step <= etape && styles.progressActif]} />)}
        </View>
        <Text style={styles.etapeTexte}>Étape {etape} sur 4 — démarrage en cours de route</Text>

        {etape === 1 && (
          <View>
            <View style={styles.encartBleu}><Text style={styles.encartBleuTexte}>Pour une ferme qui a déjà un projet réellement en cours ailleurs — on rattrape son état actuel, pas besoin de reconstituer tout l'historique.</Text></View>
            <View style={styles.carte}>
              <Text style={styles.label}>Nom du projet *</Text>
              <TextInput style={styles.champ} placeholder="Ex: Poulets de chair - Ferme X" value={form.nom} onChangeText={v => setForm({ ...form, nom: v })} />

              <Text style={styles.label}>Catégorie d'élevage</Text>
              <View style={styles.grilleCategories}>
                {CATEGORIES_ELEVAGE.map(cat => (
                  <TouchableOpacity key={cat.id} disabled={!cat.disponible} onPress={() => cat.disponible && setCategorieChoisie(cat.id)}
                    style={[styles.categorieBouton, categorieChoisie === cat.id && styles.categorieBoutonActif, !cat.disponible && styles.categorieBoutonDesactive]}>
                    <Text style={{ fontSize: 16 }}>{cat.icone}</Text>
                    <Text style={[styles.categorieTexte, categorieChoisie === cat.id && styles.categorieTexteActif]}>{cat.nom}</Text>
                    {!cat.disponible && <Text style={styles.categorieBientot}>Bientôt</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {categorieChoisie === 'aviculture' && (
                <>
                  <Text style={styles.label}>Espèce</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {ESPECES_AVICULTURE.map(esp => (
                      <TouchableOpacity key={esp.nom} onPress={() => setForm({ ...form, espece: esp.nom, objectif_elevage: esp.objectifFixe || form.objectif_elevage })}
                        style={[styles.chip, form.espece === esp.nom && styles.chipActif]}>
                        <Text style={[styles.chipTexte, form.espece === esp.nom && styles.chipTexteActif]}>{esp.nom}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {especeActuelle?.objectifFixe ? (
                    <Text style={styles.infoGrise}>Objectif : {especeActuelle.objectifFixe === 'viande' ? 'Viande' : 'Œufs'} (fixé par l'espèce)</Text>
                  ) : (
                    <View>
                      <Text style={styles.label}>Objectif</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {['viande', 'oeufs', 'viande_et_oeufs'].map(obj => (
                          <TouchableOpacity key={obj} onPress={() => setForm({ ...form, objectif_elevage: obj })} style={[styles.chipFlex, form.objectif_elevage === obj && styles.chipActif]}>
                            <Text style={[styles.chipTexte, form.objectif_elevage === obj && styles.chipTexteActif]}>{obj === 'viande' ? 'Viande' : obj === 'oeufs' ? 'Œufs' : 'Les deux'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  <TouchableOpacity style={styles.checkboxLigne} onPress={() => setForm({ ...form, reproduction_active: !form.reproduction_active })}>
                    <View style={[styles.checkbox, form.reproduction_active && styles.checkboxActif]}>{form.reproduction_active && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}</View>
                    <Text style={styles.checkboxTexte}>Je fais aussi la reproduction (couveuse à moi ou prestataire payant)</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Objectif (sujets)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" placeholder="1000" value={form.objectif_sujets} onChangeText={v => setForm({ ...form, objectif_sujets: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Survie visée (%)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={form.taux_survie_vise} onChangeText={v => setForm({ ...form, taux_survie_vise: v })} />
                </View>
              </View>

              <Text style={styles.label}>Prix de vente estimatif (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="Par sujet, ou par kg" value={form.prix_vente_femelle} onChangeText={v => setForm({ ...form, prix_vente_femelle: v })} />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Rendement promis (%)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={form.rendement_promis} onChangeText={v => setForm({ ...form, rendement_promis: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Loyer gestionnaire (%)</Text>
                  <TextInput style={styles.champ} keyboardType="numeric" value={form.loyer_gestionnaire} onChangeText={v => setForm({ ...form, loyer_gestionnaire: v })} />
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(2)}><Text style={styles.boutonPrincipalTexte}>Suivant → État actuel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={onAnnuler}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
          </View>
        )}

        {etape === 2 && (
          <View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Ce qu'il reste aujourd'hui, réellement</Text>
              <Text style={styles.label}>Effectif vivant actuellement *</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="Sujets vivants aujourd'hui" value={form.effectif_actuel} onChangeText={v => setForm({ ...form, effectif_actuel: v })} />
              <Text style={styles.label}>Morts cumulés depuis le début</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.morts_cumules} onChangeText={v => setForm({ ...form, morts_cumules: v })} />
              <Text style={styles.aide}>Le total initial sera calculé automatiquement (vivants + morts).</Text>
              <Text style={styles.label}>Date d'arrivée réelle des sujets</Text>
              <TextInput style={styles.champ} placeholder="AAAA-MM-JJ" value={form.date_arrivee_reelle} onChangeText={v => setForm({ ...form, date_arrivee_reelle: v })} />
            </View>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(3)}><Text style={styles.boutonPrincipalTexte}>Suivant → Finances</Text></TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(1)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
          </View>
        )}

        {etape === 3 && (
          <View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Ce qui a déjà été dépensé (montants globaux)</Text>
              <Text style={styles.label}>Total dépensé en aliment (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.depense_aliment} onChangeText={v => setForm({ ...form, depense_aliment: v })} />
              <Text style={styles.label}>Total dépensé en santé (vaccins, traitements) (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.depense_sante} onChangeText={v => setForm({ ...form, depense_sante: v })} />
              <Text style={styles.label}>Total autres dépenses (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.depense_autres} onChangeText={v => setForm({ ...form, depense_autres: v })} />
            </View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Budget prévisionnel pour la suite</Text>
              <Text style={styles.aide}>Ce que vous prévoyez de dépenser encore d'ici la fin.</Text>
              <Text style={styles.label}>Aliment prévu restant (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.budget_aliment_prevu} onChangeText={v => setForm({ ...form, budget_aliment_prevu: v })} />
              <Text style={styles.label}>Santé prévue restante (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.budget_sante_prevu} onChangeText={v => setForm({ ...form, budget_sante_prevu: v })} />
              <Text style={styles.label}>Autres dépenses prévues restantes (F)</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.budget_autres_prevu} onChangeText={v => setForm({ ...form, budget_autres_prevu: v })} />
            </View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Solde de caisse actuel</Text>
              <Text style={styles.label}>Combien reste-t-il réellement en caisse aujourd'hui (F) *</Text>
              <TextInput style={styles.champ} keyboardType="numeric" placeholder="0" value={form.solde_caisse_actuel} onChangeText={v => setForm({ ...form, solde_caisse_actuel: v })} />
              <Text style={styles.aide}>L'appli ajustera automatiquement pour que ce solde soit exact.</Text>
            </View>
            <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(4)}><Text style={styles.boutonPrincipalTexte}>Suivant → Investisseurs</Text></TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(2)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
          </View>
        )}

        {etape === 4 && (
          <View>
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Investisseurs déjà engagés (facultatif)</Text>
              {investisseurs.map((inv, i) => (
                <View key={i} style={styles.investisseurBloc}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => changerInvestisseur(i, 'mode', 'nouveau')} style={[styles.chipFlex, inv.mode === 'nouveau' && styles.chipActif]}>
                      <Text style={[styles.chipTexte, inv.mode === 'nouveau' && styles.chipTexteActif]}>Nouveau compte</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changerInvestisseur(i, 'mode', 'existant')} style={[styles.chipFlex, inv.mode === 'existant' && styles.chipActif]}>
                      <Text style={[styles.chipTexte, inv.mode === 'existant' && styles.chipTexteActif]}>Compte existant</Text>
                    </TouchableOpacity>
                  </View>
                  {inv.mode === 'existant' ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {comptesExistants.map(c => (
                        <TouchableOpacity key={c.id} onPress={() => changerInvestisseur(i, 'utilisateur_id', String(c.id))} style={[styles.chip, inv.utilisateur_id === String(c.id) && styles.chipActif]}>
                          <Text style={[styles.chipTexte, inv.utilisateur_id === String(c.id) && styles.chipTexteActif]}>{c.nom}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : (
                    <>
                      <TextInput style={styles.champ} placeholder="Nom complet" value={inv.nom} onChangeText={v => changerInvestisseur(i, 'nom', v)} />
                      <TextInput style={[styles.champ, { marginTop: 6 }]} keyboardType="email-address" placeholder="Email (optionnel si téléphone donné)" value={inv.email} onChangeText={v => changerInvestisseur(i, 'email', v)} />
                      <TextInput style={[styles.champ, { marginTop: 6 }]} placeholder="Téléphone (optionnel si email donné)" value={inv.telephone} onChangeText={v => changerInvestisseur(i, 'telephone', v)} />
                      <TextInput style={[styles.champ, { marginTop: 6 }]} secureTextEntry placeholder="Mot de passe (min. 6 caractères)" value={inv.mot_de_passe} onChangeText={v => changerInvestisseur(i, 'mot_de_passe', v)} />
                    </>
                  )}
                  <TextInput style={[styles.champ, { marginTop: 6 }]} keyboardType="numeric" placeholder="Mise (F)" value={inv.mise} onChangeText={v => changerInvestisseur(i, 'mise', v)} />
                  {investisseurs.length > 1 && <TouchableOpacity onPress={() => retirerInvestisseur(i)}><Text style={styles.lienRetirer}>Retirer</Text></TouchableOpacity>}
                </View>
              ))}
              <TouchableOpacity onPress={ajouterInvestisseur}><Text style={styles.lienAjouter}>+ Ajouter un investisseur</Text></TouchableOpacity>
            </View>
            {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
            <TouchableOpacity style={styles.boutonPrincipal} onPress={soumettre} disabled={envoi}>
              <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création...' : "Créer le projet avec son état actuel"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(3)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { justifyContent: 'center', alignItems: 'center' },
  succesTitre: { fontSize: 16, fontWeight: '600', color: '#1D1D1F', marginBottom: 8 },
  succesTexte: { fontSize: 13, color: '#6E6E73', textAlign: 'center', marginBottom: 20 },
  progressLigne: { flexDirection: 'row', gap: 4, marginTop: 12, marginBottom: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA' },
  progressActif: { backgroundColor: '#1D1D1F' },
  etapeTexte: { fontSize: 11, color: '#6E6E73', marginBottom: 12 },
  encartBleu: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 12, padding: 12, marginBottom: 12 },
  encartBleuTexte: { color: '#1D4ED8', fontSize: 12 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#1D1D1F', marginBottom: 10 },
  label: { fontSize: 12, color: '#6E6E73', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, fontSize: 13, color: '#1D1D1F' },
  aide: { fontSize: 10, color: '#6E6E73', marginTop: 4 },
  grilleCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  categorieBouton: { width: '31%', backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  categorieBoutonActif: { backgroundColor: '#1D1D1F' },
  categorieBoutonDesactive: { backgroundColor: '#F5F5F7' },
  categorieTexte: { fontSize: 10, color: '#4B5563', marginTop: 2 },
  categorieTexteActif: { color: '#fff', fontWeight: '600' },
  categorieBientot: { fontSize: 8, color: '#D1D5DB' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6', marginRight: 6 },
  chipFlex: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  chipActif: { backgroundColor: '#1D1D1F' },
  chipTexte: { fontSize: 11, color: '#6E6E73' },
  chipTexteActif: { color: '#fff', fontWeight: '600' },
  infoGrise: { fontSize: 11, color: '#6E6E73', backgroundColor: '#F5F5F7', padding: 8, borderRadius: 8, marginTop: 8 },
  checkboxLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, marginTop: 10 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActif: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  checkboxTexte: { fontSize: 11, color: '#4B5563', flex: 1 },
  investisseurBloc: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 10, padding: 10, marginBottom: 10 },
  lienRetirer: { color: '#DC2626', fontSize: 11, marginTop: 6 },
  lienAjouter: { color: '#4B5563', fontSize: 12, fontWeight: '600' },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginBottom: 8 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
});

export default DemarrageRattrapageScreen;