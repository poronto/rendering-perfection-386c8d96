import { useStreamingText } from '@/hooks/useStreamingText';
import { MarkdownMessage } from './MarkdownMessage';

interface StreamingMessageProps {
  content: string;
  onComplete?: () => void;
}

export function StreamingMessage({ content, onComplete }: StreamingMessageProps) {
  const { displayed, isStreaming } = useStreamingText(content);

  // Notify parent when streaming completes
  if (!isStreaming && displayed === content && onComplete) {
    // Use microtask to avoid state update during render
    queueMicrotask(onComplete);
  }

  return (
    <div className="relative">
      <MarkdownMessage content={displayed} />
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}
