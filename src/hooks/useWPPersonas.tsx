import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PERSONAS, Persona } from '@/lib/types';
import { getMyPersonasFromWP, getWPPersonaId, isWPUserLoggedIn, WPPersona } from '@/lib/wp-api';

function toPersona(persona: WPPersona): Persona {
  const name = persona.name || 'AI Assistant';
  const initials = persona.avatar_initials || name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return {
    id: String(persona.id),
    name,
    description: persona.description || 'WordPress dashboard persona',
    model: persona.model || 'gpt-4',
    avatar: initials || 'AI',
  };
}

export function useWPPersonas(enabled: boolean) {
  const [personas, setPersonas] = useState<Persona[]>(enabled ? [] : DEFAULT_PERSONAS);
  const [loading, setLoading] = useState(false);

  const fetchPersonas = useCallback(async () => {
    if (!enabled) {
      setPersonas(DEFAULT_PERSONAS);
      return;
    }

    if (!isWPUserLoggedIn()) {
      setPersonas([]);
      return;
    }

    setLoading(true);
    try {
      const wpPersonas = await getMyPersonasFromWP();
      setPersonas(wpPersonas.map(toPersona));
    } catch (error) {
      console.error('Failed to load WordPress personas:', error);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const defaultPersonaId = String(getWPPersonaId());
  const selectedPersona = personas.find((persona) => persona.id === defaultPersonaId) || personas[0] || DEFAULT_PERSONAS[0];

  return { personas, selectedPersona, loading, fetchPersonas };
}