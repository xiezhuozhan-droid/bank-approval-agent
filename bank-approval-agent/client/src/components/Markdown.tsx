import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Md({ children }: { children: string }) {
  return (
    <div className="md-body text-[13.5px] leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: c }) => <h1 className="mb-2 mt-3 text-base font-semibold text-slate-900 first:mt-0">{c}</h1>,
          h2: ({ children: c }) => <h2 className="mb-1.5 mt-3 text-[15px] font-semibold text-slate-900 first:mt-0">{c}</h2>,
          h3: ({ children: c }) => <h3 className="mb-1 mt-2 text-[14px] font-semibold text-slate-800 first:mt-0">{c}</h3>,
          ul: ({ children: c }) => <ul className="mb-1.5 ml-4 list-disc space-y-0.5">{c}</ul>,
          ol: ({ children: c }) => <ol className="mb-1.5 ml-4 list-decimal space-y-0.5">{c}</ol>,
          li: ({ children: c }) => <li className="leading-relaxed">{c}</li>,
          p: ({ children: c }) => <p className="mb-1.5">{c}</p>,
          strong: ({ children: c }) => <strong className="font-semibold text-slate-900">{c}</strong>,
          code: (props) => {
            const { inline, children: c, className } = props as { inline?: boolean; children?: React.ReactNode; className?: string };
            if (inline) return <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-bank-dark font-mono">{c}</code>;
            return (
              <pre className={`my-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-[12px] text-slate-100 ${className ?? ''}`}>
                <code>{c}</code>
              </pre>
            );
          },
          table: ({ children: c }) => (
            <div className="my-2 overflow-x-auto"><table className="w-full border-collapse text-[12.5px]">{c}</table></div>
          ),
          th: ({ children: c }) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold">{c}</th>,
          td: ({ children: c }) => <td className="border border-slate-200 px-2 py-1">{c}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
