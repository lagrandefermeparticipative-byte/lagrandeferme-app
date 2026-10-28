import { Alert } from 'react-native';

// Le statut d'une dépense fait bouger la caisse côté serveur : "Payée" débite
// le reste dû (réel complété jusqu'au prévu), "Annulée" rembourse ce qui a
// déjà été payé (réel remis à 0) — on prévient avant, comme sur le web.
// Résout true si rien ne bouge ou si l'utilisateur confirme.
const confirmerMouvementCaisse = (depense, nouveauStatut, nouveauPrevu, formatMontant) => {
  const reel = parseFloat(depense.montant_reel) || 0;
  let message = null;
  if (nouveauStatut === 'payee' && depense.statut !== 'payee') {
    const reste = (parseFloat(nouveauPrevu ?? depense.montant_prevu) || 0) - reel;
    if (reste > 0) message = `Passer en "Payée" va enregistrer un paiement de ${formatMontant(reste)} (reste dû) et le débiter de la caisse. Continuer ?`;
  }
  if (nouveauStatut === 'annulee' && depense.statut !== 'annulee' && reel > 0) {
    message = `Annuler cette dépense va rembourser ${formatMontant(reel)} déjà payés dans la caisse et la retirer du budget. Continuer ?`;
  }
  if (!message) return Promise.resolve(true);
  return new Promise(resolve => {
    Alert.alert('Mouvement de caisse', message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Continuer', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
};

export default confirmerMouvementCaisse;
