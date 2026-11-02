import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const folders=['01收件箱','02资料库','03任务输出','04工作区','05临时','06归档'];
export function config({owner,token,vault='/workspace/vault',profile='/data/dsh/profiles/web'}) {
  if(!/^[1-9][0-9]{4,11}$/.test(owner??''))throw new Error('OWNER_QQ must be a QQ number');
  if(!/^[a-f0-9]{64}$/.test(token??''))throw new Error('ONEBOT_TOKEN must be a fresh 32-byte hex token');
  const plugins=[
    {id:'agent-instructions',name:'@deepseek-ai/dsh-agent-instructions'},
    {id:'time-context',name:'@deepseek-ai/dsh-time-context'},
    {id:'tool-bash',name:'@deepseek-ai/dsh-tool-bash'},
    {id:'tool-fs',name:'@deepseek-ai/dsh-tool-fs'},
    {id:'tool-fs-search',name:'@deepseek-ai/dsh-tool-fs-search'},
    {id:'tool-jobs',name:'@deepseek-ai/dsh-tool-jobs'},
    {id:'tool-schedule',name:'@deepseek-ai/dsh-tool-schedule'},
    {id:'skill-filesystem',name:'@deepseek-ai/dsh-skill-filesystem'},
    {id:'tool-skill',name:'@deepseek-ai/dsh-tool-skill'},
    {id:'compaction',name:'cordis:group',group:true,isolate:{compaction:true,toolResultPruner:true},config:[
      {id:'companion-context',name:'dsh-companion-core/context'},
      {id:'command-compact',name:'@deepseek-ai/dsh-command-compact'},
      {id:'tool-result-pruner',name:'@deepseek-ai/dsh-compaction-tool-result-pruner',config:{thresholdChars:8192,headChars:4096,tailChars:1024}}
    ]},
    {id:'tool-ask-user',name:'@deepseek-ai/dsh-tool-ask-user'},
    {id:'tool-todo',name:'@deepseek-ai/dsh-tool-todo'},
    {id:'tool-web',name:'@deepseek-ai/dsh-tool-web',config:{fetch:true,searchTimeoutMs:60000}},
    {id:'present',name:'@deepseek-ai/dsh-tool-present'},
    {id:'mcp-playwright',name:'@deepseek-ai/dsh-mcp-client',config:{serverName:'playwright',transport:'stdio',command:'node',args:[path.posix.join(profile,'node_modules/@playwright/mcp/cli.js'),'--config','/data/dsh/playwright.json'],cwd:vault,env:{PLAYWRIGHT_BROWSERS_PATH:'/ms-playwright'},toolCallTimeoutMs:120000,maxInstructionBytes:8192}}
  ];
  return [
    {id:'napcat-bridge',config:{id:'napcat',ws_reverse_host:'0.0.0.0',ws_reverse_port:6199,ws_reverse_token:token,workspacePath:vault,agentPreset:'companion',admins:[owner],whitelistEnabled:true,privateWhitelist:[owner],groupWhitelist:[],wake_prefix:['/'],wakeKeywords:['大肥鱼','肥鱼'],identifier:true,imageToModel:true,segmentAdminPrivate:true}},
    {id:'companion-core',config:{personaPresets:['companion'],personaOnly:true,recallEnabled:true,recallTopKMaster:5,recallTopK:4,masterMaxRounds:30,masterDropRounds:10,masterMode:'truncate',activeMemory:true,archiveEnabled:true,diaryEnabled:true,proactiveEnabled:true,proactiveMinMinutes:20,proactiveMaxMinutes:45,quietStart:'23:00',quietEnd:'08:00',embedApiUrl:'http://ollama:11434/v1',embedApiKey:'ollama',embedModel:'bge-m3',embedBatch:8}},
    {id:'dafeiyu-vault',config:{root:vault,owners:[owner],memeRoots:[path.posix.join(vault,'02资料库/表情包')]}},
    {id:'dafeiyu-qq-tools',config:{reportRoot:vault,owners:[owner]}},
    {id:'remember-you',config:{root:vault,owners:[owner],budgetChars:800}},
    {id:'dafeiyu-qq-runtime',config:{root:vault,owners:[owner],toolTimeoutMs:120000}},
    {id:'preset-companion',config:{id:'companion',name:'大肥鱼',description:'陪伴、记忆、网页与文件工具',order:5,plugins}},
    {id:'agent-preset-registry',config:{default:'companion',selectedDefault:'companion'}}
  ];
}
export async function init({home='/data/dsh',vault='/workspace/vault',template='/opt/template',owner=process.env.OWNER_QQ,token=process.env.ONEBOT_TOKEN}={}) {
  const profile=path.join(home,'profiles/web');
  const entries=config({owner,token,vault,profile:profile.replaceAll('\\','/')});
  await fs.mkdir(profile,{recursive:true});
  for(const dir of folders)await fs.mkdir(path.join(vault,dir),{recursive:true});
  await fs.mkdir(path.join(vault,'02资料库/表情包'),{recursive:true});
  const version='linux-clean-1';
  let prior;try{prior=await fs.readFile(path.join(profile,'.dafeiyu-runtime'),'utf8')}catch{}
  if(prior!==version){
    // The package tree is built for Linux, never copied from the Windows device.
    if(await fs.stat(path.join(profile,'node_modules')).catch(()=>null))throw new Error('Unexpected existing dependency tree; back up and inspect before replacing it');
    await fs.cp(path.join(template,'node_modules'),path.join(profile,'node_modules'),{recursive:true,dereference:false,verbatimSymlinks:true});
    for(const name of ['plugins','vendor'])await fs.cp(path.join(template,name),path.join(profile,name),{recursive:true,verbatimSymlinks:true});
    await fs.copyFile(path.join(template,'package.json'),path.join(profile,'package.json'));
    await fs.writeFile(path.join(profile,'cordis.yml'),'[]\n',{flag:'wx'});
    await fs.writeFile(path.join(profile,'.dafeiyu-runtime'),version);
  }
  const patch=path.join(profile,'cordis.patch.yml');
  if(!await fs.stat(patch).catch(()=>null))await fs.writeFile(patch,JSON.stringify(entries,null,2)+'\n',{mode:0o600,flag:'wx'});
  const persona=path.join(home,'companion/persona/persona.md');
  await fs.mkdir(path.dirname(persona),{recursive:true});
  if(!await fs.stat(persona).catch(()=>null))await fs.copyFile(path.join(template,'persona.md'),persona);
  const executablePath=(await fs.readFile(path.join(template,'chromium-path'),'utf8')).trim();
  const browser={filePaths:'absolute',codegen:'none',browser:{browserName:'chromium',userDataDir:path.join(vault,'04工作区/浏览器/会话'),launchOptions:{executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],downloadsPath:path.join(vault,'05临时/浏览器')},contextOptions:{acceptDownloads:true}},outputDir:path.join(vault,'03任务输出/浏览器'),imageResponses:'omit',allowUnrestrictedFileAccess:false};
  if(!await fs.stat(path.join(home,'playwright.json')).catch(()=>null))await fs.writeFile(path.join(home,'playwright.json'),JSON.stringify(browser,null,2));
  // No database, messages, sessions, memories or credentials are seeded.
  return {profile,seededHistory:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  await init();
}
