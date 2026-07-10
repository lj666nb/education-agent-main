const LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  py: 'python',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  'c#': 'csharp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  sql: 'sql',
  html: 'html',
  css: 'css',
  bash: 'bash',
  shell: 'bash',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  markdown: 'markdown',
  text: 'text',
}

export function detectLanguage(className?: string): string {
  if (!className) return 'text'
  const match = className.match(/language-(\w+)/)
  if (!match) return 'text'
  return LANGUAGE_MAP[match[1].toLowerCase()] || match[1]
}

export const MONACO_LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  swift: 'swift',
  html: 'html',
  css: 'css',
  bash: 'bash',
  sql: 'sql',
  json: 'json',
  xml: 'xml',
  yaml: 'yaml',
  markdown: 'markdown',
}

export function toMonacoLanguage(lang: string): string {
  return MONACO_LANGUAGE_MAP[lang.toLowerCase()] || 'plaintext'
}

function hasMainFunction(code: string, language: string): boolean {
  switch (language) {
    case 'python':
      return /if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(code)
    case 'c':
    case 'cpp':
      return /int\s+main\s*\(/.test(code)
    case 'java':
      return /public\s+static\s+void\s+main\s*\(/.test(code)
    case 'go':
      return /func\s+main\s*\(/.test(code)
    default:
      return true
  }
}

/**
 * Parse a code template into driver (read-only) and solution (editable) parts.
 *
 * Marker format (language-agnostic comment):
 *   // === DRIVER START ===   or  # === DRIVER START ===
 *   ... driver code ...
 *   // === SOLUTION START === or  # === SOLUTION START ===
 *   ... solution code (user editable) ...
 *   // === SOLUTION END ===   or  # === SOLUTION END ===
 *   ... more driver code ...
 *   // === DRIVER END ===     or  # === DRIVER END ===
 *
 * If no markers are found, the entire template is treated as solution code.
 */
export function parseTemplate(code: string): { driver: string; solution: string } {
  if (!code || !code.trim()) return { driver: '', solution: '' }

  const lines = code.split('\n')
  const driverLines: string[] = []
  const solutionLines: string[] = []
  let inDriver = true
  let inSolution = false
  let foundMarker = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for SOLUTION START marker
    if (/^(#|\/\/|\/\*|\*)\s*SOLUTION\s*START/.test(trimmed)) {
      foundMarker = true
      inDriver = false
      inSolution = true
      continue
    }

    // Check for SOLUTION END marker
    if (/^(#|\/\/|\/\*|\*)\s*SOLUTION\s*END/.test(trimmed)) {
      inSolution = false
      inDriver = true
      continue
    }

    // Skip DRIVER START/END markers
    if (/^(#|\/\/|\/\*|\*)\s*DRIVER\s*(START|END)/.test(trimmed)) {
      foundMarker = true
      continue
    }

    if (inSolution) {
      solutionLines.push(line)
    } else if (inDriver) {
      driverLines.push(line)
    }
  }

  // If no markers found, the entire code is solution
  if (!foundMarker) {
    return { driver: '', solution: code }
  }

  return {
    driver: driverLines.join('\n').trim(),
    solution: solutionLines.join('\n').trim(),
  }
}

export function autoCompleteCode(code: string, language: string): string {
  const trimmed = code.trim()
  if (!trimmed) return ''

  if (hasMainFunction(trimmed, language)) {
    return trimmed
  }

  switch (language) {
    case 'python': {
      // If code has function definitions, add a test harness
      const pyFuncMatch = trimmed.match(/def\s+(\w+)\s*\(/)
      if (pyFuncMatch) {
        return `${trimmed}\n\nif __name__ == "__main__":\n    ${pyFuncMatch[1]}()`
      }
      // If code has class definitions but no main, add a simple test harness
      const pyClassMatch = trimmed.match(/class\s+(\w+)/)
      if (pyClassMatch) {
        return `${trimmed}\n\nif __name__ == "__main__":\n    # 测试代码\n    obj = ${pyClassMatch[1]}()\n    print(obj)`
      }
      // Plain script code (e.g. print('hello')), execute as-is
      return trimmed
    }
    case 'javascript': {
      return `${trimmed}\n\n// Run the code\nconsole.log(${extractFunctionName(trimmed) || 'result'});`
    }
    case 'c': {
      return `#include <stdio.h>

${trimmed}

int main() {
    // Test the function here
    ${generateCTestCall(trimmed)}
    return 0;
}`
    }
    case 'cpp': {
      return `#include <iostream>
using namespace std;

${trimmed}

int main() {
    // Test the function here
    ${generateCppTestCall(trimmed)}
    return 0;
}`
    }
    case 'java': {
      const className = extractJavaClassName(trimmed) || 'Main'
      if (trimmed.includes(`class ${className}`)) {
        return trimmed.replace(
          /public\s+static\s+void\s+main/,  // won't match since we checked hasMainFunction
          () => trimmed
        )
      }
      return `public class ${className} {
${indentCode(trimmed)}

    public static void main(String[] args) {
        // Test the class here
        ${className} obj = new ${className}();
        System.out.println(obj.toString());
    }
}`
    }
    case 'go': {
      return `package main

import "fmt"

${trimmed}

func main() {
    // Test the function here
    ${generateGoTestCall(trimmed)}
}`
    }
    default:
      return trimmed
  }
}

function indentCode(code: string, level: number = 1): string {
  const indent = '    '.repeat(level)
  return code.split('\n').map(line => line ? indent + line : '').join('\n')
}

function extractFunctionName(code: string): string {
  const match = code.match(/(?:function\s+)?(\w+)\s*\(/)
  return match ? match[1] : 'result'
}

function generateCTestCall(code: string): string {
  const funcMatch = code.match(/(\w+)\s*\(/)
  if (funcMatch) {
    return `${funcMatch[1]}();`
  }
  return 'printf("Hello from generated main\\n");'
}

function generateCppTestCall(code: string): string {
  const funcMatch = code.match(/(\w+)\s*\(/)
  if (funcMatch) {
    return `${funcMatch[1]}();`
  }
  return 'cout << "Hello from generated main" << endl;'
}

function generateGoTestCall(code: string): string {
  const funcMatch = code.match(/func\s+(\w+)\s*\(/)
  if (funcMatch) {
    return `${funcMatch[1]}()`
  }
  return 'fmt.Println("Hello from generated main")'
}

function extractJavaClassName(code: string): string | null {
  const match = code.match(/(?:public\s+)?(?:class|interface)\s+(\w+)/)
  return match ? match[1] : null
}

export const LANGUAGE_NAMES: Record<string, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  html: 'HTML',
  css: 'CSS',
  bash: 'Bash',
  sql: 'SQL',
  json: 'JSON',
  xml: 'XML',
  text: 'Text',
}
