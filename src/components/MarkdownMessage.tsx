import ReactMarkdown from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="prose prose-sm prose-invert max-w-none
      prose-p:my-1 prose-p:leading-relaxed
      prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
      prose-strong:text-foreground prose-strong:font-semibold
      prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-muted prose-pre:rounded-lg prose-pre:p-3 prose-pre:my-2
      prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
      prose-a:text-primary prose-a:underline prose-a:underline-offset-2
      prose-blockquote:border-l-primary/50 prose-blockquote:text-muted-foreground"
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
