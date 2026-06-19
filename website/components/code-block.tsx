'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

const MONOSPACE_FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const warmTheme: Record<string, React.CSSProperties> = {
  'pre[class*="language-"]': {
    color: '#c8c5ba',
    background: '#1c1b16',
  },
  'code[class*="language-"]': {
    color: '#c8c5ba',
    background: 'none',
  },
  comment: { color: '#5c5a52' },
  prolog: { color: '#5c5a52' },
  doctype: { color: '#5c5a52' },
  cdata: { color: '#5c5a52' },
  punctuation: { color: '#8a877e' },
  namespace: { opacity: 0.8 },
  property: { color: '#d4a46a' },
  tag: { color: '#d4a46a' },
  boolean: { color: '#d4a46a' },
  number: { color: '#d4a46a' },
  constant: { color: '#d4a46a' },
  symbol: { color: '#d4a46a' },
  deleted: { color: '#d4a46a' },
  selector: { color: '#a3b47a' },
  'attr-name': { color: '#a3b47a' },
  string: { color: '#a3b47a' },
  char: { color: '#a3b47a' },
  builtin: { color: '#a3b47a' },
  inserted: { color: '#a3b47a' },
  operator: { color: '#8a877e' },
  entity: { color: '#8a877e', cursor: 'help' },
  url: { color: '#8a877e' },
  'attr-value': { color: '#a3b47a' },
  keyword: { color: '#c9915c' },
  'class-name': { color: '#e0c9a0' },
  function: { color: '#d4c49a' },
  regex: { color: '#d4a46a' },
  important: { color: '#c9915c', fontWeight: 'bold' },
  variable: { color: '#c8c5ba' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  'template-string': { color: '#a3b47a' },
  'template-punctuation': { color: '#a3b47a' },
  'interpolation-punctuation': { color: '#c9915c' },
  'literal-property': { color: '#c8c5ba' },
  'spread operator': { color: '#8a877e' },
  'arrow operator': { color: '#8a877e' },
  parameter: { color: '#c8c5ba' },
  imports: { color: '#c8c5ba' },
  'module keyword': { color: '#c9915c' },
  'console keyword': { color: '#c8c5ba' },
  'method definition': { color: '#d4c49a' },
};

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'typescript',
  showLineNumbers = false,
}: CodeBlockProps) {
  return (
    <div className="code-block-scroll rounded-lg h-full">
      <SyntaxHighlighter
        language={language}
        style={warmTheme}
        showLineNumbers={showLineNumbers}
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: '1rem',
          fontSize: '0.8125rem',
          borderRadius: '0.5rem',
          fontFamily: MONOSPACE_FONT_STACK,
          height: '100%',
          overflow: 'visible',
          background: '#1c1b16',
        }}
        codeTagProps={{
          style: {
            fontFamily: MONOSPACE_FONT_STACK,
          },
        }}
        lineNumberStyle={{
          fontFamily: MONOSPACE_FONT_STACK,
          color: '#3d3c37',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
