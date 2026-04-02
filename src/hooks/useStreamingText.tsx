import { useState, useEffect, useRef } from 'react';

export function useStreamingText(fullText: string, speed: number = 12) {
  const [displayed, setDisplayed] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!fullText) {
      setDisplayed('');
      indexRef.current = 0;
      return;
    }

    setIsStreaming(true);
    indexRef.current = 0;
    setDisplayed('');

    const interval = setInterval(() => {
      indexRef.current += Math.floor(Math.random() * 3) + 1;
      if (indexRef.current >= fullText.length) {
        indexRef.current = fullText.length;
        setDisplayed(fullText);
        setIsStreaming(false);
        clearInterval(interval);
      } else {
        setDisplayed(fullText.slice(0, indexRef.current));
      }
    }, speed);

    return () => clearInterval(interval);
  }, [fullText, speed]);

  return { displayed, isStreaming };
}
