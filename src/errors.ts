/** Public-safe errors for API consumers. Never retain submitted values or raw bodies. */
export type ApiFieldError = { path: string; message: string };
export type ApiError = Error & { status?: number; code?: string; issues?: ApiFieldError[] };
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const generic = /^(?:request failed|unknown error|internal server error|validation failed|the provided data is invalid\.?|fetch failed|failed to fetch|network error|an error occurred|something went wrong)[.!]?$/iu;
const technical = /(?:<\/?(?:html|script|body)|\b(?:select .+ from|insert into|postgres(?:error)?|sqlstate|stack trace|node_modules|authorization\s*:|bearer\s+|api[_ -]?key\s*[:=]|password\s*[:=]|secret\s*[:=]|access_token\s*[:=]|https?:\/\/[^\s]+[?][^\s]*(?:token|key|code)=)|\bat .+\([^\n]+:\d+:\d+\))/iu;
const safeText = (value: unknown) => { const s=text(value); return s && s.length<=400 && !generic.test(s) && !technical.test(s) ? s : undefined; };
const statusMessage = (status?: number) => {
 if(status===401) return 'Your session has expired. Sign in again to continue.';
 if(status===403) return 'You do not have permission to do this. Ask an administrator for access.';
 if(status===404) return 'This item could not be found. Refresh the page to check whether it is still available.';
 if(status===409) return 'This item changed or the action conflicts with its current state. Refresh before trying again.';
 if(status===429) return 'Too many requests were made. Wait a moment before trying again.';
 if(status===400 || status===422) return 'Some information could not be accepted. Check the form and try again.';
 if(status===0 || status===408 || (status!==undefined && status>=500)) return 'We could not confirm the result. Check whether it completed before trying again.';
 return 'We could not complete this request. Please try again, or contact support if it continues.';
};
const unwrap = (error: unknown) => record(error) && typeof error.status==='number' && 'value' in error ? error.value : error;
export const apiErrorStatus = (error: unknown): number | undefined => record(error) && typeof error.status==='number' ? error.status : undefined;
const issuePath = (issue: Record<string, unknown>) => {
 const raw=text(issue.path) ?? text(issue.property) ?? text(issue.instancePath) ?? text(issue.fieldName);
 const schema=text(issue.schemaPath);
 const path=raw && raw!=='root' ? raw : schema?.replace(/^#\/?/u,'').split('/').filter((_,i,all)=>all[i-1]==='properties').join('.');
 return path && /^[\w./\[\]-]{1,160}$/u.test(path) ? path.replace(/^\//u,'').replaceAll('/','.') : '';
};
export const apiErrorFields = (error: unknown): ApiFieldError[] => {
 const body=unwrap(error);
 if(!record(body) && !Array.isArray(body)) return [];
 const rows=Array.isArray(body) ? body : body.issues ?? body.errors ?? body.details ?? body.all ?? (body.type === "validation" ? [body] : undefined);
 if(!Array.isArray(rows)) return [];
 return rows.slice(0,20).filter(record).map(issue=>{
  const path=issuePath(issue); const params=record(issue.params)?issue.params:{};
  const raw=text(issue.message)??'';
  let message='Check this value.';
  if(['Enter a valid email address.','Enter a valid number.','Enter a valid date.','This field is required.','Use a shorter value.','Enter a complete value.'].includes(raw)) message=raw;
  else if(params.format==='email' || /email.*format|format.*email/iu.test(raw)) message='Enter a valid email address.';
  else if(params.type==='number'||params.type==='integer'||/must be (?:number|integer)/iu.test(raw)) message='Enter a valid number.';
  else if(params.format==='date') message='Enter a valid date.';
  else if(/required|cannot be empty|must have required/iu.test(raw)) message='This field is required.';
  else if(params.maxLength!==undefined || /too long|fewer than|maximum length/iu.test(raw)) message='Use a shorter value.';
  else if(params.minLength!==undefined || /more than|too short/iu.test(raw)) message='Enter a complete value.';
  return {path,message};
 }).filter(issue=>issue.path.length>0);
};
const fieldLabel=(path:string)=>path.replace(/\.[0-9]+\./gu,'.').replaceAll('_',' ').split('.').join(' · ').replace(/^./u,s=>s.toUpperCase());
export const apiErrorMessage = (error: unknown, fallback?: string): string => {
 const status=apiErrorStatus(error); const body=unwrap(error);
 // Server failures may contain SQL, stack traces, credentials or provider bodies.
 if(status!==undefined && (status>=500 || status===0 || status===408)) return safeText(fallback) ?? statusMessage(status);
 const fields=apiErrorFields(error);
 if(fields.length) return fields.slice(0,3).map(issue=>`${fieldLabel(issue.path)}: ${issue.message}`).join(' ');
 const message=body instanceof Error ? safeText(body.message) : typeof body==='string' ? safeText(body) : record(body) ? safeText(body.publicMessage) ?? safeText(body.message) ?? safeText(body.summary) ?? safeText(body.error) : undefined;
 return message ?? safeText(fallback) ?? statusMessage(status);
};
export const apiError = (error: unknown, fallback?: string): ApiError => {
 const built:ApiError=new Error(apiErrorMessage(error,fallback));
 const status=apiErrorStatus(error); if(status!==undefined) built.status=status;
 const fields=apiErrorFields(error); if(fields.length) built.issues=fields;
 const body=unwrap(error);
 if(record(body) && typeof body.code==='string' && /^[A-Z][A-Z0-9_]{0,79}$/u.test(body.code)) built.code=body.code;
 return built;
};
export const isPaywallError=(error:unknown):boolean=>apiErrorStatus(error)===402;
