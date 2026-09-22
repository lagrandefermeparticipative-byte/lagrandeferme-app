import { useState, useEffect } from 'react';
import api from '../services/api';
import { useProjet } from '../context/ProjetContext';
import { useAuth } from '../context/AuthContext';

export const useMesRoles = () => {
  const { projetActifId } = useProjet();
  const { token } = useAuth();
  const [roles, setRoles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (!projetActifId || !token) { setChargement(false); return; }
    setChargement(true);
    setErreur('');
    api.get(`/projets/${projetActifId}/mes-roles`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setRoles(res.data.roles))
      .catch(() => { setRoles([]); setErreur('Impossible de charger tes rôles — vérifie ta connexion.'); })
      .finally(() => setChargement(false));
  }, [projetActifId, token]);

  return { roles, chargement, erreur };
};
