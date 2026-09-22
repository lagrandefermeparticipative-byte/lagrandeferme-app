import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../services/api';
import { useProjet } from '../context/ProjetContext';

const CATEGORIES_ELEVAGE = [
  { id: 'aviculture', nom: 'Aviculture', icone: '🐦', disponible: true },
  { id: 'bovin', nom: 'Bovin', icone: '🐄', disponible: false },
  { id: 'ovin', nom: 'Ovin', icone: '🐑', disponible: false },
  { id: 'caprin', nom: 'Caprin', icone: '🐐', disponible: false },
  { id: 'porcin', nom: 'Porcin', icone: '🐖', disponible: false },
];

const ESPECES_AVICULTURE = [
  { nom: 'Poulet de chair', objectifFixe: 'viande' },
  { nom: 'Poule pondeuse', objectifFixe: 'oeufs' },
  { nom: 'Pintade', objectifFixe: null },
  { nom: 'Dinde', objectifFixe: null },
  { nom: 'Canard', objectifFixe: null },
];

const LIBELLES_PAR_CATEGORIE = {
  'Alimentation': ['Maïs', 'Soja', 'Ingrédients divers', 'Aliment complet'],
  'Sante & vaccins': ['Vaccins', 'Antibiotiques', 'Déparasitant', 'Vitamines'],
  'Transport': ['Transport achats', 'Transport livraisons', 'Livraisons'],
  'Technicien': ['Techniciens - salaires'],
  'Infrastructure': ['Ustensiles', 'Charbon', 'Electricite'],
  'Achat sujets': ['Pintadeaux'],
  'Autre': ['Communication digitale', 'Imprevus'],
};

const NouveauProjetScreen = ({ token, onTermine, onAnnuler }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const { rechargerProjets, choisirProjet } = useProjet();
  const [etape, setEtape] = useState(0);
  const [categorieChoisie, setCategorieChoisie] = useState('aviculture');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [comptesExistants, setComptesExistants] = useState([]);
  const [erreurComptes, setErreurComptes] = useState('');

  const [form, setForm] = useState({
    nom: '', espece: 'Pintade', objectif_elevage: 'viande', reproduction_active: false,
    origine_cheptel: 'sujets', nombre_oeufs: '', cout_achat_oeufs: '', poussins_eclos_depart: '',
    nombre_sujets_achetes: '', cout_achat_sujets: '',
    objectif_sujets: '', taux_survie_vise: '90',
    prix_vente_male: '', prix_vente_femelle: '', rendement_promis: '20', loyer_gestionnaire: '2',
    date_debut: '', date_fin: '', cadence_rapport: 'hebdomadaire',
  });

    const [afficherCalendrier, setAfficherCalendrier] = useState(null); // 'debut' | 'fin' | null
  const [aBudget, setABudget] = useState(null);
  const [lignesBudget, setLignesBudget] = useState([]);
  const [investisseurs, setInvestisseurs] = useState([]);

  useEffect(() => {
    api.get('/utilisateurs/liste', { headers }).then(res => setComptesExistants(res.data))
      .catch(() => setErreurComptes('Impossible de charger les comptes existants — vérifie ta connexion.'));
  }, []);

  const especeActuelle = ESPECES_AVICULTURE.find(x => x.nom === form.espece);

  const handleSubmit = async () => {
    if (envoi) return;
    setEnvoi(true); setErreur('');
    try {
      const projetRes = await api.post('/projets', {
        nom: form.nom, type_volaille: form.espece, objectif_sujets: parseInt(form.objectif_sujets),
        taux_survie_vise: parseFloat(form.taux_survie_vise),
        prix_vente_male: parseFloat(form.prix_vente_male) || null, prix_vente_femelle: parseFloat(form.prix_vente_femelle) || null,
        rendement_promis: parseFloat(form.rendement_promis), loyer_gestionnaire: parseFloat(form.loyer_gestionnaire),
        date_debut: form.date_debut || null, date_fin: form.date_fin || null,
        espece: form.espece, objectif_elevage: form.objectif_elevage, reproduction_active: form.reproduction_active,
        cadence_rapport: form.cadence_rapport,
      }, { headers });
      const projetId = projetRes.data.id;

      const effectifRecu = form.origine_cheptel === 'oeufs'
        ? parseInt(form.poussins_eclos_depart) || 0
        : parseInt(form.nombre_sujets_achetes) || 0;
      if (effectifRecu > 0) {
        await api.post('/lots', {
          projet_id: projetId, nom: 'Lot 1', date_arrivee: form.date_debut || new Date().toISOString().slice(0, 10),
          quantite_initiale: effectifRecu,
          prix_unitaire: form.origine_cheptel === 'oeufs'
            ? (parseFloat(form.cout_achat_oeufs) || 0) / effectifRecu
            : (parseFloat(form.cout_achat_sujets) || 0) / effectifRecu,
        }, { headers });
      }

      if (form.origine_cheptel === 'oeufs' && form.cout_achat_oeufs) {
        await api.post('/depenses', {
          projet_id: projetId, libelle: `Achat de ${form.nombre_oeufs} œufs`, categorie: 'Achat sujets',
          montant_prevu: parseFloat(form.cout_achat_oeufs), montant_reel: parseFloat(form.cout_achat_oeufs), statut: 'payee',
        }, { headers });
      } else if (form.origine_cheptel === 'sujets' && form.cout_achat_sujets) {
        await api.post('/depenses', {
          projet_id: projetId, libelle: `Achat de ${form.nombre_sujets_achetes} sujets`, categorie: 'Achat sujets',
          montant_prevu: parseFloat(form.cout_achat_sujets), montant_reel: parseFloat(form.cout_achat_sujets), statut: 'payee',
        }, { headers });
      }

      if (aBudget && lignesBudget.length > 0) {
        for (const ligne of lignesBudget) {
          if (!ligne.libelle || !ligne.montant || ligne.libelle === '__autre__') continue;
          await api.post('/depenses', {
            projet_id: projetId, libelle: ligne.libelle, categorie: ligne.categorie,
            montant_prevu: parseFloat(ligne.montant), statut: 'planifiee',
          }, { headers });
        }
      }

      for (const inv of investisseurs.filter(i => i.mise)) {
        let userId;
        if (inv.mode === 'existant') {
          if (!inv.utilisateur_id) continue;
          userId = parseInt(inv.utilisateur_id);
        } else {
          if (!inv.nom || !inv.mot_de_passe || !inv.email) continue;
          const userRes = await api.post('/auth/creer', { nom: inv.nom, email: inv.email, mot_de_passe: inv.mot_de_passe, role: 'investisseur' }, { headers });
          userId = userRes.data.utilisateur.id;
        }
        await api.post('/investisseurs', {
          utilisateur_id: userId, projet_id: projetId, mise: parseFloat(inv.mise),
          preference_paiement: 'Mobile Money', statut_paiement: 'en_attente',
        }, { headers });
      }

      await rechargerProjets();
      choisirProjet(projetId);
      onTermine();
    } catch (error) {
      setErreur(error.response?.data?.message || 'Erreur lors de la création du projet.');
    } finally {
      setEnvoi(false);
    }
  };

  if (etape === 0) {
    return (
      <View style={styles.centre}>
        <Text style={styles.titre}>Nouveau projet</Text>
        <Text style={styles.sousTitre}>Ce projet existe-t-il déjà dans la réalité, ou démarre-t-il de zéro ?</Text>
        <TouchableOpacity style={styles.carteChoix} onPress={() => setEtape(1)}>
          <Text style={styles.carteChoixTitre}>Nouveau projet, à zéro</Text>
          <Text style={styles.carteChoixSousTitre}>Rien n'a encore été acheté ni dépensé.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.carteChoix} onPress={() => setEtape(1)}>
          <Text style={styles.carteChoixTitre}>Projet déjà en cours</Text>
          <Text style={styles.carteChoixSousTitre}>Des sujets ou des œufs ont déjà été achetés, des dépenses existent déjà.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAnnuler}><Text style={styles.lienAnnuler}>Annuler</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.conteneur} keyboardShouldPersistTaps="handled">
        <View style={styles.barreProgression}>
        {[1, 2, 3, 4, 5, 6].map(step => (
          <View key={step} style={[styles.segment, step <= etape && styles.segmentActif]} />
        ))}
      </View>
      <Text style={styles.etapeTexte}>Étape {etape} sur 6</Text>

      {etape === 1 && (
        <View>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom du projet *</Text>
            <TextInput style={styles.champ} value={form.nom} onChangeText={(v) => setForm(p => ({ ...p, nom: v }))} placeholder="Ex: Pintades 2027" />
            <Text style={styles.label}>Catégorie d'élevage</Text>
            <View style={styles.grilleCategories}>
              {CATEGORIES_ELEVAGE.map(cat => (
                <TouchableOpacity key={cat.id} disabled={!cat.disponible} onPress={() => cat.disponible && setCategorieChoisie(cat.id)}
                  style={[styles.boutonCategorie, categorieChoisie === cat.id && styles.boutonCategorieActif, !cat.disponible && styles.boutonCategorieDesactive]}>
                  <Text style={styles.categorieIcone}>{cat.icone}</Text>
                  <Text style={[styles.categorieTexte, categorieChoisie === cat.id && styles.categorieTexteActif]}>{cat.nom}</Text>
                  {!cat.disponible && <Text style={styles.categorieBientot}>Bientôt</Text>}
                </TouchableOpacity>
              ))}
            </View>
            {categorieChoisie === 'aviculture' && (
              <>
                <Text style={styles.label}>Espèce</Text>
                <View style={styles.ligneChoix}>
                  {ESPECES_AVICULTURE.map(esp => (
                    <TouchableOpacity key={esp.nom} onPress={() => setForm(p => ({ ...p, espece: esp.nom, objectif_elevage: esp.objectifFixe || p.objectif_elevage }))}
                      style={[styles.pastilleChoix, form.espece === esp.nom && styles.pastilleChoixActive]}>
                      <Text style={[styles.pastilleTexte, form.espece === esp.nom && styles.pastilleTexteActif]}>{esp.nom}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {especeActuelle?.objectifFixe ? (
                  <Text style={styles.infoTexte}>Objectif : {especeActuelle.objectifFixe === 'viande' ? 'Viande' : 'Œufs'} (fixé par l'espèce)</Text>
                ) : (
                  <>
                    <Text style={styles.label}>Objectif</Text>
                    <View style={styles.ligne3}>
                      <TouchableOpacity onPress={() => setForm(p => ({ ...p, objectif_elevage: 'viande' }))} style={[styles.bouton3, form.objectif_elevage === 'viande' && styles.bouton3Actif]}>
                        <Text style={[styles.bouton3Texte, form.objectif_elevage === 'viande' && styles.bouton3TexteActif]}>Viande</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setForm(p => ({ ...p, objectif_elevage: 'oeufs' }))} style={[styles.bouton3, form.objectif_elevage === 'oeufs' && styles.bouton3Actif]}>
                        <Text style={[styles.bouton3Texte, form.objectif_elevage === 'oeufs' && styles.bouton3TexteActif]}>Œufs</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setForm(p => ({ ...p, objectif_elevage: 'viande_et_oeufs' }))} style={[styles.bouton3, form.objectif_elevage === 'viande_et_oeufs' && styles.bouton3Actif]}>
                        <Text style={[styles.bouton3Texte, form.objectif_elevage === 'viande_et_oeufs' && styles.bouton3TexteActif]}>Les deux</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
                <View style={styles.ligneSwitch}>
                  <Text style={styles.switchTexte}>Je fais aussi la reproduction</Text>
                  <Switch value={form.reproduction_active} onValueChange={(v) => setForm(p => ({ ...p, reproduction_active: v }))} />
                </View>
              </>
            )}
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(2)}><Text style={styles.boutonPrincipalTexte}>Suivant →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={onAnnuler}><Text style={styles.boutonSecondaireTexte}>Annuler</Text></TouchableOpacity>
        </View>
      )}

      {etape === 2 && (
        <View>
          <View style={styles.carte}>
            <Text style={styles.sousTitreCarte}>Origine du cheptel</Text>
            <View style={styles.ligne2}>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, origine_cheptel: 'oeufs' }))} style={[styles.bouton2, form.origine_cheptel === 'oeufs' && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, form.origine_cheptel === 'oeufs' && styles.bouton2TexteActif]}>Démarré avec des œufs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, origine_cheptel: 'sujets' }))} style={[styles.bouton2, form.origine_cheptel === 'sujets' && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, form.origine_cheptel === 'sujets' && styles.bouton2TexteActif]}>Sujets déjà existants</Text>
              </TouchableOpacity>
            </View>
            {form.origine_cheptel === 'oeufs' ? (
              <>
                <Text style={styles.label}>Nombre d'œufs achetés</Text>
                <TextInput style={styles.champ} value={form.nombre_oeufs} onChangeText={(v) => setForm(p => ({ ...p, nombre_oeufs: v }))} keyboardType="numeric" placeholder="0" />
                <Text style={styles.label}>Coût d'achat (F)</Text>
                <TextInput style={styles.champ} value={form.cout_achat_oeufs} onChangeText={(v) => setForm(p => ({ ...p, cout_achat_oeufs: v }))} keyboardType="numeric" placeholder="0" />
                <Text style={styles.label}>Poussins éclos (si déjà connu)</Text>
                <TextInput style={styles.champ} value={form.poussins_eclos_depart} onChangeText={(v) => setForm(p => ({ ...p, poussins_eclos_depart: v }))} keyboardType="numeric" placeholder="Laisser vide si pas encore éclos" />
              </>
            ) : (
              <>
                <Text style={styles.label}>Nombre de sujets achetés</Text>
                <TextInput style={styles.champ} value={form.nombre_sujets_achetes} onChangeText={(v) => setForm(p => ({ ...p, nombre_sujets_achetes: v }))} keyboardType="numeric" placeholder="0" />
                <Text style={styles.label}>Coût d'achat (F)</Text>
                <TextInput style={styles.champ} value={form.cout_achat_sujets} onChangeText={(v) => setForm(p => ({ ...p, cout_achat_sujets: v }))} keyboardType="numeric" placeholder="0" />
              </>
            )}
          </View>
          <View style={styles.carte}>
            <Text style={styles.sousTitreCarte}>Objectif à atteindre</Text>
            <Text style={styles.label}>Objectif (sujets)</Text>
            <TextInput style={styles.champ} value={form.objectif_sujets} onChangeText={(v) => setForm(p => ({ ...p, objectif_sujets: v }))} keyboardType="numeric" placeholder="1000" />
            <Text style={styles.label}>Survie visée (%)</Text>
            <TextInput style={styles.champ} value={form.taux_survie_vise} onChangeText={(v) => setForm(p => ({ ...p, taux_survie_vise: v }))} keyboardType="numeric" />
            <Text style={styles.label}>Prix vente mâle (F)</Text>
            <TextInput style={styles.champ} value={form.prix_vente_male} onChangeText={(v) => setForm(p => ({ ...p, prix_vente_male: v }))} keyboardType="numeric" placeholder="0" />
            <Text style={styles.label}>Prix vente femelle (F)</Text>
            <TextInput style={styles.champ} value={form.prix_vente_femelle} onChangeText={(v) => setForm(p => ({ ...p, prix_vente_femelle: v }))} keyboardType="numeric" placeholder="0" />
            <Text style={styles.label}>Rendement promis (%)</Text>
            <TextInput style={styles.champ} value={form.rendement_promis} onChangeText={(v) => setForm(p => ({ ...p, rendement_promis: v }))} keyboardType="numeric" />
            <Text style={styles.label}>Loyer gestionnaire (%)</Text>
            <TextInput style={styles.champ} value={form.loyer_gestionnaire} onChangeText={(v) => setForm(p => ({ ...p, loyer_gestionnaire: v }))} keyboardType="numeric" />
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(3)}><Text style={styles.boutonPrincipalTexte}>Suivant →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(1)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
        </View>
      )}

      {etape === 3 && (
        <View>
          <View style={styles.carte}>
            <Text style={styles.sousTitreCarte}>Dates et fréquence</Text>
            <Text style={styles.label}>Date début</Text>
            <TouchableOpacity style={styles.champ} onPress={() => setAfficherCalendrier('debut')}>
              <Text style={{ fontSize: 13, color: form.date_debut ? '#1D1D1F' : '#6E6E73' }}>{form.date_debut || 'Choisir une date'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Date fin prévue</Text>
            <TouchableOpacity style={styles.champ} onPress={() => setAfficherCalendrier('fin')}>
              <Text style={{ fontSize: 13, color: form.date_fin ? '#1D1D1F' : '#6E6E73' }}>{form.date_fin || 'Choisir une date'}</Text>
            </TouchableOpacity>
            {afficherCalendrier && (
              <DateTimePicker
                value={new Date(afficherCalendrier === 'debut' ? (form.date_debut || Date.now()) : (form.date_fin || Date.now()))}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  const champ = afficherCalendrier;
                  setAfficherCalendrier(null);
                  if (event.type === 'dismissed' || !selectedDate) return;
                  const iso = selectedDate.toISOString().slice(0, 10);
                  setForm(p => ({ ...p, [champ === 'debut' ? 'date_debut' : 'date_fin']: iso }));
                }}
              />
            )}
            <Text style={styles.label}>Fréquence des rapports</Text>
            <View style={styles.ligne2}>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, cadence_rapport: 'hebdomadaire' }))} style={[styles.bouton2, form.cadence_rapport === 'hebdomadaire' && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, form.cadence_rapport === 'hebdomadaire' && styles.bouton2TexteActif]}>Hebdomadaire</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForm(p => ({ ...p, cadence_rapport: 'mensuelle' }))} style={[styles.bouton2, form.cadence_rapport === 'mensuelle' && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, form.cadence_rapport === 'mensuelle' && styles.bouton2TexteActif]}>Mensuelle</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={() => setEtape(4)}><Text style={styles.boutonPrincipalTexte}>Suivant →</Text></TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(2)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
        </View>
      )}

      {etape === 4 && (
        <View>
          <View style={styles.carte}>
            <Text style={styles.sousTitreCarte}>Avez-vous un budget prévisionnel ?</Text>
            <View style={styles.ligne2}>
              <TouchableOpacity onPress={() => { setABudget(true); if (lignesBudget.length === 0) setLignesBudget([{ categorie: 'Alimentation', libelle: '', montant: '' }]); }}
                style={[styles.bouton2, aBudget === true && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, aBudget === true && styles.bouton2TexteActif]}>Oui</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setABudget(false)} style={[styles.bouton2, aBudget === false && styles.bouton2Actif]}>
                <Text style={[styles.bouton2Texte, aBudget === false && styles.bouton2TexteActif]}>Non</Text>
              </TouchableOpacity>
            </View>
          </View>
          {aBudget === true && (
            <View style={styles.carte}>
              <Text style={styles.sousTitreCarte}>Lignes de budget</Text>
              {lignesBudget.map((ligne, i) => (
                <View key={i} style={styles.ligneBudget}>
                  <View style={styles.ligneCategories}>
                    {Object.keys(LIBELLES_PAR_CATEGORIE).map(cat => (
                      <TouchableOpacity key={cat} onPress={() => { const copie = [...lignesBudget]; copie[i] = { ...copie[i], categorie: cat, libelle: '' }; setLignesBudget(copie); }}
                        style={[styles.pastilleCat, ligne.categorie === cat && styles.pastilleCatActive]}>
                        <Text style={[styles.pastilleCatTexte, ligne.categorie === cat && styles.pastilleCatTexteActif]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.ligneLibelles}>
                    {(LIBELLES_PAR_CATEGORIE[ligne.categorie] || []).map(lib => (
                      <TouchableOpacity key={lib} onPress={() => { const copie = [...lignesBudget]; copie[i] = { ...copie[i], libelle: lib }; setLignesBudget(copie); }}
                        style={[styles.pastilleLib, ligne.libelle === lib && styles.pastilleLibActive]}>
                        <Text style={[styles.pastilleLibTexte, ligne.libelle === lib && styles.pastilleLibTexteActif]}>{lib}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => { const copie = [...lignesBudget]; copie[i] = { ...copie[i], libelle: '__autre__' }; setLignesBudget(copie); }}
                      style={[styles.pastilleLib, ligne.libelle === '__autre__' && styles.pastilleLibActive]}>
                      <Text style={styles.pastilleLibTexte}>+ Autre</Text>
                    </TouchableOpacity>
                  </View>
                  {ligne.libelle === '__autre__' && (
                    <TextInput style={styles.champ} placeholder="Libellé personnalisé" onChangeText={(v) => { const copie = [...lignesBudget]; copie[i] = { ...copie[i], libelle: v }; setLignesBudget(copie); }} />
                  )}
                  <TextInput style={styles.champ} value={ligne.montant} onChangeText={(v) => { const copie = [...lignesBudget]; copie[i] = { ...copie[i], montant: v }; setLignesBudget(copie); }} keyboardType="numeric" placeholder="Montant (F)" />
                  {lignesBudget.length > 1 && (
                    <TouchableOpacity onPress={() => setLignesBudget(prev => prev.filter((_, idx) => idx !== i))}><Text style={styles.lienRetirer}>Retirer</Text></TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity onPress={() => setLignesBudget(prev => [...prev, { categorie: 'Alimentation', libelle: '', montant: '' }])}>
                <Text style={styles.lienAjouter}>+ Ajouter une ligne</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity style={[styles.boutonPrincipal, aBudget === null && styles.boutonDesactive]} disabled={aBudget === null} onPress={() => setEtape(5)}>
            <Text style={styles.boutonPrincipalTexte}>Suivant →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(3)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
        </View>
      )}

      {etape === 5 && (
        <View>
          <View style={styles.carte}>
            <View style={styles.ligneEntre}>
              <Text style={styles.sousTitreCarte}>Investisseurs</Text>
              <TouchableOpacity onPress={() => setInvestisseurs(prev => [...prev, { mode: 'existant', utilisateur_id: '', nom: '', email: '', mot_de_passe: '', mise: '' }])}>
                <Text style={styles.lienAjouter}>+ Ajouter</Text>
              </TouchableOpacity>
            </View>
            {investisseurs.length === 0 ? (
              <Text style={styles.infoTexte}>Aucun investisseur ajouté pour l'instant.</Text>
            ) : investisseurs.map((inv, i) => (
              <View key={i} style={styles.ligneBudget}>
                <View style={styles.ligne2}>
                  <TouchableOpacity onPress={() => { const copie = [...investisseurs]; copie[i] = { ...copie[i], mode: 'existant' }; setInvestisseurs(copie); }}
                    style={[styles.bouton2, inv.mode === 'existant' && styles.bouton2Actif]}>
                    <Text style={[styles.bouton2Texte, inv.mode === 'existant' && styles.bouton2TexteActif]}>Compte existant</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { const copie = [...investisseurs]; copie[i] = { ...copie[i], mode: 'nouveau' }; setInvestisseurs(copie); }}
                    style={[styles.bouton2, inv.mode === 'nouveau' && styles.bouton2Actif]}>
                    <Text style={[styles.bouton2Texte, inv.mode === 'nouveau' && styles.bouton2TexteActif]}>Nouveau compte</Text>
                  </TouchableOpacity>
                </View>
                {inv.mode === 'existant' ? (
                  <View style={styles.ligneLibelles}>
                    {erreurComptes !== '' && <Text style={styles.erreurTexte}>{erreurComptes}</Text>}
                    {comptesExistants.map(c => (
                      <TouchableOpacity key={c.id} onPress={() => { const copie = [...investisseurs]; copie[i] = { ...copie[i], utilisateur_id: c.id }; setInvestisseurs(copie); }}
                        style={[styles.pastilleLib, inv.utilisateur_id === c.id && styles.pastilleLibActive]}>
                        <Text style={styles.pastilleLibTexte}>{c.nom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <>
                    <TextInput style={styles.champ} placeholder="Nom complet" value={inv.nom} onChangeText={(v) => { const copie = [...investisseurs]; copie[i] = { ...copie[i], nom: v }; setInvestisseurs(copie); }} />
                    <TextInput style={styles.champ} placeholder="Email" value={inv.email} onChangeText={(v) => { const copie = [...investisseurs]; copie[i] = { ...copie[i], email: v }; setInvestisseurs(copie); }} />
                    <TextInput style={styles.champ} placeholder="Mot de passe (min. 6 caractères)" secureTextEntry value={inv.mot_de_passe} onChangeText={(v) => { const copie = [...investisseurs]; copie[i] = { ...copie[i], mot_de_passe: v }; setInvestisseurs(copie); }} />
                  </>
                )}
                <TextInput style={styles.champ} placeholder="Mise (F)" keyboardType="numeric" value={inv.mise} onChangeText={(v) => { const copie = [...investisseurs]; copie[i] = { ...copie[i], mise: v }; setInvestisseurs(copie); }} />
                <TouchableOpacity onPress={() => setInvestisseurs(prev => prev.filter((_, idx) => idx !== i))}><Text style={styles.lienRetirer}>Retirer</Text></TouchableOpacity>
              </View>
            ))}
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} disabled={envoi} onPress={handleSubmit}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Création...' : 'Créer le projet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setEtape(4)}><Text style={styles.boutonSecondaireTexte}>← Retour</Text></TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16, backgroundColor: '#F5F5F7' },
  centre: { flex: 1, justifyContent: 'center', padding: 24 },
  titre: { fontSize: 18, fontWeight: '600', color: '#1D1D1F', marginBottom: 8, textAlign: 'center' },
  sousTitre: { fontSize: 13, color: '#6E6E73', marginBottom: 24, textAlign: 'center' },
  carteChoix: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, padding: 16, marginBottom: 12 },
  carteChoixTitre: { fontSize: 14, fontWeight: '500', color: '#1D1D1F' },
  carteChoixSousTitre: { fontSize: 11, color: '#6E6E73', marginTop: 4 },
  lienAnnuler: { textAlign: 'center', fontSize: 13, color: '#6E6E73', marginTop: 16 },
  barreProgression: { flexDirection: 'row', gap: 4, marginTop: 8, marginBottom: 8 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E5EA' },
  segmentActif: { backgroundColor: '#1D1D1F' },
  etapeTexte: { fontSize: 11, color: '#6E6E73', marginBottom: 12 },
  carte: { backgroundColor: '#fff', borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sousTitreCarte: { fontSize: 13, fontWeight: '500', color: '#1D1D1F', marginBottom: 8 },
  label: { fontSize: 11, color: '#6E6E73', marginBottom: 4, marginTop: 8 },
  champ: { borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#1D1D1F', backgroundColor: '#fff' },
  grilleCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boutonCategorie: { width: '30%', backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  boutonCategorieActif: { backgroundColor: '#1D1D1F' },
  boutonCategorieDesactive: { backgroundColor: '#F5F5F7' },
  categorieIcone: { fontSize: 18 },
  categorieTexte: { fontSize: 10, color: '#4B5563', marginTop: 2 },
  categorieTexteActif: { color: '#fff' },
  categorieBientot: { fontSize: 8, color: '#D1D5DB' },
  ligneChoix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pastilleChoix: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  pastilleChoixActive: { backgroundColor: '#1D1D1F' },
  pastilleTexte: { fontSize: 11, color: '#4B5563' },
  pastilleTexteActif: { color: '#fff' },
  infoTexte: { fontSize: 11, color: '#6E6E73', backgroundColor: '#F5F5F7', borderRadius: 8, padding: 8, marginTop: 8 },
  ligne3: { flexDirection: 'row', gap: 6 },
  bouton3: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  bouton3Actif: { backgroundColor: '#1D1D1F' },
  bouton3Texte: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  bouton3TexteActif: { color: '#fff' },
  ligneSwitch: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F5F5F7', borderRadius: 8, padding: 10, marginTop: 10 },
  switchTexte: { fontSize: 11, color: '#4B5563', flex: 1 },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  boutonDesactive: { opacity: 0.5 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 13, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 20 },
  boutonSecondaireTexte: { color: '#4B5563', fontSize: 13, fontWeight: '600' },
  ligne2: { flexDirection: 'row', gap: 8 },
  bouton2: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  bouton2Actif: { backgroundColor: '#1D1D1F' },
  bouton2Texte: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  bouton2TexteActif: { color: '#fff' },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  ligneBudget: { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 8, padding: 10, marginBottom: 8 },
  ligneCategories: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  pastilleCat: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pastilleCatActive: { backgroundColor: '#1D1D1F' },
  pastilleCatTexte: { fontSize: 10, color: '#4B5563' },
  pastilleCatTexteActif: { color: '#fff' },
  ligneLibelles: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  pastilleLib: { backgroundColor: '#F5F5F7', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  pastilleLibActive: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  pastilleLibTexte: { fontSize: 10, color: '#4B5563' },
  pastilleLibTexteActif: { color: '#fff' },
  lienRetirer: { fontSize: 11, color: '#DC2626', marginTop: 4 },
  lienAjouter: { fontSize: 11, color: '#4B5563', fontWeight: '500' },
  erreurTexte: { fontSize: 12, color: '#DC2626', backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 10 },
});

export default NouveauProjetScreen;
