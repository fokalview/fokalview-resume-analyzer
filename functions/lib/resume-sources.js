export const SOURCE_CONSENT_VERSION = 'resume-source-v1';
export const RESUME_DOCUMENT_VERSION = 'sagittaiq-resume-v1';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_DOCUMENT_SIZE = 1024 * 1024;
const encoder = new TextEncoder();
const MIME_BY_EXTENSION = { pdf:'application/pdf', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt:'application/vnd.oasis.opendocument.text', rtf:'application/rtf', txt:'text/plain', md:'text/markdown', csv:'text/csv' };
const META_SELECT = `id, user_id, request_id, source_kind, payload_sha256, original_source_id, file_name, mime_type, file_size, file_sha256, target_role, position_json, opportunity_id, resume_label, extraction_status, warnings_json, created_at, length(resume_text) AS text_length`;

export class ResumeSourceError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function sourceJson(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } });
}
export function sourceFailure(error) {
  return sourceJson({ error: error instanceof ResumeSourceError ? error.message : 'Resume storage is unavailable. Your existing copies are preserved. Please retry.' }, error instanceof ResumeSourceError ? error.status : 503);
}
export function requireSourceDb(env) {
  if (!env.DB) throw new ResumeSourceError('Resume storage is unavailable. Please retry.',503);
}
export async function readLimitedBody(request, maxBytes) {
  const declared = request.headers.get('Content-Length');
  if (declared && Number(declared) > maxBytes) throw new ResumeSourceError('This resume submission is too large.',413);
  const reader = request.body?.getReader();
  if (!reader) throw new ResumeSourceError('Send a resume submission.');
  const chunks=[]; let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read(); if(done) break;
      size += value.byteLength;
      if(size>maxBytes) { await reader.cancel(); throw new ResumeSourceError('This resume submission is too large.',413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
  return bytes;
}
export async function readSourceJson(request) {
  const bytes=await readLimitedBody(request,2*1024*1024);
  try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  catch { throw new ResumeSourceError('Send valid UTF-8 JSON.'); }
}
function field(value,name,max,{required=false}={}) {
  if(value===undefined || value===null) value='';
  if(typeof value!=='string' || value.length>max || (required&&!value.trim())) throw new ResumeSourceError(`${name} must be ${required?'nonempty ':''}text of at most ${max} characters.`);
  return value;
}
function plain(value) { return value && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value)); }
function validateJson(value,maxBytes,maxDepth=16,maxEntries=100000) {
  const pending=[{value,depth:0}]; const seen=new Set(); let count=0;
  while(pending.length) {
    const item=pending.pop(); if(++count>maxEntries || item.depth>maxDepth) throw new ResumeSourceError('Resume details are too complex.');
    const v=item.value;
    if(v===null || typeof v==='string' || typeof v==='boolean' || (typeof v==='number'&&Number.isFinite(v))) continue;
    if(typeof v!=='object' || seen.has(v) || (!Array.isArray(v)&&!plain(v))) throw new ResumeSourceError('Resume details must contain finite JSON values.');
    seen.add(v);
    for(const [key,child] of Object.entries(v)) {
      if(['__proto__','prototype','constructor'].includes(key)) throw new ResumeSourceError('Resume details contain an invalid field.');
      pending.push({value:child,depth:item.depth+1});
    }
  }
  const json=JSON.stringify(value);
  if(encoder.encode(json).byteLength>maxBytes) throw new ResumeSourceError('Resume layout details exceed the supported size.',413);
  return json;
}
function stableJson(value) {
  if(Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if(plain(value)) return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function sourceHash(value) {
  const bytes=typeof value==='string'?encoder.encode(value):value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
function requestId(value) { const id=field(value,'requestId',100,{required:true}); if(!/^[A-Za-z0-9._:-]+$/.test(id)) throw new ResumeSourceError('Use a valid resume request identifier.'); return id; }
function sourceConsent(body,legacy=false) {
  if(!legacy && (body.consent!==true || body.consentVersion!==SOURCE_CONSENT_VERSION)) throw new ResumeSourceError('Confirm the current resume-storage notice before saving.');
}
export function validateResumeDocument(document,resumeText) {
  if(!plain(document)) throw new ResumeSourceError('Send a structured resume document.');
  const documentJson=validateJson(document,MAX_DOCUMENT_SIZE);
  if(document.schemaVersion!==RESUME_DOCUMENT_VERSION) throw new ResumeSourceError('This resume document version is not supported.');
  if(field(document.text,'Document text',50000)!==resumeText) throw new ResumeSourceError('Resume text and layout document must describe the same saved version.');
  if(!plain(document.source) || !['ready','needs_text'].includes(document.source.status)) throw new ResumeSourceError('Send valid extraction information.');
  const source=document.source;
  if(!['pasted','text',...Object.keys(MIME_BY_EXTENSION)].includes(source.format) || !Number.isInteger(source.size) || source.size<0 || source.size>MAX_FILE_SIZE) throw new ResumeSourceError('Resume extraction source information is invalid.');
  field(source.fileName,'Source file name',240);
  field(source.mimeType,'Source media type',160,{required:true});
  field(source.extractor,'Source extractor',120,{required:true});
  field(source.extractorVersion,'Source extractor version',80,{required:true});
  if(typeof source.extractedAt!=='string'||source.extractedAt.length>40||!Number.isFinite(Date.parse(source.extractedAt))) throw new ResumeSourceError('Send a valid extraction timestamp.');
  if(typeof source.sha256!=='string'||!(source.format==='pasted'&&source.sha256==='')&&!/^[a-f0-9]{64}$/.test(source.sha256)) throw new ResumeSourceError('Send a valid source SHA-256 digest.');
  const warnings=document.source.warnings;
  if(!Array.isArray(warnings) || warnings.length>100 || warnings.some(w=>typeof w!=='string'||w.length>1000)) throw new ResumeSourceError('Send valid extraction warnings.');
  if(!Array.isArray(document.pages)||document.pages.length>100||!Array.isArray(document.blocks)||document.blocks.length>5000) throw new ResumeSourceError('A resume can contain at most 100 pages and 5,000 text blocks.');
  const pages=new Set();
  for(const page of document.pages) {
    if(!plain(page)||!Number.isInteger(page.page)||page.page<1||page.page>100||pages.has(page.page)||page.coordinateSystem!=='normalized-top-left'||!Number.isFinite(page.width)||page.width<=0||!Number.isFinite(page.height)||page.height<=0||!Number.isFinite(page.rotation)) throw new ResumeSourceError('Resume page geometry is invalid.');
    pages.add(page.page);
  }
  const ids=new Set(),runIds=new Set();let runCount=0;
  for(const block of document.blocks) {
    if(!plain(block)||typeof block.id!=='string'||!block.id||block.id.length>160||ids.has(block.id)||typeof block.text!=='string'||block.text.length>50000||!Number.isInteger(block.readingOrder)||block.readingOrder<0) throw new ResumeSourceError('Resume text blocks require unique identifiers and a valid reading order.');
    ids.add(block.id);
    if(block.page!==null && !pages.has(block.page)) throw new ResumeSourceError('A resume block references an unknown page.');
    if(block.geometry!==null) {
      const box=block.geometry;
      if(block.page===null||!plain(box)||['x','y','width','height'].some(k=>!Number.isFinite(box[k])||box[k]<0||box[k]>1)||box.x+box.width>1.000001||box.y+box.height>1.000001) throw new ResumeSourceError('Resume block geometry must be within its page.');
    }
    if(block.rawTransform!==undefined&&(!Array.isArray(block.rawTransform)||block.rawTransform.length!==6||block.rawTransform.some(v=>!Number.isFinite(v)))) throw new ResumeSourceError('Resume text transforms must contain six finite values.');
    if(block.fontSize!==undefined&&(!Number.isFinite(block.fontSize)||block.fontSize<0)) throw new ResumeSourceError('Resume font size must be finite.');
    for(const key of ['fontName','direction','sourcePath'])if(block[key]!==undefined)field(block[key],`Block ${key}`,1000);
    if(block.hasEOL!==undefined&&typeof block.hasEOL!=='boolean')throw new ResumeSourceError('Resume line endings must be boolean.');
    if(block.runs!==undefined) {
      if(!Array.isArray(block.runs)||(runCount+=block.runs.length)>5000)throw new ResumeSourceError('A resume can contain at most 5,000 nested text runs.');
      for(const run of block.runs) {
        if(!plain(run)||typeof run.id!=='string'||!run.id||run.id.length>160||runIds.has(run.id)||typeof run.text!=='string'||run.text.length>50000)throw new ResumeSourceError('Resume text runs require unique identifiers and valid text.');
        runIds.add(run.id);field(run.sourcePath,'Run source path',1000,{required:true});
        if(run.fontName!==undefined)field(run.fontName,'Run font name',1000);
        if(run.fontSize!==undefined&&(!Number.isFinite(run.fontSize)||run.fontSize<0))throw new ResumeSourceError('Resume run font size must be finite.');
        for(const key of ['bold','italic'])if(run[key]!==undefined&&typeof run[key]!=='boolean')throw new ResumeSourceError('Resume run formatting must be boolean.');
      }
    }
  }
  return documentJson;
}
function metadata(row,admin=false) {
  const value={id:row.id,sourceKind:row.source_kind,originalSourceId:row.original_source_id||null,fileName:row.file_name,mimeType:row.mime_type,fileSize:row.file_size,sha256:row.source_kind==='original'?row.file_sha256:row.payload_sha256,fileSha256:row.file_sha256||null,targetRole:row.target_role,position:JSON.parse(row.position_json),opportunityId:row.opportunity_id||null,resumeLabel:row.resume_label,extractionStatus:row.extraction_status,warnings:JSON.parse(row.warnings_json),hasText:Boolean(row.text_length??row.resume_text?.length),hasOriginal:row.source_kind==='original'||Boolean(row.original_source_id),savedAt:row.created_at,createdAt:row.created_at};
  if(admin) value.userId=row.user_id;
  return value;
}
async function existingRequest(env,userId,id,hash) {
  const existing=await env.DB.prepare(`SELECT ${META_SELECT} FROM resume_sources WHERE user_id=? AND request_id=?`).bind(userId,id).first();
  if(existing&&existing.payload_sha256!==hash) throw new ResumeSourceError('This save request already belongs to different resume content. Start a new version.',409);
  return existing;
}
export async function requireOwnedSource(env,userId,id,{kind}={}) {
  requireSourceDb(env);
  const source=await env.DB.prepare('SELECT * FROM resume_sources WHERE id=? AND user_id=?').bind(field(id,'Source id',100,{required:true}),userId).first();
  if(!source || (kind&&source.source_kind!==kind)) throw new ResumeSourceError('Resume source not found.',404);
  return source;
}
async function validateOpportunity(env,userId,id) {
  if(!id) return;
  const owned=await env.DB.prepare('SELECT id FROM application_captures WHERE id=? AND user_id=?').bind(id,userId).first();
  if(!owned) throw new ResumeSourceError('Saved opportunity not found.',404);
}
export async function saveOriginal(request,env,identity) {
  requireSourceDb(env);
  if(!env.RESUME_FILES) throw new ResumeSourceError('Original-file storage is not available yet. Please retry; this file has not been marked saved.',503);
  const type=request.headers.get('Content-Type')||'';
  const bytes=await readLimitedBody(request,MAX_FILE_SIZE+65536);
  let form; try { form=await new Response(bytes,{headers:{'Content-Type':type}}).formData(); } catch { throw new ResumeSourceError('Send a valid resume file upload.'); }
  sourceConsent({consent:form.get('consent')==='true',consentVersion:form.get('consentVersion')});
  const id=requestId(form.get('requestId')); const file=form.get('file');
  if(!file||typeof file==='string'||typeof file.arrayBuffer!=='function'||!file.size) throw new ResumeSourceError('Choose a nonempty resume file.');
  if(file.size>MAX_FILE_SIZE) throw new ResumeSourceError('Resume files must be 10 MiB or smaller.',413);
  const fileName=field(file.name,'File name',240,{required:true});
  const ext=fileName.split('.').at(-1).toLowerCase(); const mimeType=MIME_BY_EXTENSION[ext];
  if(!mimeType) throw new ResumeSourceError('Upload PDF, DOCX, ODT, RTF, TXT, MD or CSV.',415);
  const suppliedType=(file.type||'').toLowerCase();
  const aliases={rtf:['text/rtf'],md:['text/plain','text/x-markdown'],csv:['text/plain','application/vnd.ms-excel'],docx:['application/zip'],odt:['application/zip']};
  if(suppliedType && suppliedType!=='application/octet-stream' && suppliedType!==mimeType && !aliases[ext]?.includes(suppliedType)) throw new ResumeSourceError('The file type does not match its extension.',415);
  const content=new Uint8Array(await file.arrayBuffer());
  const header=new TextDecoder().decode(content.slice(0,1024));
  if((ext==='pdf'&&!header.includes('%PDF-'))||(['docx','odt'].includes(ext)&&!(content[0]===80&&content[1]===75&&content[2]===3&&content[3]===4))||(ext==='rtf'&&!header.trimStart().startsWith('{\\rtf'))) throw new ResumeSourceError('The file contents do not match the selected document type.',415);
  const fileHash=await sourceHash(content);
  const payloadHash=await sourceHash(stableJson({sourceKind:'original',fileName,mimeType,fileSize:file.size,fileHash}));
  const prior=await existingRequest(env,identity.userId,id,payloadHash); if(prior) return {record:metadata(prior),reused:true};
  const sourceId=crypto.randomUUID(); const objectKey=`resume-originals/${sourceId}/${fileHash}`; const now=new Date().toISOString();
  const object=await env.RESUME_FILES.put(objectKey,content,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:fileHash}});
  if(!object) throw new ResumeSourceError('The original resume could not be saved. Please retry.',503);
  try {
    await env.DB.prepare(`INSERT INTO resume_sources (id,user_id,request_id,source_kind,payload_sha256,object_key,file_name,mime_type,file_size,file_sha256,extraction_status,consent_version,created_at) VALUES (?,?,?,'original',?,?,?,?,?,?,'original_only',?,?)`).bind(sourceId,identity.userId,id,payloadHash,objectKey,fileName,mimeType,file.size,fileHash,SOURCE_CONSENT_VERSION,now).run();
  } catch(error) {
    // This request owns this random key. Never remove an existing retained copy.
    const referenced=await env.DB.prepare('SELECT id FROM resume_sources WHERE object_key=?').bind(objectKey).first().catch(()=>({id:'unknown'}));
    if(!referenced) await env.RESUME_FILES.delete(objectKey).catch(()=>{});
    const winner=await existingRequest(env,identity.userId,id,payloadHash); if(winner) return {record:metadata(winner),reused:true};
    throw error;
  }
  const saved=await requireOwnedSource(env,identity.userId,sourceId);
  return {record:{...metadata(saved),fileSha256:fileHash},reused:false};
}
export async function saveSnapshot(body,env,identity,{legacy=false}={}) {
  requireSourceDb(env); if(!plain(body)) throw new ResumeSourceError('Send a resume snapshot.');
  sourceConsent(body,legacy);
  const id=requestId(body.requestId);
  const resumeText=field(body.resumeText,'Resume text',50000);
  const documentJson=validateResumeDocument(body.resumeDocument,resumeText);
  const targetRole=field(body.targetRole,'Target role',180); const jobContext=field(body.jobContext,'Job context',30000);
  const position=body.position??{}; if(!plain(position)) throw new ResumeSourceError('Position details must be an object.'); const positionJson=validateJson(position,65536,10,4000);
  const originalSourceId=field(body.originalSourceId,'Original source id',100);
  const opportunityId=field(body.opportunityId,'Opportunity id',100); await validateOpportunity(env,identity.userId,opportunityId);
  const original=originalSourceId?await requireOwnedSource(env,identity.userId,originalSourceId,{kind:'original'}):null;
  if(original && !['pasted','text'].includes(body.resumeDocument.source.format)) {
    const source=body.resumeDocument.source;
    if(source.sha256!==original.file_sha256 || source.size!==original.file_size || source.fileName!==original.file_name)throw new ResumeSourceError('The extracted document does not match its retained original. Save the matching original first.',409);
  }
  if(!resumeText.trim()&&!original) throw new ResumeSourceError('Add resume text or an uploaded original.');
  const resumeLabel=field(body.resumeLabel,'Resume label',180)||original?.file_name||'Saved resume';
  const payloadHash=await sourceHash(stableJson({sourceKind:'snapshot',originalSourceId,resumeDocument:body.resumeDocument,resumeText,targetRole,jobContext,position,opportunityId,resumeLabel}));
  const prior=await existingRequest(env,identity.userId,id,payloadHash); if(prior) return {record:metadata(prior),reused:true};
  const sourceId=crypto.randomUUID(),now=new Date().toISOString();
  try {
    await env.DB.prepare(`INSERT INTO resume_sources (id,user_id,request_id,source_kind,payload_sha256,original_source_id,file_name,mime_type,file_size,file_sha256,resume_text,document_json,target_role,job_context,position_json,opportunity_id,resume_label,extraction_status,warnings_json,consent_version,created_at) VALUES (?,?,?,'snapshot',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(sourceId,identity.userId,id,payloadHash,originalSourceId||null,original?.file_name||'',original?.mime_type||'',original?.file_size||0,original?.file_sha256||'',resumeText,documentJson,targetRole,jobContext,positionJson,opportunityId||null,resumeLabel,body.resumeDocument.source.status,JSON.stringify(body.resumeDocument.source.warnings),legacy?'workforce-resume-profile-v1':SOURCE_CONSENT_VERSION,now).run();
  } catch(error) { const winner=await existingRequest(env,identity.userId,id,payloadHash); if(winner)return {record:metadata(winner),reused:true};throw error; }
  return {record:metadata(await requireOwnedSource(env,identity.userId,sourceId)),reused:false};
}
export async function legacyAnalysisSource(body,env,identity) {
  const resumeText=field(body.resumeText,'Resume text',50000,{required:true});
  const targetRole=field(body.targetRole,'Target role',180);const jobContext=field(body.jobContext,'Job context',30000);
  const id=body.requestId?requestId(body.requestId):`legacy-${crypto.randomUUID()}`;
  if(body.requestId) {
    const prior=await env.DB.prepare('SELECT * FROM resume_sources WHERE user_id=? AND request_id=?').bind(identity.userId,id).first();
    if(prior) {
      if(prior.source_kind!=='snapshot'||prior.resume_text!==resumeText||prior.target_role!==targetRole||prior.job_context!==jobContext)throw new ResumeSourceError('This save request already belongs to different resume content. Start a new version.',409);
      return prior;
    }
  }
  const resumeDocument={schemaVersion:RESUME_DOCUMENT_VERSION,text:resumeText,source:{format:'text',fileName:'',mimeType:'text/plain',size:encoder.encode(resumeText).byteLength,sha256:await sourceHash(resumeText),extractor:'legacy-review-input',extractorVersion:'1',extractedAt:new Date().toISOString(),status:'ready',warnings:['Legacy review input retained as text; original file and layout were not supplied.']},pages:[],blocks:[{id:'text-1',page:null,text:resumeText,readingOrder:0,geometry:null}]};
  const saved=await saveSnapshot({requestId:id,resumeDocument,resumeText,targetRole,jobContext,position:{},resumeLabel:'Saved review input'},env,identity,{legacy:true});
  return requireOwnedSource(env,identity.userId,saved.record.id,{kind:'snapshot'});
}
export async function listSources(request,env,userId,{admin=false}={}) {
  requireSourceDb(env);const params=new URL(request.url).searchParams;
  const limit=Number(params.get('limit')||50);if(!Number.isInteger(limit)||limit<1||limit>100)throw new ResumeSourceError('Choose a page size between 1 and 100.');
  const conditions=[],values=[];if(!admin){conditions.push('user_id=?');values.push(userId);}else if(params.has('userId')){conditions.push('user_id=?');values.push(field(params.get('userId'),'User id',100,{required:true}));}
  const opportunityId=field(params.get('opportunityId'),'Opportunity id',100);if(opportunityId){if(!admin)await validateOpportunity(env,userId,opportunityId);conditions.push('opportunity_id=?');values.push(opportunityId);}
  if(params.has('cursor')){let cursor;try{cursor=JSON.parse(atob(params.get('cursor')));}catch{throw new ResumeSourceError('Invalid resume page cursor.');}if(!plain(cursor)||typeof cursor.createdAt!=='string'||cursor.createdAt.length>40||typeof cursor.id!=='string'||cursor.id.length>100)throw new ResumeSourceError('Invalid resume page cursor.');conditions.push('(created_at<? OR (created_at=? AND id<?))');values.push(cursor.createdAt,cursor.createdAt,cursor.id);}
  const rows=(await env.DB.prepare(`SELECT ${META_SELECT} FROM resume_sources ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...values,limit+1).all()).results||[];
  const displayed=rows.slice(0,limit);const last=displayed.at(-1);
  return {records:displayed.map(row=>metadata(row,admin)),nextCursor:rows.length>limit?btoa(JSON.stringify({createdAt:last.created_at,id:last.id})):null};
}
function attachment(name,type) {
  let safe=name.replace(/[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069<>:"\\/|?*]/g,'_').replace(/^[. ]+|[. ]+$/g,'')||'resume';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe))safe=`resume_${safe}`;
  const extension=safe.match(/\.[a-z0-9]{1,10}$/i)?.[0]||'';
  const stem=extension?safe.slice(0,-extension.length):safe;
  const clean=Array.from(stem).slice(0,180-extension.length).join('')+extension;
  const encoded=encodeURIComponent(clean.toWellFormed()).replace(/[!'()*]/g,char=>`%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return {'Content-Type':type,'Content-Disposition':`attachment; filename="${clean.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encoded}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
}
export async function downloadSource(request,env,userId,{admin=false}={}) {
  requireSourceDb(env);const params=new URL(request.url).searchParams,id=field(params.get('id'),'Source id',100,{required:true});
  const row=admin?await env.DB.prepare('SELECT * FROM resume_sources WHERE id=?').bind(id).first():await requireOwnedSource(env,userId,id);
  if(!row)throw new ResumeSourceError('Resume source not found.',404);
  const format=params.get('format')||'json';if(!['json','text','original'].includes(format))throw new ResumeSourceError('Choose JSON, text or original format.');
  if(format==='original') {
    if(row.source_kind!=='original'&&!row.original_source_id)throw new ResumeSourceError('No original file was supplied for this text resume.',404);
    const original=row.source_kind==='original'?row:await requireOwnedSource(env,row.user_id,row.original_source_id,{kind:'original'});
    if(!env.RESUME_FILES)throw new ResumeSourceError('Original-file storage is unavailable.',503);
    const object=await env.RESUME_FILES.get(original.object_key);if(!object?.body)throw new ResumeSourceError('The retained original is temporarily unavailable. Please retry.',503);
    return new Response(object.body,{headers:attachment(original.file_name,original.mime_type||'application/octet-stream')});
  }
  if(format==='text') {
    if(!row.resume_text)throw new ResumeSourceError('This original has no extracted text yet. Download its original file.',404);
    return new Response(row.resume_text,{headers:attachment(`${row.resume_label||'resume'}.txt`,'text/plain; charset=utf-8')});
  }
  const envelope={schemaVersion:'sagittaiq-resume-archive-v1',...metadata(row,admin),resumeDocument:JSON.parse(row.document_json),resumeText:row.resume_text,targetRole:row.target_role,jobContext:row.job_context,position:JSON.parse(row.position_json),consentVersion:row.consent_version,provenance:{document:'Client-supplied extraction; original bytes retained separately when available',payloadSha256:row.payload_sha256}};
  return new Response(JSON.stringify(envelope,null,2),{headers:attachment(`${row.resume_label||row.file_name||'resume'}.json`,'application/json; charset=utf-8')});
}
export async function authorizeSourceAdmin(request,env) {
  const secrets=[env.ADMIN_ACCESS_CODE,env.OWNER_ACCESS_CODE].filter(v=>typeof v==='string'&&v);
  if(!secrets.length)throw new ResumeSourceError('Admin access is not configured.',503);
  const supplied=request.headers.get('X-Admin-Access-Code')||'';
  const digest=await sourceHash(supplied);let matched=0;
  for(const secret of secrets) {const expected=await sourceHash(secret);let difference=0;for(let i=0;i<64;i++)difference|=digest.charCodeAt(i)^expected.charCodeAt(i);matched|=Number(difference===0);}
  if(!supplied||!matched)throw new ResumeSourceError('Invalid admin access code.',401);
}
