import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import{createRequire}from'node:module';
const ts=createRequire(import.meta.url)('typescript'),scope={exports:{},URL,Number};vm.runInNewContext(ts.transpile(fs.readFileSync(new URL('../src/lib/ministry-routing.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.CommonJS}),scope);const{youthGroup,normalizeWhatsAppPhone,cleanGroupLink}=scope.exports;
for(const[age,expected]of[[0,null],[12,null],[13,'early-youth'],[18,'early-youth'],[19,'young-adults'],[34,'young-adults'],[35,null],[120,null],[121,null],[13.5,null],[NaN,null]])assert.equal(youthGroup(age),expected);
assert.equal(youthGroup(20,{early_min:13,early_max:20,adult_min:21,adult_max:34}),'early-youth');
for(const input of['0971234567','+260971234567','00260971234567'])assert.equal(normalizeWhatsAppPhone(input),'+260971234567');
assert.equal(normalizeWhatsAppPhone('+447123456789'),'+447123456789');for(const input of['123','no number','0000'])assert.equal(normalizeWhatsAppPhone(input),null);
assert.equal(cleanGroupLink('https://chat.whatsapp.com/TEST123?s=cl&p=a'),'https://chat.whatsapp.com/TEST123');
for(const input of['http://chat.whatsapp.com/TEST','https://evil.example/TEST','https://chat.whatsapp.com.evil.example/TEST','https://user@chat.whatsapp.com/TEST','https://chat.whatsapp.com/TEST/more','javascript:alert(1)'])assert.equal(cleanGroupLink(input),null);
console.log('Passed ministry age boundaries, configurable routing, WhatsApp phone normalization, and group-link validation.');
