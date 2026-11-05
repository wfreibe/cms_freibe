'use strict';
const assert=require('assert/strict');
(async()=>{
 const {backgroundColor,backgroundAppearance,contrast}=await import('../frontend/src/utils/pageBackground.js');
 assert.equal(contrast('#000','#fff'),21);
 assert.equal(backgroundColor('#ABC'),'#aabbcc');
 assert.deepEqual(backgroundAppearance('',null),{});
 assert.deepEqual(backgroundAppearance('not-a-color',null),{});
 for(const color of ['#111316','#191d22','#30343a','#edf0f2','#ffffff','#c7254e','#4ad7d1','#777777']){
  const style=backgroundAppearance(color,'');assert.equal(style.backgroundColor,color);assert(contrast(color,style['--page-foreground'])>=4.5,color);
 }
 for(let i=0;i<256;i++){const color='#'+i.toString(16).padStart(2,'0').repeat(3);assert(contrast(color,backgroundAppearance(color,'')['--page-foreground'])>=4.5,color);}
 assert.equal(backgroundAppearance('#fff','')['--page-foreground'],'#111316');
 assert.equal(backgroundAppearance('#111316','')['--page-foreground'],'#ffffff');
 const image=backgroundAppearance('#c7254e','/tests/block-landscape.png');
 assert.equal(image.backgroundColor,'#c7254e');assert(image.backgroundImage.includes('/tests/block-landscape.png'));assert.equal(image['--page-foreground'],'#ffffff');
 assert.equal(backgroundAppearance('', '/tests/block-landscape.png').backgroundColor,undefined);
 console.log('Backgrounds passed: default/reset, HEX normalization, all palette colors and 256 gray contrasts, combined image/color and unchanged image overlay.');
})().catch(e=>{console.error(e);process.exitCode=1;});
