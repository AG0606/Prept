'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useInterviewStore } from '@/store/interviewStore';
import { Play, Code as CodeIcon, Loader2, CheckCircle2, XCircle, ListChecks } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript' },
  { id: 'python', name: 'Python' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' }
];

/**
 * Normalize a value to a canonical string for comparison.
 * Handles JSON strings, quoted strings, numbers, booleans, arrays, etc.
 */
function normalizeForComparison(value: string): string {
  const trimmed = value.trim();
  // Try to parse as JSON and re-stringify for canonical form
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed);
  } catch {
    // Not valid JSON — treat as plain string
    return trimmed;
  }
}

export function CodePlayground({ onSubmitCode }: { onSubmitCode?: () => void }) {
  const [language, setLanguage] = useState('javascript');
  const store = useInterviewStore();
  const currentCode = store.currentCode;
  const setCurrentCode = store.setCurrentCode;
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<{passed: boolean, expected: string, actual: string, input: string, description?: string}[] | null>(null);

  const testCases = store.currentTestCases;
  const hasTestCases = testCases && testCases.length > 0;

  const questionId = store.currentQuestionId;
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setEditorTheme(isDark ? 'vs-dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Only set default code if empty OR when language/question changes
    const defaultPython = '# Write your code here\n# Define a function named solution that takes the inputs.\ndef solution(input):\n  pass\n';
    const defaultJava = '// Write your code here\npublic class Main {\n  public static void main(String[] args) {\n    \n  }\n}\n';
    const defaultCpp = '// Write your code here\n#include <iostream>\n\nint main() {\n  return 0;\n}\n';
    const defaultJs = '// Write your code here\n// Define a function named solution\nfunction solution(input) {\n  \n}\n';
    
    if (language === 'python') setCurrentCode(defaultPython);
    else if (language === 'java') setCurrentCode(defaultJava);
    else if (language === 'cpp') setCurrentCode(defaultCpp);
    else setCurrentCode(defaultJs);

    // Reset test results when question changes
    setTestResults(null);
    store.setCodeTestResults(null);
    setOutput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId, language]);

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Running code...');
    setTestResults(null);
    store.setCodeTestResults(null);
    
    if (language !== 'javascript') {
      setOutput(`[${language.toUpperCase()}] — Non-JavaScript code will be evaluated by the AI interviewer when you submit your response.\n\nTo test locally, use JavaScript mode or define your solution in JS.`);
      setIsRunning(false);
      return;
    }

    try {
      const workerCode = `
        function normalizeForComparison(value) {
          const trimmed = value.trim();
          try {
            return JSON.stringify(JSON.parse(trimmed));
          } catch (e) {
            return trimmed;
          }
        }

        self.onmessage = function(e) {
          const { code, testCases } = e.data;
          const logs = [];
          const originalLog = console.log;
          console.log = (...args) => { 
            logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); 
          };
          
          try {
            const wrapperFunc = new Function(code + "\\nif (typeof solution !== 'undefined') return solution; return null;");
            const userFunction = wrapperFunc();
            
            if (testCases && testCases.length > 0 && typeof userFunction === 'function') {
              const results = [];
              for (const tc of testCases) {
                try {
                  let args;
                  try {
                    const parsedInput = JSON.parse(tc.input);
                    args = Array.isArray(parsedInput) ? [parsedInput] : [parsedInput];
                  } catch (e) {
                    try {
                      args = JSON.parse('[' + tc.input + ']');
                    } catch (e2) {
                      args = [tc.input];
                    }
                  }
                  
                  const res = userFunction(...args);
                  const actual = res === undefined ? 'undefined' : JSON.stringify(res);
                  const expectedStr = String(tc.expectedOutput).trim();
                  
                  const normalizedActual = normalizeForComparison(actual);
                  const normalizedExpected = normalizeForComparison(expectedStr);
                  const passed = normalizedActual === normalizedExpected;

                  results.push({
                    input: tc.input,
                    expected: expectedStr,
                    actual: actual,
                    passed,
                    description: tc.description,
                  });
                } catch (err) {
                  results.push({
                    input: tc.input,
                    expected: String(tc.expectedOutput),
                    actual: 'Error: ' + err.message,
                    passed: false,
                    description: tc.description,
                  });
                }
              }
              self.postMessage({ type: 'success', logs, results });
            } else if (testCases && testCases.length > 0 && !userFunction) {
              logs.push("⚠ Please define a function named 'solution' to run against test cases.");
              self.postMessage({ type: 'success', logs, results: null });
            } else {
              self.postMessage({ type: 'success', logs, results: null });
            }
          } catch (err) {
            self.postMessage({ type: 'error', error: err.message, logs });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const runPromise = new Promise<any>((resolve) => {
        worker.onmessage = (e) => resolve(e.data);
        worker.onerror = (e) => resolve({ type: 'error', logs: [], error: e.message });
      });

      const timeoutPromise = new Promise<any>((resolve) => 
        setTimeout(() => resolve({ type: 'error', logs: [], error: 'Execution timed out after 5 seconds (possible infinite loop).' }), 5000)
      );

      worker.postMessage({ code: currentCode, testCases: hasTestCases ? testCases : null });
      const result = await Promise.race([runPromise, timeoutPromise]);
      
      worker.terminate();
      URL.revokeObjectURL(workerUrl);

      if (result.type === 'error') {
        setOutput((result.logs?.join('\\n') || '') + '\\nRuntime Error: ' + result.error);
      } else {
        const { logs, results } = result;
        if (results) {
          setTestResults(results);
          const passedCount = results.filter((r: any) => r.passed).length;
          store.setCodeTestResults({
            passed: passedCount,
            total: results.length,
            details: results.map((r: any) => ({
              input: r.input,
              expected: r.expected,
              actual: r.actual,
              passed: r.passed,
            }))
          });
          logs.push(`\\n✓ Test Cases: ${passedCount}/${results.length} passed`);
        }
        setOutput(logs.join('\\n') || 'Code executed successfully (no output).');
      }
    } catch (e: any) {
      setOutput(`System Error: ${e.message}`);
    }
    
    setIsRunning(false);
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden shadow-none transition-colors duration-150">
      <div className="flex items-center justify-between px-4 py-3 bg-surface-warm border-b border-border shrink-0 transition-colors duration-150">
        <div className="flex items-center gap-3">
          <CodeIcon size={16} className="text-accent" />
          <select 
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setCurrentCode(''); 
            }}
            className="bg-transparent text-xs font-mono font-bold text-fg-muted uppercase tracking-wider outline-none border-none cursor-pointer focus:ring-0"
          >
            {LANGUAGES.map(l => <option key={l.id} value={l.id} className="bg-surface text-fg text-xs uppercase">{l.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-success-muted hover:bg-success/20 border border-success/20 text-success font-bold font-mono text-xs rounded-lg transition-all disabled:opacity-50"
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            {isRunning ? 'RUNNING' : 'RUN CODE'}
          </button>
          {onSubmitCode && (
            <button 
              onClick={onSubmitCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-muted hover:bg-accent/20 border border-accent/20 text-accent font-bold font-mono text-xs rounded-lg transition-all"
            >
              SUBMIT CODE
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow relative">
        <Editor
          height="100%"
          language={language}
          theme={editorTheme}
          value={currentCode}
          onChange={(val) => setCurrentCode(val || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
          }}
          loading={<div className="h-full flex items-center justify-center text-fg-muted"><Loader2 className="animate-spin" size={18} /></div>}
        />
      </div>

      <div className="flex-1 basis-0 min-h-0 bg-surface border-t border-border p-4 overflow-y-auto font-mono text-xs flex flex-col gap-4 scrollbar-custom transition-colors duration-150"
        style={{ maxHeight: '45%', minHeight: '120px' }}
      >
        
        {/* Show test case specs before running */}
        {hasTestCases && !testResults && (
          <div>
            <div className="text-fg-muted mb-2.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
              <ListChecks size={12} className="text-accent" />
              Sample Test Cases
              <span className="px-2 py-0.5 rounded bg-surface border border-border text-fg-subtle text-[9px] font-bold">
                {testCases.length} cases
              </span>
            </div>
            <div className="space-y-2">
              {testCases.map((tc, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-surface-warm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-fg-muted text-[10px]">CASE {i + 1}</span>
                    {tc.description && <span className="text-fg-subtle text-[10px]">— {tc.description}</span>}
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-fg-muted">
                    <span className="text-fg-subtle font-bold uppercase text-[9px]">Input:</span> <span className="text-accent">{typeof tc.input === 'object' ? JSON.stringify(tc.input) : String(tc.input)}</span>
                    <span className="text-fg-subtle font-bold uppercase text-[9px]">Expected:</span> <span className="text-success">{typeof tc.expectedOutput === 'object' ? JSON.stringify(tc.expectedOutput) : String(tc.expectedOutput)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Console output */}
        <div>
          <div className="text-fg-muted mb-2 text-[10px] uppercase tracking-widest font-bold">Console Output</div>
          {output ? (
            <pre className={`whitespace-pre-wrap leading-relaxed text-xs ${output.startsWith('Error') || output.startsWith('Runtime') || output.includes('⚠') ? 'text-danger' : 'text-fg-muted'}`}>
              {output}
            </pre>
          ) : (
            <span className="text-fg-subtle text-xs italic">No output yet. Click RUN CODE to execute.</span>
          )}
        </div>

        {/* Test case results after running */}
        <AnimatePresence>
          {testResults && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-fg-muted mb-2.5 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2">
                Test Results 
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                  testResults.every(t => t.passed) 
                    ? 'bg-success-muted text-success border-success/20' 
                    : 'bg-danger-muted text-danger border-danger/20'
                }`}>
                  {testResults.filter(t => t.passed).length}/{testResults.length} PASSED
                </span>
              </div>
              <div className="space-y-2">
                {testResults.map((tr, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${tr.passed ? 'border-success/20 bg-success-muted' : 'border-danger/20 bg-danger-muted'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {tr.passed ? <CheckCircle2 size={14} className="text-success" /> : <XCircle size={14} className="text-danger" />}
                        <span className="font-bold text-fg-muted text-[10px]">CASE {i + 1}</span>
                      </div>
                      {tr.description && <span className="text-fg-subtle text-[10px]">— {tr.description}</span>}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs text-fg-muted">
                      <span className="text-fg-subtle font-bold uppercase text-[9px]">Input:</span> <span>{typeof tr.input === 'object' ? JSON.stringify(tr.input) : String(tr.input)}</span>
                      <span className="text-fg-subtle font-bold uppercase text-[9px]">Expected:</span> <span>{typeof tr.expected === 'object' ? JSON.stringify(tr.expected) : String(tr.expected)}</span>
                      <span className="text-fg-subtle font-bold uppercase text-[9px]">Actual:</span> <span className={tr.passed ? 'text-success' : 'text-danger'}>{typeof tr.actual === 'object' ? JSON.stringify(tr.actual) : String(tr.actual)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
