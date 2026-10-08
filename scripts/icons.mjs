import {readFile} from 'node:fs/promises';
// Finished image-generated brand assets are committed; never overwrite them on build.
for(const [name,size] of [['brand-mark',128],['favicon-32',32],['icon-192',192],['icon-512',512],['icon-maskable-512',512]]){
  const file=await readFile(`public/icons/${name}.png`);
  if(file.subarray(1,4).toString()!=='PNG'||file.readUInt32BE(16)!==size||file.readUInt32BE(20)!==size)throw new Error(`Invalid brand asset: ${name}`);
}
