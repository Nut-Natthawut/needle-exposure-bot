import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL} from 'node:url';

const root=new URL('../',import.meta.url);
const ui=JSON.parse(readFileSync(new URL('content/ui.json',root),'utf8'));
const API='https://api.line.me/v2/bot';
const DATA='https://api-data.line.me/v2/bot';
const MAX_IMAGE_BYTES=1_000_000;
const sha=data=>createHash('sha256').update(data).digest('hex');
const fail=message=>{throw new Error(message);};
const shortText=(value,max)=>typeof value==='string'&&value.trim().length>0&&[...value].length<=max;

/** Project-specific preflight; no network or secrets needed. */
export function validateRichMenu(config,image) {
  if(!isDeepStrictEqual(config?.size,{width:2500,height:1686})||typeof config.selected!=='boolean'
    ||!shortText(config.name,280)||!shortText(config.chatBarText,14)||!Array.isArray(config.areas)||config.areas.length!==6)fail('invalid rich menu config');
  if(!Buffer.isBuffer(image)||image.length<24||image.length>MAX_IMAGE_BYTES
    ||image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'
    ||image.readUInt32BE(16)!==2500||image.readUInt32BE(20)!==1686)fail('invalid PNG: require 2500x1686 and <=1,000,000 bytes');
  for(const [index,area] of config.areas.entries()) {
    const b=area?.bounds,a=area?.action;
    if(!b||!['x','y','width','height'].every(key=>Number.isInteger(b[key]))||b.x<0||b.y<0
      ||b.width<=0||b.height<=0||b.x+b.width>2500||b.y+b.height>1686)fail('invalid tap bounds');
    if(a?.type!=='postback'||a.data!==ui.mainMenu[index].routeId||!shortText(a.label,20)
      ||Object.keys(a).some(key=>!['type','label','data'].includes(key)))fail('invalid menu postback/label');
  }
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++) {
    const a=config.areas[i].bounds,b=config.areas[j].bounds;
    if(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height)fail('overlapping tap bounds');
  }
}

/** Both the actual image and action coordinates identify this menu version. */
export function menuVersion(config,image) {
  return `${config.name}-${sha(Buffer.concat([Buffer.from(JSON.stringify(config)),image])).slice(0,16)}`;
}

function menuId(value) {
  if(typeof value!=='string'||!/^richmenu-[a-zA-Z0-9-]+$/.test(value))fail('invalid richMenuId');
  return value;
}
async function imageBytes(response) {
  const reader=response.body?.getReader();
  if(!reader)fail('existing image differs');
  let size=0;const chunks=[];
  try {
    while(true) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_IMAGE_BYTES){await reader.cancel();fail('existing image differs');}
      chunks.push(Buffer.from(value));
    }
  } catch { fail('existing image differs or could not be read'); }
  finally {reader.releaseLock();}
  return Buffer.concat(chunks);
}

/** Manual provisioning only. Never import this module from the Worker. */
export async function installRichMenu({config,image,accessToken,fetcher=fetch}) {
  validateRichMenu(config,image);
  if(typeof accessToken!=='string'||!/^[\x21-\x7e]+$/.test(accessToken))fail('set LINE_CHANNEL_ACCESS_TOKEN in the local environment (do not paste into chat)');
  const versioned={...config,name:menuVersion(config,image)};
  async function request(operation,url,{method='GET',body,contentType,allow404=false}={}) {
    let response;
    try {
      response=await fetcher(url,{method,body,redirect:'manual',signal:AbortSignal.timeout(15_000),
        headers:{Authorization:`Bearer ${accessToken}`,...(contentType?{'Content-Type':contentType}:{})}});
    } catch {fail(`${operation}: network_error`);}
    if(!response.ok&&!(allow404&&response.status===404)) {
      // Do not follow redirects or expose LINE response bodies / thrown fetch errors.
      await response.body?.cancel().catch(()=>{});
      fail(`${operation}: HTTP ${response.status}`);
    }
    return response;
  }
  async function readJson(response,operation) {
    try{return await response.json();}catch{fail(`${operation}: invalid JSON response`);}
  }
  const list=await readJson(await request('list',`${API}/richmenu/list`),'list');
  if(!Array.isArray(list?.richmenus))fail('list: invalid menu list');
  const matches=list.richmenus.filter(menu=>menu.name===versioned.name);
  if(matches.length>1)fail('multiple matching menus; inspect in LINE before retrying');
  const existing=matches[0];
  let id,upload=true;
  if(existing) {
    const {richMenuId,...definition}=existing;
    if(!isDeepStrictEqual(definition,versioned))fail('existing menu differs');
    id=menuId(richMenuId);
    const response=await request('download',`${DATA}/richmenu/${id}/content`,{allow404:true});
    if(response.status===404)await response.body?.cancel().catch(()=>{});
    else {
      if(sha(await imageBytes(response))!==sha(image))fail('existing image differs');
      upload=false;
    }
  } else {
    const created=await readJson(await request('create',`${API}/richmenu`,{
      method:'POST',body:JSON.stringify(versioned),contentType:'application/json',
    }),'create');
    id=menuId(created.richMenuId);
  }
  if(upload) {
    const uploaded=await request('upload',`${DATA}/richmenu/${id}/content`,{method:'POST',body:image,contentType:'image/png'});
    await uploaded.body?.cancel().catch(()=>{});
  }
  const activated=await request('activate',`${API}/user/all/richmenu/${id}`,{method:'POST'});
  await activated.body?.cancel().catch(()=>{});
  const current=await readJson(await request('verify',`${API}/user/all/richmenu`),'verify');
  if(current?.richMenuId!==id)fail('default verification failed; inspect LINE before retrying');
  return {richMenuId:id,reused:Boolean(existing)};
}

async function main() {
  const args=process.argv.slice(2);
  if(args.length>1||!['--check','--install'].includes(args[0]??'--check'))fail('usage: node scripts/install-rich-menu.mjs [--check | --install]');
  const config=JSON.parse(readFileSync(new URL('config/rich-menu.json',root),'utf8'));
  const image=readFileSync(new URL('assets/rich-menu.png',root));
  validateRichMenu(config,image);
  if(args[0]!=='--install') {
    console.log(`CHECK OK: 2500x1686 PNG, ${image.length} bytes, 6 postbacks. No LINE request made.`);
    return;
  }
  const result=await installRichMenu({config,image,accessToken:process.env.LINE_CHANNEL_ACCESS_TOKEN});
  console.log(`INSTALLED + DEFAULT VERIFIED: ${result.richMenuId} (${result.reused?'reused':'created'}). Test all 6 buttons on LINE mobile.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(`Rich Menu: ${error.message}`);process.exitCode=1;});
}
