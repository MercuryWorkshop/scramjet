const fs = require('licia/fs')
const promisify = require('licia/promisify')
const mkdir = promisify(require('licia/mkdir'))
const path = require('path')

async function copyDefinition() {
  const data = await fs.readFile(path.resolve(__dirname, '../src/index.d.ts'))
  const dist = path.resolve(__dirname, '../dist')
  if (!(await fs.exists(dist))) {
    await mkdir(dist)
  }
  await fs.writeFile(path.resolve(dist, 'chobitsu.d.ts'), data)
}

copyDefinition()
