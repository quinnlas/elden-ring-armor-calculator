const fs = require('fs').promises
const Papa = require('papaparse')
const _ = require('lodash')

async function main() {
  // LOAD DATA
  const dataFiles = (await fs.readdir('data')).filter(f => f[0] !== '.')
  types = dataFiles.map(f => f.split('.')[0])

  const results = []
  for (const type of types) {
    const fileStr = await fs.readFile(`data/${type}.csv`, 'utf8')
    const parseResult = Papa.parse(fileStr, {
      header: true,
      dynamicTyping: true
    })

    let options = parseResult.data
    
    results.push(...options
      .filter(o => o.Unavailable)
      .map(o => o.Name))
  }
  results.sort().forEach(r => console.log(r))
}
main().catch(console.error)