// One-time: generate a VAPID key pair for web push.
// Run via `node scripts/generate-vapid.mjs`.
// Add the printed values to your Vercel project's environment variables.

import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID keys generated ===\n');
console.log('Add these as environment variables in Vercel:');
console.log('(Project Settings -> Environment Variables)\n');
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY =');
console.log(keys.publicKey);
console.log('\nVAPID_PRIVATE_KEY =');
console.log(keys.privateKey);
console.log('\nVAPID_SUBJECT = mailto:your-email@example.com');
console.log('  (use a real address — used by push services for abuse contact)\n');
console.log('After setting all three env vars, redeploy.');
console.log('Then connect Vercel KV in Storage tab — KV_REST_API_URL +');
console.log('KV_REST_API_TOKEN will be auto-injected.\n');
