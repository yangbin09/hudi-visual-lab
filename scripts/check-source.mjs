import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
const problems=[]
async function scan(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    const name=path.join(dir,item.name)
    if(item.isDirectory())await scan(name)
    else if(/\.(vue|css|ts)$/.test(name)){
      const source=await readFile(name,'utf8')
      for(const [i,line] of source.split('\n').entries()){
        if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(line)||/\\font-size\s*:/.test(line))problems.push(`${name}:${i+1}: invalid control character or escaped CSS property`)
      }
    }
  }
}
await scan('src')
if(problems.length){console.error(problems.join('\n'));process.exitCode=1}else console.log('Source checks passed (CSS declarations and control characters).')
