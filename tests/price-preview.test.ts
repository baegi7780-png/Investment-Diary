import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Browser ES module is shared directly with tests.
import {pricePreview} from '../public/price-preview.mjs';
test('Price simulation uses fee-inclusive cost, handles losses and fractions, and never mutates holdings',()=>{
 const holding={quantity:'7',cost:'1295',current:'200',currency:'USD'},before={...holding};
 const p=pricePreview(holding,'220');assert.equal(p.value,'1540');assert.equal(p.pnl,'245');assert.ok(Math.abs(Number(p.rate)-245/1295*100)<1e-10);assert.deepEqual(holding,before);
 assert.equal(pricePreview({quantity:'0.5',cost:'100'},'150').pnl,'-25');assert.equal(pricePreview({quantity:'10',cost:'700000'},'80000').rate,'14.285714285714285714285714285714285714285714285714');
 assert.equal(pricePreview({quantity:'1',cost:'0'},'10').rate,null);
 for(const invalid of ['','-1','0','NaN','Infinity','1e3','1.123456789'])assert.throws(()=>pricePreview(holding,invalid));
});
