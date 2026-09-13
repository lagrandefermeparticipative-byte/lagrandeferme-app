import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import api from '../services/api';
import Header from '../components/Header';
import { useNavigation } from '@react-navigation/native';

const getRoleLabel = (role) => ({
  gestionnaire: 'Gestionnaire', gestion_invest: 'Gestionnaire · Investisseur',
  technicien: 'Technicien', tech_invest: 'Technicien · Investisseur', investisseur: 'Investisseur',
}[role] || role);

const ProfilScreen = ({ utilisateur, token, onDeconnecter }) => {
  const headers = { Authorization: `Bearer ${token}` };
  const navigation = useNavigation();
  const [onglet, setOnglet] = useState('profil');
  const [vue, setVue] = useState('liste'); // liste | editer | email | mdp
  const [emailActuel, setEmailActuel] = useState(utilisateur?.utilisateur?.email);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState('');
  const [erreur, setErreur] = useState('');
  const [notifs, setNotifs] = useState({ rapport_hebdo: true, rapport_mensuel: true, alerte_mortalite: true, revision_budget: true, confirmation_paiement: true, push: false });
  const [chargementNotifs, setChargementNotifs] = useState(true);

  const [profilForm, setProfilForm] = useState({ nom: utilisateur?.utilisateur?.nom || '', telephone: utilisateur?.utilisateur?.telephone || '', whatsapp: utilisateur?.utilisateur?.whatsapp || '' });
  const [emailForm, setEmailForm] = useState({ mot_de_passe: '', nouvel_email: '' });
  const [mdpForm, setMdpForm] = useState({ ancien_mot_de_passe: '', nouveau_mot_de_passe: '', confirmer: '' });

  useEffect(() => {
    api.get('/auth/preferences', { headers }).then(res => {
      if (res.data && Object.keys(res.data).length > 0) setNotifs(prev => ({ ...prev, ...res.data }));
    }).catch(() => {}).finally(() => setChargementNotifs(false));
  }, []);

  const toggleNotif = async (key) => {
    const nouvelles = { ...notifs, [key]: !notifs[key] };
    setNotifs(nouvelles);
    try { await api.put('/auth/preferences', nouvelles, { headers }); }
    catch { setNotifs(notifs); }
  };

  const enregistrerProfil = async () => {
    setErreur(''); setSucces(''); setEnvoi(true);
    try {
      await api.put('/auth/profil', profilForm, { headers });
      setSucces('Profil mis à jour avec succès.');
      setVue('liste');
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors de la mise à jour.'); }
    finally { setEnvoi(false); }
  };

  const changerEmail = async () => {
    setErreur(''); setSucces(''); setEnvoi(true);
    try {
      const res = await api.put('/auth/email', emailForm, { headers });
      setEmailActuel(res.data.email);
      setSucces('Email modifié avec succès. Utilise ce nouvel email pour te reconnecter.');
      setEmailForm({ mot_de_passe: '', nouvel_email: '' });
      setVue('liste');
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors du changement.'); }
    finally { setEnvoi(false); }
  };

  const changerMdp = async () => {
    setErreur(''); setSucces('');
    if (mdpForm.nouveau_mot_de_passe !== mdpForm.confirmer) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    if (mdpForm.nouveau_mot_de_passe.length < 6) { setErreur('Le nouveau mot de passe doit faire au moins 6 caractères.'); return; }
    setEnvoi(true);
    try {
      await api.put('/auth/mot-de-passe', { ancien_mot_de_passe: mdpForm.ancien_mot_de_passe, nouveau_mot_de_passe: mdpForm.nouveau_mot_de_passe }, { headers });
      setSucces('Mot de passe modifié avec succès.');
      setMdpForm({ ancien_mot_de_passe: '', nouveau_mot_de_passe: '', confirmer: '' });
      setVue('liste');
    } catch (error) { setErreur(error.response?.data?.message || 'Erreur lors du changement.'); }
    finally { setEnvoi(false); }
  };

  const initiales = utilisateur?.utilisateur?.nom?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

  // --- FORMULAIRE MODIFIER PROFIL ---
  if (vue === 'editer') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Modifier mes informations" masquerSwitch />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.champ} value={profilForm.nom} onChangeText={v => setProfilForm({ ...profilForm, nom: v })} />
            <Text style={styles.label}>Téléphone</Text>
            <TextInput style={styles.champ} placeholder="+228 XX XX XX XX" value={profilForm.telephone} onChangeText={v => setProfilForm({ ...profilForm, telephone: v })} />
            <Text style={styles.label}>WhatsApp</Text>
            <TextInput style={styles.champ} placeholder="+228 XX XX XX XX" value={profilForm.whatsapp} onChangeText={v => setProfilForm({ ...profilForm, whatsapp: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={enregistrerProfil} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setErreur(''); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- FORMULAIRE CHANGER EMAIL ---
  if (vue === 'email') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Changer l'email" masquerSwitch />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Nouvel email</Text>
            <TextInput style={styles.champ} keyboardType="email-address" autoCapitalize="none" placeholder="nouveladresse@email.com" value={emailForm.nouvel_email} onChangeText={v => setEmailForm({ ...emailForm, nouvel_email: v })} />
            <Text style={styles.label}>Mot de passe actuel (pour confirmer)</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="••••••••" value={emailForm.mot_de_passe} onChangeText={v => setEmailForm({ ...emailForm, mot_de_passe: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={changerEmail} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Modification...' : "Modifier l'email"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setErreur(''); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- FORMULAIRE CHANGER MOT DE PASSE ---
  if (vue === 'mdp') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header titre="Changer le mot de passe" masquerSwitch />
        <ScrollView style={styles.conteneur}>
          <View style={styles.carte}>
            <Text style={styles.label}>Mot de passe actuel</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="••••••••" value={mdpForm.ancien_mot_de_passe} onChangeText={v => setMdpForm({ ...mdpForm, ancien_mot_de_passe: v })} />
            <Text style={styles.label}>Nouveau mot de passe</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="Min. 6 caractères" value={mdpForm.nouveau_mot_de_passe} onChangeText={v => setMdpForm({ ...mdpForm, nouveau_mot_de_passe: v })} />
            <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
            <TextInput style={styles.champ} secureTextEntry placeholder="••••••••" value={mdpForm.confirmer} onChangeText={v => setMdpForm({ ...mdpForm, confirmer: v })} />
          </View>
          {erreur !== '' && <Text style={styles.erreurTexte}>{erreur}</Text>}
          <TouchableOpacity style={styles.boutonPrincipal} onPress={changerMdp} disabled={envoi}>
            <Text style={styles.boutonPrincipalTexte}>{envoi ? 'Modification...' : 'Modifier le mot de passe'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setVue('liste'); setErreur(''); }}>
            <Text style={styles.boutonSecondaireTexte}>Annuler</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // --- VUE PRINCIPALE ---
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Header titre="Mon profil" masquerSwitch />
      <ScrollView style={styles.conteneur}>
        <View style={styles.avatarZone}>
          <View style={styles.avatar}><Text style={styles.avatarTexte}>{initiales}</Text></View>
          <Text style={styles.nomTexte}>{utilisateur?.utilisateur?.nom}</Text>
          <Text style={styles.emailTexte}>{emailActuel}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleBadgeTexte}>{getRoleLabel(utilisateur?.utilisateur?.role)}</Text></View>
        </View>

        <View style={styles.ongletsLigne}>
          {['profil', 'notifications'].map(t => (
            <TouchableOpacity key={t} onPress={() => setOnglet(t)} style={[styles.ongletBouton, onglet === t && styles.ongletBoutonActif]}>
              <Text style={[styles.ongletTexte, onglet === t && styles.ongletTexteActif]}>{t === 'profil' ? 'Mon profil' : 'Notifications'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {onglet === 'profil' && (
          <View>
            {succes !== '' && <View style={styles.encartVert}><Text style={styles.encartVertTexte}>{succes}</Text></View>}
            <View style={styles.carte}>
              <Text style={styles.carteTitre}>Informations</Text>
              <LigneInfo label="Nom" value={utilisateur?.utilisateur?.nom} />
              <LigneInfo label="Email" value={emailActuel} />
              <LigneInfo label="Téléphone" value={utilisateur?.utilisateur?.telephone || '—'} />
              <LigneInfo label="WhatsApp" value={utilisateur?.utilisateur?.whatsapp || '—'} />
              <LigneInfo label="Rôle" value={getRoleLabel(utilisateur?.utilisateur?.role)} />
            </View>
            {(utilisateur?.utilisateur?.role === 'gestionnaire' || utilisateur?.utilisateur?.role === 'gestion_invest') && (
              <TouchableOpacity style={styles.boutonAction} onPress={() => navigation.navigate('GestionUtilisateurs')}><Text style={styles.boutonActionTexte}>👥 Gérer les comptes utilisateurs</Text></TouchableOpacity>
            )}
            <TouchableOpacity style={styles.boutonAction} onPress={() => setVue('email')}><Text style={styles.boutonActionTexte}>✉️ Changer l'email</Text></TouchableOpacity>
            <TouchableOpacity style={styles.boutonAction} onPress={() => setVue('mdp')}><Text style={styles.boutonActionTexte}>🔒 Changer le mot de passe</Text></TouchableOpacity>
            <TouchableOpacity style={styles.boutonDeconnexion} onPress={onDeconnecter}><Text style={styles.boutonDeconnexionTexte}>Se déconnecter</Text></TouchableOpacity>
          </View>
        )}

        {onglet === 'notifications' && (
          <View style={styles.carte}>
            <Text style={styles.carteTitre}>Préférences de notification</Text>
            <Text style={styles.carteSousTexte}>{chargementNotifs ? 'Chargement...' : 'Gérez ce que vous souhaitez recevoir'}</Text>
            {[
              { key: 'rapport_hebdo', label: 'Rapport hebdomadaire', meta: 'Email · À chaque diffusion' },
              { key: 'rapport_mensuel', label: 'Rapport mensuel', meta: 'Email · Fin de mois' },
              { key: 'alerte_mortalite', label: 'Alerte mortalité critique', meta: 'Immédiat si taux > 10%' },
              { key: 'revision_budget', label: 'Révision budgétaire', meta: 'Dès modification du budget' },
              { key: 'confirmation_paiement', label: 'Confirmation paiement', meta: 'Quand ton paiement est enregistré' },
              { key: 'push', label: 'Notifications push', meta: 'Sur ton téléphone' },
            ].map(item => (
              <View key={item.key} style={styles.notifLigne}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifLabel}>{item.label}</Text>
                  <Text style={styles.notifMeta}>{item.meta}</Text>
                </View>
                <Switch value={notifs[item.key]} onValueChange={() => toggleNotif(item.key)} disabled={chargementNotifs} trackColor={{ false: '#E5E7EB', true: '#111827' }} />
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const LigneInfo = ({ label, value }) => (
  <View style={styles.ligneEntre}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValeur}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  conteneur: { flex: 1, padding: 16 },
  ligneEntre: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  carte: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', padding: 14, marginBottom: 10 },
  carteTitre: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 4 },
  carteSousTexte: { fontSize: 11, color: '#9CA3AF', marginBottom: 8 },
  label: { fontSize: 12, color: '#6B7280', marginBottom: 6, marginTop: 10 },
  champ: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, fontSize: 13, color: '#111827' },
  erreurTexte: { color: '#DC2626', fontSize: 13, marginTop: 12 },
  boutonPrincipal: { backgroundColor: '#111827', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { color: '#fff', fontSize: 14, fontWeight: '600' },
  boutonSecondaire: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  boutonSecondaireTexte: { color: '#374151', fontSize: 14, fontWeight: '600' },
  avatarZone: { alignItems: 'center', paddingVertical: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarTexte: { color: '#fff', fontSize: 20, fontWeight: '600' },
  nomTexte: { fontSize: 15, fontWeight: '600', color: '#111827' },
  emailTexte: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  roleBadge: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  roleBadgeTexte: { fontSize: 11, color: '#4B5563' },
  ongletsLigne: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginBottom: 14 },
  ongletBouton: { paddingBottom: 8, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  ongletBoutonActif: { borderBottomColor: '#111827' },
  ongletTexte: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  ongletTexteActif: { color: '#111827' },
  encartVert: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, padding: 10, marginBottom: 10 },
  encartVertTexte: { color: '#047857', fontSize: 12 },
  infoLabel: { fontSize: 11, color: '#6B7280' },
  infoValeur: { fontSize: 11, fontWeight: '600', color: '#111827' },
  boutonAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  boutonActionTexte: { fontSize: 13, fontWeight: '600', color: '#111827' },
  boutonDeconnexion: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  boutonDeconnexionTexte: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  notifLigne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  notifLabel: { fontSize: 13, color: '#111827' },
  notifMeta: { fontSize: 11, color: '#9CA3AF' },
});

export default ProfilScreen;