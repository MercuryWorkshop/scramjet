import { resolve } from 'node:path'

const scramjetPath = resolve(import.meta.dirname, '..', 'dist');

export { scramjetPath }