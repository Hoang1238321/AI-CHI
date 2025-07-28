import { cn } from "@/lib/utils";
import { MathRenderer } from "./math-renderer";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];
    let tableRows: string[] = [];
    let inTable = false;
    
    const flushTable = () => {
      if (tableRows.length > 0) {
        const tableElement = createTable(tableRows, elements.length);
        elements.push(tableElement);
        tableRows = [];
        inTable = false;
      }
    };
    
    lines.forEach((line, index) => {
      if (line.trim() === '') {
        flushTable();
        elements.push(<div key={`space-${index}`} className="h-3" />);
        return;
      }
      
      // Parse line content for text formatting - simplified approach
      let parsedLine = line;
      
      // Store math expressions temporarily
      const mathMap = new Map<string, string>();
      let mathCounter = 0;
      
      // Function to create unique placeholder
      const createMathPlaceholder = (math: string): string => {
        const placeholder = `MATHTEMP${mathCounter}MATHTEMP`;
        mathMap.set(placeholder, math);
        mathCounter++;
        return placeholder;
      };
      
      // Extract all math expressions first (most specific to least specific)
      // Display math $$...$$
      parsedLine = parsedLine.replace(/\$\$(.*?)\$\$/g, (match) => createMathPlaceholder(match));
      
      // Inline math $...$
      parsedLine = parsedLine.replace(/\$([^$\n]+?)\$/g, (match) => createMathPlaceholder(match));
      
      // LaTeX display \\[...\\]
      parsedLine = parsedLine.replace(/\\\\?\[(.*?)\\\\?\]/g, (match) => createMathPlaceholder(match));
      
      // LaTeX inline \\(...\\)
      parsedLine = parsedLine.replace(/\\\\?\((.*?)\\\\?\)/g, (match) => createMathPlaceholder(match));
      
      // Now apply markdown formatting (math is safely stored)
      // Bold text: **text** or __text__ (simple approach)
      parsedLine = parsedLine.replace(/\*\*([^*]+?)\*\*/g, '<strong class="font-bold text-gray-900 dark:text-gray-100">$1</strong>');
      
      // Handle __ bold only if not part of math placeholder
      parsedLine = parsedLine.replace(/__([^_]+?)__/g, (match, content) => {
        if (match.includes('MATHTEMP')) return match;
        return `<strong class="font-bold text-gray-900 dark:text-gray-100">${content}</strong>`;
      });
      
      // Italic text: *text* or _text_ (simple approach)
      parsedLine = parsedLine.replace(/\*([^*]+?)\*/g, '<em class="italic text-gray-800 dark:text-gray-200">$1</em>');
      
      // Handle _ italic only if not part of math placeholder or strong tags
      parsedLine = parsedLine.replace(/_([^_]+?)_/g, (match, content) => {
        if (match.includes('MATHTEMP') || parsedLine.includes('<strong')) return match;
        return `<em class="italic text-gray-800 dark:text-gray-200">${content}</em>`;
      });
      
      // Restore math expressions
      mathMap.forEach((math, placeholder) => {
        parsedLine = parsedLine.replace(placeholder, math);
      });
      
      // Enhanced table detection - stricter rules
      if (line.includes('|') && (line.trim().startsWith('|') || line.split('|').length >= 3)) {
        tableRows.push(line);
        inTable = true;
        return;
      } else if (inTable) {
        flushTable();
      }
      
      // Headers
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={index} className="text-lg font-semibold mt-5 mb-3 text-gray-900 dark:text-gray-100">
            {line.substring(4)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="text-xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100">
            {line.substring(3)}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-gray-900 dark:text-gray-100">
            {line.substring(2)}
          </h1>
        );
      }
      // List items
      else if (line.trim().startsWith('- ') || line.trim().startsWith('+ ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={index} className="flex items-start space-x-3 my-2">
            <span className="text-blue-600 dark:text-blue-400 mt-1 text-lg">•</span>
            <MathRenderer
              content={parsedLine.substring(2)}
              className="text-gray-900 dark:text-gray-100 leading-relaxed flex-1"
            />
          </div>
        );
      }
      // Numbered lists
      else if (/^\d+\. /.test(line.trim())) {
        const number = line.trim().match(/^(\d+)\. /)?.[1];
        elements.push(
          <div key={index} className="flex items-start space-x-3 my-2">
            <span className="text-blue-600 dark:text-blue-400 font-semibold min-w-[24px]">{number}.</span>
            <MathRenderer
              content={parsedLine.replace(/^\d+\. /, '')}
              className="text-gray-900 dark:text-gray-100 leading-relaxed flex-1"
            />
          </div>
        );
      }
      // Code blocks
      else if (line.trim().startsWith('```')) {
        elements.push(
          <div key={index} className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 my-3 font-mono text-sm text-gray-800 dark:text-gray-200">
            {line.replace(/```/g, '')}
          </div>
        );
      }
      // Regular paragraphs
      else {
        elements.push(
          <MathRenderer
            key={index}
            content={parsedLine}
            className="leading-relaxed mb-4 text-gray-900 dark:text-gray-100"
          />
        );
      }
    });
    
    // Flush any remaining table
    flushTable();
    
    return elements;
  };

  const createTable = (rows: string[], keyPrefix: number) => {
    if (rows.length === 0) return null;
    
    const processedRows = rows.map(row => {
      let cells = row.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
      
      // Handle cases where the first or last element is empty due to leading/trailing |
      if (row.trim().startsWith('|')) {
        cells = cells.slice(0);
      }
      if (row.trim().endsWith('|')) {
        cells = cells.slice(0);
      }
      
      return cells;
    });
    
    // Filter out separator rows (rows with only -, |, and spaces)
    const dataRows = processedRows.filter(row => 
      !row.every(cell => /^[-\s|:]*$/.test(cell))
    );
    
    if (dataRows.length === 0) return null;
    
    const [headerRow, ...bodyRows] = dataRows;
    
    return (
      <div key={`table-${keyPrefix}`} className="my-6 overflow-x-auto">
        <table className="w-full border-collapse bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-300 dark:border-gray-600">
          <thead>
            <tr className="bg-blue-50 dark:bg-blue-900/20">
              {headerRow.map((cell, cellIndex) => (
                <th 
                  key={cellIndex}
                  className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600 first:rounded-tl-lg last:rounded-tr-lg"
                >
                  <MathRenderer content={cell} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr 
                key={rowIndex}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {row.map((cell, cellIndex) => (
                  <td 
                    key={cellIndex}
                    className="px-4 py-3 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                  >
                    <MathRenderer content={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={cn("prose prose-sm max-w-none", className)}>
      {parseMarkdown(content)}
    </div>
  );
}