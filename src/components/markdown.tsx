import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const VIDEO_HOST = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com)$/;

function isVideoLink(href: string | undefined) {
  if (!href) return false;
  try {
    return VIDEO_HOST.test(new URL(href).hostname);
  } catch {
    return false;
  }
}

const heading = ({ children }: { children?: React.ReactNode }) => (
  <p className="font-semibold text-foreground">{children}</p>
);

const components: Components = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
      {isVideoLink(href) && "▶ "}
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="space-y-2 border-l-2 border-line pl-3 italic">{children}</blockquote>
  ),
  code: ({ children }) => <code className="rounded bg-line px-1 font-mono text-[0.85em]">{children}</code>,
  pre: ({ children }) => <pre className="overflow-x-auto rounded-md bg-line p-2 [&_code]:bg-transparent [&_code]:p-0">{children}</pre>,
  hr: () => <hr className="border-line" />,
  img: () => null,
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:px-2">
        {children}
      </table>
    </div>
  ),
};

/** Renders Ivan's own Markdown. Raw HTML is never rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted [&_strong]:text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
