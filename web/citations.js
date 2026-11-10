// Link both narrative citations (Author et al. (2020)) and parenthetical ones
// (Author et al. 2020) without changing the supplied prose or using HTML input.
export function citationParts(text, references=[]) {
  const parts=[];let cursor=0;
  while(cursor<text.length){
    let next=null;
    for(const reference of references){
      for(const label of new Set([reference.label,reference.label.replace(/\s+\((\d{4})\)$/,' $1')])){
        const index=text.indexOf(label,cursor);
        if(index>=0&&(!next||index<next.index))next={index,label,url:reference.url};
      }
    }
    if(!next){parts.push({text:text.slice(cursor)});break;}
    if(next.index>cursor)parts.push({text:text.slice(cursor,next.index)});
    parts.push({text:next.label,url:next.url});cursor=next.index+next.label.length;
  }
  return parts;
}
