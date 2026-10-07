import { processOutbox } from '../server/aviation/outbox.ts'
console.log(await processOutbox())
