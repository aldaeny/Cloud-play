/** Bounded buffered media only; never proxy arbitrary headers to a provider. */
export function mediaRange(value:unknown,length:number):{start:number;end:number}|null {
 if(value===undefined)return null;
 if(typeof value!=='string'||value.length>100||!/^bytes=(\d*-\d*)$/.test(value)||length<1)throw new Error('INVALID_MEDIA_RANGE');
 const [a,b]=value.slice(6).split('-');if(!a&&!b)throw new Error('INVALID_MEDIA_RANGE');
 const first=a?Number(a):Math.max(0,length-Number(b)),last=b&&a?Math.min(Number(b),length-1):length-1;
 if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<0||first>=length||last<first||(!a&&Number(b)<=0))throw new Error('INVALID_MEDIA_RANGE');
 return {start:first,end:last};
}
