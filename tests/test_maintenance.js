'use strict';
const {fs,path,temp,baseEnv,run}=require('./helpers');
const dir=temp();
try {
  run('php',['tests/test_maintenance.php'],{env:{...baseEnv,CMS_MAINTENANCE_TEST_DIR:dir},stdio:'inherit'});
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
  if(fs.existsSync(dir)) throw new Error('Maintenance test data could not be removed.');
}
