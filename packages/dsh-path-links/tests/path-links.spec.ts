/**
 * dsh-path-links 纯函数单测：splitPathTokens 的路径/文本切分行为。
 */
import { describe, expect, it } from 'vitest'
import { splitPathTokens, type PathToken } from '../src/index.ts'

function textOnly(tokens: PathToken[]): string {
  return tokens.map(t => ('path' in t ? `[P:${t.path}]` : t.text)).join('')
}

describe('splitPathTokens', () => {
  it('returns one text token for plain text', () => {
    expect(splitPathTokens('你好，世界')).toEqual([{ text: '你好，世界' }])
  })

  it('splits a bare Windows path', () => {
    const tokens = splitPathTokens('请查看 C:\\Users\\19161\\Desktop\\a.md 这个文件')
    expect(tokens).toEqual([
      { text: '请查看 ' },
      { path: 'C:\\Users\\19161\\Desktop\\a.md' },
      { text: ' 这个文件' },
    ])
  })

  it('preserves quoted paths verbatim (复制为路径语义)', () => {
    const tokens = splitPathTokens('路径是 "C:\\my dir\\file!.txt" 在这里')
    // 路径 token 不含引号；开/闭引号作为文本段保留（逐字语义）
    expect(tokens).toEqual([
      { text: '路径是 ' },
      { text: '"' },
      { path: 'C:\\my dir\\file!.txt' },
      { text: '"' },
      { text: ' 在这里' },
    ])
  })

  it('trims trailing punctuation on bare paths', () => {
    const tokens = splitPathTokens('在 C:\\a\\b.txt。继续')
    expect(tokens[1]).toEqual({ path: 'C:\\a\\b.txt' })
    expect(textOnly(tokens)).toContain('。继续')
  })

  it('stops a bare path at CJK prose (CJK needs quotes)', () => {
    // 裸路径字符集排除 CJK —— "报告.docx" 是中文，裸路径在 "C:\data\" 处截断，
    // 要完整保留含中文的路径必须带引号（见下一个用例）。
    const tokens = splitPathTokens('C:\\data\\报告.docx内容见上')
    expect(tokens[0]).toEqual({ path: 'C:\\data\\' })
    expect(textOnly(tokens)).toContain('报告.docx内容见上')
  })

  it('keeps a quoted path containing CJK verbatim', () => {
    const tokens = splitPathTokens('文件 "C:\\data\\报告.docx" 已保存')
    // 路径 token 保留 CJK（引号分支逐字）；引号作为文本段
    expect(tokens[1]).toEqual({ text: '"' })
    expect(tokens[2]).toEqual({ path: 'C:\\data\\报告.docx' })
    expect(tokens[3]).toEqual({ text: '"' })
  })

  it('recognizes UNC paths', () => {
    const tokens = splitPathTokens('共享 \\\\server\\share\\folder\\x.txt 在')
    expect(tokens[1]).toEqual({ path: '\\\\server\\share\\folder\\x.txt' })
  })

  it('requires a word boundary before the drive letter', () => {
    expect(textOnly(splitPathTokens('abcC:\\x'))).not.toContain('[P:')
  })

  it('excludes device-prefix paths', () => {
    expect(textOnly(splitPathTokens('\\\\?\\C:\\x'))).not.toContain('[P:')
  })

  it('handles multiple paths in one text', () => {
    const tokens = splitPathTokens('A: C:\\1.txt B: D:\\2.txt C: E:\\3.txt')
    const paths = tokens.filter(t => 'path' in t).map(t => ('path' in t ? t.path : ''))
    expect(paths).toEqual(['C:\\1.txt', 'D:\\2.txt', 'E:\\3.txt'])
  })

  it('round-trips every segment', () => {
    const input = '看 C:\\a\\b.md 和 D:\\c\\d.txt 两个'
    const tokens = splitPathTokens(input)
    expect(textOnly(tokens)).toBe(input.replace(/C:\\a\\b.md/g, '[P:C:\\a\\b.md]').replace(/D:\\c\\d.txt/g, '[P:D:\\c\\d.txt]'))
  })
})
