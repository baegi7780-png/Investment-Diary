import {mkdir, copyFile, writeFile} from 'node:fs/promises';
await mkdir('dist-pages', {recursive: true});
await copyFile('pages/worker.mjs', 'dist-pages/_worker.js');
await writeFile('dist-pages/_routes.json', JSON.stringify({version:1,include:['/*'],exclude:[]}));
await writeFile('dist-pages/index.html', '<!doctype html><html lang="ko"><meta charset="utf-8"><title>투자노트</title><p>투자노트 연결 중입니다.</p></html>');
