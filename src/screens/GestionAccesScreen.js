import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import api from '../services/api';

// Gestion de la capacité "Aperçu ferme" — un interrupteur greffé sur
// n'importe quel compte existant, jamais un nouveau rôle à part.
const getRoleLabel = (role) => ({
  gestionnaire: 'Gestionnaire', gestion_invest: 'Gestion + Invest.',
  technicien: 'Technicien', tech_invest: 'Technicien + Invest.', investisseur: 'Investisseur',
}[role] || role);

const GestionAccesScreen = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const [comptes, setComptes] = useState([]);
  const [projets, setProjets] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [compteOuvertId, setCompteOuvertId] = useState(null);
  const [selectionParCompte, setSelectionParCompte] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const charger = () => {
    setChargement(true);
    Promise.all([
      api.get('/apercu-ferme/comptes', { headers }),
      api.get('/projets', { headers }),
    ]).then(([comptesRes, projetsRes]) => {
      setComptes(comptesRes.data);
      setProjets(projetsRes.data);
      const initial = {};
      comptesRes.data.forEach(c => { initial[c.id] = c.projets_ids || []; });
      setSelectionParCompte(initial);
    }).catch(() => {}).finally(() => setChargement(false));
  };

  useEffect(() => { charger(); }, []);

  const toggleProjet = (compteId, projetId) => {
    setSelectionParCompte(prev => {
      const liste = prev[compteId] || [];
      const nouvelle = liste.includes(projetId) ? liste.filter(id => id !== projetId) : [...liste, projetId];
      return { ...prev, [compteId]: nouvelle };
    });
  };

  const activerDesactiver = async (compte, actif) => {
    setEnvoi(true);
    try {
      await api.put(`/apercu-ferme/comptes/${compte.uuid_id || compte.id}`, {
        actif, projet_ids: actif ? (selectionParCompte[compte.id] || []) : [],
      }, { headers });
      charger();
      if (actif) setCompteOuvertId(compte.id);
    } catch (error) {
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour.');
    } finally { setEnvoi(false); }
  };

  const enregistrerProjets = async (compte) => {
    setEnvoi(true);
    try {
      await api.put(`/apercu-ferme/comptes/${compte.uuid_id || compte.id}`, {
        actif: true, projet_ids: selectionParCompte[compte.id] || [],
      }, { headers });
      charger();
    } catch (error) {
      alert(error.response?.data?.message || 'Erreur lors de la mise à jour.');
    } finally { setEnvoi(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F7' }}>
      <Header titre="Gérer les accès" sousTitre='Capacité "Aperçu ferme"' />
      {chargement ? (
        <View style={styles.centre}><ActivityIndicator size="large" color="#1D1D1F" /></View>
      ) : (
        <ScrollView style={styles.conteneur}>
          <View style={styles.carteInfo}>
            <Text style={styles.infoTexte}>
              "Aperçu ferme" donne un accès en lecture seule (chiffres consolidés, jamais de détail nominatif investisseur) aux projets que tu coches ici, sans rien changer au rôle habituel de la personne.
            </Text>
          </View>
          {comptes.filter(c => !['gestionnaire', 'gestion_invest'].includes(c.role)).map(compte => (
            <View key={compte.id} style={styles.carte}>
              <View style={styles.ligneEntre}>
                <View>
                  <Text style={styles.carteTitre}>{compte.nom}</Text>
                  <Text style={styles.carteSousTexte}>{getRoleLabel(compte.role)} · {compte.email}</Text>
                </View>
                <TouchableOpacity disabled={envoi} onPress={() => activerDesactiver(compte, !compte.apercu_ferme_actif)}
                  style={[styles.boutonToggle, compte.apercu_ferme_actif && styles.boutonToggleActif]}>
                  <Text style={[styles.boutonToggleTexte, compte.apercu_ferme_actif && styles.boutonToggleTexteActif]}>
                    {compte.apercu_ferme_actif ? 'Activé' : 'Désactivé'}
                  </Text>
                </TouchableOpacity>
              </View>

              {compte.apercu_ferme_actif && (
                <View style={styles.blocProjets}>
                  <TouchableOpacity onPress={() => setCompteOuvertId(prev => prev === compte.id ? null : compte.id)}>
                    <Text style={styles.lienProjets}>
                      {compteOuvertId === compte.id ? 'Masquer les projets' : `Choisir les projets (${(selectionParCompte[compte.id] || []).length})`}
                    </Text>
                  </TouchableOpacity>
                  {compteOuvertId === compte.id && (
                    <View style={{ marginTop: 10 }}>
                      {projets.map(p => {
                        const coche = (selectionParCompte[compte.id] || []).includes(p.id);
                        return (
                          <TouchableOpacity key={p.id} style={styles.ligneCheckbox} onPress={() => toggleProjet(compte.id, p.id)}>
                            <View style={[styles.checkbox, coche && styles.checkboxCoche]}>{coche && <Text style={styles.checkboxTexte}>✓</Text>}</View>
                            <Text style={styles.checkboxLabel}>{p.nom}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <TouchableOpacity disabled={envoi} onPress={() => enregistrerProjets(compte)} style={styles.boutonPrincipal}>
                        <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer les projets'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  centre: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  carteInfo: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 14 },
  infoTexte: { fontSize: 12, color: '#6E6E73', lineHeight: 18 },
  carte: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  carteTitre: { fontSize: 14, fontWeight: '600', color: '#1D1D1F' },
  carteSousTexte: { fontSize: 12, color: '#6E6E73', marginTop: 2 },
  boutonToggle: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  boutonToggleActif: { backgroundColor: '#1D1D1F' },
  boutonToggleTexte: { fontSize: 11, fontWeight: '600', color: '#6E6E73' },
  boutonToggleTexteActif: { color: '#fff' },
  blocProjets: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  lienProjets: { fontSize: 12, color: '#4338CA', fontWeight: '600' },
  ligneCheckbox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxCoche: { backgroundColor: '#1D1D1F', borderColor: '#1D1D1F' },
  checkboxTexte: { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkboxLabel: { fontSize: 13, color: '#1D1D1F' },
  boutonPrincipal: { backgroundColor: '#1D1D1F', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

export default GestionAccesScreen;
