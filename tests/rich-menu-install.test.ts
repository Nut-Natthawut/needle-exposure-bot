import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {describe,expect,it,vi} from 'vitest';
import {installRichMenu,validateRichMenu,menuVersion} from '../scripts/install-rich-menu.mjs';

const config=JSON.parse(readFileSync(new URL('../config/rich-menu.json',import.meta.url),'utf8'));
const image=readFileSync(new URL('../assets/rich-menu.png',import.meta.url));
const id='richmenu-0123456789abcdef';
const token='synthetic-token-NOT-A-REAL-SECRET';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
function newMenuFetch() {
  return vi.fn().mockResolvedValueOnce(json({richmenus:[]})).mockResolvedValueOnce(json({richMenuId:id}))
    .mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({richMenuId:id}));
}
describe('one-time rich menu installer',()=>{
  it('creates, uploads PNG, activates only after upload, and reads back the active default',async()=>{
    const fetcher=newMenuFetch();
    expect(await installRichMenu({config,image,accessToken:token,fetcher})).toEqual({richMenuId:id,reused:false});
    expect(fetcher.mock.calls.map(([url])=>url)).toEqual([
      'https://api.line.me/v2/bot/richmenu/list','https://api.line.me/v2/bot/richmenu',
      `https://api-data.line.me/v2/bot/richmenu/${id}/content`,
      `https://api.line.me/v2/bot/user/all/richmenu/${id}`,'https://api.line.me/v2/bot/user/all/richmenu',
    ]);
    for(const [,init] of fetcher.mock.calls) {
      expect(init.redirect).toBe('manual');expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    }
    const create=fetcher.mock.calls[1]![1];
    expect(JSON.parse(create.body)).toEqual({...config,name:menuVersion(config,image)});
    const upload=fetcher.mock.calls[2]![1];
    expect(upload).toMatchObject({method:'POST',headers:{'Content-Type':'image/png'}});
    // Compare all PNG bytes without recursively matching nearly 1MB as an object.
    expect(Buffer.isBuffer(upload.body)).toBe(true);
    expect((upload.body as Buffer).equals(image)).toBe(true);
    expect(fetcher.mock.calls[3]![1].method).toBe('POST');
  });
  it('reuses an identical menu and does not upload an immutable image twice',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({richmenus:[{...config,name:menuVersion(config,image),richMenuId:id}]}))
      .mockResolvedValueOnce(new Response(image)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({richMenuId:id}));
    expect(await installRichMenu({config,image,accessToken:token,fetcher})).toEqual({richMenuId:id,reused:true});
    expect(fetcher.mock.calls.map(([,i])=>i.method)).toEqual(['GET','GET','POST','GET']);
  });
  it('resumes a created menu whose image upload previously failed',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({richmenus:[{...config,name:menuVersion(config,image),richMenuId:id}]}))
      .mockResolvedValueOnce(json({},404)).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({richMenuId:id}));
    await installRichMenu({config,image,accessToken:token,fetcher});
    const upload=fetcher.mock.calls[2]![1];
    expect(upload).toMatchObject({method:'POST'});
    expect(Buffer.isBuffer(upload.body)).toBe(true);
    expect((upload.body as Buffer).equals(image)).toBe(true);
  });
  it.each([302,400,401,403,429,500])('stops on upload HTTP %i; never activates or exposes server body/token',async(status)=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({richmenus:[]})).mockResolvedValueOnce(json({richMenuId:id}))
      .mockResolvedValueOnce(new Response(`leaked ${token}`,{status,headers:{Location:'https://evil.invalid'}}));
    const error=await installRichMenu({config,image,accessToken:token,fetcher}).catch((e:Error)=>e);
    if(!(error instanceof Error))throw new Error('expected installer to reject');
    expect(error.message).toContain(`HTTP ${status}`);expect(error.message).not.toContain(token);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not propagate a thrown network error that could contain credentials',async()=>{
    const fetcher=vi.fn().mockRejectedValue(new Error(`secret ${token}`));
    await expect(installRichMenu({config,image,accessToken:token,fetcher})).rejects.toThrow('list: network_error');
  });
  it('rejects missing/invalid credentials before any API request',async()=>{
    const fetcher=vi.fn();
    for(const accessToken of [undefined,'','   ','bad\ntoken'])await expect(installRichMenu({config,image,accessToken,fetcher})).rejects.toThrow('LINE_CHANNEL_ACCESS_TOKEN');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects a returned rich menu ID containing an arbitrary path',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(json({richmenus:[]})).mockResolvedValueOnce(json({richMenuId:'../../evil'}));
    await expect(installRichMenu({config,image,accessToken:token,fetcher})).rejects.toThrow('invalid richMenuId');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not activate a matching-name menu with different actions/image',async()=>{
    const existing={...config,name:menuVersion(config,image),richMenuId:id,areas:[]};
    const fetcher=vi.fn().mockResolvedValueOnce(json({richmenus:[existing]}));
    await expect(installRichMenu({config,image,accessToken:token,fetcher})).rejects.toThrow('existing menu differs');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const fetchImage=vi.fn().mockResolvedValueOnce(json({richmenus:[{...config,name:menuVersion(config,image),richMenuId:id}]}))
      .mockResolvedValueOnce(new Response('wrong image'));
    await expect(installRichMenu({config,image,accessToken:token,fetcher:fetchImage})).rejects.toThrow('existing image differs');
    expect(fetchImage).toHaveBeenCalledTimes(2);
  });
  it('fails verification if the read-back default is not the installed ID',async()=>{
    const fetcher=newMenuFetch();fetcher.mockReset();
    fetcher.mockResolvedValueOnce(json({richmenus:[]})).mockResolvedValueOnce(json({richMenuId:id}))
      .mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({})).mockResolvedValueOnce(json({richMenuId:'richmenu-other'}));
    await expect(installRichMenu({config,image,accessToken:token,fetcher})).rejects.toThrow('default verification failed');
  });
});
describe('preflight rejects wrong image/config locally before installing',()=>{
  it('accepts the final asset; image/config changes produce a different version',()=>{
    expect(()=>validateRichMenu(config,image)).not.toThrow();
    expect(menuVersion(config,image)).not.toBe(menuVersion({...config,selected:false},image));
  });
  it.each(['signature','dimensions','size'])('rejects invalid image %s',mode=>{
    const bad=mode==='size'?Buffer.alloc(1_000_001):Buffer.from(image);
    if(mode==='signature')bad[0]=0;if(mode==='dimensions')bad.writeUInt32BE(1200,16);
    expect(()=>validateRichMenu(config,bad)).toThrow();
  });
  it.each(['route','bounds','label','uri','overlap','chatBar'])('rejects wrong config %s',mode=>{
    const bad=structuredClone(config);
    if(mode==='route')bad.areas[0].action.data='made.up';
    if(mode==='bounds')bad.areas[0].bounds.width=3000;
    if(mode==='label')bad.areas[0].action.label='x'.repeat(21);
    if(mode==='uri')bad.areas[3].action={type:'uri',uri:'https://form.invalid'};
    if(mode==='overlap')bad.areas[1].bounds.x=0;
    if(mode==='chatBar')bad.chatBarText='x'.repeat(15);
    expect(()=>validateRichMenu(bad,image)).toThrow();
  });
  it('check command runs without token and does not install; unknown args fail',()=>{
    const env={...process.env,LINE_CHANNEL_ACCESS_TOKEN:''};
    expect(execFileSync(process.execPath,['scripts/install-rich-menu.mjs','--check'],{env,encoding:'utf8'})).toContain('CHECK OK');
    expect(()=>execFileSync(process.execPath,['scripts/install-rich-menu.mjs','--install'],{env,stdio:'pipe'})).toThrow();
    expect(()=>execFileSync(process.execPath,['scripts/install-rich-menu.mjs','--typo'],{env,stdio:'pipe'})).toThrow();
  });
});
