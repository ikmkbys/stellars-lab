// 公開ページ内のリンク先が「gitの管理下にあるか」を検査する。
//
// ディスク上の存在ではなくgitを見るのが肝。
// 試作ページはローカルには実在するがコミットされていないことがあり、
// ファイル存在チェックでは「ある」と判定されてしまう。しかしデプロイされるのは
// gitの中身だけなので、本番では404になる（実際にSTELLAR SAND等で起きた）。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);

// コミット対象（ステージ済み）を含めた「これから公開される状態」で判定する
const tracked = new Set([...git('ls-files'), ...git('diff', '--cached', '--name-only', '--diff-filter=ACMR')]);
const deleted = new Set(git('diff', '--cached', '--name-only', '--diff-filter=D'));
for (const f of deleted) tracked.delete(f);

/** Vercelのクリーンな URL（/privacy → privacy.html、/en/ → en/index.html、/ → index.html）も解決する */
const resolves = (target) => {
  const base = target.replace(/^\//, '');
  if (base === '' || base === '.') return tracked.has('index.html');
  return [base, `${base}.html`, `${base.replace(/\/$/, '')}/index.html`].some((c) => tracked.has(c));
};

const htmlFiles = [...tracked].filter((f) => f.endsWith('.html'));
const problems = [];

for (const file of htmlFiles) {
  if (!existsSync(file)) continue; // ステージ済みだが作業ツリーに無い場合は飛ばす
  const html = readFileSync(file, 'utf8');
  for (const [, link] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    // 外部・アンカー・Vercelが注入するものは対象外
    if (/^(https?:|mailto:|tel:|#|data:|\/_vercel)/.test(link)) continue;
    const clean = link.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? clean
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
    if (resolves(target)) continue;
    problems.push({
      file,
      link,
      reason: existsSync(target.replace(/^\//, ''))
        ? 'ローカルにはあるがgit未追跡（デプロイされず404になります）'
        : 'リンク先が見つかりません',
    });
  }
}

if (problems.length === 0) {
  console.log(`✓ リンク検査OK（${htmlFiles.length}ファイル）`);
  process.exit(0);
}

console.error('\n✗ 公開されないページへのリンクがあります\n');
for (const { file, link, reason } of problems) {
  console.error(`  ${file} -> ${link}`);
  console.error(`      ${reason}\n`);
}
console.error('リンクを消すか、リンク先を git add してください。\n');
process.exit(1);
