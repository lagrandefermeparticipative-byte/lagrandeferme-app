import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.lagrandefermeparticipative.com/api',
});

// Nettoie les champs numériques envoyés vides — PostgreSQL refuse une
// chaîne vide "" pour une colonne numeric (contrairement à null). Les
// formulaires initialisent souvent ces champs à '' avant saisie.
const CHAMPS_DATE = ['date_depense', 'date_debut', 'date_fin', 'date_paiement', 'date_arrivee_reelle', 'date_mortalite'];

const CHAMPS_NUMERIQUES = [
  'montant_prevu', 'montant_reel', 'mise', 'objectif_sujets', 'taux_survie_vise',
  'prix_vente_male', 'prix_vente_femelle', 'rendement_promis', 'loyer_gestionnaire',
  'avancement_pourcentage', 'effectif_actuel', 'morts_cumules', 'depense_aliment',
  'depense_sante', 'depense_autres', 'solde_caisse_actuel', 'budget_aliment_prevu',
  'budget_sante_prevu', 'budget_autres_prevu', 'nombre', 'quantite_initiale',
  'prix_unitaire', 'transport_cout',
];

const nettoyerChampsNumeriques = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const copie = { ...data };
  for (const champ of [...CHAMPS_NUMERIQUES, ...CHAMPS_DATE]) {
    if (copie[champ] === '') copie[champ] = null;
  }
  return copie;
};

api.interceptors.request.use((config) => {
  if (config.data && !(config.data instanceof FormData)) {
    config.data = nettoyerChampsNumeriques(config.data);
  }
  return config;
});

export default api;