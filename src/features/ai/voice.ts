import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Voice input. On the web it uses the browser's speech recognition (Chrome,
 * Edge, Safari). In Expo Go there is no speech engine to call, so the
 * assistant falls back to the keyboard's own microphone (dictation), which
 * every phone keyboard has. A native build can plug a speech module in here
 * without touching the assistant.
 */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function engine(): (new () => Recognition) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const final = useRef(onFinal);
  useEffect(() => {
    final.current = onFinal;
  }, [onFinal]);

  const supported = engine() !== null;

  const start = useCallback(() => {
    const E = engine();
    if (!E) return false;
    const r = new E();
    r.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = '';
      let done = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) done = true;
      }
      setPartial(text);
      if (done) final.current(text);
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone permission denied' : 'Could not hear you');
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setPartial('');
    setListening(true);
    r.start();
    return true;
  }, [lang]);

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);

  return { supported, listening, partial, error, start, stop };
}
